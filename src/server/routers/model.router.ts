import { z } from 'zod';

import { env } from '~/env/server.mjs';
import { BrowsingMode } from '~/server/common/enums';
import {
  changeModelModifierHandler,
  declineReviewHandler,
  deleteModelHandler,
  findResourcesToAssociateHandler,
  getAssociatedResourcesCardDataHandler,
  getDownloadCommandHandler,
  getModelByHashesHandler,
  getModelDetailsForReviewHandler,
  getModelGallerySettingsHandler,
  getModelHandler,
  getModelReportDetailsHandler,
  getModelsInfiniteHandler,
  getModelsPagedSimpleHandler,
  getModelsWithVersionsHandler,
  getModelTemplateFieldsHandler,
  getModelTemplateFromBountyHandler,
  getModelVersionsHandler,
  getModelWithVersionsHandler,
  getMyDraftModelsHandler,
  getMyTrainingModelsHandler,
  getSimpleModelsInfiniteHandler,
  publishModelHandler,
  reorderModelVersionsHandler,
  requestReviewHandler,
  restoreModelHandler,
  toggleModelLockHandler,
  unpublishModelHandler,
  updateGallerySettingsHandler,
  upsertModelHandler,
} from '~/server/controllers/model.controller';
import { dbRead } from '~/server/db/client';
import { cacheIt, edgeCacheIt } from '~/server/middleware.trpc';
import { getAllQuerySchema, getByIdSchema } from '~/server/schema/base.schema';
import {
  changeModelModifierSchema,
  declineReviewSchema,
  deleteModelSchema,
  findResourcesToAssociateSchema,
  GetAllModelsOutput,
  getAllModelsSchema,
  getAssociatedResourcesSchema,
  getDownloadSchema,
  getModelsByCategorySchema,
  getModelsWithCategoriesSchema,
  getModelVersionsSchema,
  modelByHashesInput,
  ModelInput,
  modelUpsertSchema,
  publishModelSchema,
  reorderModelVersionsSchema,
  setAssociatedResourcesSchema,
  setModelsCategorySchema,
  toggleModelLockSchema,
  unpublishModelSchema,
  getSimpleModelsInfiniteSchema,
  updateGallerySettingsSchema,
} from '~/server/schema/model.schema';
import {
  getAllModelsWithCategories,
  getAssociatedResourcesSimple,
  getModelsByCategory,
  getSimpleModelWithVersions,
  rescanModel,
  setAssociatedResources,
  setModelsCategory,
} from '~/server/services/model.service';
import { getAllHiddenForUser, getHiddenTagsForUser } from '~/server/services/user-cache.service';
import {
  guardedProcedure,
  middleware,
  moderatorProcedure,
  protectedProcedure,
  publicProcedure,
  router,
} from '~/server/trpc';
import { throwAuthorizationError, throwBadRequestError } from '~/server/utils/errorHandling';
import { prepareFile } from '~/utils/file-helpers';
import { checkFileExists, getS3Client } from '~/utils/s3-utils';

const isOwnerOrModerator = middleware(async ({ ctx, next, input = {} }) => {
  if (!ctx.user) throw throwAuthorizationError();

  const { id } = input as { id: number };

  const userId = ctx.user.id;
  const isModerator = ctx?.user?.isModerator;
  if (!isModerator && !!id) {
    const ownerId = (await dbRead.model.findUnique({ where: { id }, select: { userId: true } }))
      ?.userId;
    if (ownerId !== userId) throw throwAuthorizationError();
  }

  return next({
    ctx: {
      // infers the `user` as non-nullable
      user: ctx.user,
    },
  });
});

const checkFilesExistence = middleware(async ({ input, ctx, next }) => {
  if (!ctx.user) throw throwAuthorizationError();

  const { modelVersions } = input as ModelInput;
  const files = modelVersions.flatMap(({ files }) => files?.map(prepareFile) ?? []);
  const s3 = getS3Client();

  for (const file of files) {
    if (!file.url || !file.url.includes(env.S3_UPLOAD_BUCKET)) continue;
    const fileExists = await checkFileExists(file.url, s3);
    if (!fileExists)
      throw throwBadRequestError(`File ${file.name} could not be found. Please re-upload.`, {
        file,
      });
  }

  return next({
    ctx: { user: ctx.user },
  });
});

const applyUserPreferences = middleware(async ({ input, ctx, next }) => {
  const _input = input as GetAllModelsOutput;
  _input.browsingMode ??= ctx.browsingMode;
  if (_input.browsingMode !== BrowsingMode.All) {
    const hidden = await getAllHiddenForUser({ userId: ctx.user?.id });
    _input.excludedImageTagIds = [
      ...hidden.tags.moderatedTags,
      ...hidden.tags.hiddenTags,
      ...(_input.excludedImageTagIds ?? []),
    ];
    _input.excludedTagIds = [...hidden.tags.hiddenTags, ...(_input.excludedTagIds ?? [])];
    _input.excludedIds = [...hidden.models, ...(_input.excludedIds ?? [])];
    _input.excludedUserIds = [...hidden.users, ...(_input.excludedUserIds ?? [])];
    _input.excludedImageIds = [...hidden.images, ...(_input.excludedImageIds ?? [])];
    if (_input.browsingMode === BrowsingMode.SFW) {
      const systemHidden = await getHiddenTagsForUser({ userId: -1 });
      _input.excludedImageTagIds = [
        ...systemHidden.moderatedTags,
        ...systemHidden.hiddenTags,
        ...(_input.excludedImageTagIds ?? []),
      ];
      _input.excludedTagIds = [...systemHidden.hiddenTags, ...(_input.excludedTagIds ?? [])];
    }
  }

  return next({
    ctx: { user: ctx.user },
  });
});

const skipEdgeCache = middleware(async ({ input, ctx, next }) => {
  const _input = input as GetAllModelsOutput;

  return next({
    ctx: { user: ctx.user, cache: { ...ctx.cache, skip: _input.favorites || _input.hidden } },
  });
});

export const modelRouter = router({
  getById: publicProcedure.input(getByIdSchema).query(getModelHandler),
  getAll: publicProcedure
    .input(getAllModelsSchema.extend({ page: z.never().optional() }))
    // .use(applyUserPreferences)
    .use(skipEdgeCache)
    .use(edgeCacheIt({ ttl: 60, tags: () => ['models'] }))
    .query(getModelsInfiniteHandler),
  getAllPagedSimple: publicProcedure
    .input(getAllModelsSchema)
    .use(cacheIt({ ttl: 60 }))
    .query(getModelsPagedSimpleHandler),
  getAllInfiniteSimple: guardedProcedure
    .input(getSimpleModelsInfiniteSchema)
    .query(getSimpleModelsInfiniteHandler),
  getAllWithVersions: publicProcedure
    .input(getAllModelsSchema.extend({ cursor: z.never().optional() }))
    .use(applyUserPreferences)
    .query(getModelsWithVersionsHandler),
  getByIdWithVersions: publicProcedure.input(getByIdSchema).query(getModelWithVersionsHandler),
  getVersions: publicProcedure.input(getModelVersionsSchema).query(getModelVersionsHandler),
  getMyDraftModels: protectedProcedure.input(getAllQuerySchema).query(getMyDraftModelsHandler),
  getMyTrainingModels: protectedProcedure
    .input(getAllQuerySchema)
    .query(getMyTrainingModelsHandler),
  upsert: guardedProcedure.input(modelUpsertSchema).mutation(upsertModelHandler),
  delete: protectedProcedure
    .input(deleteModelSchema)
    .use(isOwnerOrModerator)
    .mutation(deleteModelHandler),
  publish: guardedProcedure
    .input(publishModelSchema)
    .use(isOwnerOrModerator)
    .mutation(publishModelHandler),
  unpublish: protectedProcedure
    .input(unpublishModelSchema)
    .use(isOwnerOrModerator)
    .mutation(unpublishModelHandler),
  // TODO - TEMP HACK for reporting modal
  getModelReportDetails: publicProcedure.input(getByIdSchema).query(getModelReportDetailsHandler),
  getModelDetailsForReview: publicProcedure
    .input(getByIdSchema)
    .query(getModelDetailsForReviewHandler),
  restore: protectedProcedure.input(getByIdSchema).mutation(restoreModelHandler),
  getDownloadCommand: protectedProcedure.input(getDownloadSchema).query(getDownloadCommandHandler),
  reorderVersions: protectedProcedure
    .input(reorderModelVersionsSchema)
    .use(isOwnerOrModerator)
    .mutation(reorderModelVersionsHandler),
  toggleLock: protectedProcedure
    .input(toggleModelLockSchema)
    .use(isOwnerOrModerator)
    .mutation(toggleModelLockHandler),
  getSimple: publicProcedure
    .input(getByIdSchema)
    .query(({ input, ctx }) => getSimpleModelWithVersions({ id: input.id, ctx })),
  requestReview: protectedProcedure
    .input(getByIdSchema)
    .use(isOwnerOrModerator)
    .mutation(requestReviewHandler),
  declineReview: protectedProcedure.input(declineReviewSchema).mutation(declineReviewHandler),
  changeMode: protectedProcedure
    .input(changeModelModifierSchema)
    .use(isOwnerOrModerator)
    .mutation(changeModelModifierHandler),
  getByCategory: publicProcedure
    .input(getModelsByCategorySchema)
    .use(applyUserPreferences)
    .use(cacheIt())
    .query(({ input, ctx }) => getModelsByCategory({ ...input, user: ctx.user })),
  getWithCategoriesSimple: publicProcedure
    .input(getModelsWithCategoriesSchema)
    .query(({ input }) => getAllModelsWithCategories(input)),
  setCategory: protectedProcedure
    .input(setModelsCategorySchema)
    .mutation(({ input, ctx }) => setModelsCategory({ ...input, userId: ctx.user?.id })),
  findResourcesToAssociate: protectedProcedure
    .input(findResourcesToAssociateSchema)
    .query(findResourcesToAssociateHandler),
  getAssociatedResourcesCardData: publicProcedure
    .input(getAssociatedResourcesSchema)
    .use(applyUserPreferences)
    .query(getAssociatedResourcesCardDataHandler),
  getAssociatedResourcesSimple: publicProcedure
    .input(getAssociatedResourcesSchema)
    .query(({ input }) => getAssociatedResourcesSimple(input)),
  setAssociatedResources: guardedProcedure
    .input(setAssociatedResourcesSchema)
    .mutation(({ input, ctx }) => setAssociatedResources(input, ctx.user)),
  rescan: moderatorProcedure.input(getByIdSchema).mutation(({ input }) => rescanModel(input)),
  getModelsByHash: publicProcedure.input(modelByHashesInput).mutation(getModelByHashesHandler),
  getTemplateFields: guardedProcedure.input(getByIdSchema).query(getModelTemplateFieldsHandler),
  getModelTemplateFieldsFromBounty: guardedProcedure
    .input(getByIdSchema)
    .query(getModelTemplateFromBountyHandler),
  getGallerySettings: publicProcedure.input(getByIdSchema).query(getModelGallerySettingsHandler),
  updateGallerySettings: guardedProcedure
    .input(updateGallerySettingsSchema)
    .use(isOwnerOrModerator)
    .mutation(updateGallerySettingsHandler),
});

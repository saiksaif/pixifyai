import {
  ImageGenerationProcess,
  MediaType,
  MetricTimeframe,
  NsfwLevel,
  ReviewReactions,
} from '@prisma/client';
import { z } from 'zod';
import { constants } from '~/server/common/constants';
import { periodModeSchema } from '~/server/schema/base.schema';
import { postgresSlugify } from '~/utils/string-helpers';
import { BrowsingMode, ImageSort } from './../common/enums';
import { SearchIndexEntityTypes } from '~/components/Search/parsers/base';
import { zc } from '~/utils/schema-helpers';

const stringToNumber = z.coerce.number().optional();

const undefinedString = z.preprocess((value) => (value ? value : undefined), z.string().optional());

// TODO: update accordingly once new entities follow this pattern
export const ImageEntityType = {
  Bounty: 'Bounty',
  BountyEntry: 'BountyEntry',
  User: 'User',
} as const;
export type ImageEntityType = (typeof ImageEntityType)[keyof typeof ImageEntityType];

export type ComfyMetaSchema = z.infer<typeof comfyMetaSchema>;
export const comfyMetaSchema = z
  .object({
    prompt: z.object({}).passthrough(),
    workflow: z
      .object({
        nodes: z.object({}).passthrough().array().optional(),
      })
      .passthrough(),
  })
  .partial();

export const imageGenerationSchema = z.object({
  prompt: undefinedString,
  negativePrompt: undefinedString,
  cfgScale: stringToNumber,
  steps: stringToNumber,
  sampler: undefinedString,
  seed: stringToNumber,
  'Clip skip': z.coerce.number().optional(),
  clipSkip: z.coerce.number().optional(),
  // resources: z
  //   .object({
  //     name: z.string().optional(),
  //     type: z.string().optional(),
  //     weight: z.number().optional(),
  //     hash: z.string().optional(),
  //   })
  //   .passthrough()
  //   .array()
  //   .optional(),
  hashes: z.record(z.string()).optional(),
  comfy: z.union([z.string().optional(), comfyMetaSchema.optional()]).optional(), // stored as stringified JSON
});

export const imageMetaSchema = imageGenerationSchema.partial().passthrough();

export type FaceDetectionInput = z.infer<typeof faceDetectionSchema>;
export const faceDetectionSchema = z.object({
  age: z.number(),
  emotions: z.array(z.object({ emotion: z.string(), score: z.number() })),
  gender: z.enum(['male', 'female', 'unknown']),
  genderConfidence: z.number().optional().default(0),
  live: z.number(),
  real: z.number(),
});

export type ImageAnalysisInput = z.infer<typeof imageAnalysisSchema>;
export const imageAnalysisSchema = z.object({
  drawing: z.number(),
  hentai: z.number(),
  neutral: z.number(),
  porn: z.number(),
  sexy: z.number(),
  faces: z.array(faceDetectionSchema).optional(),
});

// #region [Image Resource]
export type ImageResourceUpsertInput = z.infer<typeof imageResourceUpsertSchema>;
export const imageResourceUpsertSchema = z.object({
  id: z.number().optional(),
  modelVersionId: z.number().optional(),
  name: z.string().optional(),
  detected: z.boolean().optional(),
});
export const isImageResource = (
  entity: ImageResourceUpsertInput
): entity is Omit<ImageResourceUpsertInput, 'id'> & { id: number } => !!entity.id;
export const isNotImageResource = (
  entity: ImageResourceUpsertInput
): entity is Omit<ImageResourceUpsertInput, 'id'> & { id: undefined } => !entity.id;
// #endregion

export const imageSchema = z.object({
  id: z.number().optional(),
  name: z.string().nullish(),
  url: z
    .string()
    .url()
    .or(z.string().uuid('One of the files did not upload properly, please try again')),
  meta: z.preprocess((value) => {
    if (typeof value !== 'object') return null;
    if (value && !Object.keys(value).length) return null;
    return value;
  }, imageMetaSchema.nullish()),
  hash: z.string().nullish(),
  height: z.number().nullish(),
  width: z.number().nullish(),
  nsfw: z.nativeEnum(NsfwLevel).optional(),
  analysis: imageAnalysisSchema.optional(),
  // tags: z.array(tagSchema).optional(),
  needsReview: z.string().nullish(),
  mimeType: z.string().optional(),
  sizeKB: z.number().optional(),
  postId: z.number().nullish(),
  resources: z.array(imageResourceUpsertSchema).optional(),
  type: z.nativeEnum(MediaType).default(MediaType.image),
  metadata: z.object({}).passthrough().optional(),
});

export const comfylessImageSchema = imageSchema.extend({
  meta: imageGenerationSchema.omit({ comfy: true }).nullish(),
});

export type ImageUploadProps = z.infer<typeof imageSchema>;
export type ImageMetaProps = z.infer<typeof imageMetaSchema> & Record<string, unknown>;

export const imageUpdateSchema = z.object({
  id: z.number(),
  name: z.string().optional(),
  url: z
    .string()
    .url()
    .or(z.string().uuid('One of the files did not upload properly, please try again').optional())
    .optional(),
  nsfw: z.boolean().optional(),
  needsReview: z.string().nullish(),
});
export type ImageUpdateSchema = z.infer<typeof imageUpdateSchema>;

export const imageModerationSchema = z.object({
  ids: z.number().array(),
  nsfw: z.nativeEnum(NsfwLevel).optional(),
  needsReview: z.string().nullish(),
  reviewAction: z.enum(['delete', 'removeName', 'mistake']).optional(),
  reviewType: z.enum(['minor', 'poi', 'reported', 'csam', 'blocked']),
});
export type ImageModerationSchema = z.infer<typeof imageModerationSchema>;

export type GetModelVersionImagesSchema = z.infer<typeof getModelVersionImageSchema>;
export const getModelVersionImageSchema = z.object({
  modelVersionId: z.number(),
});

export type GetReviewImagesSchema = z.infer<typeof getReviewImagesSchema>;
export const getReviewImagesSchema = z.object({
  reviewId: z.number(),
});

export type UpdateImageInput = z.infer<typeof updateImageSchema>;
export const updateImageSchema = z.object({
  id: z.number(),
  meta: z.preprocess((value) => {
    if (typeof value !== 'object') return null;
    if (value && !Object.keys(value).length) return null;
    return value;
  }, imageMetaSchema.nullish()),
  hideMeta: z.boolean().optional(),
  nsfw: z.nativeEnum(NsfwLevel).optional(),
  resources: z.array(imageResourceUpsertSchema).optional(),
});

export type IngestImageInput = z.infer<typeof ingestImageSchema>;
export const ingestImageSchema = z.object({
  id: z.number(),
  url: z.string(),
  type: z.nativeEnum(MediaType).optional(),
  height: z.coerce.number().nullish(),
  width: z.coerce.number().nullish(),
});

// #region [new schemas]
const imageInclude = z.enum([
  'tags',
  'count',
  'cosmetics',
  'report',
  'meta',
  'tagIds',
  'profilePictures',
]);
export type ImageInclude = z.infer<typeof imageInclude>;
export type GetInfiniteImagesInput = z.infer<typeof getInfiniteImagesSchema>;

export const getInfiniteImagesSchema = z
  .object({
    limit: z.number().min(0).max(200).default(100),
    cursor: z.union([z.bigint(), z.number(), z.string()]).optional(),
    skip: z.number().optional(),
    postId: z.number().optional(),
    collectionId: z.number().optional(),
    modelId: z.number().optional(),
    modelVersionId: z.number().optional(),
    imageId: z.number().optional(),
    reviewId: z.number().optional(),
    username: zc.usernameValidationSchema.optional(),
    excludedTagIds: z.array(z.number()).optional(),
    excludedUserIds: z.array(z.number()).optional(),
    prioritizedUserIds: z.array(z.number()).optional(),
    // excludedImageIds: z.array(z.number()).optional(),
    period: z.nativeEnum(MetricTimeframe).default(constants.galleryFilterDefaults.period),
    periodMode: periodModeSchema,
    sort: z.nativeEnum(ImageSort).default(constants.galleryFilterDefaults.sort),
    tags: z.array(z.number()).optional(),
    generation: z.nativeEnum(ImageGenerationProcess).array().optional(),
    withTags: z.boolean().optional(),
    // browsingMode: z.nativeEnum(BrowsingMode).optional(),
    include: z.array(imageInclude).optional().default(['cosmetics']),
    excludeCrossPosts: z.boolean().optional(),
    reactions: z.array(z.nativeEnum(ReviewReactions)).optional(),
    ids: z.array(z.number()).optional(),
    includeBaseModel: z.boolean().optional(),
    types: z.array(z.nativeEnum(MediaType)).optional(),
    withMeta: z.boolean().optional(),
    hidden: z.boolean().optional(),
    followed: z.boolean().optional(),
  })
  .transform((value) => {
    if (value.withTags) {
      if (!value.include) value.include = [];
      value.include.push('tags');
    }
    if (value.withMeta) {
      if (!value.include) value.include = [];
      value.include.push('meta');
    }
    return value;
  });

export type GetImagesByCategoryInput = z.infer<typeof getImagesByCategorySchema>;
export const getImagesByCategorySchema = z.object({
  cursor: z.number().optional(),
  limit: z.number().min(1).max(30).optional(),
  imageLimit: z.number().min(1).max(30).optional(),
  sort: z.nativeEnum(ImageSort).optional(),
  period: z.nativeEnum(MetricTimeframe).optional(),
  periodMode: periodModeSchema,
  // browsingMode: z.nativeEnum(BrowsingMode).optional(),
  excludedTagIds: z.array(z.number()).optional(),
  excludedUserIds: z.array(z.number()).optional(),
  excludedImageIds: z.array(z.number()).optional(),
  tags: z.number().array().optional(),
  username: z
    .string()
    .transform((data) => postgresSlugify(data))
    .nullish(),
  modelVersionId: z.number().optional(),
  modelId: z.number().optional(),
});

export type GetImageInput = z.infer<typeof getImageSchema>;
export const getImageSchema = z.object({
  id: z.number(),
  withoutPost: z.boolean().optional(),
  // excludedTagIds: z.array(z.number()).optional(),
  // excludedUserIds: z.array(z.number()).optional(),
  // browsingMode: z.nativeEnum(BrowsingMode).optional(),
});
// #endregion

export type RemoveImageResourceSchema = z.infer<typeof removeImageResourceSchema>;
export const removeImageResourceSchema = z.object({
  imageId: z.number(),
  resourceId: z.number(),
});

export type GetEntitiesCoverImage = z.infer<typeof getEntitiesCoverImage>;
export const getEntitiesCoverImage = z.object({
  entities: z.array(
    z.object({
      entityType: z.union([z.nativeEnum(SearchIndexEntityTypes), z.enum(['ModelVersion'])]),
      entityId: z.number(),
    })
  ),
});

export type ImageReviewQueueInput = z.infer<typeof imageReviewQueueInputSchema>;
export const imageReviewQueueInputSchema = z.object({
  limit: z.number().min(0).max(200).default(100),
  cursor: z.union([z.bigint(), z.number()]).optional(),
  needsReview: z.string().nullish(),
  tagReview: z.boolean().optional(),
  reportReview: z.boolean().optional(),
  tagIds: z.array(z.number()).optional(),
});

export type ScanJobsOutput = z.output<typeof scanJobsSchema>;
export const scanJobsSchema = z
  .object({
    scans: z.record(z.string(), z.number()).default({}),
    retryCount: z.number().optional(),
  })
  .passthrough();
// .catchall(z.string());

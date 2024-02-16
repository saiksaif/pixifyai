import {
  ActionIcon,
  Alert,
  Badge,
  Button,
  Container,
  createStyles,
  Divider,
  Group,
  Menu,
  Stack,
  Text,
  ThemeIcon,
  Title,
  Paper,
  Center,
  Box,
  Loader,
} from '@mantine/core';
import { useDisclosure } from '@mantine/hooks';
import { closeAllModals, openConfirmModal } from '@mantine/modals';
import { NextLink } from '@mantine/next';
import { Availability, CollectionType, ModelModifier, ModelStatus } from '@prisma/client';
import {
  IconBan,
  IconClock,
  IconDotsVertical,
  IconDownload,
  IconEdit,
  IconExclamationMark,
  IconFlag,
  IconHeart,
  IconMessage,
  IconPlus,
  IconRecycle,
  IconTagOff,
  IconTrash,
  IconLock,
  IconLockOff,
  IconMessageCircleOff,
  IconArrowsLeftRight,
  IconArchive,
  IconCircleMinus,
  IconReload,
  IconBookmark,
  IconInfoCircle,
  IconBolt,
  IconRadar2,
  IconBrush,
  IconRepeat,
} from '@tabler/icons-react';
import { truncate } from 'lodash-es';
import { InferGetServerSidePropsType } from 'next';
import Link from 'next/link';
import { useRouter } from 'next/router';
import React, { useEffect, useRef, useState } from 'react';

import { getEdgeUrl } from '~/client-utils/cf-images-utils';
import { Announcements } from '~/components/Announcements/Announcements';
import { NotFound } from '~/components/AppLayout/NotFound';
import { Collection } from '~/components/Collection/Collection';
import { HideModelButton } from '~/components/HideModelButton/HideModelButton';
import { HideUserButton } from '~/components/HideUserButton/HideUserButton';
import { IconBadge } from '~/components/IconBadge/IconBadge';
import ImagesAsPostsInfinite from '~/components/Image/AsPosts/ImagesAsPostsInfinite';
// import { ImageFiltersDropdown } from '~/components/Image/Infinite/ImageFiltersDropdown';
import { JoinPopover } from '~/components/JoinPopover/JoinPopover';
import { LoginRedirect } from '~/components/LoginRedirect/LoginRedirect';
import { Meta } from '~/components/Meta/Meta';
import { ReorderVersionsModal } from '~/components/Modals/ReorderVersionsModal';
import { ModelDiscussionV2 } from '~/components/Model/ModelDiscussion/ModelDiscussionV2';
import { ModelVersionList } from '~/components/Model/ModelVersionList/ModelVersionList';
import { ModelVersionDetails } from '~/components/Model/ModelVersions/ModelVersionDetails';
import { PageLoader } from '~/components/PageLoader/PageLoader';
import { SensitiveShield } from '~/components/SensitiveShield/SensitiveShield';
import { useCurrentUser } from '~/hooks/useCurrentUser';
import { openContext } from '~/providers/CustomModalsProvider';
import { ReportEntity } from '~/server/schema/report.schema';
import { getDefaultModelVersion } from '~/server/services/model-version.service';
import { createServerSideProps } from '~/server/utils/server-side-helpers';
import { ModelById } from '~/types/router';
import { formatDate, isFutureDate } from '~/utils/date-helpers';
import { showErrorNotification, showSuccessNotification } from '~/utils/notifications';
import { abbreviateNumber } from '~/utils/number-helpers';
import { getDisplayName, removeTags, splitUppercase, slugit } from '~/utils/string-helpers';
import { trpc } from '~/utils/trpc';
import { isNumber } from '~/utils/type-guards';
import useIsClient from '~/hooks/useIsClient';
import { ImageSort } from '~/server/common/enums';
import { useQueryImages } from '~/components/Image/image.utils';
import { CAROUSEL_LIMIT } from '~/server/common/constants';
import { ToggleLockModel } from '~/components/Model/Actions/ToggleLockModel';
import { unpublishReasons } from '~/server/common/moderation-helpers';
import { ButtonTooltip } from '~/components/CivitaiWrapped/ButtonTooltip';
import { ModelMeta } from '~/server/schema/model.schema';
import { AlertWithIcon } from '~/components/AlertWithIcon/AlertWithIcon';
import { TrackView } from '~/components/TrackView/TrackView';
import { AssociatedModels } from '~/components/AssociatedModels/AssociatedModels';
import { useFeatureFlags } from '~/providers/FeatureFlagsProvider';
import { ResourceReviewSummary } from '~/components/ResourceReview/Summary/ResourceReviewSummary';
import { AddToCollectionMenuItem } from '~/components/MenuItems/AddToCollectionMenuItem';
import { env } from '~/env/client.mjs';
import {
  InteractiveTipBuzzButton,
  useBuzzTippingStore,
} from '~/components/Buzz/InteractiveTipBuzzButton';
import { AddToShowcaseMenuItem } from '~/components/Profile/AddToShowcaseMenuItem';
import { triggerRoutedDialog } from '~/components/Dialog/RoutedDialogProvider';
import { containerQuery } from '~/utils/mantine-css-helpers';
import { GenerateButton } from '~/components/RunStrategy/GenerateButton';
import { ToggleSearchableMenuItem } from '../../../components/MenuItems/ToggleSearchableMenuItem';
import { InfoPopover } from '~/components/InfoPopover/InfoPopover';
import { HowToButton } from '~/components/Model/HowToUseModel/HowToUseModel';
import { Adunit } from '~/components/Ads/AdUnit';
import { adsRegistry } from '~/components/Ads/adsRegistry';

export const getServerSideProps = createServerSideProps({
  useSSG: true,
  useSession: true,
  resolver: async ({ ssg, ctx }) => {
    const params = (ctx.params ?? {}) as {
      id: string;
      slug: string[];
    };
    const query = ctx.query as {
      modelVersionId: string;
    };
    const id = Number(params.id);
    const modelVersionId = query.modelVersionId ? Number(query.modelVersionId) : undefined;
    if (!isNumber(id)) return { notFound: true };
    const version = await getDefaultModelVersion({ modelId: id, modelVersionId }).catch(() => null);
    const modelVersionIdParsed = modelVersionId ?? version?.id;

    if (!modelVersionIdParsed) {
      return { notFound: true };
    }

    if (ssg) {
      if (version)
        await ssg.image.getInfinite.prefetchInfinite({
          modelVersionId: version.id,
          prioritizedUserIds: [version.model.userId],
          period: 'AllTime',
          sort: ImageSort.MostReactions,
          limit: CAROUSEL_LIMIT,
          // browsingMode: parseBrowsingMode(ctx.req.cookies, session),
        });

      if (modelVersionIdParsed) {
        await ssg.common.getEntityAccess.prefetch({
          entityId: modelVersionIdParsed as number,
          entityType: 'ModelVersion',
        });
        await ssg.common.getEntityClubRequirement.prefetch({
          entityId: modelVersionIdParsed as number,
          entityType: 'ModelVersion',
        });
      }
      await ssg.model.getById.prefetch({ id });
    }

    return {
      props: { id },
    };
  },
});

type ModelVersionDetail = ModelById['modelVersions'][number];

export default function ModelDetailsV2({
  id,
}: InferGetServerSidePropsType<typeof getServerSideProps>) {
  const currentUser = useCurrentUser();

  const router = useRouter();
  const { classes, theme } = useStyles();
  const queryUtils = trpc.useUtils();
  const isClient = useIsClient();
  const features = useFeatureFlags();

  const [opened, { toggle }] = useDisclosure();
  const discussionSectionRef = useRef<HTMLDivElement | null>(null);
  const gallerySectionRef = useRef<HTMLDivElement | null>(null);

  const { data: model, isLoading: loadingModel } = trpc.model.getById.useQuery(
    { id },
    {
      onSuccess(result) {
        const latestVersion = result.modelVersions[0];
        if (latestVersion) setSelectedVersion(latestVersion);
      },
    }
  );

  const { data: { Favorite: favoriteModels = [] } = { Favorite: [] } } =
    trpc.user.getEngagedModels.useQuery(undefined, {
      enabled: !!currentUser,
      cacheTime: Infinity,
      staleTime: Infinity,
    });

  const rawVersionId = router.query.modelVersionId;
  const modelVersionId = Number(
    (Array.isArray(rawVersionId) ? rawVersionId[0] : rawVersionId) ?? model?.modelVersions[0]?.id
  );

  const isModerator = currentUser?.isModerator ?? false;
  const isCreator = model?.user.id === currentUser?.id;
  const isOwner = isCreator || isModerator;
  const publishedVersions = !isOwner
    ? model?.modelVersions.filter((v) => v.status === ModelStatus.Published) ?? []
    : model?.modelVersions ?? [];
  const latestVersion =
    publishedVersions.find((version) => version.id === modelVersionId) ??
    publishedVersions[0] ??
    null;
  const [selectedVersion, setSelectedVersion] = useState<ModelVersionDetail | null>(latestVersion);
  const tippedAmount = useBuzzTippingStore({ entityType: 'Model', entityId: model?.id ?? -1 });

  const latestGenerationVersion = publishedVersions.find((version) => version.canGenerate);

  const { images: versionImages, isLoading: loadingImages } = useQueryImages(
    {
      modelVersionId: latestVersion?.id,
      prioritizedUserIds: model ? [model.user.id] : undefined,
      period: 'AllTime',
      sort: ImageSort.MostReactions,
      limit: CAROUSEL_LIMIT,
    },
    {
      enabled: !!latestVersion,
    }
  );

  const deleteMutation = trpc.model.delete.useMutation({
    async onSuccess(_, { permanently }) {
      await queryUtils.model.getAll.invalidate();
      if (!permanently) await queryUtils.model.getById.invalidate({ id });
      if (!isModerator || permanently) await router.replace('/models');

      showSuccessNotification({
        title: 'Successfully deleted the model',
        message: 'Your model has been deleted',
      });
      closeAllModals();
    },
    onError(error) {
      showErrorNotification({
        error: new Error(error.message),
        title: 'Could not delete model',
        reason: 'An unexpected error occurred, please try again',
      });
    },
  });
  const handleDeleteModel = (options?: { permanently: boolean }) => {
    const { permanently = false } = options || {};

    openConfirmModal({
      title: 'Delete Model',
      children: permanently
        ? 'Are you sure you want to permanently delete this model? This action is destructive and cannot be reverted.'
        : 'Are you sure you want to delete this model? This action is destructive and you will have to contact support to restore your data.',
      centered: true,
      labels: { confirm: 'Delete Model', cancel: "No, don't delete it" },
      confirmProps: { color: 'red', disabled: deleteMutation.isLoading },
      closeOnConfirm: false,
      onConfirm: () => {
        if (model) {
          deleteMutation.mutate({ id: model.id, permanently });
        }
      },
    });
  };

  const unpublishModelMutation = trpc.model.unpublish.useMutation({
    async onSuccess() {
      await queryUtils.model.getById.invalidate({ id });
    },
    onError(error) {
      showErrorNotification({ error: new Error(error.message) });
    },
  });
  const publishModelMutation = trpc.model.publish.useMutation({
    async onSuccess() {
      await queryUtils.model.getById.invalidate({ id });
    },
    onError(error) {
      showErrorNotification({ error: new Error(error.message) });
    },
  });
  const restoreModelMutation = trpc.model.restore.useMutation({
    async onSuccess() {
      await queryUtils.model.getById.invalidate({ id });
      await queryUtils.model.getAll.invalidate();
    },
    onError(error) {
      showErrorNotification({ error: new Error(error.message) });
    },
  });
  const toggleFavoriteModelMutation = trpc.user.toggleFavoriteModel.useMutation({
    async onMutate({ modelId }) {
      await queryUtils.user.getEngagedModels.cancel();

      const previousEngaged = queryUtils.user.getEngagedModels.getData() ?? {
        Favorite: [],
        Hide: [],
      };
      const previousModel = queryUtils.model.getById.getData({ id: modelId });
      const shouldRemove = previousEngaged.Favorite?.find((id) => id === modelId);
      // Update the favorite count
      queryUtils.model.getById.setData({ id: modelId }, (model) => {
        if (model?.rank) model.rank.favoriteCountAllTime += shouldRemove ? -1 : 1;
        return model;
      });
      // Remove from favorites list
      queryUtils.user.getEngagedModels.setData(
        undefined,
        ({ Favorite = [], ...old } = { Favorite: [], Hide: [] }) => {
          if (shouldRemove) return { Favorite: Favorite.filter((id) => id !== modelId), ...old };
          return { Favorite: [...Favorite, modelId], ...old };
        }
      );

      return { previousEngaged, previousModel };
    },
    async onSuccess() {
      await queryUtils.model.getAll.invalidate({ favorites: true });
    },
    onError(_error, _variables, context) {
      queryUtils.user.getEngagedModels.setData(undefined, context?.previousEngaged);
      if (context?.previousModel?.id)
        queryUtils.model.getById.setData(
          { id: context?.previousModel?.id },
          context?.previousModel
        );
    },
  });
  const handleToggleFavorite = () => {
    toggleFavoriteModelMutation.mutate({ modelId: id });
  };

  const handleCollect = () => {
    openContext('addToCollection', {
      modelId: id,
      type: CollectionType.Model,
    });
  };

  const deleteVersionMutation = trpc.modelVersion.delete.useMutation({
    async onMutate(payload) {
      await queryUtils.model.getById.cancel({ id });

      const previousData = queryUtils.model.getById.getData({ id });
      if (previousData) {
        const filteredVersions = previousData.modelVersions.filter((v) => v.id !== payload.id);

        queryUtils.model.getById.setData(
          { id },
          { ...previousData, modelVersions: filteredVersions }
        );
      }

      return { previousData };
    },
    async onSuccess() {
      const nextLatestVersion = queryUtils.model.getById.getData({ id })?.modelVersions[0];
      if (nextLatestVersion) router.replace(`/models/${id}?modelVersionId=${nextLatestVersion.id}`);
      closeAllModals();
    },
    onError(error, _variables, context) {
      showErrorNotification({
        error: new Error(error.message),
        title: 'Unable to delete version',
        reason: 'An unexpected error occurred, please try again',
      });
      if (context?.previousData?.id)
        queryUtils.model.getById.setData({ id: context?.previousData?.id }, context?.previousData);
    },
  });
  const handleDeleteVersion = (versionId: number) => {
    openConfirmModal({
      title: 'Delete Version',
      children:
        'Are you sure you want to delete this version? This action is destructive and cannot be reverted.',
      centered: true,
      labels: { confirm: 'Delete Version', cancel: "No, don't delete it" },
      confirmProps: { color: 'red', loading: deleteVersionMutation.isLoading },
      closeOnConfirm: false,
      onConfirm: () => deleteVersionMutation.mutate({ id: versionId }),
    });
  };

  const changeModeMutation = trpc.model.changeMode.useMutation();
  const handleChangeMode = async (mode: ModelModifier | null) => {
    const prevModel = queryUtils.model.getById.getData({ id });
    await queryUtils.model.getById.cancel({ id });

    if (prevModel)
      queryUtils.model.getById.setData(
        { id },
        { ...prevModel, mode, meta: (prevModel.meta as ModelMeta) ?? null }
      );

    changeModeMutation.mutate(
      { id, mode },
      {
        async onSuccess() {
          await queryUtils.model.getById.invalidate({ id });
        },
        onError(error) {
          showErrorNotification({
            title: 'Unable to change mode',
            error: new Error(error.message),
          });
          queryUtils.model.getById.setData({ id }, prevModel);
        },
      }
    );
  };

  const rescanModelMutation = trpc.model.rescan.useMutation();
  const handleRescanModel = async () => {
    rescanModelMutation.mutate({ id });
  };

  const handlePublishModel = () => {
    if (model && model.status === ModelStatus.Unpublished && isCreator)
      openConfirmModal({
        centered: true,
        closeOnConfirm: false,
        title: 'Republish model',
        children:
          'This model and all of its versions will be publicly available. Are you sure you want to republish this model?',
        labels: { confirm: 'Yes, republish', cancel: 'No, go back' },
        onConfirm: () => {
          publishModelMutation.mutate(
            {
              id: model.id,
              versionIds: model?.modelVersions.map((v) => v.id),
            },
            { onSuccess: () => closeAllModals() }
          );
        },
      });
  };

  useEffect(() => {
    // Change the selected modelVersion based on querystring param
    const queryVersion = publishedVersions.find((v) => v.id === modelVersionId);
    const hasSelected = publishedVersions.some((v) => v.id === selectedVersion?.id);
    if (!hasSelected) setSelectedVersion(publishedVersions[0] ?? null);
    if (selectedVersion && queryVersion !== selectedVersion) {
      router.replace(`/models/${id}?modelVersionId=${selectedVersion.id}`, undefined, {
        shallow: true,
      });
    }
  }, [id, publishedVersions, selectedVersion, modelVersionId]);

  if (loadingModel) return <PageLoader />;

  // Handle missing and deleted models
  const modelDoesntExist = !model;
  const modelDeleted = !!model && !!model.deletedAt && model.status === ModelStatus.Deleted;
  const modelNotVisible =
    model &&
    !isOwner &&
    !isModerator &&
    // Check if published or has any model versions
    (model.status !== ModelStatus.Published || !model.modelVersions.length);
  if (modelDeleted && !isOwner && !isModerator)
    return (
      <Center p="xl">
        <Alert>
          <Text size="lg">This resource has been removed by its owner</Text>
        </Alert>
      </Center>
    );
  if (modelDoesntExist || (modelDeleted && !isModerator) || modelNotVisible) return <NotFound />;

  const userNotBlurringNsfw = currentUser?.blurNsfw !== false;
  const nsfw = userNotBlurringNsfw && model.nsfw === true;
  const metaSchema = {
    '@context': 'https://schema.org',
    '@type': 'SoftwareApplication',
    applicationCategory: 'Multimedia',
    applicationSubCategory: 'Stable Diffusion Model',
    description: model.description,
    name: model.name,
    image:
      nsfw || versionImages[0]?.url == null
        ? undefined
        : getEdgeUrl(versionImages[0].url, { width: 1200 }),
    author: model.user.username,
    datePublished: model.publishedAt,
    aggregateRating: {
      '@type': 'AggregateRating',
      ratingValue: model.rank?.ratingAllTime,
      reviewCount: model.rank?.ratingCountAllTime,
    },
  };

  const meta = (
    <Meta
      title={`${model.name}${
        selectedVersion ? ' - ' + selectedVersion.name : ''
      } | Stable Diffusion ${getDisplayName(model.type)} | Civitai`}
      description={truncate(removeTags(model.description ?? ''), { length: 150 })}
      image={
        nsfw || versionImages[0]?.url == null
          ? undefined
          : getEdgeUrl(versionImages[0].url, { width: 1200 })
      }
      links={[
        {
          href: `${env.NEXT_PUBLIC_BASE_URL}/models/${model.id}/${slugit(model.name)}`,
          rel: 'canonical',
        },
      ]}
      schema={metaSchema}
      deIndex={
        model.status !== ModelStatus.Published || model.availability === Availability.Unsearchable
          ? 'noindex'
          : undefined
      }
    />
  );

  if (model.nsfw && !currentUser)
    return (
      <>
        {meta}
        <SensitiveShield />
      </>
    );

  const isFavorite = !!favoriteModels.find((modelId) => modelId === id);
  const published = model.status === ModelStatus.Published;
  const inaccurate = model.modelVersions.some((version) => version.inaccurate);
  const isMuted = currentUser?.muted ?? false;
  const onlyEarlyAccess = model.modelVersions.every((version) => version.earlyAccessDeadline);
  const canDiscuss =
    !isMuted && (!onlyEarlyAccess || currentUser?.isMember || currentUser?.isModerator);
  const versionCount = model.modelVersions.length;
  const inEarlyAccess = model.earlyAccessDeadline && isFutureDate(model.earlyAccessDeadline);
  const versionIsEarlyAccess =
    selectedVersion &&
    !!selectedVersion.earlyAccessDeadline &&
    isFutureDate(selectedVersion.earlyAccessDeadline);
  const category = model.tagsOnModels.find(({ tag }) => !!tag.isCategory)?.tag;
  const tags = model.tagsOnModels.filter(({ tag }) => !tag.isCategory).map((tag) => tag.tag);
  const canLoadBelowTheFold = isClient && !loadingModel && !loadingImages;
  const unpublishedReason = model.meta?.unpublishedReason ?? 'other';
  const unpublishedMessage =
    unpublishedReason !== 'other'
      ? unpublishReasons[unpublishedReason]?.notificationMessage
      : `Removal reason: ${model.meta?.customMessage}.` ?? '';

  return (
    <>
      {meta}
      <TrackView entityId={model.id} entityType="Model" type="ModelView" />
      <Container size="xl">
        <Stack spacing="xl">
          <Announcements sx={{ marginBottom: 5 }} />
          <Stack spacing="xs">
            <Stack spacing={4}>
              <Group align="center" sx={{ justifyContent: 'space-between' }} noWrap>
                <Group className={classes.titleWrapper} align="center">
                  <Title className={classes.title} order={1}>
                    {model?.name}
                  </Title>
                  <LoginRedirect reason="favorite-model">
                    <IconBadge
                      radius="sm"
                      color={isFavorite ? 'red' : 'gray'}
                      size="lg"
                      icon={
                        <IconHeart
                          size={18}
                          color={isFavorite ? theme.colors.red[6] : undefined}
                          style={{ fill: isFavorite ? theme.colors.red[6] : undefined }}
                        />
                      }
                      sx={{ cursor: 'pointer' }}
                      onClick={handleToggleFavorite}
                    >
                      <Text className={classes.modelBadgeText}>
                        {abbreviateNumber(model.rank?.favoriteCountAllTime ?? 0)}
                      </Text>
                    </IconBadge>
                  </LoginRedirect>
                  <IconBadge radius="sm" size="lg" icon={<IconDownload size={18} />}>
                    <Text className={classes.modelBadgeText}>
                      {abbreviateNumber(model.rank?.downloadCountAllTime ?? 0)}
                    </Text>
                  </IconBadge>
                  {model.canGenerate && latestGenerationVersion && (
                    <GenerateButton
                      modelVersionId={latestGenerationVersion.id}
                      data-activity="create:model-stat"
                    >
                      <IconBadge radius="sm" size="lg" icon={<IconBrush size={18} />}>
                        <Text className={classes.modelBadgeText}>
                          {abbreviateNumber(model.rank?.generationCountAllTime ?? 0)}
                        </Text>
                      </IconBadge>
                    </GenerateButton>
                  )}
                  {features.collections && (
                    <LoginRedirect reason="add-to-collection">
                      <IconBadge
                        radius="sm"
                        size="lg"
                        icon={<IconBookmark size={18} />}
                        sx={{ cursor: 'pointer' }}
                        onClick={handleCollect}
                      >
                        <Text className={classes.modelBadgeText}>
                          {abbreviateNumber(model.rank?.collectedCountAllTime ?? 0)}
                        </Text>
                      </IconBadge>
                    </LoginRedirect>
                  )}
                  <InteractiveTipBuzzButton
                    toUserId={model.user.id}
                    entityId={model.id}
                    entityType="Model"
                  >
                    <IconBadge
                      radius="sm"
                      size="lg"
                      icon={
                        <IconBolt
                          size={18}
                          color="yellow.7"
                          style={{ fill: theme.colors.yellow[7] }}
                        />
                      }
                    >
                      <Text className={classes.modelBadgeText}>
                        {abbreviateNumber(
                          (model.rank?.tippedAmountCountAllTime ?? 0) + tippedAmount
                        )}
                      </Text>
                    </IconBadge>
                  </InteractiveTipBuzzButton>

                  {!model.locked && (
                    <ResourceReviewSummary modelId={model.id}>
                      <ResourceReviewSummary.Simple
                        rating={model.rank?.ratingAllTime}
                        count={model.rank?.ratingCountAllTime}
                        onClick={() => {
                          gallerySectionRef.current?.scrollIntoView({ behavior: 'smooth' });
                        }}
                      />
                    </ResourceReviewSummary>
                  )}
                  {inEarlyAccess && (
                    <IconBadge radius="sm" color="green" size="lg" icon={<IconClock size={18} />}>
                      Early Access
                    </IconBadge>
                  )}
                </Group>

                <Group spacing={8} noWrap>
                  <HowToButton
                    size={30}
                    stroke={1.5}
                    href="https://education.civitai.com/civitais-100-beginners-guide-to-generative-ai-art/#heading-77"
                    tooltip="What is this?"
                  />
                  <Menu position="bottom-end" transition="pop-top-right" withinPortal>
                    <Menu.Target>
                      <ActionIcon variant="outline">
                        <IconDotsVertical size={16} />
                      </ActionIcon>
                    </Menu.Target>
                    <Menu.Dropdown>
                      {currentUser && isCreator && published && (
                        <Menu.Item
                          icon={<IconBan size={14} stroke={1.5} />}
                          color="yellow"
                          onClick={() => unpublishModelMutation.mutate({ id })}
                          disabled={unpublishModelMutation.isLoading}
                        >
                          Unpublish
                        </Menu.Item>
                      )}
                      {currentUser && isCreator && model.status === ModelStatus.Unpublished && (
                        <Menu.Item
                          icon={<IconRepeat size={14} stroke={1.5} />}
                          color="green"
                          onClick={handlePublishModel}
                          disabled={publishModelMutation.isLoading}
                        >
                          Republish
                        </Menu.Item>
                      )}
                      {currentUser && isModerator && modelDeleted && (
                        <Menu.Item
                          icon={<IconRecycle size={14} stroke={1.5} />}
                          color="green"
                          onClick={() => restoreModelMutation.mutate({ id })}
                          disabled={restoreModelMutation.isLoading}
                        >
                          Restore
                        </Menu.Item>
                      )}
                      {currentUser && isModerator && (
                        <>
                          {env.NEXT_PUBLIC_MODEL_LOOKUP_URL && (
                            <Menu.Item
                              component="a"
                              target="_blank"
                              icon={<IconInfoCircle size={14} stroke={1.5} />}
                              href={`${env.NEXT_PUBLIC_MODEL_LOOKUP_URL}${model.id}`}
                            >
                              Lookup Model
                            </Menu.Item>
                          )}
                          {published && (
                            <Menu.Item
                              color="yellow"
                              icon={<IconBan size={14} stroke={1.5} />}
                              onClick={() => openContext('unpublishModel', { modelId: model.id })}
                            >
                              Unpublish as Violation
                            </Menu.Item>
                          )}
                          <Menu.Item
                            color={theme.colors.red[6]}
                            icon={<IconTrash size={14} stroke={1.5} />}
                            onClick={() => handleDeleteModel({ permanently: true })}
                          >
                            Permanently Delete Model
                          </Menu.Item>
                        </>
                      )}
                      {currentUser && isOwner && !modelDeleted && (
                        <>
                          <Menu.Item
                            color={theme.colors.red[6]}
                            icon={<IconTrash size={14} stroke={1.5} />}
                            onClick={() => handleDeleteModel()}
                          >
                            Delete Model
                          </Menu.Item>
                          <Menu.Item
                            icon={<IconEdit size={14} stroke={1.5} />}
                            component={NextLink}
                            href={`/models/${model.id}/edit`}
                          >
                            Edit Model
                          </Menu.Item>
                          {!model.mode ? (
                            <>
                              <Menu.Item
                                icon={<IconArchive size={14} stroke={1.5} />}
                                onClick={() => handleChangeMode(ModelModifier.Archived)}
                              >
                                Archive
                              </Menu.Item>
                              {isModerator && (
                                <Menu.Item
                                  icon={<IconCircleMinus size={14} stroke={1.5} />}
                                  onClick={() => handleChangeMode(ModelModifier.TakenDown)}
                                >
                                  Take Down
                                </Menu.Item>
                              )}
                            </>
                          ) : model.mode === ModelModifier.Archived ||
                            (isModerator && model.mode === ModelModifier.TakenDown) ? (
                            <Menu.Item
                              icon={<IconReload size={14} stroke={1.5} />}
                              onClick={() => handleChangeMode(null)}
                            >
                              Bring Back
                            </Menu.Item>
                          ) : null}
                        </>
                      )}
                      {features.collections && (
                        <AddToCollectionMenuItem
                          onClick={() =>
                            openContext('addToCollection', {
                              modelId: model.id,
                              type: CollectionType.Model,
                            })
                          }
                        />
                      )}
                      {isOwner && (
                        <AddToShowcaseMenuItem
                          key="add-to-showcase"
                          entityType="Model"
                          entityId={model.id}
                        />
                      )}
                      <ToggleSearchableMenuItem
                        entityType="Model"
                        entityId={model.id}
                        key="toggle-searchable-menu-item"
                      />
                      {(!currentUser || !isOwner || isModerator) && (
                        <LoginRedirect reason="report-model">
                          <Menu.Item
                            icon={<IconFlag size={14} stroke={1.5} />}
                            onClick={() =>
                              openContext('report', {
                                entityType: ReportEntity.Model,
                                entityId: model.id,
                              })
                            }
                          >
                            Report
                          </Menu.Item>
                        </LoginRedirect>
                      )}
                      {isModerator && (
                        <Menu.Item
                          icon={
                            rescanModelMutation.isLoading ? (
                              <Loader size={14} />
                            ) : (
                              <IconRadar2 size={14} stroke={1.5} />
                            )
                          }
                          onClick={() => handleRescanModel()}
                        >
                          Rescan Files
                        </Menu.Item>
                      )}
                      {currentUser && (
                        <>
                          <HideUserButton as="menu-item" userId={model.user.id} />
                          <HideModelButton as="menu-item" modelId={model.id} />
                          <Menu.Item
                            icon={<IconTagOff size={14} stroke={1.5} />}
                            onClick={() => openContext('blockModelTags', { modelId: model.id })}
                          >
                            Hide content with these tags
                          </Menu.Item>
                        </>
                      )}
                      {isOwner && (
                        <ToggleLockModel modelId={model.id} locked={model.locked}>
                          {({ onClick }) => (
                            <Menu.Item
                              icon={
                                model.locked ? (
                                  <IconLockOff size={14} stroke={1.5} />
                                ) : (
                                  <IconLock size={14} stroke={1.5} />
                                )
                              }
                              onClick={onClick}
                            >
                              {model.locked ? 'Unlock' : 'Lock'} model discussion
                            </Menu.Item>
                          )}
                        </ToggleLockModel>
                      )}
                    </Menu.Dropdown>
                  </Menu>
                </Group>
              </Group>
              <Group spacing={4}>
                <Text size="xs" color="dimmed">
                  Updated: {formatDate(model.updatedAt)}
                </Text>
                {category && (
                  <>
                    <Divider orientation="vertical" />
                    <Link href={`/tag/${encodeURIComponent(category.name.toLowerCase())}`} passHref>
                      <Badge component="a" size="sm" color="blue" sx={{ cursor: 'pointer' }}>
                        {category.name}
                      </Badge>
                    </Link>
                  </>
                )}

                {tags.length > 0 && <Divider orientation="vertical" />}
                <Collection
                  items={tags}
                  renderItem={(tag) => (
                    <Link href={`/tag/${encodeURIComponent(tag.name.toLowerCase())}`} passHref>
                      <Badge
                        component="a"
                        size="sm"
                        color="gray"
                        variant={theme.colorScheme === 'dark' ? 'filled' : undefined}
                        sx={{ cursor: 'pointer' }}
                      >
                        {tag.name}
                      </Badge>
                    </Link>
                  )}
                />
              </Group>
            </Stack>
            {(model.status === ModelStatus.Unpublished || modelDeleted) && (
              <Alert color="red">
                <Group spacing="xs" noWrap align="flex-start">
                  <ThemeIcon color="red">
                    <IconExclamationMark />
                  </ThemeIcon>
                  <Text size="md">
                    This model has been {modelDeleted ? 'deleted' : 'unpublished'} and is not
                    visible to the community.
                  </Text>
                </Group>
              </Alert>
            )}
            {model.status === ModelStatus.UnpublishedViolation && !model.meta?.needsReview && (
              <Alert color="red">
                <Group spacing="xs" noWrap align="flex-start">
                  <ThemeIcon color="red">
                    <IconExclamationMark />
                  </ThemeIcon>
                  <Text size="sm" mt={-3}>
                    This model has been unpublished due to a violation of our{' '}
                    <Text component="a" variant="link" href="/content/tos" target="_blank">
                      guidelines
                    </Text>{' '}
                    and is not visible to the community.{' '}
                    {unpublishedReason && unpublishedMessage ? unpublishedMessage : null} If you
                    adjust your model to comply with our guidelines, you can request a review from
                    one of our moderators.
                  </Text>
                </Group>
              </Alert>
            )}
            {model.status === ModelStatus.UnpublishedViolation && model.meta?.needsReview && (
              <Alert color="yellow">
                <Group spacing="xs" noWrap>
                  <ThemeIcon color="yellow">
                    <IconExclamationMark />
                  </ThemeIcon>
                  <Text size="md">
                    This model is currently being reviewed by our moderators. It will be visible to
                    the community once it has been approved.
                  </Text>
                </Group>
              </Alert>
            )}
            {inaccurate && (
              <Alert color="yellow">
                <Group spacing="xs" noWrap align="flex-start">
                  <ThemeIcon color="yellow">
                    <IconExclamationMark />
                  </ThemeIcon>
                  <Text size="md">
                    The images on this {splitUppercase(model.type).toLowerCase()} are inaccurate.
                    Please submit reviews with images so that we can improve this page.
                  </Text>
                </Group>
              </Alert>
            )}
            {(model.mode === ModelModifier.TakenDown || model.mode === ModelModifier.Archived) && (
              <AlertWithIcon color="blue" icon={<IconExclamationMark />} size="md">
                {model.mode === ModelModifier.Archived
                  ? 'This model has been archived and is not available for download. You can still share your creations with the community.'
                  : 'The visual assets associated with this model have been taken down. You can still download the resource, but you will not be able to share your creations.'}
              </AlertWithIcon>
            )}
          </Stack>
          <Group spacing={4} noWrap>
            {isOwner ? (
              <>
                <ButtonTooltip label="Add Version">
                  <Link href={`/models/${model.id}/model-versions/create`}>
                    <ActionIcon variant="light" color="blue">
                      <IconPlus size={14} />
                    </ActionIcon>
                  </Link>
                </ButtonTooltip>

                {versionCount > 1 && (
                  <ButtonTooltip label="Rearrange Versions">
                    <ActionIcon onClick={toggle}>
                      <IconArrowsLeftRight size={14} />
                    </ActionIcon>
                  </ButtonTooltip>
                )}
              </>
            ) : null}
            <ModelVersionList
              versions={model.modelVersions}
              selected={selectedVersion?.id}
              onVersionClick={(version) => {
                if (version.id !== selectedVersion?.id) {
                  setSelectedVersion(version);
                  // router.replace(`/models/${model.id}?modelVersionId=${version.id}`, undefined, {
                  //   shallow: true,
                  // });
                }
              }}
              onDeleteClick={handleDeleteVersion}
              showExtraIcons={isOwner || isModerator}
            />
          </Group>
          {!!selectedVersion && (
            <ModelVersionDetails
              model={model}
              version={selectedVersion}
              user={currentUser}
              isFavorite={isFavorite}
              onFavoriteClick={handleToggleFavorite}
              onBrowseClick={() => {
                gallerySectionRef.current?.scrollIntoView({ behavior: 'smooth' });
              }}
            />
          )}
        </Stack>
        {versionCount > 1 ? (
          <ReorderVersionsModal modelId={model.id} opened={opened} onClose={toggle} />
        ) : null}
      </Container>
      {canLoadBelowTheFold && (isOwner || model.hasSuggestedResources) && (
        <AssociatedModels
          fromId={model.id}
          type="Suggested"
          label={
            <Group spacing={8} noWrap>
              Suggested Resources{' '}
              <InfoPopover>
                <Text size="sm" weight={400}>
                  These are resources suggested by the creator of this model. They may be related to
                  this model or created by the same user.
                </Text>
              </InfoPopover>
            </Group>
          }
          ownerId={model.user.id}
        />
      )}
      {canLoadBelowTheFold &&
        (!model.locked ? (
          <Container size="xl" my="xl">
            <Stack spacing="md">
              {model.hasSuggestedResources && <Adunit {...adsRegistry.modelDetailSectionDivider} />}
              <Group ref={discussionSectionRef} sx={{ justifyContent: 'space-between' }}>
                <Group spacing="xs">
                  <Title order={2}>Discussion</Title>
                  {canDiscuss ? (
                    <>
                      <LoginRedirect reason="create-comment">
                        <Button
                          leftIcon={<IconMessage size={16} />}
                          variant="outline"
                          onClick={() => triggerRoutedDialog({ name: 'commentEdit', state: {} })}
                          size="xs"
                        >
                          Add Comment
                        </Button>
                      </LoginRedirect>
                    </>
                  ) : (
                    !isMuted &&
                    onlyEarlyAccess && (
                      <JoinPopover message="You must be a Supporter Tier member to join this discussion">
                        <Button
                          leftIcon={<IconClock size={16} />}
                          variant="outline"
                          size="xs"
                          color="green"
                        >
                          Early Access
                        </Button>
                      </JoinPopover>
                    )
                  )}
                </Group>
              </Group>
              <ModelDiscussionV2 modelId={model.id} />
            </Stack>
          </Container>
        ) : (
          <Paper p="lg" withBorder bg={`rgba(0, 0, 0, 0.1)`}>
            <Center>
              <Group spacing="xs">
                <ThemeIcon color="gray" size="xl" radius="xl">
                  <IconMessageCircleOff />
                </ThemeIcon>
                <Text size="lg" color="dimmed">
                  Discussion is turned off for this model.
                </Text>
              </Group>
            </Center>
          </Paper>
        ))}
      {canLoadBelowTheFold && !model.locked && model.mode !== ModelModifier.TakenDown && (
        <Box ref={gallerySectionRef} id="gallery" mt="md">
          <ImagesAsPostsInfinite
            model={model}
            selectedVersionId={selectedVersion?.id}
            modelVersions={model.modelVersions}
            showModerationOptions={isOwner}
            showPOIWarning={model.poi}
            generationOptions={{
              generationModelId: selectedVersion?.meta.picFinderModelId,
              includeEditingActions: isOwner,
            }}
            canReview={!versionIsEarlyAccess || currentUser?.isMember || currentUser?.isModerator}
          />
        </Box>
      )}
    </>
  );
}

const useStyles = createStyles((theme) => ({
  actions: {
    [containerQuery.smallerThan('sm')]: {
      width: '100%',
    },
  },

  titleWrapper: {
    gap: theme.spacing.xs,

    [containerQuery.smallerThan('md')]: {
      gap: theme.spacing.xs * 0.4,
    },
  },

  title: {
    wordBreak: 'break-word',
    [containerQuery.smallerThan('md')]: {
      fontSize: theme.fontSizes.xs * 2.4, // 24px
      width: '100%',
      paddingBottom: 0,
    },
  },

  engagementBar: {
    [containerQuery.smallerThan('sm')]: {
      display: 'none',
    },
  },

  mobileCarousel: {
    display: 'none',
    [containerQuery.smallerThan('md')]: {
      display: 'block',
    },
  },
  desktopCarousel: {
    display: 'block',
    [containerQuery.smallerThan('md')]: {
      display: 'none',
    },
  },

  modelBadgeText: {
    fontSize: theme.fontSizes.md,
    [containerQuery.smallerThan('md')]: {
      fontSize: theme.fontSizes.sm,
    },
  },

  discussionActionButton: {
    [containerQuery.smallerThan('sm')]: {
      width: '100%',
    },
  },

  // Increase carousel control arrow size
  control: {
    svg: {
      width: 24,
      height: 24,

      [containerQuery.smallerThan('sm')]: {
        minWidth: 16,
        minHeight: 16,
      },
    },
  },
}));

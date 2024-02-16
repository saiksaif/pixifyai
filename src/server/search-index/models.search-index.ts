import { client, updateDocs } from '~/server/meilisearch/client';
import { userWithCosmeticsSelect } from '~/server/selectors/user.selector';
import { modelHashSelect } from '~/server/selectors/modelHash.selector';
import {
  Availability,
  MetricTimeframe,
  ModelHashType,
  ModelStatus,
  Prisma,
  PrismaClient,
  SearchIndexUpdateQueueAction,
} from '@prisma/client';
import { isEqual } from 'lodash';
import { MODELS_SEARCH_INDEX, ModelFileType } from '~/server/common/constants';
import { getOrCreateIndex, onSearchIndexDocumentsCleanup } from '~/server/meilisearch/util';
import { EnqueuedTask, TypoTolerance } from 'meilisearch';
import { getImagesForModelVersion } from '~/server/services/image.service';
import { isDefined } from '~/utils/type-guards';
import {
  createSearchIndexUpdateProcessor,
  SearchIndexRunContext,
} from '~/server/search-index/base.search-index';
import { getCategoryTags } from '~/server/services/system-cache';
import { ModelFileMetadata } from '~/server/schema/model-file.schema';
import { withRetries } from '~/server/utils/errorHandling';
import { getModelVersionsForSearchIndex } from '../selectors/modelVersion.selector';
import { getUnavailableResources } from '../services/generation/generation.service';

const RATING_BAYESIAN_M = 3.5;
const RATING_BAYESIAN_C = 10;

const READ_BATCH_SIZE = 1000;
const MEILISEARCH_DOCUMENT_BATCH_SIZE = 1000;
const INDEX_ID = MODELS_SEARCH_INDEX;
const SWAP_INDEX_ID = `${INDEX_ID}_NEW`;

const onIndexSetup = async ({ indexName }: { indexName: string }) => {
  if (!client) {
    return;
  }

  const index = await getOrCreateIndex(indexName, { primaryKey: 'id' });
  console.log('onIndexSetup :: Index has been gotten or created', index);

  if (!index) {
    return;
  }

  const settings = await index.getSettings();

  const searchableAttributes = ['name', 'user.username', 'hashes', 'triggerWords'];

  if (JSON.stringify(searchableAttributes) !== JSON.stringify(settings.searchableAttributes)) {
    const updateSearchableAttributesTask = await index.updateSearchableAttributes(
      searchableAttributes
    );
    console.log(
      'onIndexSetup :: updateSearchableAttributesTask created',
      updateSearchableAttributesTask
    );
  }

  const sortableAttributes = [
    // sort
    'metrics.weightedRating',
    'createdAt',
    'metrics.commentCount',
    'metrics.favoriteCount',
    'metrics.downloadCount',
    'metrics.rating',
    'metrics.ratingCount',
    'metrics.collectedCount',
    'metrics.tippedAmountCount',
  ];

  // Meilisearch stores sorted.
  if (JSON.stringify(sortableAttributes.sort()) !== JSON.stringify(settings.sortableAttributes)) {
    const sortableFieldsAttributesTask = await index.updateSortableAttributes(sortableAttributes);
    console.log(
      'onIndexSetup :: sortableFieldsAttributesTask created',
      sortableFieldsAttributesTask
    );
  }

  const rankingRules = [
    'sort',
    'attribute',
    'metrics.weightedRating:desc',
    'words',
    'proximity',
    'exactness',
  ];

  if (JSON.stringify(rankingRules) !== JSON.stringify(settings.rankingRules)) {
    const updateRankingRulesTask = await index.updateRankingRules(rankingRules);
    console.log('onIndexSetup :: updateRankingRulesTask created', updateRankingRulesTask);
  }

  const filterableAttributes = [
    'hashes',
    'nsfw',
    'type',
    'checkpointType',
    'tags.name',
    'user.username',
    'version.baseModel',
    'user.username',
    'status',
    'category.name',
    'canGenerate',
    'fileFormats',
    'lastVersionAtUnix',
    'versions.hashes',
  ];

  if (
    // Meilisearch stores sorted.
    JSON.stringify(filterableAttributes.sort()) !== JSON.stringify(settings.filterableAttributes)
  ) {
    const updateFilterableAttributesTask = await index.updateFilterableAttributes(
      filterableAttributes
    );

    console.log(
      'onIndexSetup :: updateFilterableAttributesTask created',
      updateFilterableAttributesTask
    );
  }

  const typoTolerance: TypoTolerance = {
    enabled: true,
    minWordSizeForTypos: {
      oneTypo: 12,
      twoTypos: 16,
    },
    disableOnAttributes: [],
    disableOnWords: [],
  };

  if (
    // Meilisearch stores sorted.
    !isEqual(settings.typoTolerance, typoTolerance)
  ) {
    const updateTypoToleranceTask = await index.updateTypoTolerance(typoTolerance);
    console.log('onIndexSetup :: updateTypoToleranceTask created', updateTypoToleranceTask);
  }
};

export type ModelSearchIndexRecord = Awaited<
  ReturnType<typeof onFetchItemsToIndex>
>['indexReadyRecords'][number] &
  Awaited<ReturnType<typeof onFetchItemsToIndex>>['indexRecordsWithImages'][number];

const onFetchItemsToIndex = async ({
  db,
  whereOr,
  indexName,
  ...queryProps
}: {
  db: PrismaClient;
  indexName: string;
  whereOr?: Prisma.ModelWhereInput[];
  skip?: number;
  take?: number;
}) => {
  return withRetries(
    async () => {
      const modelCategories = await getCategoryTags('model');
      const modelCategoriesIds = modelCategories.map((category) => category.id);

      const offset = queryProps.skip || 0;
      console.log(
        `onFetchItemsToIndex :: fetching starting for ${indexName} range:`,
        offset,
        offset + READ_BATCH_SIZE - 1,
        ' filters:',
        whereOr
      );
      const models = await db.model.findMany({
        take: READ_BATCH_SIZE,
        ...queryProps,
        select: {
          id: true,
          name: true,
          type: true,
          nsfw: true,
          status: true,
          createdAt: true,
          lastVersionAt: true,
          publishedAt: true,
          locked: true,
          earlyAccessDeadline: true,
          mode: true,
          checkpointType: true,
          availability: true,
          // Joins:
          user: {
            select: userWithCosmeticsSelect,
          },
          modelVersions: {
            orderBy: { index: 'asc' },
            select: getModelVersionsForSearchIndex,
            where: {
              status: ModelStatus.Published,
              availability: {
                not: Availability.Unsearchable,
              },
            },
          },
          tagsOnModels: { select: { tag: { select: { id: true, name: true } } } },
          hashes: {
            select: modelHashSelect,
            where: {
              fileType: { in: ['Model', 'Pruned Model'] as ModelFileType[] },
            },
          },
          metrics: {
            select: {
              commentCount: true,
              favoriteCount: true,
              downloadCount: true,
              rating: true,
              ratingCount: true,
              collectedCount: true,
              tippedAmountCount: true,
            },
            where: {
              timeframe: MetricTimeframe.AllTime,
            },
          },
          rank: {
            select: {
              [`downloadCount${MetricTimeframe.AllTime}`]: true,
              [`favoriteCount${MetricTimeframe.AllTime}`]: true,
              [`commentCount${MetricTimeframe.AllTime}`]: true,
              [`ratingCount${MetricTimeframe.AllTime}`]: true,
              [`rating${MetricTimeframe.AllTime}`]: true,
              [`collectedCount${MetricTimeframe.AllTime}`]: true,
              [`tippedAmountCount${MetricTimeframe.AllTime}`]: true,
            },
          },
        },
        where: {
          status: ModelStatus.Published,
          availability: {
            not: Availability.Unsearchable,
          },
          OR: (whereOr?.length ?? 0) > 0 ? whereOr : undefined,
        },
      });

      console.log(
        `onFetchItemsToIndex :: fetching complete for ${indexName} range:`,
        offset,
        offset + READ_BATCH_SIZE - 1,
        'filters:',
        whereOr
      );

      // Avoids hitting the DB without data.
      if (models.length === 0) {
        return {
          indexReadyRecords: [],
          indexRecordsWithImages: [],
        };
      }

      const modelVersionIds = models.flatMap((m) => m.modelVersions.map((m) => m.id));
      const images = !!modelVersionIds.length
        ? await getImagesForModelVersion({
            modelVersionIds,
            imagesPerVersion: 10,
          })
        : [];

      const imageIds = images.map((image) => image.id);
      // Performs a single DB request:
      const tagsOnImages = !imageIds.length
        ? []
        : await db.tagsOnImage.findMany({
            select: {
              imageId: true,
              tag: {
                select: {
                  id: true,
                  name: true,
                },
              },
            },
            where: {
              imageId: {
                in: imageIds,
              },
            },
          });

      // Get tags for each image:
      const imagesWithTags = images.map((image) => {
        const imageTags = tagsOnImages
          .filter((tagOnImage) => tagOnImage.imageId === image.id)
          .map((tagOnImage) => tagOnImage.tag);

        return {
          ...image,
          tags: imageTags,
        };
      });

      const unavailableGenResources = await getUnavailableResources();

      const indexReadyRecords = models
        .map((modelRecord) => {
          const { user, modelVersions, tagsOnModels, hashes, rank, ...model } = modelRecord;

          const metrics = modelRecord.metrics[0] || {};

          const weightedRating =
            (metrics.rating * metrics.ratingCount + RATING_BAYESIAN_M * RATING_BAYESIAN_C) /
            (metrics.ratingCount + RATING_BAYESIAN_C);

          const [version] = modelVersions;

          if (!version) {
            return null;
          }

          const canGenerate = modelVersions.some(
            (x) => x.generationCoverage?.covered && unavailableGenResources.indexOf(x.id) === -1
          );

          const category = tagsOnModels.find((tagOnModel) =>
            modelCategoriesIds.includes(tagOnModel.tag.id)
          );

          return {
            ...model,
            lastVersionAtUnix: model.lastVersionAt?.getTime() ?? model.createdAt.getTime(),
            user,
            category: category?.tag,
            version: {
              ...version,
              hashes: version.hashes.map((hash) => hash.hash),
            },
            versions: modelVersions.map(({ generationCoverage, files, hashes, ...x }) => ({
              ...x,
              hashes: hashes.map((hash) => hash.hash),
              canGenerate:
                generationCoverage?.covered && unavailableGenResources.indexOf(x.id) === -1,
            })),
            triggerWords: [
              ...new Set(modelVersions.flatMap((modelVersion) => modelVersion.trainedWords)),
            ],
            fileFormats: [
              ...new Set(
                modelVersions
                  .flatMap((modelVersion) =>
                    modelVersion.files.map((x) => (x.metadata as ModelFileMetadata)?.format)
                  )
                  .filter(isDefined)
              ),
            ],
            hashes: hashes.map((hash) => hash.hash.toLowerCase()),
            tags: tagsOnModels.map((tagOnModel) => tagOnModel.tag),
            metrics: {
              ...metrics,
              weightedRating,
            },
            rank: {
              downloadCount: rank?.[`downloadCount${MetricTimeframe.AllTime}`] ?? 0,
              favoriteCount: rank?.[`favoriteCount${MetricTimeframe.AllTime}`] ?? 0,
              commentCount: rank?.[`commentCount${MetricTimeframe.AllTime}`] ?? 0,
              ratingCount: rank?.[`ratingCount${MetricTimeframe.AllTime}`] ?? 0,
              rating: rank?.[`rating${MetricTimeframe.AllTime}`] ?? 0,
              collectedCount: rank?.[`collectedCount${MetricTimeframe.AllTime}`] ?? 0,
              tippedAmountCount: rank?.[`tippedAmountCount${MetricTimeframe.AllTime}`] ?? 0,
            },
            canGenerate,
          };
        })
        // Removes null models that have no versionIDs
        .filter(isDefined);

      const indexRecordsWithImages = models
        .map((modelRecord) => {
          const { modelVersions, ...model } = modelRecord;
          const [modelVersion] = modelVersions;

          if (!modelVersion) {
            return null;
          }

          const modelImages = imagesWithTags.filter(
            (image) =>
              image.modelVersionId === modelVersion.id &&
              image.availability !== Availability.Unsearchable
          );

          return {
            id: model.id,
            images: modelImages,
          };
        })
        // Removes null models that have no versionIDs
        .filter(isDefined);

      return {
        indexReadyRecords,
        indexRecordsWithImages,
      };
    },
    3,
    1500
  );
};

const onUpdateQueueProcess = async ({ db, indexName }: { db: PrismaClient; indexName: string }) => {
  const queuedItems = await db.searchIndexUpdateQueue.findMany({
    select: {
      id: true,
    },
    where: { type: INDEX_ID, action: SearchIndexUpdateQueueAction.Update },
  });

  console.log(
    'onUpdateQueueProcess :: A total of ',
    queuedItems.length,
    ' have been updated and will be re-indexed'
  );

  const batchCount = Math.ceil(queuedItems.length / READ_BATCH_SIZE);

  const itemsToIndex: Awaited<ReturnType<typeof onFetchItemsToIndex>> = {
    indexReadyRecords: [],
    indexRecordsWithImages: [],
  };

  for (let batchNumber = 0; batchNumber < batchCount; batchNumber++) {
    const batch = queuedItems.slice(
      batchNumber * READ_BATCH_SIZE,
      batchNumber * READ_BATCH_SIZE + READ_BATCH_SIZE
    );

    const itemIds = batch.map(({ id }) => id);

    const { indexReadyRecords, indexRecordsWithImages } = await onFetchItemsToIndex({
      db,
      indexName,
      whereOr: [{ id: { in: itemIds } }],
    });

    itemsToIndex.indexReadyRecords.push(...indexReadyRecords);
    itemsToIndex.indexRecordsWithImages.push(...indexRecordsWithImages);
  }

  return itemsToIndex;
};

const onIndexUpdate = async ({
  db,
  lastUpdatedAt,
  indexName = INDEX_ID,
  updateIds,
  deleteIds,
}: SearchIndexRunContext) => {
  if (!client) return;

  // Confirm index setup & working:
  await onIndexSetup({ indexName });

  // Cleanup documents that require deletion:
  // Always pass INDEX_ID here, not index name, as pending to delete will
  // always use this name.
  await onSearchIndexDocumentsCleanup({ db, indexName: INDEX_ID });
  if (deleteIds && deleteIds.length > 0) {
    await onSearchIndexDocumentsCleanup({ db, indexName: INDEX_ID, ids: deleteIds });
  }

  const modelTasks: EnqueuedTask[] = [];

  if (lastUpdatedAt) {
    // Only if this is an update (NOT a reset or first run) will we care for queued items:

    // Update whatever items we have on the queue.
    // Do it on batches, since it's possible that there are far more items than we expect:
    const {
      indexReadyRecords: updateIndexReadyRecords,
      indexRecordsWithImages: updateIndexRecordsWithImages,
    } = await onUpdateQueueProcess({
      db,
      indexName,
    });

    if (updateIndexReadyRecords.length > 0) {
      const updateBaseTasks = await updateDocs({
        indexName,
        documents: updateIndexReadyRecords,
        batchSize: MEILISEARCH_DOCUMENT_BATCH_SIZE,
      });

      console.log('onIndexUpdate :: base tasks for updated items have been added');
      modelTasks.push(...updateBaseTasks);
    }

    if (updateIndexRecordsWithImages.length > 0) {
      const updateImageTasks = await updateDocs({
        indexName,
        documents: updateIndexRecordsWithImages,
        batchSize: MEILISEARCH_DOCUMENT_BATCH_SIZE,
      });

      console.log('onIndexUpdate :: image tasks for updated items have been added');

      modelTasks.push(...updateImageTasks);
    }
  }

  // Now, we can tackle new additions
  let offset = 0;
  while (true) {
    const whereOr: Prisma.Enumerable<Prisma.ModelWhereInput> = [];
    if (lastUpdatedAt) {
      whereOr.push({
        createdAt: {
          gt: lastUpdatedAt,
        },
      });

      whereOr.push({
        updatedAt: {
          gt: lastUpdatedAt,
        },
      });
    }

    if (updateIds && updateIds.length > 0) {
      whereOr.push({
        id: {
          in: updateIds,
        },
      });
    }

    const { indexReadyRecords, indexRecordsWithImages } = await onFetchItemsToIndex({
      db,
      indexName,
      skip: offset,
      whereOr,
    });

    if (indexReadyRecords.length === 0 && indexRecordsWithImages.length === 0) {
      break;
    }

    const baseTasks = await updateDocs({
      indexName,
      documents: indexReadyRecords,
      batchSize: MEILISEARCH_DOCUMENT_BATCH_SIZE,
    });

    console.log('onIndexUpdate :: base tasks have been added');

    const imagesTasks = await updateDocs({
      indexName,
      documents: indexRecordsWithImages,
      batchSize: MEILISEARCH_DOCUMENT_BATCH_SIZE,
    });

    console.log('onIndexUpdate :: image tasks have been added');

    modelTasks.push(...baseTasks);
    modelTasks.push(...imagesTasks);

    offset += indexReadyRecords.length;
  }

  console.log('onIndexUpdate :: Indexing complete');
};

export const modelsSearchIndex = createSearchIndexUpdateProcessor({
  indexName: INDEX_ID,
  swapIndexName: SWAP_INDEX_ID,
  onIndexUpdate,
  onIndexSetup,
});

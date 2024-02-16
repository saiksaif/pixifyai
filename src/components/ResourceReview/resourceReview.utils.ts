import { queryClient, trpc } from '~/utils/trpc';
import produce from 'immer';
import { getQueryKey } from '@trpc/react-query';
import { ResourceReviewPaged } from '~/types/router';
import { GetInfiniteImagesInput } from '~/server/schema/image.schema';
import { useFiltersContext } from '~/providers/FiltersProvider';
import { useMemo } from 'react';
import { GetResourceReviewsInfiniteInput } from '~/server/schema/resourceReview.schema';

export const useCreateResourceReview = ({
  modelId,
  modelVersionId,
}: {
  modelId: number;
  modelVersionId: number;
}) => {
  const queryUtils = trpc.useContext();
  return trpc.resourceReview.create.useMutation({
    onSuccess: async (response, request) => {
      queryUtils.resourceReview.getUserResourceReview.setData({ modelVersionId }, () => response);
      queryUtils.resourceReview.getRatingTotals.invalidate({ modelId, modelVersionId });
    },
  });
};

export const useUpdateResourceReview = ({
  modelId,
  modelVersionId,
}: {
  modelId: number;
  modelVersionId: number;
}) => {
  const queryUtils = trpc.useContext();
  return trpc.resourceReview.update.useMutation({
    onSuccess: async (response, request) => {
      if (request.rating) {
        queryUtils.resourceReview.getRatingTotals.invalidate({ modelId, modelVersionId });
      }
      // update single review on model reviews page
      // /models/:id/reviews?modelVersionId
      queryUtils.resourceReview.getUserResourceReview.setData(
        { modelVersionId },
        produce((old) => {
          if (!old) return;
          if (request.details) old.details = request.details as string;
          if (request.rating) old.rating = request.rating;
        })
      );

      // update single review on review details page
      // /reviews/:reviewId
      queryUtils.resourceReview.get.setData(
        { id: request.id },
        produce((old) => {
          if (!old) return;
          if (request.details) old.details = request.details as string;
          if (request.rating) old.rating = request.rating;
        })
      );

      // update paged reviews
      const queryKey = getQueryKey(trpc.resourceReview.getPaged);
      let shouldInvalidate = true;
      queryClient.setQueriesData(
        { queryKey, exact: false },
        produce<ResourceReviewPaged | undefined>((state) => {
          const item = state?.items.find((x) => x.id === response.id);
          if (item) {
            shouldInvalidate = false;
            if (request.rating) item.rating = request.rating;
            if (request.details) item.details = request.details as string;
          }
        })
      );
      if (shouldInvalidate) {
        // only invalidate if the item wasn't found in the cache
        queryUtils.resourceReview.getPaged.invalidate();
      }
    },
  });
};

export const useQueryResourceReview = (
  filters?: Partial<GetResourceReviewsInfiniteInput>,
  options?: { keepPreviousData?: boolean; enabled?: boolean }
) => {
  filters ??= {};
  const { data, ...rest } = trpc.resourceReview.getInfinite.useInfiniteQuery(
    { ...filters },
    {
      getNextPageParam: (lastPage) => (!!lastPage ? lastPage.nextCursor : 0),
      getPreviousPageParam: (firstPage) => (!!firstPage ? firstPage.nextCursor : 0),
      trpc: { context: { skipBatch: true } },
      ...options,
    }
  );

  const resourceReviews = useMemo(() => data?.pages.flatMap((x) => x.items) ?? [], [data]);

  return { data, resourceReviews, ...rest };
};

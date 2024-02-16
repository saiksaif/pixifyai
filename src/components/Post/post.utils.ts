import { MetricTimeframe } from '@prisma/client';
import { useMemo } from 'react';
import { z } from 'zod';
import { useApplyHiddenPreferences } from '~/components/HiddenPreferences/useApplyHiddenPreferences';
import { useZodRouteParams } from '~/hooks/useZodRouteParams';
import { useFiltersContext } from '~/providers/FiltersProvider';
import { PostSort } from '~/server/common/enums';
import { GetPostsByCategoryInput, PostsQueryInput } from '~/server/schema/post.schema';
import { removeEmpty } from '~/utils/object-helpers';
import { postgresSlugify } from '~/utils/string-helpers';
import { trpc } from '~/utils/trpc';
import { numericString, numericStringArray } from '~/utils/zod-helpers';

export const usePostQueryParams = () => useZodRouteParams(postQueryParamSchema);

export const usePostFilters = () => {
  const storeFilters = useFiltersContext((state) => state.posts);
  const { query } = usePostQueryParams();
  return removeEmpty({ ...storeFilters, ...query });
};

const postQueryParamSchema = z
  .object({
    tags: numericStringArray(),
    modelId: numericString(),
    modelVersionId: numericString(),
    username: z.string().transform(postgresSlugify).nullish(),
    view: z.enum(['categories', 'feed']),
    period: z.nativeEnum(MetricTimeframe),
    sort: z.nativeEnum(PostSort),
    collectionId: numericString(),
    section: z.enum(['published', 'draft']),
    followed: z.coerce.boolean(),
  })
  .partial();

export const useQueryPosts = (
  filters?: Partial<PostsQueryInput>,
  options?: { keepPreviousData?: boolean; enabled?: boolean }
) => {
  filters ??= {};
  const browsingMode = useFiltersContext((state) => state.browsingMode);
  const { data, isLoading, ...rest } = trpc.post.getInfinite.useInfiniteQuery(
    { ...filters, browsingMode, include: [] },
    {
      getNextPageParam: (lastPage) => (!!lastPage ? lastPage.nextCursor : 0),
      getPreviousPageParam: (firstPage) => (!!firstPage ? firstPage.nextCursor : 0),
      trpc: { context: { skipBatch: true } },
      ...options,
    }
  );

  const flatData = useMemo(() => data?.pages.flatMap((x) => (!!x ? x.items : [])), [data]);
  const { items: posts, loadingPreferences } = useApplyHiddenPreferences({
    type: 'posts',
    data: flatData,
  });
  return { data, posts, isLoading: isLoading || loadingPreferences, ...rest };
};

export const useQueryPostCategories = (
  filters?: Partial<GetPostsByCategoryInput>,
  options?: { keepPreviousData?: boolean; enabled?: boolean }
) => {
  filters ??= {};
  const browsingMode = useFiltersContext((state) => state.browsingMode);
  const { data, ...rest } = trpc.post.getPostsByCategory.useInfiniteQuery(
    { ...filters, browsingMode },
    {
      getNextPageParam: (lastPage) => (!!lastPage ? lastPage.nextCursor : 0),
      getPreviousPageParam: (firstPage) => (!!firstPage ? firstPage.nextCursor : 0),
      trpc: { context: { skipBatch: true } },
      keepPreviousData: true,
      ...options,
    }
  );

  const categories = useMemo(() => data?.pages.flatMap((x) => x.items) ?? [], [data]);

  return { data, categories, ...rest };
};

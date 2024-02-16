import { Group, LoadingOverlay, Paper, Stack, Text } from '@mantine/core';
import { IconMessageCancel } from '@tabler/icons-react';
import React, { useMemo } from 'react';
import { RoutedDialogLink } from '~/components/Dialog/RoutedDialogProvider';

import { MasonryGrid2 } from '~/components/MasonryGrid/MasonryGrid2';
import { CommentDiscussionItem } from '~/components/Model/ModelDiscussion/CommentDiscussionItem';
import { ReviewSort } from '~/server/common/enums';
import { trpc } from '~/utils/trpc';
import { ContainerGrid } from '~/components/ContainerGrid/ContainerGrid';
import { useContainerSmallerThan } from '~/components/ContainerProvider/useContainerSmallerThan';

export function ModelDiscussionV2({ modelId, limit: initialLimit = 8, onlyHidden }: Props) {
  const isMobile = useContainerSmallerThan('sm');
  const limit = isMobile ? initialLimit / 2 : initialLimit;
  const filters = { modelId, limit, sort: ReviewSort.Newest, hidden: onlyHidden };

  const { data, isLoading, isFetchingNextPage, fetchNextPage, hasNextPage, isRefetching } =
    trpc.comment.getAll.useInfiniteQuery(filters, {
      getNextPageParam: (lastPage) => lastPage.nextCursor,
      keepPreviousData: false,
    });
  const comments = useMemo(() => data?.pages.flatMap((x) => x.comments) ?? [], [data?.pages]);
  const hasItems = comments.length > 0;

  const { data: hiddenCommentsCount = 0 } = trpc.comment.getCommentCountByModel.useQuery(
    {
      modelId,
      hidden: true,
    },
    { enabled: !onlyHidden }
  );
  const hasHiddenComments = hiddenCommentsCount > 0;

  return (
    <ContainerGrid gutter="xl">
      <ContainerGrid.Col span={12} sx={{ position: 'relative' }}>
        <LoadingOverlay visible={isLoading} zIndex={10} />
        {hasItems ? (
          <Stack spacing={8}>
            <MasonryGrid2
              data={comments}
              render={CommentDiscussionItem}
              isRefetching={isRefetching}
              isFetchingNextPage={isFetchingNextPage}
              hasNextPage={hasNextPage}
              fetchNextPage={fetchNextPage}
              filters={filters}
              columnWidth={300}
              autoFetch={false}
            />
            {hasHiddenComments && !onlyHidden && (
              <RoutedDialogLink
                name="hiddenModelComments"
                state={{ modelId }}
                style={{ display: 'flex', justifyContent: 'center', alignSelf: 'center' }}
              >
                <Text size="xs" color="dimmed">
                  <Group spacing={4} position="center">
                    <IconMessageCancel size={16} />
                    <Text inherit inline>
                      {`See ${hiddenCommentsCount} more hidden ${
                        hiddenCommentsCount > 1 ? 'comments' : 'comment'
                      }`}
                    </Text>
                  </Group>
                </Text>
              </RoutedDialogLink>
            )}
          </Stack>
        ) : (
          <Paper
            p="xl"
            sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 200 }}
          >
            <Stack>
              <Text size="xl">There are no comments for this model yet.</Text>
              <Text color="dimmed">
                Be the first to let the people know about this model by leaving your comment.
              </Text>
            </Stack>
          </Paper>
        )}
      </ContainerGrid.Col>
    </ContainerGrid>
  );
}

type Props = {
  modelId: number;
  limit?: number;
  onlyHidden?: boolean;
  // filters: { filterBy: ReviewFilter[]; sort: ReviewSort };
};

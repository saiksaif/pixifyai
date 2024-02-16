import { Stack } from '@mantine/core';
import { Announcements } from '~/components/Announcements/Announcements';
import { setPageOptions } from '~/components/AppLayout/AppLayout';
import { FeedLayout } from '~/components/AppLayout/FeedLayout';
import { IsClient } from '~/components/IsClient/IsClient';
import { Meta } from '~/components/Meta/Meta';
import { PostCategoriesInfinite } from '~/components/Post/Categories/PostCategoriesInfinite';
import { PostCategories } from '~/components/Post/Infinite/PostCategories';
import PostsInfinite from '~/components/Post/Infinite/PostsInfinite';
import { usePostQueryParams } from '~/components/Post/post.utils';
import { env } from '~/env/client.mjs';
import { useCurrentUser } from '~/hooks/useCurrentUser';
import { useFiltersContext } from '~/providers/FiltersProvider';
import { containerQuery } from '~/utils/mantine-css-helpers';

export default function PostsPage() {
  const currentUser = useCurrentUser();
  const storedView = useFiltersContext((state) => state.posts.view);
  const { query } = usePostQueryParams();

  const view = env.NEXT_PUBLIC_UI_CATEGORY_VIEWS ? query.view ?? storedView : 'feed';

  return (
    <>
      <Meta
        title={`Civitai${
          !currentUser ? ` Posts | Explore Community-Created Content with Custom AI Resources` : ''
        }`}
        description="Discover engaging posts from our growing community on Civitai, featuring unique and creative content generated with custom Stable Diffusion AI resources crafted by talented community members."
        links={[{ href: `${env.NEXT_PUBLIC_BASE_URL}/posts`, rel: 'canonical' }]}
      />
      <Stack spacing="xs">
        <Announcements
          sx={(theme) => ({
            marginBottom: -35,
            [containerQuery.smallerThan('md')]: {
              marginBottom: -5,
            },
          })}
        />
        <IsClient>
          {view === 'categories' ? (
            <PostCategoriesInfinite filters={query} />
          ) : (
            <>
              <PostCategories />
              <PostsInfinite filters={query} showEof showAds />
            </>
          )}
        </IsClient>
      </Stack>
    </>
  );
}

setPageOptions(PostsPage, { innerLayout: FeedLayout });

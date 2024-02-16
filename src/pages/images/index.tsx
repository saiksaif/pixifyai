import { Stack, Title } from '@mantine/core';
import { Announcements } from '~/components/Announcements/Announcements';
import { setPageOptions } from '~/components/AppLayout/AppLayout';
import { FeedLayout } from '~/components/AppLayout/FeedLayout';
import { ImageCategoriesInfinite } from '~/components/Image/Categories/ImageCategoriesInfinite';
import { ImageCategories } from '~/components/Image/Filters/ImageCategories';
import { useImageFilters } from '~/components/Image/image.utils';
import ImagesInfinite from '~/components/Image/Infinite/ImagesInfinite';
import { IsClient } from '~/components/IsClient/IsClient';
import { Meta } from '~/components/Meta/Meta';
import { env } from '~/env/client.mjs';
import { containerQuery } from '~/utils/mantine-css-helpers';

export default function ImagesPage() {
  const { view: queryView, hidden } = useImageFilters('images');
  const canToggleView = env.NEXT_PUBLIC_UI_CATEGORY_VIEWS && !hidden;
  const view = env.NEXT_PUBLIC_UI_CATEGORY_VIEWS && canToggleView ? queryView : 'feed';

  return (
    <>
      <Meta
        title="Civitai Gallery | AI-Generated Art Showcase"
        description="See the latest art created by the generative AI art community and delve into the inspirations and prompts behind their work"
        links={[{ href: `${env.NEXT_PUBLIC_BASE_URL}/images`, rel: 'canonical' }]}
      />

      {hidden && <Title>Your Hidden Images</Title>}
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
            <ImageCategoriesInfinite />
          ) : (
            <>
              <ImageCategories />
              <ImagesInfinite showEof showAds />
            </>
          )}
        </IsClient>
      </Stack>
    </>
  );
}

setPageOptions(ImagesPage, { innerLayout: FeedLayout });

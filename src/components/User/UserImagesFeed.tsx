import { Group, Stack } from '@mantine/core';

import { PeriodFilter, SortFilter } from '~/components/Filters';
import ImagesInfinite from '~/components/Image/Infinite/ImagesInfinite';
import { MasonryContainer } from '~/components/MasonryColumns/MasonryContainer';
import { MasonryProvider } from '~/components/MasonryColumns/MasonryProvider';
import { constants } from '~/server/common/constants';

export function UserImagesFeed({ username }: Props) {
  return (
    <MasonryProvider
      columnWidth={constants.cardSizes.image}
      maxColumnCount={7}
      maxSingleColumnWidth={450}
    >
      <MasonryContainer>
        <Stack spacing="xs">
          <Group position="apart" spacing={0}>
            <SortFilter type="images" />
            <PeriodFilter type="images" />
          </Group>
          {/* <ImageCategories /> */}
          <ImagesInfinite
            filters={{ username, types: undefined, withMeta: undefined, hidden: undefined }}
            withTags
          />
        </Stack>
      </MasonryContainer>
    </MasonryProvider>
  );
}

type Props = { username: string };

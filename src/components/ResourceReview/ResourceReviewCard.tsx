import { Card, Stack, Group, Rating, Badge, Center, Text, Button, ScrollArea } from '@mantine/core';
import { UserAvatar } from '~/components/UserAvatar/UserAvatar';
import { IconPhoto, IconMessageCircle2 } from '@tabler/icons-react';
import { abbreviateNumber } from '~/utils/number-helpers';
import { RenderHtml } from '~/components/RenderHtml/RenderHtml';
import { ResourceReviewInfiniteModel } from '~/types/router';
import { StarRating } from '../StartRating/StarRating';

export function ResourceReviewCard({ data }: { data: ResourceReviewInfiniteModel }) {
  return (
    <Card p="xs">
      <Stack>
        <UserAvatar user={data.user} withUsername withLink />
        {data.rating && (
          <Group position="apart">
            <StarRating value={data.rating ?? undefined} />
            {data.helper?.imageCount && (
              <Badge
                leftSection={
                  <Center>
                    <IconPhoto size={14} />
                  </Center>
                }
              >
                {data.helper.imageCount}
              </Badge>
            )}
          </Group>
        )}
        {data.details && (
          <ScrollArea.Autosize maxHeight={200}>
            <RenderHtml html={data.details} sx={(theme) => ({ fontSize: theme.fontSizes.sm })} />
          </ScrollArea.Autosize>
        )}
      </Stack>
      <Card.Section>
        <Group p="xs" position="apart">
          <span>{/* TODO.posts  - Reactions */}</span>
          <Button size="xs" radius="xl" variant="subtle" compact>
            <Group spacing={2} noWrap>
              <IconMessageCircle2 size={14} />
              {data.thread && <Text>{abbreviateNumber(data.thread._count.comments)}</Text>}
            </Group>
          </Button>
        </Group>
      </Card.Section>
    </Card>
  );
}

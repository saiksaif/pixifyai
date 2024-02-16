import { Group, Stack, Text, ThemeIcon, UnstyledButton, Tooltip } from '@mantine/core';
import React from 'react';
import { FeedCard } from '~/components/Cards/FeedCard';
import { useCardStyles } from '~/components/Cards/Cards.styles';
import { EdgeMedia } from '~/components/EdgeMedia/EdgeMedia';
import { ImageGuard, ImageGuardReportContext } from '~/components/ImageGuard/ImageGuard';
import { MediaHash } from '~/components/ImageHash/ImageHash';
import { UserAvatar } from '~/components/UserAvatar/UserAvatar';
import { PostsInfiniteModel } from '~/server/services/post.service';
import { useRouter } from 'next/router';
import { IconClubs, IconPhoto } from '@tabler/icons-react';
import { abbreviateNumber } from '~/utils/number-helpers';
import { IconBadge } from '~/components/IconBadge/IconBadge';
import { useCurrentUser } from '../../hooks/useCurrentUser';
import { AddToClubMenuItem } from '../Club/AddToClubMenuItem';
import { useFeatureFlags } from '../../providers/FeatureFlagsProvider';
import { truncate } from 'lodash-es';
import { constants } from '~/server/common/constants';

const IMAGE_CARD_WIDTH = 332;

export function PostCard({ data }: Props) {
  const { classes, cx } = useCardStyles({ aspectRatio: 1 });
  const router = useRouter();
  const currentUser = useCurrentUser();
  const features = useFeatureFlags();

  return (
    <FeedCard href={`/posts/${data.id}`} aspectRatio="square">
      <div className={classes.root}>
        <ImageGuard
          images={[data.image]}
          connect={{ entityId: data.id, entityType: 'post' }}
          render={(image) => (
            <ImageGuard.Content>
              {({ safe }) => (
                <>
                  <Group
                    position="apart"
                    align="start"
                    spacing={4}
                    className={cx(classes.contentOverlay, classes.top)}
                  >
                    <ImageGuard.ToggleConnect position="static" />
                    <Stack spacing="xs" ml="auto">
                      <ImageGuard.Report context="post" position="static" withinPortal />
                    </Stack>
                  </Group>
                  {!safe ? (
                    <MediaHash {...data.image} />
                  ) : (
                    <EdgeMedia
                      src={image.url}
                      name={image.name ?? image.id.toString()}
                      alt={
                        image.meta
                          ? truncate(image.meta.prompt, { length: constants.altTruncateLength })
                          : image.name ?? undefined
                      }
                      type={image.type}
                      width={IMAGE_CARD_WIDTH}
                      placeholder="empty"
                      className={classes.image}
                    />
                  )}
                </>
              )}
            </ImageGuard.Content>
          )}
        />
        <Stack
          className={cx(classes.contentOverlay, classes.bottom, classes.gradientOverlay)}
          spacing="sm"
        >
          <Group position="apart" align="end" noWrap>
            <Stack spacing="sm">
              {data.user?.id !== -1 && (
                <UnstyledButton
                  sx={{ color: 'white' }}
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();

                    router.push(`/user/${data.user.username}`);
                  }}
                >
                  <UserAvatar
                    user={data.user}
                    avatarProps={{ radius: 'md', size: 32 }}
                    withUsername
                  />
                </UnstyledButton>
              )}
              {data.title && (
                <Text size="xl" weight={700} lineClamp={2} lh={1.2}>
                  {data.title}
                </Text>
              )}
            </Stack>
            <Group align="end">
              <IconBadge className={classes.iconBadge} icon={<IconPhoto size={14} />}>
                <Text size="xs">{abbreviateNumber(data.imageCount)}</Text>
              </IconBadge>
            </Group>
          </Group>
        </Stack>
      </div>
    </FeedCard>
  );
}

type Props = { data: PostsInfiniteModel };

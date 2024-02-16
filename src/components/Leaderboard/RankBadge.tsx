import { BadgeProps, Box, Group, MantineColor, MantineSize, Text, Tooltip } from '@mantine/core';
import { IconCrown } from '@tabler/icons-react';
import { EdgeMedia } from '~/components/EdgeMedia/EdgeMedia';
import { IconBadge } from '~/components/IconBadge/IconBadge';

const rankColors: Record<number, MantineColor> = {
  1: 'blue',
  3: 'yellow',
  10: 'gray',
  100: 'orange',
};

export const RankBadge = ({
  rank,
  size,
  textSize = 'sm',
  iconSize = 18,
  withTitle,
  ...props
}: Props) => {
  if (!rank || !rank.leaderboardRank || rank.leaderboardRank > 100) return null;

  let badgeColor: MantineColor = 'gray';
  for (const [rankLimit, rankColor] of Object.entries(rankColors)) {
    if (rank.leaderboardRank <= parseInt(rankLimit)) {
      badgeColor = rankColor;
      break;
    }
  }

  const hasLeaderboardCosmetic = !!rank.leaderboardCosmetic;

  return (
    <Tooltip label={`${rank.leaderboardTitle} Rank`} position="top" color="dark" withArrow>
      <Group spacing={0} noWrap sx={{ position: 'relative' }}>
        {rank.leaderboardCosmetic ? (
          <Box pos="relative" sx={{ zIndex: 2 }}>
            <EdgeMedia
              src={rank.leaderboardCosmetic}
              alt={`${rank.leaderboardTitle} position #${rank.leaderboardRank}`}
              width={32}
            />
          </Box>
        ) : null}
        <IconBadge
          size={size}
          color={badgeColor}
          // @ts-ignore
          variant={withTitle ? 'transparent' : badgeColor === 'gray' ? 'filled' : undefined}
          href={`/leaderboard/${rank.leaderboardId}?position=${rank.leaderboardRank}`}
          icon={!hasLeaderboardCosmetic ? <IconCrown size={iconSize} /> : undefined}
          sx={
            hasLeaderboardCosmetic
              ? {
                  paddingLeft: 16,
                  marginLeft: -14,
                  borderTopLeftRadius: 0,
                  borderBottomLeftRadius: 0,
                }
              : undefined
          }
          {...props}
        >
          <Text size={textSize} inline>
            #{rank.leaderboardRank} {withTitle ? rank.leaderboardTitle : null}
          </Text>
        </IconBadge>
      </Group>
    </Tooltip>
  );
};

type Props = {
  rank: {
    leaderboardRank: number | null;
    leaderboardId: string | null;
    leaderboardTitle: string | null;
    leaderboardCosmetic?: string | null;
  } | null;
  textSize?: MantineSize;
  iconSize?: number;
  withTitle?: boolean;
} & Omit<BadgeProps, 'leftSection'>;

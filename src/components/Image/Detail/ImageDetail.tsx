import {
  ActionIcon,
  Box,
  Button,
  Card,
  CloseButton,
  createStyles,
  Divider,
  Group,
  MantineProvider,
  Paper,
  ScrollArea,
  Stack,
  Text,
} from '@mantine/core';
import { Availability, CollectionType, NsfwLevel } from '@prisma/client';
import {
  IconAlertTriangle,
  IconBrush,
  IconDotsVertical,
  IconFlag,
  IconEye,
  IconInfoCircle,
  IconBookmark,
  IconShare3,
} from '@tabler/icons-react';
import { getEdgeUrl } from '~/client-utils/cf-images-utils';
import { Adunit } from '~/components/Ads/AdUnit';
import { adsRegistry } from '~/components/Ads/adsRegistry';
import { AlertWithIcon } from '~/components/AlertWithIcon/AlertWithIcon';
import { NotFound } from '~/components/AppLayout/NotFound';
import { useBrowserRouter } from '~/components/BrowserRouter/BrowserRouterProvider';
import { TipBuzzButton } from '~/components/Buzz/TipBuzzButton';
import { ChatUserButton } from '~/components/Chat/ChatUserButton';
import { ContentPolicyLink } from '~/components/ContentPolicyLink/ContentPolicyLink';
import { DaysFromNow } from '~/components/Dates/DaysFromNow';
import { RoutedDialogLink } from '~/components/Dialog/RoutedDialogProvider';
import { DismissibleAlert } from '~/components/DismissibleAlert/DismissibleAlert';
import { FollowUserButton } from '~/components/FollowUserButton/FollowUserButton';
import { ImageDetailCarousel } from '~/components/Image/Detail/ImageDetailCarousel';
import { ImageDetailComments } from '~/components/Image/Detail/ImageDetailComments';
import { ImageDetailContextMenu } from '~/components/Image/Detail/ImageDetailContextMenu';
import { useImageDetailContext } from '~/components/Image/Detail/ImageDetailProvider';
import { ImageResources } from '~/components/Image/Detail/ImageResources';
import { ImageMeta } from '~/components/ImageMeta/ImageMeta';
import { Meta } from '~/components/Meta/Meta';
import { PageLoader } from '~/components/PageLoader/PageLoader';
import { Reactions } from '~/components/Reaction/Reactions';
import { ShareButton } from '~/components/ShareButton/ShareButton';
import { TrackView } from '~/components/TrackView/TrackView';
import { UserAvatar } from '~/components/UserAvatar/UserAvatar';
import { VotableTags } from '~/components/VotableTags/VotableTags';
import { env } from '~/env/client.mjs';
import { useCurrentUser } from '~/hooks/useCurrentUser';
import { openContext } from '~/providers/CustomModalsProvider';
import { BrowsingMode } from '~/server/common/enums';
import { generationPanel } from '~/store/generation.store';
import { containerQuery } from '~/utils/mantine-css-helpers';
import { abbreviateNumber } from '~/utils/number-helpers';
import { LoginRedirect } from '~/components/LoginRedirect/LoginRedirect';
import { ReportEntity } from '~/server/schema/report.schema';

const UNFURLABLE: NsfwLevel[] = [NsfwLevel.None, NsfwLevel.Soft];
export function ImageDetail() {
  const { classes, cx, theme } = useStyles();
  const { image, isLoading, active, toggleInfo, close, shareUrl } = useImageDetailContext();
  const { query } = useBrowserRouter();
  const currentUser = useCurrentUser();

  if (isLoading) return <PageLoader />;
  if (!image) return <NotFound />;

  const nsfw = image.nsfw !== 'None';

  return (
    <>
      <Meta
        title={`Image posted by ${image.user.username}`}
        image={
          image.url == null || !UNFURLABLE.includes(image.nsfw)
            ? undefined
            : getEdgeUrl(image.url, { width: 1200 })
        }
        links={[{ href: `${env.NEXT_PUBLIC_BASE_URL}/images/${image.id}`, rel: 'canonical' }]}
        deIndex={
          image.nsfw !== NsfwLevel.None ||
          !!image.needsReview ||
          image.availability === Availability.Unsearchable
            ? 'noindex, nofollow'
            : undefined
        }
      />
      <TrackView entityId={image.id} entityType="Image" type="ImageView" nsfw={nsfw} />
      <MantineProvider theme={{ colorScheme: 'dark' }} inherit>
        <Paper className={classes.root}>
          <CloseButton
            style={{ position: 'absolute', top: 15, right: 15, zIndex: 10 }}
            size="lg"
            variant="default"
            onClick={close}
            className={classes.mobileOnly}
          />
          <ImageDetailCarousel className={classes.carousel} />
          <ActionIcon
            size="lg"
            className={cx(classes.info, classes.mobileOnly)}
            onClick={toggleInfo}
            variant="default"
          >
            <IconInfoCircle />
          </ActionIcon>
          <Card
            className={cx(classes.sidebar, {
              [classes.active]: active,
            })}
          >
            <Card.Section py="xs" withBorder inheritPadding>
              <Group position="apart" spacing={8}>
                <UserAvatar
                  user={image.user}
                  avatarProps={{ size: 32 }}
                  size="sm"
                  subText={
                    <Text size="xs" color="dimmed">
                      Uploaded <DaysFromNow date={image.createdAt} />
                    </Text>
                  }
                  subTextForce
                  withUsername
                  linkToProfile
                />
                <Group
                  spacing={8}
                  sx={{ [containerQuery.smallerThan('sm')]: { flexGrow: 1 } }}
                  noWrap
                >
                  <TipBuzzButton
                    toUserId={image.user.id}
                    entityId={image.id}
                    entityType="Image"
                    size="md"
                    compact
                  />
                  <ChatUserButton user={image.user} size="md" compact />
                  <FollowUserButton userId={image.user.id} size="md" compact />
                  <CloseButton
                    size="md"
                    radius="xl"
                    variant="transparent"
                    ml="auto"
                    iconSize={20}
                    onClick={(e) => {
                      e.stopPropagation();
                      close();
                    }}
                  />
                </Group>
              </Group>
            </Card.Section>
            <Card.Section
              py="xs"
              sx={{ backgroundColor: theme.colors.dark[7] }}
              withBorder
              inheritPadding
            >
              <Stack spacing={8}>
                <Group position="apart" spacing={8}>
                  <Group spacing={8}>
                    {currentUser && image.meta && (
                      <Button
                        size="md"
                        radius="xl"
                        color="blue"
                        variant={theme.colorScheme === 'dark' ? 'filled' : 'light'}
                        onClick={() => generationPanel.open({ type: 'image', id: image.id })}
                        data-activity="remix:image"
                        compact
                      >
                        <Group spacing={4} noWrap>
                          <IconBrush size={14} />
                          <Text size="xs">Remix</Text>
                        </Group>
                      </Button>
                    )}
                    {image.postId &&
                      (!query.postId ? (
                        <RoutedDialogLink
                          name="postDetail"
                          state={{ postId: image.postId }}
                          passHref
                        >
                          <Button
                            component="a"
                            size="md"
                            radius="xl"
                            color="gray"
                            variant={theme.colorScheme === 'dark' ? 'filled' : 'light'}
                            compact
                          >
                            <Group spacing={4}>
                              <IconEye size={14} />
                              <Text size="xs">View post</Text>
                            </Group>
                          </Button>
                        </RoutedDialogLink>
                      ) : (
                        <Button
                          component="a"
                          size="md"
                          radius="xl"
                          color="gray"
                          variant={theme.colorScheme === 'dark' ? 'filled' : 'light'}
                          compact
                          onClick={close}
                        >
                          <Group spacing={4}>
                            <IconEye size={14} />
                            <Text size="xs">View post</Text>
                          </Group>
                        </Button>
                      ))}
                    <ActionIcon
                      size={30}
                      radius="xl"
                      color="gray"
                      variant={theme.colorScheme === 'dark' ? 'filled' : 'light'}
                      onClick={() =>
                        openContext('addToCollection', {
                          imageId: image.id,
                          type: CollectionType.Image,
                        })
                      }
                    >
                      <IconBookmark size={14} />
                    </ActionIcon>
                    <ShareButton
                      url={shareUrl}
                      title={`Image by ${image.user.username}`}
                      collect={{ type: CollectionType.Image, imageId: image.id }}
                    >
                      <ActionIcon
                        size={30}
                        radius="xl"
                        color="gray"
                        variant={theme.colorScheme === 'dark' ? 'filled' : 'light'}
                      >
                        <IconShare3 size={14} />
                      </ActionIcon>
                    </ShareButton>
                  </Group>
                  <Group spacing={8}>
                    <LoginRedirect reason={'report-content'}>
                      <ActionIcon
                        size={30}
                        variant={theme.colorScheme === 'dark' ? 'filled' : 'light'}
                        radius="xl"
                        onClick={(e) => {
                          openContext('report', {
                            entityType: ReportEntity.Image,
                            entityId: image.id,
                          });
                        }}
                      >
                        <IconFlag size={14} stroke={2} />
                      </ActionIcon>
                    </LoginRedirect>
                    <ImageDetailContextMenu>
                      <ActionIcon
                        size={30}
                        variant={theme.colorScheme === 'dark' ? 'filled' : 'light'}
                        radius="xl"
                      >
                        <IconDotsVertical size={14} />
                      </ActionIcon>
                    </ImageDetailContextMenu>
                  </Group>
                </Group>
              </Stack>
            </Card.Section>
            <Card.Section
              component={ScrollArea}
              style={{ flex: 1, position: 'relative' }}
              classNames={{ viewport: classes.scrollViewport }}
            >
              <Stack spacing="md" pt={image.needsReview ? 0 : 'md'} pb="md" style={{ flex: 1 }}>
                {image.needsReview && (
                  <AlertWithIcon
                    icon={<IconAlertTriangle />}
                    color="yellow"
                    iconColor="yellow"
                    title="Flagged for review"
                    radius={0}
                    px="md"
                  >
                    {`This image won't be visible to other users until it's reviewed by our moderators.`}
                  </AlertWithIcon>
                )}
                <VotableTags entityType="image" entityId={image.id} canAdd collapsible px="sm" />
                <div>
                  <Divider
                    label="Discussion"
                    labelPosition="center"
                    styles={{
                      label: {
                        marginTop: '-9px !important',
                        marginBottom: -9,
                      },
                    }}
                  />
                  <Paper p="sm" radius={0}>
                    <Stack spacing={8}>
                      <Group position="apart">
                        <Reactions
                          entityId={image.id}
                          entityType="image"
                          reactions={image.reactions}
                          metrics={{
                            likeCount: image.stats?.likeCountAllTime,
                            dislikeCount: image.stats?.dislikeCountAllTime,
                            heartCount: image.stats?.heartCountAllTime,
                            laughCount: image.stats?.laughCountAllTime,
                            cryCount: image.stats?.cryCountAllTime,
                            tippedAmountCount: image.stats?.tippedAmountCountAllTime,
                          }}
                          targetUserId={image.user.id}
                        />
                        <Stack spacing={2}>
                          <Text size="sm" align="center" weight={500} lh={1.1}>
                            {abbreviateNumber(image.stats?.viewCountAllTime ?? 0)}
                          </Text>
                          <Group spacing={4}>
                            <IconEye size={14} stroke={1.5} />
                            <Text color="dimmed" size="xs" lh={1} mt={-2}>
                              total views
                            </Text>
                          </Group>
                        </Stack>
                      </Group>
                      <ImageDetailComments imageId={image.id} userId={image.user.id} />
                    </Stack>
                  </Paper>
                </div>
                <Adunit
                  browsingModeOverride={!nsfw ? BrowsingMode.SFW : undefined}
                  showRemoveAds
                  {...adsRegistry.imageDetail}
                />
                <Stack spacing="md" mt="auto">
                  <Divider label="Resources Used" labelPosition="center" />

                  <Box px="md">
                    <ImageResources imageId={image.id} />
                  </Box>
                  {image.meta && (
                    <>
                      <Divider label="Generation Data" labelPosition="center" mb={-15} />
                      <Box px="md">
                        <ImageMeta meta={image.meta} imageId={image.id} />
                      </Box>
                    </>
                  )}
                </Stack>
              </Stack>
            </Card.Section>
          </Card>
        </Paper>
      </MantineProvider>
    </>
  );
}

const useStyles = createStyles((theme, _props, getRef) => {
  const isMobile = containerQuery.smallerThan('md');
  const isDesktop = containerQuery.largerThan('md');
  return {
    root: {
      flex: 1,
      display: 'flex',
      position: 'relative',
      overflow: 'hidden',
      zIndex: 200,
    },
    carousel: {
      flex: 1,
      alignItems: 'stretch',
    },
    active: { ref: getRef('active') },
    sidebar: {
      width: 457,
      borderRadius: 0,
      borderLeft: `1px solid ${theme.colors.dark[4]}`,
      display: 'flex',
      flexDirection: 'column',

      [isMobile]: {
        position: 'absolute',
        top: '100%',
        left: 0,
        width: '100%',
        height: '100%',
        transition: '.3s ease transform',
        // transform: 'translateY(100%)',
        zIndex: 20,

        [`&.${getRef('active')}`]: {
          transform: 'translateY(-100%)',
        },
      },
    },
    mobileOnly: { [isDesktop]: { display: 'none' } },
    desktopOnly: { [isMobile]: { display: 'none' } },
    info: {
      position: 'absolute',
      bottom: theme.spacing.md,
      right: theme.spacing.md,
    },
    // Overwrite scrollArea generated styles
    scrollViewport: {
      '& > div': {
        minHeight: '100%',
        display: 'flex !important',
      },
    },
  };
});

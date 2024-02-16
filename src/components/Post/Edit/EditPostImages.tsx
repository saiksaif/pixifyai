import {
  createStyles,
  Stack,
  Menu,
  ActionIcon,
  Group,
  Badge,
  Progress,
  Text,
  Card,
  Alert,
  Center,
  Popover,
  Code,
  BadgeProps,
  Button,
  Loader,
} from '@mantine/core';
import { EdgeMedia } from '~/components/EdgeMedia/EdgeMedia';
import { Fragment, useEffect, useState } from 'react';
import {
  IconDotsVertical,
  IconInfoCircle,
  IconTrash,
  IconX,
  IconExclamationMark,
  IconExclamationCircle,
  IconCheck,
  IconArrowBackUp,
} from '@tabler/icons-react';
import { DeleteImage } from '~/components/Image/DeleteImage/DeleteImage';
import { useCFUploadStore } from '~/store/cf-upload.store';
import { EditImageDrawer } from '~/components/Post/Edit/EditImageDrawer';
import { PostEditImage } from '~/server/controllers/post.controller';
import { VotableTags } from '~/components/VotableTags/VotableTags';
import { POST_IMAGE_LIMIT } from '~/server/common/constants';
import { ImageIngestionStatus } from '@prisma/client';
import { ImageDropzone } from '~/components/Image/ImageDropzone/ImageDropzone';
import { useEditPostContext, ImageUpload, ImageBlocked } from './EditPostProvider';
import { postImageTransmitter } from '~/store/post-image-transmitter.store';
import { IMAGE_MIME_TYPE, MEDIA_TYPE, VIDEO_MIME_TYPE } from '~/server/common/mime-types';
import { useCurrentUser } from '~/hooks/useCurrentUser';
import { UnblockImage } from '~/components/Image/UnblockImage/UnblockImage';
import { useImageStore } from '~/store/image.store';
import { DismissibleAlert } from '~/components/DismissibleAlert/DismissibleAlert';

export function EditPostImages({ max = POST_IMAGE_LIMIT }: { max?: number }) {
  const currentUser = useCurrentUser();
  const postId = useEditPostContext((state) => state.id);
  const modelVersionId = useEditPostContext((state) => state.modelVersionId);
  const upload = useEditPostContext((state) => state.upload);
  const images = useEditPostContext((state) => state.images);

  const handleDrop = async (files: File[]) => {
    if (currentUser?.muted) return;
    upload({ postId, modelVersionId }, files);
  };

  useEffect(() => {
    const files = postImageTransmitter.getData();
    if (files) handleDrop([...files].splice(0, max));
  }, []);

  return (
    <Stack>
      <ImageDropzone
        onDrop={handleDrop}
        count={images.length}
        max={max}
        accept={[...IMAGE_MIME_TYPE, ...VIDEO_MIME_TYPE]}
      />
      <DismissibleAlert
        id="image-tagging"
        content="Images are tagged automatically by our tagging system. You can always downvote tags that you think are wrongly placed on your images for moderators to review."
      />
      <Stack>
        {images.map(({ discriminator: type, data }, index) => (
          <Fragment key={index}>
            {type === 'image' && <ImageController image={data} />}
            {type === 'upload' && <ImageUpload {...data} />}
            {type === 'blocked' && <ImageBlocked {...data} />}
          </Fragment>
        ))}
      </Stack>
      <EditImageDrawer />
    </Stack>
  );
}

function ImageController({ image }: { image: PostEditImage }) {
  const { id, url, previewUrl, name, meta, resourceHelper, blockedFor, type, ingestion } =
    useImageStore(image);

  const currentUser = useCurrentUser();
  const { classes, cx } = useStyles();
  const [withBorder, setWithBorder] = useState(false);
  const removeImage = useEditPostContext((state) => state.removeImage);
  const setSelectedImageId = useEditPostContext((state) => state.setSelectedImageId);
  const handleSelectImageClick = () => setSelectedImageId(id);

  const isPending = ingestion === ImageIngestionStatus.Pending;
  const isBlocked = ingestion === ImageIngestionStatus.Blocked;
  const isScanned = ingestion === ImageIngestionStatus.Scanned;

  return (
    <Card className={classes.container} withBorder={withBorder} p={0}>
      <EdgeMedia
        src={previewUrl ?? url}
        alt={name ?? undefined}
        width="original"
        type={type}
        onLoad={() => setWithBorder(true)}
        className={cx({ [classes.blocked]: isBlocked })}
      />

      {isPending && (
        <Alert color="yellow" p="xs" w="100%" radius={0}>
          <Group position="center" spacing="xs">
            <Loader size="xs" />
            <Text align="center">Analyzing image</Text>
          </Group>
        </Alert>
      )}

      {isBlocked && (
        <Card
          radius={0}
          p={0}
          sx={{
            position: 'absolute',
            top: '50%',
            left: '50%',
            transform: 'translate(-50%,-50%)',
            minWidth: 300,
          }}
        >
          <Alert
            color="red"
            radius={0}
            title={
              <Group spacing={4}>
                <Popover position="top" withinPortal withArrow>
                  <Popover.Target>
                    <ActionIcon>
                      <IconInfoCircle />
                    </ActionIcon>
                  </Popover.Target>
                  <Popover.Dropdown>
                    <Stack spacing={0}>
                      <Text size="xs" weight={500}>
                        Blocked for
                      </Text>
                      <Code color="red">{blockedFor}</Code>
                    </Stack>
                  </Popover.Dropdown>
                </Popover>
                <Text>TOS Violation</Text>
              </Group>
            }
          >
            <Stack align="flex-end" spacing={0}>
              <Text>This image has been flagged as a TOS violation.</Text>
              {currentUser?.isModerator && (
                <Group grow w="100%">
                  <UnblockImage imageId={id} skipConfirm>
                    {({ onClick, isLoading }) => (
                      <Button
                        onClick={onClick}
                        loading={isLoading}
                        color="gray.6"
                        mt="xs"
                        leftIcon={<IconArrowBackUp size={20} />}
                      >
                        Unblock
                      </Button>
                    )}
                  </UnblockImage>
                  <DeleteImage imageId={id} onSuccess={(id) => removeImage(id)} skipConfirm>
                    {({ onClick, isLoading }) => (
                      <Button
                        onClick={onClick}
                        loading={isLoading}
                        color="red.7"
                        mt="xs"
                        leftIcon={<IconTrash size={20} />}
                      >
                        Delete
                      </Button>
                    )}
                  </DeleteImage>
                </Group>
              )}
            </Stack>
          </Alert>
        </Card>
      )}

      {isScanned && <VotableTags entityType="image" entityId={id} p="xs" canAdd />}

      <Group className={classes.actions}>
        {meta ? (
          <Badge {...readyBadgeProps} onClick={handleSelectImageClick}>
            Generation Data
          </Badge>
        ) : (
          <Badge {...warningBadgeProps} onClick={handleSelectImageClick}>
            Missing Generation Data
          </Badge>
        )}
        {resourceHelper.length ? (
          <Badge {...readyBadgeProps} onClick={handleSelectImageClick}>
            Resources: {resourceHelper.length}
          </Badge>
        ) : (
          <Badge {...blockingBadgeProps} onClick={handleSelectImageClick}>
            Missing Resources
          </Badge>
        )}
        <Menu position="bottom-end" withinPortal>
          <Menu.Target>
            <ActionIcon size="lg" variant="transparent" p={0}>
              <IconDotsVertical
                size={24}
                color="#fff"
                style={{ filter: `drop-shadow(0 0 2px #000)` }}
              />
            </ActionIcon>
          </Menu.Target>
          <Menu.Dropdown>
            <Menu.Item onClick={handleSelectImageClick}>Edit image</Menu.Item>
            <DeleteImage imageId={id} onSuccess={(id) => removeImage(id)}>
              {({ onClick, isLoading }) => (
                <Menu.Item color="red" onClick={onClick}>
                  Delete image
                </Menu.Item>
              )}
            </DeleteImage>
          </Menu.Dropdown>
        </Menu>
      </Group>
    </Card>
  );
}

function ImageUpload({ url, name, uuid, status, message, file, mimeType }: ImageUpload) {
  const { classes, cx } = useStyles();
  const items = useCFUploadStore((state) => state.items);
  const trackedFile = items.find((x) => x.file === file);
  const removeFile = useEditPostContext((state) => state.removeFile);
  const hasError =
    trackedFile && (trackedFile.status === 'error' || trackedFile.status === 'aborted');

  useEffect(() => {
    if (trackedFile?.status === 'dequeued') removeFile(uuid);
  }, [trackedFile?.status]); //eslint-disable-line

  return (
    <Card className={classes.container} withBorder p={0}>
      <EdgeMedia src={url} alt={name ?? undefined} type={MEDIA_TYPE[mimeType]} />
      {trackedFile && (
        <Alert
          radius={0}
          p="sm"
          color={hasError ? 'red' : undefined}
          variant={hasError ? 'filled' : undefined}
          className={cx(classes.footer, { [classes.ambient]: !hasError })}
        >
          <Group noWrap>
            <Text>{trackedFile.status}</Text>
            <Progress
              sx={{ flex: 1 }}
              size="xl"
              value={trackedFile.progress}
              label={`${Math.floor(trackedFile.progress)}%`}
              color={trackedFile.progress < 100 ? 'blue' : 'green'}
              striped
              animate
            />
            {hasError ? (
              <ActionIcon color="red" onClick={() => removeFile(uuid)}>
                <IconX />
              </ActionIcon>
            ) : trackedFile.status !== 'success' ? (
              <ActionIcon onClick={trackedFile.abort}>
                <IconX />
              </ActionIcon>
            ) : null}
          </Group>
        </Alert>
      )}
      {status === 'blocked' && (
        <>
          <ActionIcon
            className={classes.actions}
            onClick={() => removeFile(uuid)}
            color="red"
            variant="filled"
            size="xl"
          >
            <IconTrash />
          </ActionIcon>
          <Card className={classes.footer} radius={0} p={0}>
            <Alert color="red" radius={0}>
              <Center>
                <Group spacing={4}>
                  <Popover position="top" withinPortal withArrow>
                    <Popover.Target>
                      <ActionIcon>
                        <IconInfoCircle />
                      </ActionIcon>
                    </Popover.Target>
                    <Popover.Dropdown>
                      <Stack spacing={0}>
                        <Text size="xs" weight={500}>
                          Blocked for
                        </Text>
                        <Code color="red">{message}</Code>
                      </Stack>
                    </Popover.Dropdown>
                  </Popover>
                  <Text>TOS Violation</Text>
                </Group>
              </Center>
            </Alert>
          </Card>
        </>
      )}
    </Card>
  );
}

function ImageBlocked({ blockedFor, tags, uuid }: ImageBlocked) {
  const { classes, cx } = useStyles();
  const removeFile = useEditPostContext((state) => state.removeFile);
  return (
    <Card className={classes.container} withBorder p={0}>
      <Alert
        color="red"
        styles={{ label: { width: '100%' } }}
        title={
          <Group noWrap position="apart" sx={{ width: '100%' }}>
            <Group spacing={4} noWrap>
              <Popover position="top" withinPortal withArrow width={300}>
                <Popover.Target>
                  <ActionIcon>
                    <IconInfoCircle />
                  </ActionIcon>
                </Popover.Target>
                <Popover.Dropdown>
                  <Stack spacing="xs">
                    <Text size="xs" weight={500}>
                      Blocked for
                    </Text>
                    <Code color="red">{blockedFor}</Code>
                    <Group spacing="xs">
                      {tags
                        ?.filter((x) => x.type === 'Moderation')
                        .map((x) => (
                          <Badge key={x.name} color="red">
                            {x.name}
                          </Badge>
                        ))}
                    </Group>
                  </Stack>
                </Popover.Dropdown>
              </Popover>
              <Text>TOS Violation</Text>
            </Group>
            <ActionIcon color="red" onClick={() => removeFile(uuid)}>
              <IconX />
            </ActionIcon>
          </Group>
        }
      >
        <Text>
          The image you uploaded was determined to violate our TOS and has been completely removed
          from our service
        </Text>
      </Alert>
    </Card>
  );
}

const useStyles = createStyles((theme) => {
  return {
    container: {
      position: 'relative',
      background: theme.colors.dark[9],
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      minHeight: 200,
    },
    blocked: {
      opacity: 0.3,
    },
    actions: {
      position: 'absolute',
      top: theme.spacing.sm,
      right: theme.spacing.sm,
    },
    header: {
      position: 'absolute',
      top: 0,
      right: 0,
      left: 0,
    },
    floatingBadge: {
      color: 'white',
      backdropFilter: 'blur(7px)',
      boxShadow: '1px 2px 3px -1px rgba(37,38,43,0.2)',
    },
    footer: {
      position: 'absolute',
      bottom: 0,
      right: 0,
      left: 0,
    },
    ambient: {
      backgroundColor: theme.fn.rgba(theme.colorScheme === 'dark' ? '#000' : '#fff', 0.5),
    },
    error: {
      backgroundColor: theme.fn.rgba(
        theme.colorScheme === 'dark' ? theme.colors.red[8] : theme.colors.red[6],
        0.5
      ),
    },
  };
});

const sharedBadgeProps: Partial<BadgeProps> = {
  sx: () => ({ cursor: 'pointer' }),
  variant: 'filled',
};

const readyBadgeProps: Partial<BadgeProps> = {
  ...sharedBadgeProps,
  color: 'green',
  leftSection: (
    <Center>
      <IconCheck size={16} />
    </Center>
  ),
};

const warningBadgeProps: Partial<BadgeProps> = {
  ...sharedBadgeProps,
  color: 'yellow',
  leftSection: (
    <Center>
      <IconExclamationMark size={16} />
    </Center>
  ),
};

const blockingBadgeProps: Partial<BadgeProps> = {
  ...sharedBadgeProps,
  color: 'red',
  leftSection: (
    <Center>
      <IconExclamationCircle size={16} />
    </Center>
  ),
};

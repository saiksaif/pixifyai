import {
  Drawer,
  Stack,
  Text,
  Grid,
  Input,
  Button,
  Card,
  Group,
  Badge,
  ScrollArea,
  CloseButton,
  Alert,
  ActionIcon,
  Popover,
} from '@mantine/core';
import { z } from 'zod';
import { NotFound } from '~/components/AppLayout/NotFound';
import { ImagePreview } from '~/components/ImagePreview/ImagePreview';
import { useEditPostContext } from '~/components/Post/Edit/EditPostProvider';
import { useIsMobile } from '~/hooks/useIsMobile';
import { useForm, Form, InputTextArea, InputNumber, InputSelect } from '~/libs/form';
import {
  ImageMetaProps,
  imageGenerationSchema,
  imageMetaSchema,
} from '~/server/schema/image.schema';

import { trpc } from '~/utils/trpc';
import { splitUppercase } from '~/utils/string-helpers';
import { showSuccessNotification } from '~/utils/notifications';
import { PostEditImage } from '~/server/controllers/post.controller';
import { DismissibleAlert } from '~/components/DismissibleAlert/DismissibleAlert';
import { IconInfoCircle } from '@tabler/icons-react';
import { constants } from '~/server/common/constants';
import { removeEmpty } from '~/utils/object-helpers';
import { auditImageMeta } from '~/utils/media-preprocessors';
import { useState } from 'react';

// const matureLabel = 'Mature content may include content that is suggestive or provocative';
// const tooltipProps: Partial<TooltipProps> = {
//   maw: 300,
//   multiline: true,
//   position: 'bottom',
//   withArrow: true,
// };

const schema = z.object({
  hideMeta: z.boolean().default(false),
  meta: imageGenerationSchema.partial().omit({ comfy: true }),
});

export function EditImageDrawer() {
  const mobile = useIsMobile();
  const imageId = useEditPostContext((state) => state.selectedImageId);
  const setSelectedImageId = useEditPostContext((state) => state.setSelectedImageId);

  const handleClose = () => setSelectedImageId(undefined);

  return (
    <Drawer
      opened={!!imageId}
      onClose={handleClose}
      position={mobile ? 'bottom' : 'right'}
      size={mobile ? '100%' : 'xl'}
      padding={0}
      shadow="sm"
      withCloseButton={false}
      styles={{
        body: {
          height: '100%',
        },
      }}
    >
      {imageId ? <EditImage imageId={imageId} onClose={handleClose} /> : <NotFound />}
    </Drawer>
  );
}
export function EditImage({ imageId, onClose }: { imageId: number; onClose: () => void }) {
  const images = useEditPostContext((state) => state.images);
  const setImage = useEditPostContext((state) => state.setImage);
  const image = images.find((x) => x.discriminator === 'image' && x.data.id === imageId)?.data as
    | PostEditImage
    | undefined;
  const [blockedFor, setBlockedFor] = useState<string[]>();

  const meta: Record<string, unknown> = (image?.meta as Record<string, unknown>) ?? {};
  const defaultValues: z.infer<typeof schema> = {
    hideMeta: image?.hideMeta ?? false,
    meta: {
      prompt: meta.prompt ?? '',
      negativePrompt: meta.negativePrompt ?? '',
      cfgScale: meta.cfgScale ?? '',
      steps: meta.steps ?? '',
      sampler: meta.sampler ?? '',
      seed: meta.seed ?? '',
    } as ImageMetaProps,
  };

  const form = useForm({ schema, defaultValues, mode: 'onChange' });
  const { mutate, isLoading } = trpc.post.updateImage.useMutation();

  const handleSubmit = async (data: z.infer<typeof schema>) => {
    if (!image) return;
    const meta = removeEmpty({ ...(image.meta as z.infer<typeof imageMetaSchema>), ...data.meta });
    const payload = { ...image, ...data, meta };
    const { blockedFor } = await auditImageMeta(meta, image.nsfw !== 'None');
    setBlockedFor(blockedFor);
    if (!blockedFor)
      mutate(payload, {
        onSuccess: (response) => {
          showSuccessNotification({ message: 'Image details saved successfully' });
          setImage(response.id, () => response);
          onClose();
        },
      });
  };

  if (!image) return <NotFound />;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <Group
        px="md"
        py="sm"
        position="apart"
        noWrap
        sx={(theme) => ({
          borderBottom: `1px solid ${
            theme.colorScheme === 'dark' ? theme.colors.dark[4] : theme.colors.gray[3]
          }`,
        })}
      >
        <Text>Image Details</Text>
        <CloseButton onClick={onClose} />
      </Group>
      <ScrollArea offsetScrollbars pl="md" pr={4} style={{ flex: 1 }}>
        <Form id="image-detail" form={form} onSubmit={handleSubmit}>
          <Stack spacing="xl" pt="md" pb={4}>
            <ImagePreview
              image={image}
              edgeImageProps={{ width: 450 }}
              aspectRatio={1}
              style={{ maxWidth: 110 }}
            />
            {/* <Stack spacing="xs">
              <InputCheckbox
                name="nsfw"
                disabled={hasModerationTags}
                label={
                  <Text>
                    Mature Content{' '}
                    <Tooltip label={matureLabel} {...tooltipProps}>
                      <Text component="span">(?)</Text>
                    </Tooltip>
                  </Text>
                }
              />
              <InputCheckbox name="hideMeta" label="Hide generation data" />
            </Stack> */}
            {/* <Input.Wrapper label="Tags">
              <Group spacing={4}>
                {hasTags ? (
                  <VotableTags entityId={image.id} entityType="image" canAdd canAddModerated />
                ) : (
                  <Alert color="yellow">
                    There are no tags associated with this image yet. Tags will be assigned to this
                    image soon.
                  </Alert>
                )}
              </Group>
            </Input.Wrapper> */}
            <Input.Wrapper label="Resources">
              {!!image.resourceHelper.length ? (
                <Stack>
                  <DismissibleAlert
                    id="not-all-resources"
                    color="blue"
                    title="Missing resources?"
                    content={
                      <>
                        Install the{' '}
                        <Text
                          component="a"
                          href="https://github.com/civitai/sd_civitai_extension"
                          target="_blank"
                          variant="link"
                          rel="nofollow"
                        >
                          Civitai Extension for Automatic 1111 Stable Diffusion Web UI
                        </Text>{' '}
                        to automatically detect all the resources used in your images.
                      </>
                    }
                  />
                  {image.resourceHelper
                    .filter((x) => x.name !== 'vae')
                    .map((resource) => (
                      <Card key={resource.id} p={8} withBorder>
                        <Stack>
                          <Group spacing={4} position="apart" noWrap align="flex-start">
                            <Group spacing={4} noWrap>
                              {resource.modelVersionId ? (
                                <Group spacing={4}>
                                  {resource.modelName && (
                                    <Text size="sm" weight={500} lineClamp={1}>
                                      {resource.modelName}
                                    </Text>
                                  )}
                                  {resource.modelVersionName && (
                                    <Badge style={{ textTransform: 'none' }}>
                                      {resource.modelVersionName}
                                    </Badge>
                                  )}
                                </Group>
                              ) : (
                                <Group spacing={4}>
                                  <Popover width={300} withinPortal withArrow>
                                    <Popover.Target>
                                      <ActionIcon size="xs">
                                        <IconInfoCircle size={16} />
                                      </ActionIcon>
                                    </Popover.Target>
                                    <Popover.Dropdown>
                                      <Text>
                                        The detected image resource was not found in our system
                                      </Text>
                                    </Popover.Dropdown>
                                  </Popover>
                                  <Text size="sm" weight={500} lineClamp={1}>
                                    {resource.name}
                                  </Text>
                                </Group>
                              )}
                              {/* <IconVersions size={16} /> */}
                            </Group>
                            {resource.modelType && (
                              <Badge radius="sm" size="sm">
                                {splitUppercase(resource.modelType)}
                              </Badge>
                            )}
                          </Group>
                        </Stack>
                      </Card>
                    ))}
                </Stack>
              ) : (
                <Alert color="yellow">
                  We could not detect any resources associated with this image. If this image is
                  based on a model hosted on Civitai, try creating this post from the model detail
                  page. For automatic image resource detection, try installing{' '}
                  <Text
                    component="a"
                    href="https://github.com/civitai/sd_civitai_extension"
                    target="_blank"
                    variant="link"
                    rel="nofollow"
                  >
                    Civitai Extension for Automatic 1111 Stable Diffusion Web UI
                  </Text>
                </Alert>
              )}
            </Input.Wrapper>
            <Grid gutter="xs">
              <Grid.Col span={12}>
                <DismissibleAlert
                  id="missing-gen-data"
                  title="Missing generation data?"
                  content="In some cases, we might not be able to pull in all the generation data from each image because either the image was not AI generated or we couldn't detect the right generation tool. You can always add/edit the generation data right here"
                />
              </Grid.Col>
              <Grid.Col span={12}>
                <InputTextArea
                  name="meta.prompt"
                  label="Prompt"
                  autosize
                  maxRows={3}
                  error={!!blockedFor?.length ? `blocked for: ${blockedFor.join(', ')}` : undefined}
                />
              </Grid.Col>
              <Grid.Col span={12}>
                <InputTextArea
                  name="meta.negativePrompt"
                  label="Negative prompt"
                  autosize
                  maxRows={3}
                />
              </Grid.Col>
              <Grid.Col span={6}>
                <InputNumber name="meta.cfgScale" label="Guidance scale" min={0} max={30} />
              </Grid.Col>
              <Grid.Col span={6}>
                <InputNumber name="meta.steps" label="Steps" />
              </Grid.Col>
              <Grid.Col span={6}>
                <InputSelect
                  name="meta.sampler"
                  clearable
                  searchable
                  data={constants.samplers as unknown as string[]}
                  label="Sampler"
                />
              </Grid.Col>
              <Grid.Col span={6}>
                <InputNumber name="meta.seed" label="Seed" format="default" />
              </Grid.Col>
            </Grid>
          </Stack>
        </Form>
      </ScrollArea>
      <Stack
        py="xs"
        px="md"
        sx={(theme) => ({
          borderTop: `1px solid ${
            theme.colorScheme === 'dark' ? theme.colors.dark[4] : theme.colors.gray[3]
          }`,
        })}
      >
        <Button type="submit" loading={isLoading} form="image-detail">
          Save
        </Button>
      </Stack>
    </div>
  );
}

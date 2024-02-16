import { Alert, Anchor, Group, Input, Paper, Stack, Text, ThemeIcon } from '@mantine/core';
import {
  CheckpointType,
  CommercialUse,
  ModelType,
  ModelUploadType,
  TagTarget,
} from '@prisma/client';
import {
  IconBrush,
  IconCurrencyDollarOff,
  IconExclamationMark,
  IconPhoto,
  IconShoppingCart,
  IconWorldUpload,
} from '@tabler/icons-react';
import { useRouter } from 'next/router';
import { useEffect } from 'react';
import { z } from 'zod';

import {
  Form,
  InputCheckbox,
  InputRTE,
  InputSegmentedControl,
  InputSelect,
  InputTags,
  InputText,
  useForm,
} from '~/libs/form';
import { TagSort } from '~/server/common/enums';
import { ModelUpsertInput, modelUpsertSchema } from '~/server/schema/model.schema';
import { showErrorNotification } from '~/utils/notifications';
import { parseNumericString } from '~/utils/query-string-helpers';
import { getDisplayName, splitUppercase, titleCase } from '~/utils/string-helpers';
import { trpc } from '~/utils/trpc';
import { ContainerGrid } from '~/components/ContainerGrid/ContainerGrid';
import { InfoPopover } from '~/components/InfoPopover/InfoPopover';
import { getSanitizedStringSchema } from '~/server/schema/utils.schema';

const schema = modelUpsertSchema
  .extend({
    category: z.number().optional(),
    description: getSanitizedStringSchema(),
  })
  .refine((data) => (data.type === 'Checkpoint' ? !!data.checkpointType : true), {
    message: 'Please select the checkpoint type',
    path: ['checkpointType'],
  })
  .refine((data) => !(data.nsfw && data.poi), {
    message: 'Mature content depicting actual people is not permitted.',
  });
const querySchema = z.object({
  category: z.preprocess(parseNumericString, z.number().optional()),
  templateId: z.coerce.number().optional(),
  bountyId: z.coerce.number().optional(),
});

export function ModelUpsertForm({ model, children, onSubmit }: Props) {
  const router = useRouter();
  const result = querySchema.safeParse(router.query);

  const defaultCategory = result.success ? result.data.category : undefined;
  const defaultValues: z.infer<typeof schema> = {
    ...model,
    name: model?.name ?? '',
    description: model?.description ?? '',
    tagsOnModels: model?.tagsOnModels?.filter((tag) => !tag.isCategory) ?? [],
    status: model?.status ?? 'Draft',
    type: model?.type ?? 'Checkpoint',
    checkpointType: model?.checkpointType,
    uploadType: model?.uploadType ?? 'Created',
    poi: model?.poi ?? false,
    nsfw: model?.nsfw ?? false,
    allowCommercialUse: model?.allowCommercialUse ?? CommercialUse.Sell,
    allowDerivatives: model?.allowDerivatives ?? true,
    allowNoCredit: model?.allowNoCredit ?? true,
    allowDifferentLicense: model?.allowDifferentLicense ?? true,
    category: model?.tagsOnModels?.find((tag) => !!tag.isCategory)?.id ?? defaultCategory,
  };
  const form = useForm({ schema, mode: 'onChange', defaultValues, shouldUnregister: false });
  const queryUtils = trpc.useUtils();

  const [type, allowDerivatives] = form.watch(['type', 'allowDerivatives']);
  const nsfwPoi = form.watch(['nsfw', 'poi']);
  const { isDirty, errors } = form.formState;

  const { data, isLoading: loadingCategories } = trpc.tag.getAll.useQuery({
    categories: true,
    entityType: ['Model'],
    unlisted: false,
    sort: TagSort.MostModels,
    limit: 100,
  });
  const categories =
    data?.items.map((tag) => ({ label: titleCase(tag.name), value: tag.id })) ?? [];

  const handleModelTypeChange = (value: ModelType) => {
    form.setValue('checkpointType', null);
    switch (value) {
      case 'Checkpoint':
        form.setValue('checkpointType', CheckpointType.Merge);
        break;
      default:
        break;
    }
  };

  const upsertModelMutation = trpc.model.upsert.useMutation({
    onSuccess: async (data, payload) => {
      await queryUtils.model.getById.invalidate({ id: data.id });
      await queryUtils.model.getAllInfiniteSimple.invalidate();
      if (!payload.id) await queryUtils.model.getMyDraftModels.invalidate();
      onSubmit(data);
    },
    onError: (error) => {
      showErrorNotification({ error: new Error(error.message), title: 'Failed to save model' });
    },
  });
  const handleSubmit = ({ category, tagsOnModels = [], ...rest }: z.infer<typeof schema>) => {
    const bountyId = result.success ? result.data.bountyId : undefined;
    if (isDirty || bountyId) {
      const templateId = result.success ? result.data.templateId : undefined;
      const selectedCategory = data?.items.find((cat) => cat.id === category);
      const tags =
        tagsOnModels && selectedCategory ? tagsOnModels.concat([selectedCategory]) : tagsOnModels;
      upsertModelMutation.mutate({ ...rest, tagsOnModels: tags, templateId, bountyId });
    } else onSubmit(defaultValues);
  };

  useEffect(() => {
    if (model)
      form.reset({
        ...model,
        tagsOnModels: model.tagsOnModels?.filter((tag) => !tag.isCategory) ?? [],
        category: model.tagsOnModels?.find((tag) => tag.isCategory)?.id ?? defaultCategory,
        description: model.description ?? '',
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [defaultCategory, model]);

  return (
    <Form form={form} onSubmit={handleSubmit}>
      <ContainerGrid gutter="xl">
        <ContainerGrid.Col span={12}>
          <Stack>
            <InputText name="name" label="Name" placeholder="Name" withAsterisk />
            <Stack spacing={5}>
              <Group spacing="sm" grow>
                <InputSelect
                  name="type"
                  label="Type"
                  placeholder="Type"
                  data={Object.values(ModelType).map((type) => ({
                    label: getDisplayName(type),
                    value: type,
                  }))}
                  onChange={handleModelTypeChange}
                  disabled={model?.uploadType === ModelUploadType.Trained}
                  withAsterisk
                />
                {type === 'Checkpoint' && (
                  <Input.Wrapper label="Checkpoint Type" withAsterisk>
                    <InputSegmentedControl
                      name="checkpointType"
                      data={Object.values(CheckpointType).map((type) => ({
                        label: splitUppercase(type),
                        value: type,
                      }))}
                      color="blue"
                      styles={(theme) => ({
                        root: {
                          border: `1px solid ${
                            errors.checkpointType
                              ? theme.colors.red[theme.fn.primaryShade()]
                              : theme.colorScheme === 'dark'
                              ? theme.colors.dark[4]
                              : theme.colors.gray[4]
                          }`,
                          background: 'none',
                          height: 36,
                        },
                        label: {
                          padding: '2px 10px',
                        },
                      })}
                      fullWidth
                    />
                  </Input.Wrapper>
                )}
              </Group>
              {errors.checkpointType && <Input.Error>{errors.checkpointType.message}</Input.Error>}
            </Stack>
            <InputSelect
              name="category"
              label={
                <Group spacing={4} noWrap>
                  <Input.Label>Category</Input.Label>
                  <InfoPopover type="hover" size="xs" iconProps={{ size: 14 }}>
                    <Text>
                      Categories determine what kind of resource you&apos;re making. Selecting a
                      category that&apos;s the closest match to your subject helps users find your
                      resource
                    </Text>
                  </InfoPopover>
                </Group>
              }
              placeholder="Select a Category"
              nothingFound="Nothing found"
              data={categories}
              loading={loadingCategories}
              searchable
            />
            <InputTags
              name="tagsOnModels"
              label={
                <Group spacing={4} noWrap>
                  <Input.Label>Tags</Input.Label>
                  <InfoPopover type="hover" size="xs" iconProps={{ size: 14 }}>
                    <Text>
                      Tags are how users filter content on the site. It&apos;s important to
                      correctly tag your content so it can be found by interested users
                    </Text>
                  </InfoPopover>
                </Group>
              }
              description="Search or create tags for your model"
              target={[TagTarget.Model]}
              filter={(tag) =>
                data && tag.name ? !data.items.map((cat) => cat.name).includes(tag.name) : true
              }
            />
            <InputRTE
              name="description"
              label="Description"
              description="Tell us what your model does"
              includeControls={[
                'heading',
                'formatting',
                'list',
                'link',
                'media',
                'mentions',
                'colors',
              ]}
              editorSize="xl"
              placeholder="What does your model do? What's it for? What is your model good at? What should it be used for? What is your resource bad at? How should it not be used?"
              withAsterisk
            />
          </Stack>
        </ContainerGrid.Col>
        <ContainerGrid.Col span={12}>
          <Stack>
            <Paper radius="md" p="xl" withBorder>
              <ContainerGrid gutter="xs">
                <ContainerGrid.Col xs={12} sm={6}>
                  <Stack spacing="xs">
                    <Text size="md" weight={500} sx={{ lineHeight: 1.2 }} mb="xs">
                      {`When using this model, I give permission for users to:`}
                    </Text>
                    <InputCheckbox name="allowNoCredit" label="Use without crediting me" />
                    <InputCheckbox name="allowDerivatives" label="Share merges of this model" />
                    {allowDerivatives && (
                      <InputCheckbox
                        name="allowDifferentLicense"
                        label="Use different permissions on merges"
                      />
                    )}
                    <Text size="xs" color="dimmed">
                      Learn more about how licensing works by reading our{' '}
                      <Anchor
                        href="https://education.civitai.com"
                        target="_blank"
                        rel="nofollow noreferrer"
                      >
                        {/* TODO.howto: get the right link */}
                        Licensing Guide
                      </Anchor>
                      .
                    </Text>
                  </Stack>
                </ContainerGrid.Col>
                <ContainerGrid.Col xs={12} sm={6}>
                  <Stack spacing="xs">
                    <Stack spacing={4}>
                      <Group spacing={4} noWrap>
                        <Text size="md" weight={500} sx={{ lineHeight: 1.2 }}>
                          Commercial Use
                        </Text>
                        <InfoPopover size="xs" iconProps={{ size: 14 }}>
                          <Text>
                            These permissions determine what others can do with your resource.
                            Select the option that make the most sense for your use case.
                          </Text>
                        </InfoPopover>
                      </Group>
                      <Text size="xs" color="dimmed" sx={{ lineHeight: 1.2 }}>
                        Select the most permissive option that applies to your model. Options are
                        listed from least to most permissive.
                      </Text>
                    </Stack>
                    {/* TODO.howto: transform this into input checkboxes */}
                    <InputSegmentedControl
                      name="allowCommercialUse"
                      orientation="vertical"
                      fullWidth
                      color="blue"
                      styles={(theme) => ({
                        root: {
                          border: `1px solid ${
                            theme.colorScheme === 'dark'
                              ? theme.colors.dark[4]
                              : theme.colors.gray[4]
                          }`,
                          background: 'none',
                        },
                      })}
                      data={[
                        {
                          value: CommercialUse.None,
                          label: (
                            <Group>
                              <IconCurrencyDollarOff size={16} /> None
                            </Group>
                          ),
                        },
                        {
                          value: CommercialUse.Image,
                          label: (
                            <Group>
                              <IconPhoto size={16} /> Sell generated images
                            </Group>
                          ),
                        },
                        {
                          value: CommercialUse.RentCivit,
                          label: (
                            <Group>
                              <IconBrush size={16} /> Use on Civitai generation service
                            </Group>
                          ),
                        },
                        {
                          value: CommercialUse.Rent,
                          label: (
                            <Group>
                              <IconWorldUpload size={16} /> Use on other generation services
                            </Group>
                          ),
                        },
                        {
                          value: CommercialUse.Sell,
                          label: (
                            <Group>
                              <IconShoppingCart size={16} /> Sell this model or merges
                            </Group>
                          ),
                        },
                      ]}
                    />
                  </Stack>
                </ContainerGrid.Col>
              </ContainerGrid>
            </Paper>
            <Paper radius="md" p="xl" withBorder>
              <Stack>
                <Text size="md" weight={500}>
                  This resource:
                </Text>
                <InputCheckbox
                  name="poi"
                  label="Depicts an actual person"
                  description="For Example: Tom Cruise or Tom Cruise as Maverick"
                />
                <InputCheckbox name="nsfw" label="Is intended to produce mature themes only" />
              </Stack>
            </Paper>
            {nsfwPoi.every((item) => item === true) && (
              <>
                <Alert color="red" pl={10}>
                  <Group noWrap spacing={10}>
                    <ThemeIcon color="red">
                      <IconExclamationMark />
                    </ThemeIcon>
                    <Text size="xs" sx={{ lineHeight: 1.2 }}>
                      Mature content depicting actual people is not permitted.
                    </Text>
                  </Group>
                </Alert>
                <Text size="xs" color="dimmed" sx={{ lineHeight: 1.2 }}>
                  Please revise the content of this listing to ensure no actual person is depicted
                  in an mature context out of respect for the individual.
                </Text>
              </>
            )}
          </Stack>
        </ContainerGrid.Col>
      </ContainerGrid>
      {typeof children === 'function'
        ? children({ loading: upsertModelMutation.isLoading })
        : children}
    </Form>
  );
}

type Props = {
  onSubmit: (data: { id?: number }) => void;
  children: React.ReactNode | ((data: { loading: boolean }) => React.ReactNode);
  model?: Partial<ModelUpsertInput>;
};

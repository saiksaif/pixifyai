import {
  Button,
  Container,
  Group,
  LoadingOverlay,
  Popover,
  Stack,
  Stepper,
  Title,
} from '@mantine/core';
import { ModelUploadType, TrainingStatus } from '@prisma/client';
import { NextRouter, useRouter } from 'next/router';
import { useEffect, useState } from 'react';
import { z } from 'zod';
import { NotFound } from '~/components/AppLayout/NotFound';
import { PageLoader } from '~/components/PageLoader/PageLoader';
import { PostEditWrapper } from '~/components/Post/Edit/PostEditLayout';
import { Files, UploadStepActions } from '~/components/Resource/Files';
import { FilesProvider } from '~/components/Resource/FilesProvider';
import { ModelUpsertForm } from '~/components/Resource/Forms/ModelUpsertForm';
import { ModelVersionUpsertForm } from '~/components/Resource/Forms/ModelVersionUpsertForm';
import { PostUpsertForm } from '~/components/Resource/Forms/PostUpsertForm';
import TrainingSelectFile from '~/components/Resource/Forms/TrainingSelectFile';
import { useS3UploadStore } from '~/store/s3-upload.store';
import { ModelById } from '~/types/router';
import { trpc } from '~/utils/trpc';
import { isNumber } from '~/utils/type-guards';
import { TemplateSelect } from './TemplateSelect';
import { useCurrentUser } from '~/hooks/useCurrentUser';
import { QS } from '../../../utils/qs';
import { HelpButton } from '~/components/HelpButton/HelpButton';
import { FeatureIntroduction } from '~/components/FeatureIntroduction/FeatureIntroduction';

export type ModelWithTags = Omit<ModelById, 'tagsOnModels'> & {
  tagsOnModels: Array<{ isCategory: boolean; id: number; name: string }>;
};

type WizardState = {
  step: number;
  selectedTemplate?: { id: number; name: string };
};

const querySchema = z.object({
  id: z.coerce.number().optional(),
  templateId: z.coerce.number().optional(),
  bountyId: z.coerce.number().optional(),
});

const CreateSteps = ({
  step,
  model,
  modelVersion,
  hasVersions,
  goBack,
  goNext,
  modelId,
  router,
  postId,
}: {
  step: number;
  model?: ModelWithTags;
  modelVersion?: ModelWithTags['modelVersions'][number];
  hasVersions: boolean | undefined;
  goBack: () => void;
  goNext: () => void;
  modelId: number | undefined;
  router: NextRouter;
  postId: number | undefined;
}) => {
  const { getStatus: getUploadStatus } = useS3UploadStore();
  const { uploading, error, aborted } = getUploadStatus(
    (file) => file.meta?.versionId === modelVersion?.id
  );
  const editing = !!model;

  const result = querySchema.safeParse(router.query);
  const templateId = result.success ? result.data.templateId : undefined;
  const bountyId = result.success ? result.data.bountyId : undefined;

  const { data: templateFields, isInitialLoading } = trpc.model.getTemplateFields.useQuery(
    // Explicit casting since we know it's a number at this point
    { id: templateId as number },
    { enabled: !!templateId }
  );
  const { data: bountyFields, isInitialLoading: isBountyFieldsInitialLoading } =
    trpc.model.getModelTemplateFieldsFromBounty.useQuery(
      // Explicit casting since we know it's a number at this point
      { id: bountyId as number },
      { enabled: !!bountyId }
    );

  return (
    <Stepper
      active={step - 1}
      onStepClick={(step) =>
        router.replace(getWizardUrl({ id: modelId, step: step + 1, templateId }), undefined, {
          shallow: true,
        })
      }
      allowNextStepsSelect={false}
      size="sm"
    >
      {/* Step 1: Model Info */}
      <Stepper.Step label={editing ? 'Edit model' : 'Create your model'}>
        <Stack pos="relative">
          <LoadingOverlay visible={isInitialLoading || isBountyFieldsInitialLoading} />
          <Title order={3}>{editing ? 'Edit model' : 'Create your model'}</Title>
          <ModelUpsertForm
            model={model ?? templateFields ?? bountyFields}
            onSubmit={({ id }) => {
              if (editing) return goNext();
              router.replace(getWizardUrl({ id, step: 2, templateId, bountyId }));
            }}
          >
            {({ loading }) => (
              <Group mt="xl" position="right">
                <Button type="submit" loading={loading}>
                  Next
                </Button>
              </Group>
            )}
          </ModelUpsertForm>
        </Stack>
      </Stepper.Step>

      {/* Step 2: Version Info */}
      <Stepper.Step label={hasVersions ? 'Edit version' : 'Add version'}>
        <Stack>
          <Title order={3}>{hasVersions ? 'Edit version' : 'Add version'}</Title>
          <ModelVersionUpsertForm
            model={model ?? templateFields ?? bountyFields}
            version={modelVersion ?? templateFields?.version ?? bountyFields?.version}
            onSubmit={goNext}
          >
            {({ loading }) => (
              <Group mt="xl" position="right">
                <Button variant="default" onClick={goBack}>
                  Back
                </Button>
                <Button type="submit" loading={loading}>
                  Next
                </Button>
              </Group>
            )}
          </ModelVersionUpsertForm>
        </Stack>
      </Stepper.Step>

      {/* Step 3: Upload Files */}
      <Stepper.Step
        label="Upload files"
        loading={uploading > 0}
        color={error + aborted > 0 ? 'red' : undefined}
      >
        <Stack>
          <Title order={3}>Upload files</Title>
          <Files />
          <UploadStepActions onBackClick={goBack} onNextClick={goNext} />
        </Stack>
      </Stepper.Step>

      <Stepper.Step label={postId ? 'Edit post' : 'Create a post'}>
        <Stack>
          <Title order={3}>{postId ? 'Edit post' : 'Create your post'}</Title>
          {model && modelVersion && (
            <PostEditWrapper postId={postId}>
              <PostUpsertForm modelVersionId={modelVersion.id} modelId={model.id} />
            </PostEditWrapper>
          )}
        </Stack>
      </Stepper.Step>
    </Stepper>
  );
};

const TrainSteps = ({
  step,
  model,
  modelVersion,
  goBack,
  goNext,
  modelId,
  router,
  postId,
}: {
  step: number;
  model: ModelWithTags;
  modelVersion: ModelWithTags['modelVersions'][number];
  goBack: () => void;
  goNext: () => void;
  modelId: number | undefined;
  router: NextRouter;
  postId: number | undefined;
}) => {
  return (
    <Stepper
      active={step - 1}
      onStepClick={(step) =>
        router.replace(getWizardUrl({ id: modelId, step: step + 1 }), undefined, {
          shallow: true,
        })
      }
      allowNextStepsSelect={false}
      size="sm"
    >
      {/* Step 1: Select File */}
      <Stepper.Step
        label="Select Model File"
        loading={
          modelVersion.trainingStatus === TrainingStatus.Pending ||
          modelVersion.trainingStatus === TrainingStatus.Submitted ||
          modelVersion.trainingStatus === TrainingStatus.Processing
        }
        color={modelVersion.trainingStatus === TrainingStatus.Failed ? 'red' : undefined}
      >
        <Stack>
          <Title order={3}>Select Model File</Title>
          <Title mb="sm" order={5}>
            Choose a model file from the results of your training run.
            <br />
            Sample images are provided for reference.
          </Title>
          <TrainingSelectFile model={model} onNextClick={goNext} />
        </Stack>
      </Stepper.Step>

      {/* Step 2: Model Info */}
      <Stepper.Step label="Edit model">
        <Stack>
          <Title order={3}>Edit model</Title>
          <ModelUpsertForm model={model} onSubmit={goNext}>
            {({ loading }) => (
              <Group mt="xl" position="right">
                <Button variant="default" onClick={goBack}>
                  Back
                </Button>
                <Button type="submit" loading={loading}>
                  Next
                </Button>
              </Group>
            )}
          </ModelUpsertForm>
        </Stack>
      </Stepper.Step>

      {/* Step 3: Version Info */}
      <Stepper.Step label="Edit version">
        <Stack>
          <Title order={3}>Edit version</Title>
          <ModelVersionUpsertForm model={model} version={modelVersion} onSubmit={goNext}>
            {({ loading }) => (
              <Group mt="xl" position="right">
                <Button variant="default" onClick={goBack}>
                  Back
                </Button>
                <Button type="submit" loading={loading}>
                  Next
                </Button>
              </Group>
            )}
          </ModelVersionUpsertForm>
        </Stack>
      </Stepper.Step>
      <Stepper.Step label={postId ? 'Edit post' : 'Create a post'}>
        <Stack>
          <Title order={3}>{postId ? 'Edit post' : 'Create your post'}</Title>
          {model && modelVersion && (
            <PostEditWrapper postId={postId}>
              <PostUpsertForm modelVersionId={modelVersion.id} modelId={model.id} />
            </PostEditWrapper>
          )}
        </Stack>
      </Stepper.Step>
    </Stepper>
  );
};

function getWizardUrl({
  id,
  step,
  templateId,
  bountyId,
}: {
  step: number;
  id?: number;
  templateId?: number;
  bountyId?: number;
}) {
  if (!id) return '';
  const query = QS.stringify({ templateId, bountyId, step });
  return `/models/${id}/wizard?${query}`;
}

export function ModelWizard() {
  const currentUser = useCurrentUser();
  const router = useRouter();

  const result = querySchema.safeParse(router.query);
  const id = result.success ? result.data.id : undefined;
  const templateId = result.success ? result.data.templateId : undefined;
  const bountyId = result.success ? result.data.bountyId : undefined;
  const isNew = router.pathname.includes('/create');
  const [state, setState] = useState<WizardState>({ step: 1 });
  const [opened, setOpened] = useState(false);

  const {
    data: model,
    isInitialLoading: modelLoading,
    isError: modelError,
  } = trpc.model.getById.useQuery({ id: Number(id) }, { enabled: !!id });

  const maxSteps = 4;

  const hasVersions = model && model.modelVersions.length > 0;
  const modelVersion = hasVersions ? model.modelVersions[0] : undefined;
  const hasFiles =
    model &&
    model.modelVersions.some((version) =>
      model.uploadType === ModelUploadType.Trained
        ? version.files.filter((f) => f.type === 'Model' || f.type === 'Pruned Model').length > 0
        : version.files.length > 0
    );

  const goNext = () => {
    if (state.step < maxSteps) {
      router.replace(getWizardUrl({ id, step: state.step + 1, templateId }), undefined, {
        shallow: true,
        scroll: true,
      });
    }
  };

  const goBack = () => {
    if (state.step > 1) {
      router.replace(getWizardUrl({ id, step: state.step - 1, templateId }), undefined, {
        shallow: true,
        scroll: true,
      });
    }
  };

  const showTraining = model?.uploadType === ModelUploadType.Trained;

  useEffect(() => {
    // redirect to correct step if missing values
    if (!isNew) {
      // don't redirect for Trained type
      if (showTraining) return;

      if (!hasVersions)
        router.replace(getWizardUrl({ id, step: 2, templateId, bountyId }), undefined, {
          shallow: true,
        });
      else if (!hasFiles)
        router.replace(getWizardUrl({ id, step: 3, templateId, bountyId }), undefined, {
          shallow: true,
        });
      else
        router.replace(getWizardUrl({ id, step: 4, templateId, bountyId }), undefined, {
          shallow: true,
        });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hasFiles, hasVersions, id, isNew, model, templateId, bountyId]);

  useEffect(() => {
    // set current step based on query param
    if (state.step.toString() !== router.query.step) {
      const rawStep = router.query.step;
      const step = Number(rawStep);
      const validStep = isNumber(step) && step >= 1 && step <= maxSteps;

      setState((current) => ({ ...current, step: validStep ? step : 1 }));
    }
  }, [isNew, router.query.step, state.step]);

  const postId = modelVersion?.posts[0]?.id;

  const modelFlatTags = !!model
    ? {
        ...model,
        tagsOnModels: model.tagsOnModels.map(({ tag }) => tag),
      }
    : undefined;

  return (
    <FilesProvider model={modelFlatTags} version={modelVersion}>
      <Container size="sm">
        {modelLoading ? (
          <PageLoader text="Loading model..." />
        ) : modelError ? (
          <NotFound />
        ) : (
          <Stack pb="xl">
            <Group position="apart" noWrap>
              <Group spacing={8} noWrap>
                <Title order={2}>Publish a Model</Title>
                <FeatureIntroduction
                  feature="model-upload"
                  contentSlug={['feature-introduction', 'model-upload']}
                  actionButton={<HelpButton size="md" radius="xl" />}
                />
              </Group>
              {isNew && !showTraining && currentUser && (
                <Popover
                  opened={opened}
                  width={400}
                  position="bottom-end"
                  onChange={setOpened}
                  withArrow
                >
                  <Popover.Target>
                    <Button variant="subtle" onClick={() => setOpened(true)}>
                      {state.selectedTemplate || templateId ? 'Swap template' : 'Use a template'}
                    </Button>
                  </Popover.Target>
                  <Popover.Dropdown p={4}>
                    <TemplateSelect userId={currentUser.id} onSelect={() => setOpened(false)} />
                  </Popover.Dropdown>
                </Popover>
              )}
            </Group>

            {showTraining ? (
              <TrainSteps
                model={modelFlatTags!}
                modelVersion={modelVersion!}
                goBack={goBack}
                goNext={goNext}
                modelId={id}
                step={state.step}
                router={router}
                postId={postId}
              />
            ) : (
              <CreateSteps
                model={modelFlatTags}
                modelVersion={modelVersion}
                hasVersions={hasVersions}
                goBack={goBack}
                goNext={goNext}
                modelId={id}
                step={state.step}
                router={router}
                postId={postId}
              />
            )}
          </Stack>
        )}
      </Container>
    </FilesProvider>
  );
}

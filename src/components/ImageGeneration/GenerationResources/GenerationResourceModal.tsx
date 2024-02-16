import { ContextModalProps } from '@mantine/modals';
import { ModelType } from '@prisma/client';
import { Generation } from '~/server/services/generation/generation.types';
import { trpc } from '~/utils/trpc';
import {
  Stack,
  Text,
  Group,
  TextInput,
  Badge,
  Loader,
  createStyles,
  Divider,
  Center,
} from '@mantine/core';
import { useState } from 'react';
import { useDebouncedValue } from '@mantine/hooks';
import { getDisplayName } from '~/utils/string-helpers';
import { DismissibleAlert } from '~/components/DismissibleAlert/DismissibleAlert';

export default function GenerationResourceModal({
  context,
  id,
  innerProps: { notIds, onSelect, baseModel, types },
}: ContextModalProps<{
  notIds: number[];
  onSelect: (value: Generation.Resource) => void;
  baseModel?: string;
  types: ModelType[];
}>) {
  const { classes } = useStyles();
  const [search, setSearch] = useState('');
  const [debounced] = useDebouncedValue(search, 300);

  const { data, isInitialLoading: isLoading } = trpc.generation.getResources.useQuery(
    {
      types,
      query: debounced,
      baseModel,
      supported: true,
    },
    {
      keepPreviousData: true,
    }
  );

  const handleSelect = (resource: Generation.Resource) => {
    onSelect(resource);
    context.closeModal(id);
  };

  return (
    <Stack spacing={4}>
      <Stack>
        <TextInput
          value={search}
          placeholder="Search"
          onChange={(e) => setSearch(e.target.value)}
          rightSection={isLoading ? <Loader size="xs" /> : null}
          autoFocus
        />
      </Stack>
      {isLoading || !data ? (
        <Center p="xl">
          <Loader />
        </Center>
      ) : (
        <>
          {!debounced?.length && <Divider label="Popular Resources" labelPosition="center" />}
          <Stack spacing={0}>
            {(data?.items ?? [])
              .filter((resource) => !notIds.includes(resource.id))
              .map((resource) => (
                <Stack
                  spacing={0}
                  key={`${resource.modelId}_${resource.id}`}
                  onClick={() => handleSelect(resource)}
                  className={classes.resource}
                  p="xs"
                >
                  <Group position="apart" noWrap>
                    <Text weight={500} lineClamp={1} size="sm">
                      {resource.modelName}
                    </Text>
                  </Group>
                  <Group position="apart">
                    <Text size="xs">{resource.name}</Text>
                    <Badge>{getDisplayName(resource.modelType)}</Badge>
                  </Group>
                </Stack>
              ))}
          </Stack>
        </>
      )}
    </Stack>
  );
}

const useStyles = createStyles((theme) => {
  const colors = theme.fn.variant({ variant: 'light' });
  return {
    resource: {
      '&:hover': {
        cursor: 'pointer',
        background: colors.background,
      },
    },
  };
});

import { InfiniteData, useQueryClient } from '@tanstack/react-query';
import { getQueryKey } from '@trpc/react-query';
import produce from 'immer';
import { GetGenerationRequestsReturn } from '~/server/services/generation/generation.service';
import { showErrorNotification } from '~/utils/notifications';
import { trpc } from '~/utils/trpc';
import { useCallback, useEffect, useMemo } from 'react';
import { GetGenerationRequestsInput } from '~/server/schema/generation.schema';
import { GenerationRequestStatus, Generation } from '~/server/services/generation/generation.types';
import { useDebouncer } from '~/utils/debouncer';
import { useSignalConnection } from '~/components/Signals/SignalsProvider';
import { SignalMessages } from '~/server/common/enums';
import { useCurrentUser } from '~/hooks/useCurrentUser';

export const useGetGenerationRequests = (
  input?: GetGenerationRequestsInput,
  options?: { enabled?: boolean; onError?: (err: unknown) => void }
) => {
  const currentUser = useCurrentUser();
  const { data, ...rest } = trpc.generation.getRequests.useInfiniteQuery(input ?? {}, {
    getNextPageParam: (lastPage) => (!!lastPage ? lastPage.nextCursor : 0),
    enabled: !!currentUser,
    ...options,
  });
  const requests = useMemo(() => data?.pages.flatMap((x) => (!!x ? x.items : [])) ?? [], [data]);
  const images = useMemo(() => requests.flatMap((x) => x.images ?? []), [requests]);
  return { data, requests, images, ...rest };
};

export const useUpdateGenerationRequests = () => {
  const queryClient = useQueryClient();
  const queryKey = getQueryKey(trpc.generation.getRequests);

  const setData = (cb: (data?: InfiniteData<GetGenerationRequestsReturn>) => void) => {
    queryClient.setQueriesData({ queryKey, exact: false }, (state) => produce(state, cb));
  };

  return setData;
};

const POLLABLE_STATUSES = [GenerationRequestStatus.Pending, GenerationRequestStatus.Processing];
export const usePollGenerationRequests = (requestsInput: Generation.Request[] = []) => {
  const currentUser = useCurrentUser();
  const update = useUpdateGenerationRequests();
  const debouncer = useDebouncer(5000);
  const requestIds = requestsInput
    .filter((x) => POLLABLE_STATUSES.includes(x.status))
    .map((x) => x.id);
  const { requests, refetch } = useGetGenerationRequests(
    {
      requestId: requestIds,
      take: 100,
      status: !requestIds.length ? POLLABLE_STATUSES : undefined,
      detailed: true,
    },
    {
      onError: () => debouncer(refetch),
      enabled: !!requestIds.length && !!currentUser,
    }
  );

  useEffect(() => {
    if (!!requestIds?.length) {
      debouncer(refetch);
    }
  }, [requestIds]); //eslint-disable-line

  // update requests with newly polled values
  useEffect(() => {
    update((old) => {
      if (!old) return;
      for (const request of requests) {
        for (const page of old.pages) {
          const index = page.items.findIndex((x) => x.id === request.id);
          if (index > -1) {
            // page.items[index] = request;
            const item = page.items[index];
            item.estimatedCompletionDate = request.estimatedCompletionDate;
            item.status = request.status;
            item.queuePosition = request.queuePosition;
            item.images = item.images?.map((image) => {
              const match = request.images?.find((x) => x.hash === image.hash);
              if (!match) return image;
              const available = image.available ? image.available : match.available;
              return { ...image, ...match, available };
            });
          }
        }
      }
    });
  }, [requests]) //eslint-disable-line

  return requests.filter((x) => POLLABLE_STATUSES.includes(x.status)).length;
};

export const useCreateGenerationRequest = () => {
  const update = useUpdateGenerationRequests();
  return trpc.generation.createRequest.useMutation({
    onSuccess: (data) => {
      update((old) => {
        if (!old) return;
        for (const image of data.images ?? []) {
          const status = unmatchedSignals[image.hash];
          if (status) {
            image.status = status;
            delete unmatchedSignals[image.hash];
          }
        }
        old.pages[0].items.unshift(data);
      });
    },
    onError: (error) => {
      showErrorNotification({
        title: 'Failed to generate',
        error: new Error(error.message),
        reason: error.message ?? 'An unexpected error occurred. Please try again later.',
      });
    },
  });
};

export const useDeleteGenerationRequest = () => {
  const update = useUpdateGenerationRequests();
  return trpc.generation.deleteRequest.useMutation({
    onSuccess: (_, { id }) => {
      update((data) => {
        if (!data) return;
        for (const page of data.pages) {
          const index = page.items.findIndex((x) => x.id === id);
          if (index > -1) page.items.splice(index, 1);
        }
      });
    },
    onError: (error) => {
      showErrorNotification({
        title: 'Error deleting request',
        error: new Error(error.message),
      });
    },
  });
};

const bulkDeleteImagesMutation = trpc.generation.bulkDeleteImages.useMutation;
export const useDeleteGenerationRequestImages = (
  ...args: Parameters<typeof bulkDeleteImagesMutation>
) => {
  const [options] = args;
  const update = useUpdateGenerationRequests();
  return trpc.generation.bulkDeleteImages.useMutation({
    ...options,
    onSuccess: (response, request, context) => {
      update((data) => {
        if (!data) return;
        for (const page of data.pages) {
          for (const item of page.items) {
            for (const id of request.ids) {
              const index = item.images?.findIndex((x) => x.id === id) ?? -1;
              if (index > -1) item.images?.splice(index, 1);
            }
          }
          // if there are requests without images, remove the requests
          page.items = page.items.filter((x) => !!x.images?.length);
        }
      });
      options?.onSuccess?.(response, request, context);
    },
    onError: (error, ...args) => {
      showErrorNotification({
        title: 'Error deleting images',
        error: new Error(error.message),
      });
      options?.onError?.(error, ...args);
    },
  });
};

const unmatchedSignals: Record<string, Generation.ImageStatus> = {};

export const useImageGenStatusUpdate = () => {
  const update = useUpdateGenerationRequests();
  const onStatusUpdate = useCallback(
    ({ status, imageHash }: { status: Generation.ImageStatus; imageHash: string }) => {
      let matched = false;
      update((old) => {
        if (!old) return;
        pages: for (const page of old.pages) {
          for (const item of page.items) {
            const image = item.images?.find((x) => x.hash === imageHash);
            if (image) {
              matched = true;
              image.status = status;
              if (image.status === 'Success') image.available = true;
              if (image.status === 'RemovedForSafety') {
                image.removedForSafety = true;
                image.available = true;
              }
              break pages;
            }
          }
        }
      });
      if (!matched) unmatchedSignals[imageHash] = status;
    },
    [] //eslint-disable-line
  );

  useSignalConnection(SignalMessages.ImageGenStatusUpdate, onStatusUpdate);
};

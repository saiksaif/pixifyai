import { trpc } from '~/utils/trpc';
import { showErrorNotification, showSuccessNotification } from '~/utils/notifications';
import { openConfirmModal } from '@mantine/modals';
import { Text } from '@mantine/core';
import { useRouter } from 'next/router';

export function DeletePostButton({
  children,
  postId,
}: {
  postId: number;
  children: ({
    onClick,
    isLoading,
  }: {
    onClick: (cb?: (confirm: boolean) => void) => void;
    isLoading: boolean;
  }) => React.ReactElement;
}) {
  const router = useRouter();
  const queryUtils = trpc.useContext();
  const { mutate, isLoading } = trpc.post.delete.useMutation({
    async onSuccess(_, { id }) {
      // router.push('/posts');
      showSuccessNotification({
        title: 'Post deleted',
        message: 'Successfully deleted post',
      });
      await router.replace('/');
      await queryUtils.post.get.invalidate({ id });
      await queryUtils.post.getInfinite.invalidate();
    },
    onError(error) {
      showErrorNotification({ title: 'Post delete failed', error: new Error(error.message) });
    },
  });

  const onClick = (cb?: (confirm: boolean) => void) => {
    openConfirmModal({
      centered: true,
      title: 'Delete post',
      children: (
        <Text>
          Are you sure you want to delete this post? The images in this post{' '}
          <strong>will also be deleted</strong>.
        </Text>
      ),
      labels: { cancel: `Cancel`, confirm: `Delete Post` },
      confirmProps: { color: 'red' },
      onCancel: () => cb?.(false),
      onConfirm: () => {
        cb?.(true);
        mutate({ id: postId });
      },
    });
  };

  return children({ onClick, isLoading });
}

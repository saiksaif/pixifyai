import { ActionIcon, Card, createStyles, Indicator, Portal } from '@mantine/core';
import { IconMessage2 } from '@tabler/icons-react';
import { useChatContext } from '~/components/Chat/ChatProvider';
import { ChatWindow } from '~/components/Chat/ChatWindow';
import { useCurrentUser } from '~/hooks/useCurrentUser';
import { containerQuery } from '~/utils/mantine-css-helpers';
import { trpc } from '~/utils/trpc';

const useStyles = createStyles((theme) => ({
  absolute: {
    position: 'absolute',
    display: 'flex',
    bottom: theme.spacing.xs,
    left: theme.spacing.md,
    zIndex: 500,
    height: 'min(700px, 70%)',
    width: 'min(800px, 80%)',
    [containerQuery.smallerThan('sm')]: {
      height: `calc(100% - ${theme.spacing.xs * 2}px)`,
      width: `calc(100% - ${theme.spacing.md * 2}px)`,
    },
  },
}));

export function ChatButton() {
  const { state, setState } = useChatContext();
  const { classes } = useStyles();
  const currentUser = useCurrentUser();

  const { data: unreadData, isLoading: unreadLoading } = trpc.chat.getUnreadCount.useQuery(
    undefined,
    { enabled: !!currentUser }
  );
  trpc.chat.getUserSettings.useQuery(undefined, { enabled: !!currentUser });

  if (!currentUser) return <></>;

  const totalUnread = unreadData?.reduce((accum, { cnt }) => accum + cnt, 0);

  return (
    <>
      <Indicator
        color="red"
        disabled={unreadLoading || !totalUnread}
        // processing={unreadLoading} (this doesn't work)
        label={totalUnread}
        inline
        size={14}
      >
        <ActionIcon
          variant={state.open ? 'filled' : undefined}
          onClick={() => setState((prev) => ({ ...prev, open: !state.open }))}
        >
          <IconMessage2 />
        </ActionIcon>
      </Indicator>
      <Portal target={'main'}>
        <div className={classes.absolute} style={{ display: state.open ? 'block' : 'none' }}>
          <Card
            p={0}
            radius={4}
            withBorder
            shadow="md"
            sx={{
              width: '100%',
              height: '100%',
              overflow: 'hidden',
            }}
          >
            <ChatWindow />
          </Card>
        </div>
      </Portal>
    </>
  );
}

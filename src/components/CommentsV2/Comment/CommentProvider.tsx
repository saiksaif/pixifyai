import { CommentV2BadgeProps, useCommentsContext } from '~/components/CommentsV2/CommentsProvider';
import { useCurrentUser } from '~/hooks/useCurrentUser';
import { InfiniteCommentV2Model } from '~/server/controllers/commentv2.controller';
import { createContext, useContext } from 'react';

type CommentV2State = {
  canReport?: boolean;
  canDelete?: boolean;
  canEdit?: boolean;
  canReply?: boolean;
  canHide?: boolean;
  badge?: CommentV2BadgeProps;
  comment: InfiniteCommentV2Model;
};

const CommentV2Context = createContext<CommentV2State | null>(null);
export const useCommentV2Context = () => {
  const context = useContext(CommentV2Context);
  if (!context) throw new Error('CommentV2Context not in tree');
  return context;
};

export function CommentProvider({
  comment,
  children,
  resourceOwnerId: resourcerOwnerId,
}: {
  comment: InfiniteCommentV2Model;
  children: React.ReactNode;
  resourceOwnerId?: number;
}) {
  const { isLocked, isMuted, badges, forceLocked } = useCommentsContext();
  const currentUser = useCurrentUser();
  const isOwner = currentUser?.id === comment.user.id;
  const isMod = currentUser?.isModerator ?? false;

  const canDelete = isOwner || currentUser?.isModerator;
  const canEdit = (!isLocked && !isMuted) || isMod;
  const canReply =
    (currentUser && !isLocked && !isMuted && !forceLocked && !comment.hidden) ?? undefined;
  const canHide = currentUser?.id === resourcerOwnerId || isMod;
  const badge = badges?.find((x) => x.userId === comment.user.id);
  return (
    <CommentV2Context.Provider
      value={{
        canReport: !currentUser || !isOwner,
        canDelete,
        canEdit,
        canReply,
        canHide,
        badge,
        comment,
      }}
    >
      {children}
    </CommentV2Context.Provider>
  );
}

import { articleNotifications } from '~/server/notifications/article.notifications';
import { BareNotification } from '~/server/notifications/base.notifications';
import { bountyNotifications } from '~/server/notifications/bounty.notifications';
import { buzzNotifications } from '~/server/notifications/buzz.notifications';
import { commentNotifications } from '~/server/notifications/comment.notifications';
import { featuredNotifications } from '~/server/notifications/featured.notifications';
import { mentionNotifications } from '~/server/notifications/mention.notifications';
import { modelNotifications } from '~/server/notifications/model.notifications';
import { reactionNotifications } from '~/server/notifications/reaction.notifications';
import { reportNotifications } from '~/server/notifications/report.notifications';
import { reviewNotifications } from '~/server/notifications/review.notifications';
import { systemNotifications } from '~/server/notifications/system.notifications';
import { unpublishNotifications } from '~/server/notifications/unpublish.notifications';
import { userJourneyNotifications } from '~/server/notifications/user-journey.notifications';
import { collectionNotifications } from '~/server/notifications/collection.notifications';
import { imageNotifications } from '~/server/notifications/image.notifications';
import { clubNotifications } from '~/server/notifications/club.notifications';
import { creatorsProgramNotifications } from '~/server/notifications/creators-program.notifications';

const notificationProcessors = {
  ...mentionNotifications,
  ...modelNotifications,
  ...reviewNotifications,
  ...commentNotifications,
  ...reactionNotifications,
  ...systemNotifications,
  ...userJourneyNotifications,
  ...unpublishNotifications,
  ...articleNotifications,
  ...reportNotifications,
  ...featuredNotifications,
  ...bountyNotifications,
  ...buzzNotifications,
  ...collectionNotifications,
  ...imageNotifications,
  ...clubNotifications,
  ...creatorsProgramNotifications,
};

// Sort notifications by priority and group them by priority
const notifications = Object.entries(notificationProcessors)
  .map(([key, v]) => ({
    ...v,
    key,
  }))
  .sort((a, b) => (a.priority ?? 0) - (b.priority ?? 0));
const notificationBatches: (typeof notifications)[] = [[]];
let currentBatch = notificationBatches[0];
for (const notification of notifications) {
  const priority = notification.priority ?? 0;
  if (priority !== currentBatch[0]?.priority) {
    currentBatch = [];
    notificationBatches.push(currentBatch);
  }
  currentBatch.push(notification);
}
export { notificationBatches };

export function getNotificationMessage(notification: Omit<BareNotification, 'id'>) {
  const { prepareMessage } = notificationProcessors[notification.type] ?? {};
  if (!prepareMessage) return null;
  return prepareMessage(notification);
}

function getNotificationTypes() {
  const notificationTypes: string[] = [];
  const notificationCategoryTypes: Record<string, { displayName: string; type: string }[]> = {};
  for (const [type, { displayName, toggleable, category }] of Object.entries(
    notificationProcessors
  )) {
    if (toggleable === false) continue;
    notificationCategoryTypes[category] ??= [];
    notificationCategoryTypes[category]!.push({
      type,
      displayName,
    });
    notificationTypes.push(type);
  }

  return {
    notificationCategoryTypes,
    notificationTypes,
  };
}
export const { notificationCategoryTypes, notificationTypes } = getNotificationTypes();

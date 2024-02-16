import { dbRead } from '~/server/db/client';
import { BareNotification } from '~/server/notifications/base.notifications';
import { articleDetailFetcher } from '~/server/notifications/detail-fetchers/article.detail-fetcher';
import { buzzDetailFetcher } from '~/server/notifications/detail-fetchers/buzz.detail-fetcher';
import { commentDetailFetcher } from '~/server/notifications/detail-fetchers/comment.detail-fetcher';
import { modelDetailFetcher } from '~/server/notifications/detail-fetchers/model.detail-fetcher';

const detailFetchers = [
  commentDetailFetcher,
  modelDetailFetcher,
  articleDetailFetcher,
  buzzDetailFetcher,
];
export async function populateNotificationDetails(notifications: BareNotification[]) {
  for (const { types, fetcher } of detailFetchers) {
    const targetNotifications = notifications.filter((n) => types.includes(n.type));
    await fetcher(targetNotifications, { db: dbRead });
  }
}

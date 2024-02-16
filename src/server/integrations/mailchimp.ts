import { env } from '~/env/server.mjs';
import { createLogger } from '~/utils/logging';
import * as client from '@mailchimp/mailchimp_marketing';
import { createHash } from 'crypto';

const connected = !!env.NEWSLETTER_KEY && !!env.NEWSLETTER_SERVER && !!env.NEWSLETTER_ID;
if (connected) {
  client.setConfig({
    apiKey: env.NEWSLETTER_KEY,
    server: env.NEWSLETTER_SERVER,
  });
}
const log = createLogger('newsletter', 'green');

function createSubscriberHash(email: string) {
  return createHash('md5').update(email.toLowerCase().trim()).digest('hex');
}
function newsletterHandler<T, R>(fn: (input: T) => Promise<R>) {
  return async (input: T) => {
    if (!connected) {
      log('Newsletter not setup');
      return null;
    }
    return fn(input);
  };
}

const getSubscription = newsletterHandler(async (email: string) => {
  try {
    const res = await client.lists.getListMember(
      env.NEWSLETTER_ID as string,
      createSubscriberHash(email)
    );
    return res as client.lists.MembersSuccessResponse;
  } catch (err) {
    if ((err as client.ErrorResponse).status === 404) return undefined;
    throw err;
  }
});

const setSubscription = newsletterHandler(
  async ({
    email,
    username,
    subscribed,
    ip,
  }: {
    email: string;
    username?: string;
    subscribed: boolean;
    ip?: string;
  }) => {
    const subscription = await getSubscription(email);
    if (!subscription && !subscribed) return;
    const active = subscription?.status === 'subscribed';

    if (!active) {
      if (!subscribed) return;
      // They aren't active and they want to subscribe
      await client.lists.setListMember(env.NEWSLETTER_ID as string, createSubscriberHash(email), {
        email_address: email,
        merge_fields: {
          FNAME: username,
        },
        status_if_new: 'pending',
        status: 'subscribed',
        ip_signup: ip,
      });
    } else {
      if (subscribed) return;
      // They are active and they want to unsubscribe
      await client.lists.updateListMember(
        env.NEWSLETTER_ID as string,
        createSubscriberHash(email),
        {
          status: 'unsubscribed',
        }
      );
    }
  }
);

export const mailchimp = {
  getSubscription,
  setSubscription,
};

// @ts-check
import { z } from "zod";
import { zc } from "~/utils/schema-helpers";
import { commaDelimitedStringArray, commaDelimitedStringObject } from "~/utils/zod-helpers";

/**
 * Specify your server-side environment variables schema here.
 * This way you can ensure the app isn't built with invalid env vars.
 */
export const serverSchema = z.object({
  DATABASE_URL: z.string().url(),
  DATABASE_REPLICA_URL: z.string().url(),
  DATABASE_SSL_CA: z.string().optional(),
  DATABASE_CONNECTION_TIMEOUT: z.coerce.number().default(0),
  DATABASE_POOL_MAX: z.coerce.number().default(20),
  DATABASE_POOL_IDLE_TIMEOUT: z.coerce.number().default(30000),
  REDIS_URL: z.string().url(),
  REDIS_TIMEOUT: z.preprocess((x) => x ? parseInt(String(x)) : 5000, z.number().optional()),
  NODE_ENV: z.enum(["development", "test", "production"]),
  NEXTAUTH_SECRET: z.string(),
  NEXTAUTH_URL: z.preprocess(
    // This makes Vercel deployments not fail if you don't set NEXTAUTH_URL
    // Since NextAuth automatically uses the VERCEL_URL if present.
    (str) => process.env.VERCEL_URL ?? str,
    // VERCEL_URL doesnt include `https` so it cant be validated as a URL
    process.env.VERCEL ? z.string() : z.string().url()
  ),
  CLICKHOUSE_HOST: z.string().optional(),
  CLICKHOUSE_USERNAME: z.string().optional(),
  CLICKHOUSE_PASSWORD: z.string().optional(),
  CLICKHOUSE_TRACKER_URL: z.string().url().optional(),
  DISCORD_CLIENT_ID: z.string(),
  DISCORD_CLIENT_SECRET: z.string(),
  DISCORD_BOT_TOKEN: z.string().optional(),
  DISCORD_GUILD_ID: z.string().optional(),
  GITHUB_CLIENT_ID: z.string(),
  GITHUB_CLIENT_SECRET: z.string(),
  GOOGLE_CLIENT_ID: z.string(),
  GOOGLE_CLIENT_SECRET: z.string(),
  REDDIT_CLIENT_ID: z.string(),
  REDDIT_CLIENT_SECRET: z.string(),
  EMAIL_HOST: z.string(),
  EMAIL_PORT: z.preprocess((x) => parseInt(String(x)), z.number()),
  EMAIL_SECURE: zc.booleanString,
  EMAIL_USER: z.string(),
  EMAIL_PASS: z.string(),
  EMAIL_FROM: z.string(),
  S3_UPLOAD_KEY: z.string(),
  S3_ORIGINS: z.preprocess((value) => {
    const str = String(value);
    return str.split(",");
  }, z.array(z.string().url()).optional()),
  S3_UPLOAD_SECRET: z.string(),
  S3_UPLOAD_REGION: z.string(),
  S3_UPLOAD_ENDPOINT: z.string().url(),
  S3_UPLOAD_BUCKET: z.string(),
  S3_IMAGE_UPLOAD_BUCKET: z.string(),
  S3_IMAGE_CACHE_BUCKET: z.string().default(""),
  S3_SETTLED_BUCKET: z.string(),
  RATE_LIMITING: zc.booleanString,
  CF_ACCOUNT_ID: z.string(),
  CF_IMAGES_TOKEN: z.string(),
  CF_API_TOKEN: z.string().optional(),
  CF_ZONE_ID: z.string().optional(),
  JOB_TOKEN: z.string(),
  WEBHOOK_TOKEN: z.string(),
  SCANNING_ENDPOINT: z.string(),
  SCANNING_TOKEN: z.string(),
  UNAUTHENTICATED_DOWNLOAD: zc.booleanString,
  UNAUTHENTICATED_LIST_NSFW: zc.booleanString,
  SHOW_SFW_IN_NSFW: zc.booleanString,
  STRIPE_SECRET_KEY: z.string(),
  STRIPE_WEBHOOK_SECRET: z.string(),
  STRIPE_CONNECT_WEBHOOK_SECRET: z.string(),
  STRIPE_DONATE_ID: z.string(),
  STRIPE_METADATA_KEY: z.string(),
  LOGGING: commaDelimitedStringArray(),
  IMAGE_SCANNING_ENDPOINT: z.string().optional(),
  IMAGE_SCANNING_CALLBACK: z.string().optional(),
  IMAGE_SCANNING_RETRY_DELAY: z.coerce.number().default(5),
  DELIVERY_WORKER_ENDPOINT: z.string().optional(),
  DELIVERY_WORKER_TOKEN: z.string().optional(),
  PLAYFAB_TITLE_ID: z.string().optional(),
  PLAYFAB_SECRET_KEY: z.string().optional(),
  TRPC_ORIGINS: commaDelimitedStringArray().optional(),
  CANNY_SECRET: z.string().optional(),
  SCHEDULER_ENDPOINT: z.string().url().optional(),
  ORCHESTRATOR_ENDPOINT: z.string().url().optional(),
  GENERATION_CALLBACK_HOST: z.string().url().optional(),
  ORCHESTRATOR_ACCESS_TOKEN: z.string().optional(),
  AXIOM_TOKEN: z.string().optional(),
  AXIOM_ORG_ID: z.string().optional(),
  AXIOM_DATASTREAM: z.string().optional(),
  SEARCH_HOST: z.string().url().optional(),
  SEARCH_API_KEY: z.string().optional(),
  PODNAME: z.string().optional(),
  FEATUREBASE_JWT_SECRET: z.string().optional(),
  INTEGRATION_TOKEN: z.string().optional(),
  FEATUREBASE_URL: z.string().url().optional(),
  NEWSLETTER_ID: z.string().optional(),
  NEWSLETTER_KEY: z.string().optional(),
  NEWSLETTER_SERVER: z.string().optional(),
  BUZZ_ENDPOINT: z.string().url().optional(),
  SIGNALS_ENDPOINT: z.string().url().optional(),
  CACHE_DNS: zc.booleanString,
  MINOR_FALLBACK_SYSTEM: zc.booleanString,
  CSAM_UPLOAD_KEY: z.string().default(""),
  CSAM_UPLOAD_SECRET: z.string().default(""),
  CSAM_BUCKET_NAME: z.string().default(""),
  CSAM_UPLOAD_REGION: z.string().default(""),
  CSAM_UPLOAD_ENDPOINT: z.string().default(""),
  NCMEC_URL: z.string().optional(),
  NCMEC_USERNAME: z.string().optional(),
  NCMEC_PASSWORD: z.string().optional(),
  DIRNAME: z.string().optional(),
  IMAGE_QUERY_CACHING: zc.booleanString,
  POST_QUERY_CACHING: zc.booleanString,
  EXTERNAL_MODERATION_ENDPOINT: z.string().url().optional(),
  EXTERNAL_MODERATION_TOKEN: z.string().optional(),
  EXTERNAL_MODERATION_CATEGORIES: commaDelimitedStringObject().optional(),
  ALT_ORCHESTRATION_ENDPOINT: z.string().url().optional(),
  ALT_ORCHESTRATION_TOKEN: z.string().optional(),
  ALT_ORCHESTRATION_TIMEFRAME: z.preprocess((value) => {
    if (typeof value !== "string") return null;

    const [start, end] = value.split(",").map((x) => new Date(x));
    return { start, end };
  }, z.object({
    start: z.date().optional(),
    end: z.date().optional()
  })).optional(),
  REPLICATION_LAG_DELAY: z.coerce.number().default(0),
  RECAPTCHA_PROJECT_ID: z.string(),
  AIR_WEBHOOK: z.string().url().optional(),
  AIR_PAYMENT_LINK_ID: z.string().optional(),
  PAYPAL_API_URL: z.string().url().optional(),
  PAYPAL_SECRET: z.string().optional(),
  PAYPAL_CLIENT_ID: z.string().optional()
});

/**
 * Specify your client-side environment variables schema here.
 * This way you can ensure the app isn't built with invalid env vars.
 * To expose them to the client, prefix them with `NEXT_PUBLIC_`.
 */
export const clientSchema = z.object({
  NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY: z.string(),
  NEXT_PUBLIC_CONTENT_DECTECTION_LOCATION: z.string(),
  NEXT_PUBLIC_IMAGE_LOCATION: z.string(),
  NEXT_PUBLIC_CIVITAI_LINK: z.string().url(),
  NEXT_PUBLIC_GIT_HASH: z.string().optional(),
  NEXT_PUBLIC_CANNY_FEEDBACK_BOARD: z.string().optional(),
  NEXT_PUBLIC_CANNY_BUG_BOARD: z.string().optional(),
  NEXT_PUBLIC_CANNY_TOKEN: z.string().optional(),
  NEXT_PUBLIC_CANNY_APP_ID: z.string().optional(),
  NEXT_PUBLIC_PICFINDER_WS_ENDPOINT: z.string().url().optional(),
  NEXT_PUBLIC_PICFINDER_API_KEY: z.string().optional(),
  NEXT_PUBLIC_SEARCH_HOST: z.string().url().optional(),
  NEXT_PUBLIC_SEARCH_CLIENT_KEY: z.string().optional(),
  NEXT_PUBLIC_POSTHOG_KEY: z.string().optional(),
  NEXT_PUBLIC_POSTHOG_HOST: z.string().optional(),
  NEXT_PUBLIC_SIGNALS_ENDPOINT: z.string().optional(),
  NEXT_PUBLIC_USER_LOOKUP_URL: z.string().optional(),
  NEXT_PUBLIC_MODEL_LOOKUP_URL: z.string().optional(),
  NEXT_PUBLIC_CHAT_LOOKUP_URL: z.string().optional(),
  NEXT_PUBLIC_GPTT_UUID: z.string().optional(),
  NEXT_PUBLIC_BASE_URL: z.string().optional(),
  NEXT_PUBLIC_UI_CATEGORY_VIEWS: zc.booleanString.default(true),
  NEXT_PUBLIC_UI_HOMEPAGE_IMAGES: zc.booleanString.default(true),
  NEXT_PUBLIC_LOG_TRPC: zc.booleanString.default(false),
  NEXT_PUBLIC_RECAPTCHA_KEY: z.string(),
  NEXT_PUBLIC_ADS: zc.booleanString.default(false),
  NEXT_PUBLIC_PAYPAL_CLIENT_ID: z.string().optional()
});

/**
 * You can't destruct `process.env` as a regular object, so you have to do
 * it manually here. This is because Next.js evaluates this at build time,
 * and only used environment variables are included in the build.
 * @type {{ [k in keyof z.infer<typeof clientSchema>]: z.infer<typeof clientSchema>[k] | undefined }}
 */
export const clientEnv = {
  NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY: process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY,
  NEXT_PUBLIC_CONTENT_DECTECTION_LOCATION: process.env.NEXT_PUBLIC_CONTENT_DECTECTION_LOCATION,
  NEXT_PUBLIC_IMAGE_LOCATION: process.env.NEXT_PUBLIC_IMAGE_LOCATION,
  NEXT_PUBLIC_GIT_HASH: process.env.NEXT_PUBLIC_GIT_HASH,
  NEXT_PUBLIC_CIVITAI_LINK: process.env.NEXT_PUBLIC_CIVITAI_LINK,
  NEXT_PUBLIC_CANNY_FEEDBACK_BOARD: process.env.NEXT_PUBLIC_CANNY_FEEDBACK_BOARD,
  NEXT_PUBLIC_CANNY_BUG_BOARD: process.env.NEXT_PUBLIC_CANNY_BUG_BOARD,
  NEXT_PUBLIC_CANNY_TOKEN: process.env.NEXT_PUBLIC_CANNY_TOKEN,
  NEXT_PUBLIC_CANNY_APP_ID: process.env.NEXT_PUBLIC_CANNY_APP_ID,
  NEXT_PUBLIC_PICFINDER_WS_ENDPOINT: process.env.NEXT_PUBLIC_PICFINDER_WS_ENDPOINT,
  NEXT_PUBLIC_PICFINDER_API_KEY: process.env.NEXT_PUBLIC_PICFINDER_API_KEY,
  NEXT_PUBLIC_SEARCH_HOST: process.env.NEXT_PUBLIC_SEARCH_HOST,
  NEXT_PUBLIC_SEARCH_CLIENT_KEY: process.env.NEXT_PUBLIC_SEARCH_CLIENT_KEY,
  NEXT_PUBLIC_POSTHOG_KEY: process.env.NEXT_PUBLIC_POSTHOG_KEY,
  NEXT_PUBLIC_POSTHOG_HOST: process.env.NEXT_PUBLIC_POSTHOG_HOST,
  NEXT_PUBLIC_SIGNALS_ENDPOINT: process.env.NEXT_PUBLIC_SIGNALS_ENDPOINT,
  NEXT_PUBLIC_USER_LOOKUP_URL: process.env.NEXT_PUBLIC_USER_LOOKUP_URL,
  NEXT_PUBLIC_MODEL_LOOKUP_URL: process.env.NEXT_PUBLIC_MODEL_LOOKUP_URL,
  NEXT_PUBLIC_CHAT_LOOKUP_URL: process.env.NEXT_PUBLIC_CHAT_LOOKUP_URL,
  NEXT_PUBLIC_GPTT_UUID: process.env.NEXT_PUBLIC_GPTT_UUID,
  NEXT_PUBLIC_BASE_URL: process.env.NEXT_PUBLIC_BASE_URL ?? process.env.NEXTAUTH_URL,
  NEXT_PUBLIC_UI_CATEGORY_VIEWS: process.env.NEXT_PUBLIC_UI_CATEGORY_VIEWS !== "false",
  NEXT_PUBLIC_UI_HOMEPAGE_IMAGES: process.env.NEXT_PUBLIC_UI_HOMEPAGE_IMAGES !== "false",
  NEXT_PUBLIC_LOG_TRPC: process.env.NEXT_PUBLIC_LOG_TRPC !== "false",
  NEXT_PUBLIC_RECAPTCHA_KEY: process.env.NEXT_PUBLIC_RECAPTCHA_KEY,
  NEXT_PUBLIC_ADS: process.env.NEXT_PUBLIC_ADS === "true",
  NEXT_PUBLIC_PAYPAL_CLIENT_ID: process.env.NEXT_PUBLIC_PAYPAL_CLIENT_ID
};

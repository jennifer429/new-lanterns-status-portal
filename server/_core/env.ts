import { z } from "zod";

const isProduction = process.env.NODE_ENV === "production";

const envSchema = z.object({
  VITE_APP_ID: z.string().default(""),
  JWT_SECRET: z.string().default(""),
  DATABASE_URL: z.string().default(""),
  OAUTH_SERVER_URL: z.string().default(""),
  OWNER_OPEN_ID: z.string().default(""),
  NODE_ENV: z.string().default("development"),
  BUILT_IN_FORGE_API_URL: z.string().default(""),
  BUILT_IN_FORGE_API_KEY: z.string().default(""),
  NOTION_API_KEY: z.string().default(""),
  NOTION_DATABASE_ID: z.string().default(""),
  NOTION_DATASOURCE_ID: z.string().default(""),
  NOTION_CONNECTIVITY_DATABASE_ID: z.string().default(""),
  NOTION_CONNECTIVITY_DATASOURCE_ID: z.string().default(""),
  NOTION_SYNC_LOG_DATASOURCE_ID: z.string().default(""),
  NOTION_SYNC_CONFIG_DATASOURCE_ID: z.string().default(""),
  NOTION_SYNC_CONFIG_PAGE_ID: z.string().default(""),
  NOTION_CONTACTS_DATABASE_ID: z.string().default(""),
  NOTION_CONTACTS_DATASOURCE_ID: z.string().default(""),
  NOTION_SYSTEMS_DATABASE_ID: z.string().default(""),
  NOTION_SYSTEMS_DATASOURCE_ID: z.string().default(""),
  GOOGLE_SERVICE_ACCOUNT_EMAIL: z.string().default(""),
  GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY: z.string().default(""),
  GOOGLE_DRIVE_FOLDER_ID: z.string().default("1STogLQnTku6B0iAkAAqt7oFKFtaUy1Nu"),
  SITE_BASE_URL: z.string().default("https://newlantern.us.com"),
  EXTERNAL_API_KEY: z.string().default(""),
  INVITE_WEBHOOK_URL: z.string().default(""),
  INVITE_WEBHOOK_SECRET: z.string().default(""),
  INVITE_WEBHOOK_ENABLED: z.string().default(""),
});

// Corrective overrides: webdev_request_secrets cannot overwrite existing env vars in the
// sandbox shell. These ensure the correct database IDs are used regardless of stale shell env.
const ENV_OVERRIDES: Record<string, string> = {
  // Implementation Portal Questionnaire database (was pointing to old RAD1 table)
  NOTION_DATABASE_ID: "c16396a9-b4c9-48f0-9264-6e58f3742676",
  // Questionnaire Sync Log database (was using data_source_id instead of database_id)
  NOTION_SYNC_LOG_DATASOURCE_ID: "7a409211-a784-4970-bd5a-5d243a4aa21f",
  // Questionnaire data source for dataSources.query
  NOTION_DATASOURCE_ID: "0ee29093-c05c-4fdf-b3ad-bd9e2405b3b7",
  // Contacts v2 database
  NOTION_CONTACTS_DATABASE_ID: "c6f04901-bba7-4e3c-bf8e-51847c45ef06",
  NOTION_CONTACTS_DATASOURCE_ID: "d1f270d6-9090-467d-9872-ba95937d6f93",
  // Systems v2 database
  NOTION_SYSTEMS_DATABASE_ID: "6eac7e0d-8a38-4279-86f4-db6a1bf6061b",
  NOTION_SYSTEMS_DATASOURCE_ID: "5bff84ad-ebe7-408f-9296-563608cac725",
};

const e = envSchema.parse({ ...process.env, ...ENV_OVERRIDES });

// Required in production. Refuse to boot if any of these are missing.
const PROD_REQUIRED: Array<keyof typeof e> = ["JWT_SECRET", "DATABASE_URL"];

if (isProduction) {
  const missing = PROD_REQUIRED.filter(k => !e[k]);
  if (missing.length > 0) {
    console.error(`[env] Missing required environment variables in production: ${missing.join(", ")}`);
    throw new Error("Environment validation failed; refusing to start.");
  }
}

export const ENV = {
  appId: e.VITE_APP_ID,
  cookieSecret: e.JWT_SECRET,
  databaseUrl: e.DATABASE_URL,
  oAuthServerUrl: e.OAUTH_SERVER_URL,
  ownerOpenId: e.OWNER_OPEN_ID,
  isProduction,
  forgeApiUrl: e.BUILT_IN_FORGE_API_URL,
  forgeApiKey: e.BUILT_IN_FORGE_API_KEY,
  notionApiKey: e.NOTION_API_KEY,
  notionDatabaseId: e.NOTION_DATABASE_ID,
  notionDataSourceId: e.NOTION_DATASOURCE_ID || e.NOTION_DATABASE_ID,
  notionConnectivityDbId: e.NOTION_CONNECTIVITY_DATABASE_ID || e.NOTION_DATABASE_ID,
  // In Notion SDK v5, the data_source_id is the same UUID as the database_id.
  // Fall back to the connectivity DB ID so only one env var needs to be set.
  notionConnectivityDataSourceId:
    e.NOTION_CONNECTIVITY_DATASOURCE_ID || e.NOTION_CONNECTIVITY_DATABASE_ID || e.NOTION_DATABASE_ID,
  notionSyncLogDataSourceId: e.NOTION_SYNC_LOG_DATASOURCE_ID,
  notionSyncConfigDataSourceId: e.NOTION_SYNC_CONFIG_DATASOURCE_ID,
  notionSyncConfigPageId: e.NOTION_SYNC_CONFIG_PAGE_ID,
  notionContactsDbId: e.NOTION_CONTACTS_DATABASE_ID,
  notionContactsDataSourceId: e.NOTION_CONTACTS_DATASOURCE_ID || e.NOTION_CONTACTS_DATABASE_ID,
  notionSystemsDbId: e.NOTION_SYSTEMS_DATABASE_ID,
  notionSystemsDataSourceId: e.NOTION_SYSTEMS_DATASOURCE_ID || e.NOTION_SYSTEMS_DATABASE_ID,
  googleServiceAccountEmail: e.GOOGLE_SERVICE_ACCOUNT_EMAIL,
  googleServiceAccountPrivateKey: e.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY,
  googleDriveFolderId: e.GOOGLE_DRIVE_FOLDER_ID,
  siteBaseUrl: e.SITE_BASE_URL,
  externalApiKey: e.EXTERNAL_API_KEY,
  inviteWebhookUrl: e.INVITE_WEBHOOK_URL,
  inviteWebhookSecret: e.INVITE_WEBHOOK_SECRET,
  // Kill switch: emails do not go out unless this is explicitly "true".
  // Leave unset (or "false") during testing so no real invites are sent.
  inviteWebhookEnabled: e.INVITE_WEBHOOK_ENABLED === "true",
};

export const ENV = {
  appId: process.env.VITE_APP_ID ?? "",
  cookieSecret: process.env.JWT_SECRET ?? "",
  databaseUrl: process.env.DATABASE_URL ?? "",
  oAuthServerUrl: process.env.OAUTH_SERVER_URL ?? "",
  ownerOpenId: process.env.OWNER_OPEN_ID ?? "",
  isProduction: process.env.NODE_ENV === "production",
  forgeApiUrl: process.env.BUILT_IN_FORGE_API_URL ?? "",
  forgeApiKey: process.env.BUILT_IN_FORGE_API_KEY ?? "",
  notionApiKey: process.env.NOTION_API_KEY ?? "",
  notionDatabaseId: process.env.NOTION_DATABASE_ID ?? "",
  notionConnectivityDbId: process.env.NOTION_CONNECTIVITY_DATABASE_ID ?? process.env.NOTION_DATABASE_ID ?? "",
  // In Notion SDK v5, the data_source_id is the same UUID as the database_id.
  // Fall back to the connectivity DB ID so only one env var needs to be set.
  notionConnectivityDataSourceId: process.env.NOTION_CONNECTIVITY_DATASOURCE_ID
    ?? process.env.NOTION_CONNECTIVITY_DATABASE_ID
    ?? process.env.NOTION_DATABASE_ID
    ?? "",
  googleServiceAccountEmail: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL ?? "",
  googleServiceAccountPrivateKey: process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY ?? "",
  googleDriveFolderId: process.env.GOOGLE_DRIVE_FOLDER_ID ?? "1STogLQnTku6B0iAkAAqt7oFKFtaUy1Nu",
  siteBaseUrl: process.env.SITE_BASE_URL ?? "https://newlantern.us.com",
  externalApiKey: process.env.EXTERNAL_API_KEY ?? "",
  inviteWebhookUrl: process.env.INVITE_WEBHOOK_URL ?? "",
  inviteWebhookSecret: process.env.INVITE_WEBHOOK_SECRET ?? "",
  // Kill switch: emails do not go out unless this is explicitly "true".
  // Leave unset (or "false") during testing so no real invites are sent.
  inviteWebhookEnabled: process.env.INVITE_WEBHOOK_ENABLED === "true",
};

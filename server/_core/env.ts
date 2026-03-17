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
  notionConnectivityDbId: process.env.NOTION_CONNECTIVITY_DATABASE_ID ?? "3258571979e7805fb20adfe103fb7c6a",
};

import { z } from "zod";
import { router, publicProcedure } from "../_core/trpc";
import { getConnectivityNotionClient } from "../notion";
import { ENV } from "../_core/env";

// ── Notion property extractors ────────────────────────────────────────────────

function getStr(prop: any): string {
  if (!prop) return "";
  switch (prop.type) {
    case "title":        return prop.title.map((t: any) => t.plain_text).join("");
    case "rich_text":    return prop.rich_text.map((t: any) => t.plain_text).join("");
    case "select":       return prop.select?.name ?? "";
    case "multi_select": return prop.multi_select.map((s: any) => s.name).join(", ");
    case "number":       return prop.number != null ? String(prop.number) : "";
    case "url":          return prop.url ?? "";
    case "email":        return prop.email ?? "";
    case "phone_number": return prop.phone_number ?? "";
    case "status":       return prop.status?.name ?? "";
    default:             return "";
  }
}

/** Get multi_select values as an array. */
function getMultiSelect(prop: any): string[] {
  if (!prop || prop.type !== "multi_select") return [];
  return prop.multi_select.map((s: any) => s.name);
}

/** Case-insensitive lookup — tries each candidate name in order. */
function pick(props: Record<string, any>, ...candidates: string[]): any {
  const lc = Object.fromEntries(
    Object.entries(props).map(([k, v]) => [k.toLowerCase(), v])
  );
  for (const c of candidates) {
    const v = lc[c.toLowerCase()];
    if (v !== undefined) return v;
  }
  return null;
}

/** Normalise a string for fuzzy matching (lowercase, spaces→dashes). */
function normalise(s: string): string {
  return s.toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, "");
}

/**
 * Check if a row's "Institution Group" multi-select includes the given org.
 * The Notion DB uses "Institution Group" as a multi_select with values like
 * "RRAL", "Marshall", "Munson", etc.
 */
function institutionGroupMatchesOrg(
  groups: string[],
  slugNorm: string,
  nameNorm: string | null,
): boolean {
  if (groups.length === 0) return false;
  for (const g of groups) {
    const gNorm = normalise(g);
    if (gNorm === slugNorm) return true;
    if (nameNorm && gNorm === nameNorm) return true;
  }
  return false;
}

// ── Field mapping for the current Notion schema ──────────────────────────────
// The Integration Connection Registry has these fields:
//   Flow Name (title), Protocol / Message Type (select), Direction (select),
//   System Flow (text), Sender System / AE Title (text), Sender IP / Port (text),
//   Receiver System / AE Title (text), Receiver IP / Port (text),
//   SRC AE Title (text), DST AE Title (text), ENV (select: Prod/Test/Both),
//   Status (select), Institution Group (multi_select), Notes (text),
//   Router Present (select), Router Type (select), Modalities (multi_select),
//   Rad Group (text), # (number), Last Verified (date), Verified By (text)

/**
 * Parse "IP / Port" combined field into separate IP and port.
 * Examples: "10.1.2.3:104", "10.1.2.3 : 104", "192.234.130.18:5940"
 */
function parseIpPort(value: string): { ip: string; port: string } {
  if (!value) return { ip: "", port: "" };
  // Try colon separator
  const colonMatch = value.match(/^([\d.]+)\s*:\s*(\d+)$/);
  if (colonMatch) return { ip: colonMatch[1], port: colonMatch[2] };
  // Try space separator
  const spaceMatch = value.match(/^([\d.]+)\s+(\d+)$/);
  if (spaceMatch) return { ip: spaceMatch[1], port: spaceMatch[2] };
  // Just an IP
  const ipOnly = value.match(/^([\d.]+)$/);
  if (ipOnly) return { ip: ipOnly[1], port: "" };
  return { ip: value.trim(), port: "" };
}

// ── Schema / write helpers ────────────────────────────────────────────────────

type FieldInfo = { propName: string; propType: string };
type SchemaMap = Partial<Record<string, FieldInfo>>;

// Updated field candidates matching the current Notion schema
const FIELD_CANDIDATES: Record<string, string[]> = {
  flowName:          ["Flow Name", "Name"],
  trafficType:       ["Protocol / Message Type", "Protocol", "Traffic Type", "Type", "Connection Type"],
  direction:         ["Direction"],
  systemFlow:        ["System Flow"],
  senderSystem:      ["Sender System / AE Title", "Sender System", "Source System", "Source", "From System"],
  senderIpPort:      ["Sender IP / Port", "Sender IP", "Source IP"],
  receiverSystem:    ["Receiver System / AE Title", "Receiver System", "Destination System", "Dest", "To System"],
  receiverIpPort:    ["Receiver IP / Port", "Receiver IP", "Dest IP", "Destination IP"],
  srcAeTitle:        ["SRC AE Title", "Source AE Title", "Source AE", "Src AE", "Calling AE Title"],
  dstAeTitle:        ["DST AE Title", "Dest AE Title", "Destination AE Title", "Dest AE", "Called AE Title"],
  env:               ["ENV", "Environment"],
  status:            ["Status"],
  institutionGroup:  ["Institution Group"],
  notes:             ["Notes", "Comments", "Note"],
  routerPresent:     ["Router Present"],
  routerType:        ["Router Type"],
  modalities:        ["Modalities"],
  radGroup:          ["Rad Group"],
  number:            ["#"],
  lastVerified:      ["Last Verified"],
  verifiedBy:        ["Verified By"],
  issueLink:         ["Issue Link"],
};

function buildSchemaMap(dbSchema: any): { schemaMap: SchemaMap; titlePropName: string } {
  const properties = dbSchema.properties as Record<string, any>;

  // Find the title property (there's always exactly one)
  const titlePropName =
    Object.entries(properties).find(([, v]) => (v as any).type === "title")?.[0] ?? "Flow Name";

  // Build a lowercase → { propName, propType } lookup
  const lc = Object.fromEntries(
    Object.entries(properties).map(([k, v]) => [k.toLowerCase(), { propName: k, propType: (v as any).type }])
  );

  const schemaMap: SchemaMap = {};
  for (const [field, candidates] of Object.entries(FIELD_CANDIDATES)) {
    for (const c of candidates) {
      const found = lc[c.toLowerCase()];
      if (found) { schemaMap[field] = found; break; }
    }
  }
  return { schemaMap, titlePropName };
}

function buildNotionProp(type: string, value: string | boolean): any {
  switch (type) {
    case "title":        return { title: [{ text: { content: String(value) } }] };
    case "rich_text":    return { rich_text: [{ text: { content: String(value) } }] };
    case "select":       return value ? { select: { name: String(value) } } : { select: null };
    case "multi_select": {
      const vals = String(value).split(",").map(s => s.trim()).filter(Boolean);
      return { multi_select: vals.map(name => ({ name })) };
    }
    case "checkbox":     return { checkbox: Boolean(value) };
    case "number":       return { number: parseFloat(String(value)) || null };
    default:             return { rich_text: [{ text: { content: String(value) } }] };
  }
}

/** Build the Notion properties object for a row (write back). */
function buildRowProperties(
  row: Record<string, any>,
  schemaMap: SchemaMap,
  titlePropName: string,
  siteName: string,
): Record<string, any> {
  const props: Record<string, any> = {};

  // Set the title property (Flow Name)
  const flowName = row.flowName || `${row.sourceSystem} → ${row.destinationSystem}`;
  props[titlePropName] = buildNotionProp("title", flowName);

  const set = (field: string, value: string | boolean) => {
    const info = schemaMap[field];
    if (!info) return;
    if (info.propName === titlePropName) return;
    const v = String(value);
    if (info.propType === "select" && !v) return;
    if (info.propType === "status") return;
    props[info.propName] = buildNotionProp(info.propType, value);
  };

  // Map our internal fields to Notion fields
  set("trafficType",     row.trafficType || "");
  set("senderSystem",    row.sourceSystem || "");
  set("receiverSystem",  row.destinationSystem || "");
  set("srcAeTitle",      row.sourceAeTitle || "");
  set("dstAeTitle",      row.destAeTitle || "");
  set("notes",           row.notes || "");

  // Combine IP + Port back into "IP / Port" format for Notion
  if (row.sourceIp || row.sourcePort) {
    const senderIpPort = row.sourcePort ? `${row.sourceIp}:${row.sourcePort}` : row.sourceIp;
    set("senderIpPort", senderIpPort);
  }
  if (row.destIp || row.destPort) {
    const receiverIpPort = row.destPort ? `${row.destIp}:${row.destPort}` : row.destIp;
    set("receiverIpPort", receiverIpPort);
  }

  // Map envTest/envProd booleans to ENV select
  let envValue = "";
  if (row.envTest && row.envProd) envValue = "Both";
  else if (row.envProd) envValue = "Prod";
  else if (row.envTest) envValue = "Test";
  if (envValue) set("env", envValue);

  // Set Institution Group as multi_select with the site name
  if (siteName) {
    const info = schemaMap["institutionGroup"];
    if (info && info.propType === "multi_select") {
      props[info.propName] = { multi_select: [{ name: siteName }] };
    }
  }

  return props;
}

/** Composite key used to match local rows against existing Notion pages. */
function rowKey(trafficType: string, sourceSystem: string, destinationSystem: string): string {
  return [trafficType, sourceSystem, destinationSystem].map(normalise).join("|");
}

// ── Helpers to resolve data source ID and database ID ────────────────────────

function getDataSourceId(): string {
  return ENV.notionConnectivityDataSourceId || "";
}

function getDatabaseId(): string {
  return ENV.notionConnectivityDbId || "";
}

// ── Schema cache (5 min TTL) ──────────────────────────────────────────────────

let _schemaCache: { data: any; ts: number } | null = null;

async function getCachedSchema(client: any, dbId: string) {
  const now = Date.now();
  if (_schemaCache && now - _schemaCache.ts < 5 * 60 * 1000) return _schemaCache.data;
  const schema = await client.databases.retrieve({ database_id: dbId });
  _schemaCache = { data: schema, ts: now };
  return schema;
}

async function getSchemaMap(client: any, dbId: string) {
  const schema = await getCachedSchema(client, dbId);
  return buildSchemaMap(schema);
}

// ── Router ────────────────────────────────────────────────────────────────────

const ConnectivityRowSchema = z.object({
  id:                z.string(),
  trafficType:       z.string(),
  sourceSystem:      z.string(),
  destinationSystem: z.string(),
  sourceIp:          z.string(),
  sourcePort:        z.string(),
  destIp:            z.string(),
  destPort:          z.string(),
  sourceAeTitle:     z.string(),
  destAeTitle:       z.string(),
  envTest:           z.boolean(),
  envProd:           z.boolean(),
  notes:             z.string(),
  connectionDetails: z.string().optional(),
  status:            z.string().optional(),
  flowName:          z.string().optional(),
  direction:         z.string().optional(),
  systemFlow:        z.string().optional(),
  routerPresent:     z.string().optional(),
  routerType:        z.string().optional(),
  modalities:        z.string().optional(),
});

export const connectivityRouter = router({
  /**
   * Fetch connectivity rows from the Notion database and filter by org.
   * Filters by "Institution Group" multi-select field.
   * Returns `configured: false` when the Notion API key is missing.
   */
  getForOrg: publicProcedure
    .input(z.object({
      organizationSlug: z.string(),
      organizationName: z.string().optional(),
    }))
    .query(async ({ input }) => {
      const client = getConnectivityNotionClient();
      const dsId = getDataSourceId();
      if (!client || !dsId) {
        return { rows: [], configured: false };
      }

      try {
        // Fetch all pages from the data source
        const response = await (client as any).dataSources.query({
          data_source_id: dsId,
          page_size: 100,
        });

        const slugNorm = normalise(input.organizationSlug);
        const nameNorm = input.organizationName ? normalise(input.organizationName) : null;

        const rows = (response.results as any[])
          .filter((page: any) => page.object === "page" && !page.archived)
          .map((page: any) => {
            const p = page.properties as Record<string, any>;

            // Get Institution Group for filtering
            const institutionGroups = getMultiSelect(pick(p, "Institution Group"));

            // Get the ENV select value and convert to booleans
            const envValue = getStr(pick(p, "ENV", "Environment"));
            const envTest = envValue === "Test" || envValue === "Both";
            const envProd = envValue === "Prod" || envValue === "Both";

            // Parse combined IP/Port fields
            const senderIpPortRaw = getStr(pick(p, "Sender IP / Port", "Sender IP"));
            const receiverIpPortRaw = getStr(pick(p, "Receiver IP / Port", "Receiver IP"));
            const senderParsed = parseIpPort(senderIpPortRaw);
            const receiverParsed = parseIpPort(receiverIpPortRaw);

            return {
              id: page.id,
              institutionGroups,
              flowName:          getStr(pick(p, "Flow Name")),
              trafficType:       getStr(pick(p, "Protocol / Message Type", "Traffic Type")),
              direction:         getStr(pick(p, "Direction")),
              systemFlow:        getStr(pick(p, "System Flow")),
              sourceSystem:      getStr(pick(p, "Sender System / AE Title", "Sender System", "Source System")),
              destinationSystem: getStr(pick(p, "Receiver System / AE Title", "Receiver System", "Destination System")),
              sourceIp:          senderParsed.ip,
              sourcePort:        senderParsed.port,
              destIp:            receiverParsed.ip,
              destPort:          receiverParsed.port,
              sourceAeTitle:     getStr(pick(p, "SRC AE Title", "Source AE Title")),
              destAeTitle:       getStr(pick(p, "DST AE Title", "Dest AE Title")),
              envTest,
              envProd,
              notes:             getStr(pick(p, "Notes")),
              status:            getStr(pick(p, "Status")),
              routerPresent:     getStr(pick(p, "Router Present")),
              routerType:        getStr(pick(p, "Router Type")),
              modalities:        getStr(pick(p, "Modalities")),
              connectionDetails: "", // Legacy field — no longer used
            };
          })
          .filter((row: any) => institutionGroupMatchesOrg(row.institutionGroups, slugNorm, nameNorm));

        // Remove the internal institutionGroups field before returning
        const cleanRows = rows.map(({ institutionGroups, ...rest }) => rest);

        return { rows: cleanRows, configured: true };
      } catch (error: any) {
        console.error("Notion connectivity fetch error:", error?.message ?? error);
        return { rows: [], configured: true, error: String(error?.message ?? "Unknown error") };
      }
    }),

  /**
   * Sync local connectivity rows back to Notion.
   * Fetches the DB schema first to resolve actual property names, then
   * upserts each row (matched by trafficType + sourceSystem + destSystem).
   */
  syncToNotion: publicProcedure
    .input(z.object({
      organizationSlug: z.string(),
      organizationName: z.string(),
      rows: z.array(ConnectivityRowSchema),
    }))
    .mutation(async ({ input }) => {
      const client = getConnectivityNotionClient();
      const dbId = getDatabaseId();
      const dsId = getDataSourceId();
      if (!client || !dbId || !dsId) {
        return { ok: false, error: "Notion not configured" };
      }

      try {
        // 1. Fetch DB schema to resolve property names
        const dbSchema = await client.databases.retrieve({ database_id: dbId });
        const { schemaMap, titlePropName } = buildSchemaMap(dbSchema);

        // 2. Fetch existing Notion pages for this org so we can match for updates
        const slugNorm = normalise(input.organizationSlug);
        const nameNorm = normalise(input.organizationName);
        const existing = await (client as any).dataSources.query({
          data_source_id: dsId,
          page_size: 100,
        });

        // Build composite-key → Notion page ID map for this site
        const notionMap = new Map<string, string>();
        for (const page of existing.results) {
          if ((page as any).object !== "page" || (page as any).archived) continue;
          const p = (page as any).properties as Record<string, any>;
          const groups = getMultiSelect(pick(p, "Institution Group"));
          if (!institutionGroupMatchesOrg(groups, slugNorm, nameNorm)) continue;

          const k = rowKey(
            getStr(pick(p, "Protocol / Message Type", "Traffic Type")),
            getStr(pick(p, "Sender System / AE Title", "Sender System", "Source System")),
            getStr(pick(p, "Receiver System / AE Title", "Receiver System", "Destination System")),
          );
          notionMap.set(k, (page as any).id);
        }

        // 3. Upsert each row
        let created = 0;
        let updated = 0;
        const errors: string[] = [];

        for (const row of input.rows) {
          try {
            const properties = buildRowProperties(row, schemaMap, titlePropName, input.organizationName);
            const k = rowKey(row.trafficType, row.sourceSystem, row.destinationSystem);
            const existingId = notionMap.get(k);

            if (existingId) {
              await client.pages.update({ page_id: existingId, properties });
              updated++;
            } else {
              await client.pages.create({
                parent: { database_id: dbId },
                properties,
              });
              created++;
            }
          } catch (err: any) {
            errors.push(`Row "${row.trafficType} ${row.sourceSystem}→${row.destinationSystem}": ${err?.message ?? err}`);
          }
        }

        return { ok: true, created, updated, errors };
      } catch (error: any) {
        console.error("Notion sync error:", error?.message ?? error);
        return { ok: false, error: String(error?.message ?? "Unknown error") };
      }
    }),

  /** Create a new Notion page for one connectivity row. Returns the new Notion page ID. */
  createRow: publicProcedure
    .input(z.object({ organizationName: z.string(), row: ConnectivityRowSchema }))
    .mutation(async ({ input }) => {
      const client = getConnectivityNotionClient();
      const dbId = getDatabaseId();
      if (!client || !dbId) throw new Error("Notion not configured");
      const { schemaMap, titlePropName } = await getSchemaMap(client, dbId);
      const properties = buildRowProperties(input.row, schemaMap, titlePropName, input.organizationName);
      const page = await client.pages.create({
        parent: { database_id: dbId },
        properties,
      });
      return { pageId: page.id };
    }),

  /** Update an existing Notion page for one connectivity row. */
  updateRow: publicProcedure
    .input(z.object({ pageId: z.string(), organizationName: z.string(), row: ConnectivityRowSchema }))
    .mutation(async ({ input }) => {
      const client = getConnectivityNotionClient();
      const dbId = getDatabaseId();
      if (!client || !dbId) throw new Error("Notion not configured");
      const { schemaMap, titlePropName } = await getSchemaMap(client, dbId);
      const properties = buildRowProperties(input.row, schemaMap, titlePropName, input.organizationName);
      await client.pages.update({ page_id: input.pageId, properties });
      return { ok: true };
    }),

  /** Archive (soft-delete) a Notion page. */
  archiveRow: publicProcedure
    .input(z.object({ pageId: z.string() }))
    .mutation(async ({ input }) => {
      const client = getConnectivityNotionClient();
      if (!client) throw new Error("Notion not configured");
      await client.pages.update({ page_id: input.pageId, archived: true });
      return { ok: true };
    }),
});

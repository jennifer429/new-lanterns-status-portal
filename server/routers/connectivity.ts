import { z } from "zod";
import { router, publicProcedure } from "../_core/trpc";
import { getNotionClient } from "../notion";
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
    default:             return "";
  }
}

function getBool(prop: any): boolean {
  if (!prop) return false;
  return prop.type === "checkbox" ? Boolean(prop.checkbox) : false;
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

// ── Schema / write helpers ────────────────────────────────────────────────────

const FIELD_CANDIDATES: Record<string, string[]> = {
  site:              ["Site", "Organization", "Org", "Client", "Site Name", "Facility"],
  trafficType:       ["Traffic Type", "Type", "Protocol", "Connection Type", "Connection"],
  sourceSystem:      ["Source System", "Source", "From System", "From", "Sending System"],
  destinationSystem: ["Destination System", "Destination", "Dest", "To System", "To", "Receiving System"],
  sourceIp:          ["Source IP", "Src IP", "Source IP Address", "Source Host"],
  sourcePort:        ["Source Port", "Src Port", "Source Port Number"],
  destIp:            ["Dest IP", "Destination IP", "Dest IP Address", "Destination IP Address", "Destination Host"],
  destPort:          ["Dest Port", "Destination Port", "Dest Port Number"],
  sourceAeTitle:     ["Source AE Title", "Source AE", "Src AE", "Calling AE Title", "Calling AE"],
  destAeTitle:       ["Dest AE Title", "Destination AE Title", "Dest AE", "Destination AE", "Called AE Title", "Called AE"],
  envTest:           ["Test", "Test Env", "Test Environment", "Env Test", "UAT"],
  envProd:           ["Prod", "Production", "Prod Env", "Production Environment", "Env Prod", "Live"],
  notes:             ["Notes", "Comments", "Note", "Comment", "Description"],
};

type FieldInfo = { propName: string; propType: string };
type SchemaMap = Partial<Record<string, FieldInfo>>;

function buildSchemaMap(dbSchema: any): { schemaMap: SchemaMap; titlePropName: string } {
  const properties = dbSchema.properties as Record<string, any>;

  // Find the title property (there's always exactly one)
  const titlePropName =
    Object.entries(properties).find(([, v]) => (v as any).type === "title")?.[0] ?? "Name";

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
    case "checkbox":     return { checkbox: Boolean(value) };
    case "number":       return { number: parseFloat(String(value)) || null };
    default:             return { rich_text: [{ text: { content: String(value) } }] };
  }
}

/** Build the Notion properties object for a row. */
function buildRowProperties(
  row: Record<string, any>,
  schemaMap: SchemaMap,
  titlePropName: string,
  siteName: string,
): Record<string, any> {
  const props: Record<string, any> = {};

  // Always set the title property (page name = source → destination)
  props[titlePropName] = buildNotionProp("title", `${row.sourceSystem || "?"} → ${row.destinationSystem || "?"}`);

  const set = (field: string, value: string | boolean) => {
    const info = schemaMap[field];
    if (!info) return;
    // Skip if this field IS the title — already set above
    if (info.propName === titlePropName) return;
    const v = String(value);
    // Don't write empty strings to select (would create blank option)
    if (info.propType === "select" && !v) return;
    props[info.propName] = buildNotionProp(info.propType, value);
  };

  set("site",              siteName);
  set("trafficType",       row.trafficType      || "");
  set("sourceSystem",      row.sourceSystem     || "");
  set("destinationSystem", row.destinationSystem|| "");
  set("sourceIp",          row.sourceIp         || "");
  set("sourcePort",        row.sourcePort       || "");
  set("destIp",            row.destIp           || "");
  set("destPort",          row.destPort         || "");
  set("sourceAeTitle",     row.sourceAeTitle    || "");
  set("destAeTitle",       row.destAeTitle      || "");
  set("envTest",           Boolean(row.envTest));
  set("envProd",           Boolean(row.envProd));
  set("notes",             row.notes            || "");

  return props;
}

/** Composite key used to match local rows against existing Notion pages. */
function rowKey(trafficType: string, sourceSystem: string, destinationSystem: string): string {
  return [trafficType, sourceSystem, destinationSystem].map(normalise).join("|");
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
});

export const connectivityRouter = router({
  /**
   * Fetch connectivity rows from the Notion database and filter by org.
   * Returns `configured: false` when the Notion API key is missing.
   */
  getForOrg: publicProcedure
    .input(z.object({
      organizationSlug: z.string(),
      organizationName: z.string().optional(),
    }))
    .query(async ({ input }) => {
      const client = getNotionClient();
      if (!client || !ENV.notionConnectivityDbId) {
        return { rows: [], configured: false };
      }

      try {
        const response = await client.databases.query({
          database_id: ENV.notionConnectivityDbId,
          page_size: 100,
        });

        const slugNorm = normalise(input.organizationSlug);
        const nameNorm = input.organizationName ? normalise(input.organizationName) : null;

        const rows = response.results
          .filter((page: any) => page.object === "page" && !page.archived)
          .map((page: any) => {
            const p = page.properties as Record<string, any>;
            return {
              id: page.id,
              site: getStr(pick(p, ...FIELD_CANDIDATES.site)),
              trafficType:       getStr(pick(p, ...FIELD_CANDIDATES.trafficType)),
              sourceSystem:      getStr(pick(p, ...FIELD_CANDIDATES.sourceSystem)),
              destinationSystem: getStr(pick(p, ...FIELD_CANDIDATES.destinationSystem)),
              sourceIp:          getStr(pick(p, ...FIELD_CANDIDATES.sourceIp)),
              sourcePort:        getStr(pick(p, ...FIELD_CANDIDATES.sourcePort)),
              destIp:            getStr(pick(p, ...FIELD_CANDIDATES.destIp)),
              destPort:          getStr(pick(p, ...FIELD_CANDIDATES.destPort)),
              sourceAeTitle:     getStr(pick(p, ...FIELD_CANDIDATES.sourceAeTitle)),
              destAeTitle:       getStr(pick(p, ...FIELD_CANDIDATES.destAeTitle)),
              envTest:           getBool(pick(p, ...FIELD_CANDIDATES.envTest)),
              envProd:           getBool(pick(p, ...FIELD_CANDIDATES.envProd)),
              notes:             getStr(pick(p, ...FIELD_CANDIDATES.notes)),
            };
          })
          .filter(row => {
            if (!row.site) return true; // single-site DB — include all
            const siteNorm = normalise(row.site);
            return (
              siteNorm === slugNorm ||
              siteNorm.includes(slugNorm) ||
              slugNorm.includes(siteNorm) ||
              (nameNorm && (siteNorm.includes(nameNorm) || nameNorm.includes(siteNorm)))
            );
          });

        return { rows, configured: true };
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
      const client = getNotionClient();
      if (!client || !ENV.notionConnectivityDbId) {
        return { ok: false, error: "Notion not configured" };
      }

      try {
        // 1. Fetch DB schema to resolve property names
        const dbSchema = await client.databases.retrieve({
          database_id: ENV.notionConnectivityDbId,
        });
        const { schemaMap, titlePropName } = buildSchemaMap(dbSchema);

        // 2. Fetch existing Notion pages for this org so we can match for updates
        const slugNorm = normalise(input.organizationSlug);
        const nameNorm = normalise(input.organizationName);
        const existing = await client.databases.query({
          database_id: ENV.notionConnectivityDbId,
          page_size: 100,
        });

        // Build composite-key → Notion page ID map for this site
        const notionMap = new Map<string, string>();
        for (const page of existing.results) {
          if ((page as any).object !== "page" || (page as any).archived) continue;
          const p = (page as any).properties as Record<string, any>;
          const site = getStr(pick(p, ...FIELD_CANDIDATES.site));
          const siteNorm = normalise(site);
          const belongsToOrg =
            !site ||
            siteNorm === slugNorm ||
            siteNorm.includes(slugNorm) ||
            slugNorm.includes(siteNorm) ||
            siteNorm.includes(nameNorm) ||
            nameNorm.includes(siteNorm);
          if (!belongsToOrg) continue;

          const k = rowKey(
            getStr(pick(p, ...FIELD_CANDIDATES.trafficType)),
            getStr(pick(p, ...FIELD_CANDIDATES.sourceSystem)),
            getStr(pick(p, ...FIELD_CANDIDATES.destinationSystem)),
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
                parent: { database_id: ENV.notionConnectivityDbId },
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
});

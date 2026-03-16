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

// ── Router ────────────────────────────────────────────────────────────────────

export const connectivityRouter = router({
  /**
   * Fetch connectivity rows from the Notion database and filter by org.
   * Returns `configured: false` when the Notion API key is missing so the
   * client can show an appropriate placeholder.
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
              site: getStr(pick(p, "Site", "Organization", "Org", "Client", "Site Name", "Facility")),
              trafficType: getStr(pick(p, "Traffic Type", "Type", "Protocol", "Connection Type", "Connection")),
              sourceSystem: getStr(pick(p, "Source System", "Source", "From System", "From", "Sending System")),
              destinationSystem: getStr(pick(p, "Destination System", "Destination", "Dest", "To System", "To", "Receiving System")),
              sourceIp: getStr(pick(p, "Source IP", "Src IP", "Source IP Address", "Source Host")),
              sourcePort: getStr(pick(p, "Source Port", "Src Port", "Source Port Number")),
              destIp: getStr(pick(p, "Dest IP", "Destination IP", "Dest IP Address", "Destination IP Address", "Destination Host")),
              destPort: getStr(pick(p, "Dest Port", "Destination Port", "Dest Port Number")),
              sourceAeTitle: getStr(pick(p, "Source AE Title", "Source AE", "Src AE", "Calling AE Title", "Calling AE")),
              destAeTitle: getStr(pick(p, "Dest AE Title", "Destination AE Title", "Dest AE", "Destination AE", "Called AE Title", "Called AE")),
              envTest: getBool(pick(p, "Test", "Test Env", "Test Environment", "Env Test", "UAT")),
              envProd: getBool(pick(p, "Prod", "Production", "Prod Env", "Production Environment", "Env Prod", "Live")),
              notes: getStr(pick(p, "Notes", "Comments", "Note", "Comment", "Description")),
            };
          })
          .filter(row => {
            // No site column — include everything (single-site DB)
            if (!row.site) return true;
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
});

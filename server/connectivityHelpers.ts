/**
 * Shared connectivity helpers for fetching Notion connectivity data.
 * Used by both the connectivity router and the AI router.
 */
import { getConnectivityNotionClient } from "./notion";
import { ENV } from "./_core/env";

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

function getBool(prop: any): boolean {
  if (!prop) return false;
  return prop.type === "checkbox" ? Boolean(prop.checkbox) : false;
}

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

function normalise(s: string): string {
  return s.toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, "");
}

const FIELD_CANDIDATES: Record<string, string[]> = {
  site:              ["Site", "Organization", "Org", "Client", "Site Name", "Facility"],
  trafficType:       ["Traffic Type", "Type", "Protocol", "Connection Type", "Connection"],
  connectionDetails: ["connection details", "Connection Details", "Details", "Config"],
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
  status:            ["Status"],
};

function parseConnectionDetails(details: string): {
  sourceIp: string;
  destIp: string;
  sourcePort: string;
  destPort: string;
  sourceAeTitle: string;
  destAeTitle: string;
} {
  const result = { sourceIp: "", destIp: "", sourcePort: "", destPort: "", sourceAeTitle: "", destAeTitle: "" };
  if (!details) return result;
  const parts = details.split("|").map(s => s.trim()).filter(Boolean);
  for (const part of parts) {
    const lower = part.toLowerCase();
    if (lower.includes("nl nat") || lower.includes("source ip") || lower.includes("src ip")) {
      const match = part.match(/:\s*([\d.]+)/);
      if (match) result.sourceIp = match[1];
    } else if (lower.includes("ip") && !lower.includes("nl") && !lower.includes("source")) {
      const match = part.match(/:\s*([\d.]+)/);
      if (match) result.destIp = match[1];
    }
    if (lower.includes("port")) {
      const match = part.match(/:\s*(\d+)/);
      if (match) result.destPort = match[1];
    }
    if (lower.includes("ae")) {
      const match = part.match(/:\s*(.+)/);
      if (match) result.destAeTitle = match[1].trim();
    }
  }
  return result;
}

function getDataSourceId(): string {
  return ENV.notionConnectivityDataSourceId || "";
}

export interface ConnectivityRow {
  id: string;
  site: string;
  trafficType: string;
  connectionDetails: string;
  sourceSystem: string;
  destinationSystem: string;
  sourceIp: string;
  sourcePort: string;
  destIp: string;
  destPort: string;
  sourceAeTitle: string;
  destAeTitle: string;
  envTest: boolean;
  envProd: boolean;
  notes: string;
  status: string;
}

/**
 * Fetch connectivity rows from Notion for a specific organization.
 * Returns { rows, configured } — configured=false when Notion API key is missing.
 */
export async function fetchConnectivityForOrg(
  organizationSlug: string,
  organizationName?: string | null
): Promise<{ rows: ConnectivityRow[]; configured: boolean; error?: string }> {
  const client = getConnectivityNotionClient();
  const dsId = getDataSourceId();
  if (!client || !dsId) {
    return { rows: [], configured: false };
  }
  try {
    const response = await (client as any).dataSources.query({
      data_source_id: dsId,
      page_size: 100,
    });
    const slugNorm = normalise(organizationSlug);
    const nameNorm = organizationName ? normalise(organizationName) : null;
    const rows: ConnectivityRow[] = (response.results as any[])
      .filter((page: any) => page.object === "page" && !page.archived)
      .map((page: any) => {
        const p = page.properties as Record<string, any>;
        const connectionDetails = getStr(pick(p, "connection details", "Connection Details", "Details", "Config"));
        const parsed = parseConnectionDetails(connectionDetails);
        return {
          id: page.id,
          site:              getStr(pick(p, ...FIELD_CANDIDATES.site)),
          trafficType:       getStr(pick(p, ...FIELD_CANDIDATES.trafficType)),
          connectionDetails,
          sourceSystem:      getStr(pick(p, ...FIELD_CANDIDATES.sourceSystem)) || "",
          destinationSystem: getStr(pick(p, ...FIELD_CANDIDATES.destinationSystem)) || "",
          sourceIp:          getStr(pick(p, ...FIELD_CANDIDATES.sourceIp)) || parsed.sourceIp,
          sourcePort:        getStr(pick(p, ...FIELD_CANDIDATES.sourcePort)) || parsed.sourcePort,
          destIp:            getStr(pick(p, ...FIELD_CANDIDATES.destIp)) || parsed.destIp,
          destPort:          getStr(pick(p, ...FIELD_CANDIDATES.destPort)) || parsed.destPort,
          sourceAeTitle:     getStr(pick(p, ...FIELD_CANDIDATES.sourceAeTitle)) || parsed.sourceAeTitle,
          destAeTitle:       getStr(pick(p, ...FIELD_CANDIDATES.destAeTitle)) || parsed.destAeTitle,
          envTest:           getBool(pick(p, ...FIELD_CANDIDATES.envTest)),
          envProd:           getBool(pick(p, ...FIELD_CANDIDATES.envProd)),
          notes:             getStr(pick(p, ...FIELD_CANDIDATES.notes)),
          status:            getStr(pick(p, ...FIELD_CANDIDATES.status)),
        };
      })
      .filter((row) => {
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
}

/**
 * Re-backfill Notion Summary column with improved parser.
 * Handles ARCH.systems, IW.systems, CONN.endpoints, A.contacts
 * that previously showed [object Object].
 */
import { Client } from "@notionhq/client";
import dotenv from "dotenv";
dotenv.config();

// NOTION_API_KEY = Implementations-Updates integration (has access to questionnaire DB)
const NOTION_API_KEY = process.env.NOTION_API_KEY || process.env.Notion_API_Key;
// The actual data source ID for the questionnaire DB (from Notion fetch)
const DATA_SOURCE_ID = "0ee29093-c05c-4fdf-b3ad-bd9e2405b3b7";

if (!NOTION_API_KEY || !DATA_SOURCE_ID) {
  console.error("Missing NOTION_API_KEY or NOTION_DATABASE_ID");
  process.exit(1);
}

const client = new Client({ auth: NOTION_API_KEY });

// Import the improved summary generator (compiled inline since this is .mjs)
// Replicate the logic here for the backfill script

const PATH_LABELS = {
  ordersFromRIS: "Orders from RIS",
  ordersFromEHR: "Orders from EHR",
  manualEntry: "Manual Entry",
  imagesFromModalities: "Images from Modalities",
  imagesViaVNA: "Images via VNA",
  imagesViaAI: "Images via AI",
  priorsManual: "Priors Manual",
  priorsQuery: "Priors Query",
  priorsPush: "Priors Push",
  reportsToRIS: "Reports to RIS",
  reportsToEHR: "Reports to EHR",
  reportsToPortal: "Reports to Portal",
};

function generateAnswerSummary(answer) {
  if (!answer || !answer.trim()) return "";
  const trimmed = answer.trim();

  let parsed;
  try { parsed = JSON.parse(trimmed); } catch { return ""; }

  // Array
  if (Array.isArray(parsed)) {
    if (parsed.length === 0) return "None selected";
    if (typeof parsed[0] === "object" && parsed[0] !== null) {
      // Connectivity endpoints
      if ("trafficType" in parsed[0]) {
        const items = parsed.map(ep => {
          const parts = [];
          if (ep.trafficType) parts.push(ep.trafficType);
          if (ep.sourceSystem && ep.destinationSystem) parts.push(`${ep.sourceSystem} → ${ep.destinationSystem}`);
          return parts.join(": ") || "(unnamed endpoint)";
        });
        return items.length <= 4 ? items.join(" | ") : `${items.slice(0, 3).join(" | ")} (+${items.length - 3} more)`;
      }
      // Systems
      if ("type" in parsed[0] || "name" in parsed[0]) {
        const items = parsed
          .filter(s => s.name || s.type)
          .map(s => {
            if (s.name && s.type) return `${s.name} (${s.type})`;
            return s.name || s.type || "(unnamed)";
          });
        if (items.length === 0) return "No systems defined";
        return items.length <= 6 ? items.join(", ") : `${items.slice(0, 5).join(", ")} (+${items.length - 5} more)`;
      }
      return `${parsed.length} items`;
    }
    return parsed.join(", ");
  }

  // Workflow config — single-line format: ✓ Path ("note") · ✓ Path2 | Sys: val
  if (parsed && typeof parsed === "object" && parsed.paths) {
    // Build note map for inline display
    const noteMap = {};
    if (parsed.notes && typeof parsed.notes === "object") {
      for (const [key, value] of Object.entries(parsed.notes)) {
        if (value && typeof value === "string" && value.trim()) {
          const pathKey = key.replace(/_note$/, "");
          noteMap[pathKey] = value.trim();
        }
      }
    }
    // Build path items with inline notes
    const pathItems = [];
    for (const [key, value] of Object.entries(parsed.paths)) {
      if (value === true) {
        const label = PATH_LABELS[key] || key;
        const note = noteMap[key];
        if (note) {
          const shortNote = note.length > 30 ? note.substring(0, 27) + "..." : note;
          pathItems.push(`✓ ${label} ("${shortNote}")`);
        } else {
          pathItems.push(`✓ ${label}`);
        }
      }
    }
    const systems = [];
    if (parsed.systems && typeof parsed.systems === "object") {
      for (const [key, value] of Object.entries(parsed.systems)) {
        if (value && typeof value === "string" && value.trim()) systems.push(`${key}: ${value.trim()}`);
      }
    }
    if (pathItems.length === 0 && systems.length === 0) return "No workflows active";
    let summary = pathItems.join(" · ");
    if (systems.length > 0) summary += ` | ${systems.join(", ")}`;
    return summary;
  }

  // Contacts
  if (parsed && typeof parsed === "object" && (parsed.admin || parsed.additional_contacts)) {
    const parts = [];
    if (parsed.admin?.name) parts.push(`Admin: ${parsed.admin.name}`);
    if (parsed.additional_contacts?.length) {
      const names = parsed.additional_contacts.filter(c => c.name).map(c => c.name);
      if (names.length <= 3) parts.push(names.join(", "));
      else parts.push(`${names.slice(0, 2).join(", ")} (+${names.length - 2} more)`);
    }
    return parts.join(" | ") || "Contacts defined";
  }

  // Generic object
  if (parsed && typeof parsed === "object") {
    const entries = Object.entries(parsed).filter(([_, v]) => v !== null && v !== "" && v !== undefined);
    if (entries.length === 0) return "Empty object";
    const summary = entries.slice(0, 4).map(([k, v]) => {
      if (typeof v === "string" && v.length <= 40) return `${k}: ${v}`;
      if (typeof v === "boolean" || typeof v === "number") return `${k}: ${v}`;
      return k;
    });
    if (entries.length > 4) summary.push(`(+${entries.length - 4} more)`);
    return summary.join(", ");
  }

  return "";
}

// Fetch all pages and update Summary where the current Summary is wrong
async function main() {
  let cursor = undefined;
  let updated = 0;
  let checked = 0;

  do {
    const params = { data_source_id: DATA_SOURCE_ID, page_size: 100 };
    if (cursor) params.start_cursor = cursor;

    const response = await client.dataSources.query(params);

    for (const page of response.results) {
      const props = page.properties;
      const answerProp = props["Answer"];
      if (!answerProp) continue;

      const answerText = answerProp.rich_text?.[0]?.plain_text || "";
      if (!answerText.trim()) continue;

      // Only process JSON answers
      const trimmed = answerText.trim();
      if (!trimmed.startsWith("{") && !trimmed.startsWith("[")) continue;

      checked++;
      const newSummary = generateAnswerSummary(answerText);
      const currentSummary = props["Summary"]?.rich_text?.[0]?.plain_text || "";

      // Update if different
      if (newSummary !== currentSummary) {
        try {
          await client.pages.update({
            page_id: page.id,
            properties: {
              "Summary": {
                rich_text: newSummary
                  ? [{ text: { content: newSummary.substring(0, 2000) } }]
                  : [],
              },
            },
          });
          updated++;
          if (updated % 10 === 0) console.log(`  Updated ${updated} so far...`);
        } catch (err) {
          console.error(`  Failed to update page ${page.id}:`, err.message);
        }
      }
    }

    cursor = response.has_more ? response.next_cursor : undefined;
  } while (cursor);

  console.log(`Done. Checked ${checked} JSON answers, updated ${updated} summaries.`);
}

main().catch(err => { console.error(err); process.exit(1); });

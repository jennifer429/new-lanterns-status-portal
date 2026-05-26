/**
 * Backfill the "Summary" column for all questionnaire rows in Notion
 * that have JSON-formatted answers.
 *
 * Usage: node scripts/backfill-notion-summary.mjs
 */

import { Client } from "@notionhq/client";
import dotenv from "dotenv";
dotenv.config();

const NOTION_API_KEY = process.env.NOTION_API_KEY || process.env.Notion_API_Key;
const DATABASE_ID = process.env.NOTION_DATABASE_ID || "c16396a9-b4c9-48f0-9264-6e58f3742676";
const DATA_SOURCE_ID = process.env.NOTION_DATASOURCE_ID || "0ee29093-c05c-4fdf-b3ad-bd9e2405b3b7";

if (!NOTION_API_KEY) {
  console.error("Missing NOTION_API_KEY");
  process.exit(1);
}

const notion = new Client({ auth: NOTION_API_KEY });

// Friendly labels for workflow path keys
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
  try {
    parsed = JSON.parse(trimmed);
  } catch {
    return ""; // Not JSON
  }

  // Array (multi-select)
  if (Array.isArray(parsed)) {
    if (parsed.length === 0) return "None selected";
    return parsed.join(", ");
  }

  // Workflow config { paths, systems, notes }
  if (parsed && typeof parsed === "object" && parsed.paths) {
    const activePaths = [];
    const notes = [];

    for (const [key, value] of Object.entries(parsed.paths)) {
      if (value === true) {
        activePaths.push(PATH_LABELS[key] || key);
      }
    }

    if (parsed.notes && typeof parsed.notes === "object") {
      for (const [key, value] of Object.entries(parsed.notes)) {
        if (value && typeof value === "string" && value.trim()) {
          const pathKey = key.replace(/_note$/, "");
          const label = PATH_LABELS[pathKey] || pathKey;
          notes.push(`${label}: "${value.trim()}"`);
        }
      }
    }

    const systems = [];
    if (parsed.systems && typeof parsed.systems === "object") {
      for (const [key, value] of Object.entries(parsed.systems)) {
        if (value && typeof value === "string" && value.trim()) {
          systems.push(`${key}: ${value.trim()}`);
        }
      }
    }

    if (activePaths.length === 0 && notes.length === 0) {
      return "No workflows active";
    }

    let summary = "";
    if (activePaths.length > 0) summary += `Active: ${activePaths.join(" · ")}`;
    if (systems.length > 0) summary += `\nSystems: ${systems.join(" · ")}`;
    if (notes.length > 0) summary += `\nNotes: ${notes.join(" · ")}`;
    return summary.trim();
  }

  // Other objects
  if (parsed && typeof parsed === "object") {
    const keys = Object.keys(parsed);
    if (keys.length === 0) return "Empty object";
    if (keys.length <= 5) return keys.join(", ");
    return `${keys.slice(0, 5).join(", ")} (+${keys.length - 5} more)`;
  }

  return "";
}

async function main() {
  console.log("Fetching all questionnaire pages from Notion...");

  let cursor = undefined;
  let totalPages = 0;
  let updatedPages = 0;
  let skippedPages = 0;

  do {
    const queryParams = {
      data_source_id: DATA_SOURCE_ID,
      page_size: 100,
    };
    if (cursor) queryParams.start_cursor = cursor;

    const response = await notion.dataSources.query(queryParams);

    for (const page of response.results) {
      totalPages++;
      const props = page.properties;

      // Get the Answer text
      const answerRichText = props?.["Answer"]?.rich_text;
      const answer = answerRichText?.[0]?.plain_text || "";

      // Generate summary
      const summary = generateAnswerSummary(answer);

      if (!summary) {
        skippedPages++;
        continue;
      }

      // Check if Summary already has this value
      const existingSummary = props?.["Summary"]?.rich_text?.[0]?.plain_text || "";
      if (existingSummary === summary) {
        skippedPages++;
        continue;
      }

      // Update the page
      try {
        await notion.pages.update({
          page_id: page.id,
          properties: {
            "Summary": {
              rich_text: [{ text: { content: summary.substring(0, 2000) } }],
            },
          },
        });
        updatedPages++;

        const slug = props?.["Slug"]?.rich_text?.[0]?.plain_text || "?";
        const qId = props?.["Question ID"]?.rich_text?.[0]?.plain_text || props?.["Question"]?.title?.[0]?.plain_text || "?";
        console.log(`  ✓ ${slug} / ${qId} → "${summary.substring(0, 80)}${summary.length > 80 ? '...' : ''}"`);
      } catch (err) {
        console.error(`  ✗ Failed to update page ${page.id}:`, err.message);
      }

      // Rate limit: Notion allows ~3 req/sec
      await new Promise((r) => setTimeout(r, 350));
    }

    cursor = response.has_more ? response.next_cursor : undefined;
  } while (cursor);

  console.log(`\nDone! Total: ${totalPages} pages, Updated: ${updatedPages}, Skipped: ${skippedPages}`);
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});

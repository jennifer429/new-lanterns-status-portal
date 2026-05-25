/**
 * Notion Summary Generator
 *
 * Converts JSON-formatted questionnaire answers into human-readable summaries
 * for the "Summary" column in Notion. This makes workflow configurations and
 * multi-select arrays scannable without parsing JSON.
 *
 * Called by:
 *   1. syncAnswerToNotion() — on every portal write
 *   2. notionSyncBack — after processing Notion→MySQL sync
 *   3. One-time backfill script for existing rows
 */

// Friendly labels for workflow path keys
const PATH_LABELS: Record<string, string> = {
  // Orders
  ordersFromRIS: "Orders from RIS",
  ordersFromEHR: "Orders from EHR",
  manualEntry: "Manual Entry",
  // Images
  imagesFromModalities: "Images from Modalities",
  imagesViaVNA: "Images via VNA",
  imagesViaAI: "Images via AI",
  // Priors
  priorsManual: "Priors Manual",
  priorsQuery: "Priors Query",
  priorsPush: "Priors Push",
  // Reports Out
  reportsToRIS: "Reports to RIS",
  reportsToEHR: "Reports to EHR",
  reportsToPortal: "Reports to Portal",
};

/**
 * Generate a human-readable summary from a JSON answer string.
 * Returns empty string if the answer is not JSON or has no meaningful content.
 */
export function generateAnswerSummary(answer: string): string {
  if (!answer || !answer.trim()) return "";

  const trimmed = answer.trim();

  // Try to parse as JSON
  let parsed: any;
  try {
    parsed = JSON.parse(trimmed);
  } catch {
    // Not JSON — no summary needed (plain text answers are already readable)
    return "";
  }

  // Case 1: Array (multi-select like modalities)
  if (Array.isArray(parsed)) {
    if (parsed.length === 0) return "None selected";
    return parsed.join(", ");
  }

  // Case 2: Workflow configuration object { paths, systems, notes }
  if (parsed && typeof parsed === "object" && parsed.paths) {
    const activePaths: string[] = [];
    const notes: string[] = [];

    for (const [key, value] of Object.entries(parsed.paths)) {
      if (value === true) {
        activePaths.push(PATH_LABELS[key] || key);
      }
    }

    // Collect non-empty notes
    if (parsed.notes && typeof parsed.notes === "object") {
      for (const [key, value] of Object.entries(parsed.notes)) {
        if (value && typeof value === "string" && value.trim()) {
          const pathKey = key.replace(/_note$/, "");
          const label = PATH_LABELS[pathKey] || pathKey;
          notes.push(`${label}: "${value.trim()}"`);
        }
      }
    }

    // Collect non-empty systems
    const systems: string[] = [];
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
    if (activePaths.length > 0) {
      summary += `Active: ${activePaths.join(" · ")}`;
    }
    if (systems.length > 0) {
      summary += `\nSystems: ${systems.join(" · ")}`;
    }
    if (notes.length > 0) {
      summary += `\nNotes: ${notes.join(" · ")}`;
    }

    return summary.trim();
  }

  // Case 3: Other JSON objects (e.g., ARCH.systems) — try to summarize keys
  if (parsed && typeof parsed === "object") {
    const keys = Object.keys(parsed);
    if (keys.length === 0) return "Empty object";
    if (keys.length <= 5) return keys.join(", ");
    return `${keys.slice(0, 5).join(", ")} (+${keys.length - 5} more)`;
  }

  return "";
}

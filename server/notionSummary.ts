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

  // Case 1: Array (multi-select like modalities, or array of objects like systems/endpoints)
  if (Array.isArray(parsed)) {
    if (parsed.length === 0) return "None selected";
    // If first element is an object, route to Case 3 logic below
    if (typeof parsed[0] === "object" && parsed[0] !== null) {
      // handled in Case 3
    } else {
      return parsed.join(", ");
    }
  }

  // Case 2: Workflow configuration object { paths, systems, notes }
  // Single-line format: "✓ Path1 (note) · ✓ Path2 | Sys: val"
  if (parsed && typeof parsed === "object" && parsed.paths) {
    // Build a map of path notes for inline display
    const noteMap: Record<string, string> = {};
    if (parsed.notes && typeof parsed.notes === "object") {
      for (const [key, value] of Object.entries(parsed.notes)) {
        if (value && typeof value === "string" && value.trim()) {
          const pathKey = key.replace(/_note$/, "");
          noteMap[pathKey] = value.trim();
        }
      }
    }

    // Build path items with inline notes
    const pathItems: string[] = [];
    for (const [key, value] of Object.entries(parsed.paths)) {
      if (value === true) {
        const label = PATH_LABELS[key] || key;
        const note = noteMap[key];
        if (note) {
          // Truncate long notes to keep it tight
          const shortNote = note.length > 30 ? note.substring(0, 27) + "..." : note;
          pathItems.push(`✓ ${label} ("${shortNote}")`);
        } else {
          pathItems.push(`✓ ${label}`);
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

    if (pathItems.length === 0 && systems.length === 0) {
      return "No workflows active";
    }

    // Single-line: paths joined by " · ", then systems appended with " | "
    let summary = pathItems.join(" · ");
    if (systems.length > 0) {
      summary += ` | ${systems.join(", ")}`;
    }

    return summary;
  }

  // Case 3: Array of system/endpoint objects (ARCH.systems, IW.systems, CONN.endpoints)
  // These have shape: [{ id, name, type, notes/description }] or [{ id, trafficType, sourceSystem, ... }]
  if (Array.isArray(parsed) && parsed.length > 0 && typeof parsed[0] === "object") {
    // Connectivity endpoints (have trafficType field)
    if ("trafficType" in parsed[0]) {
      const items = parsed.map((ep: any) => {
        const parts: string[] = [];
        if (ep.trafficType) parts.push(ep.trafficType);
        if (ep.sourceSystem && ep.destinationSystem) parts.push(`${ep.sourceSystem} → ${ep.destinationSystem}`);
        return parts.join(": ") || "(unnamed endpoint)";
      });
      return items.length <= 4
        ? items.join(" | ")
        : `${items.slice(0, 3).join(" | ")} (+${items.length - 3} more)`;
    }
    // Systems: { name, type, notes/description }
    if ("type" in parsed[0] || "name" in parsed[0]) {
      const items = parsed
        .filter((s: any) => s.name || s.type)
        .map((s: any) => {
          if (s.name && s.type) return `${s.name} (${s.type})`;
          return s.name || s.type || "(unnamed)";
        });
      if (items.length === 0) return "No systems defined";
      return items.length <= 6
        ? items.join(", ")
        : `${items.slice(0, 5).join(", ")} (+${items.length - 5} more)`;
    }
    // Generic array of objects — show count
    return `${parsed.length} items`;
  }

  // Case 4: Contacts object { admin: {...}, additional_contacts: [...] }
  if (parsed && typeof parsed === "object" && (parsed.admin || parsed.additional_contacts)) {
    const parts: string[] = [];
    if (parsed.admin?.name) parts.push(`Admin: ${parsed.admin.name}`);
    if (parsed.additional_contacts?.length) {
      const names = parsed.additional_contacts
        .filter((c: any) => c.name)
        .map((c: any) => c.name);
      if (names.length <= 3) {
        parts.push(names.join(", "));
      } else {
        parts.push(`${names.slice(0, 2).join(", ")} (+${names.length - 2} more)`);
      }
    }
    return parts.join(" | ") || "Contacts defined";
  }

  // Case 5: Other JSON objects — try to summarize keys with values
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

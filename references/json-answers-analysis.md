# JSON Answers in the Database — Analysis

## Summary

There are **15 total JSON-formatted answers** across the system (in the `responses` and `intakeResponses` tables). These fall into two categories:

---

## Category 1: Multi-Select Arrays (Question D.3, D.7)

**Example** (Baycare, Question 72 / D.3 — "Modalities Read"):
```json
["CT", "X-Ray", "MRI", "Ultrasound", "Nuclear Medicine", "Mammography"]
```

**How it looks on the portal:** Rendered as a multi-select checkbox group. Users check boxes for each modality they use. The portal reads the JSON array and checks the corresponding boxes.

**How it looks in Notion:** Stored as a plain text string in the "Answer" property:
```
["CT", "X-Ray", "MRI", "Ultrasound", "Nuclear Medicine", "Mammography"]
```

---

## Category 2: Workflow Configuration Objects (Questions 60001–60004 / *-workflow_config)

These are the swim-lane workflow diagrams. Each workflow stores a structured JSON object with three nested maps:

**Example** (RRAL, `orders-workflow_config`):
```json
{
  "paths": {
    "ordersFromRIS": true
  },
  "systems": {},
  "notes": {
    "ordersFromRIS_note": "fa"
  }
}
```

### Structure:
| Field | Purpose |
|-------|---------|
| `paths` | Boolean flags — which pathways are active (checked) |
| `systems` | Text fields — which systems are involved in each path |
| `notes` | Text fields — free-text notes per active path |

### The 4 Workflow Types:
1. **orders-workflow_config** — Order sources (RIS HL7, EHR HL7, Manual Entry)
2. **images-workflow_config** — Image routing (from Modalities, via VNA, via AI)
3. **priors-workflow_config** — Prior studies (Manual, Query, Push)
4. **reports-out-workflow_config** — Report distribution (to RIS, to EHR, to Portal)

---

## How It Renders on the Portal

The portal renders these JSON objects as **interactive swim-lane diagrams**:

```
☑ [RIS] → [Silverback] → [New Lantern]   Notes: "fa"
☐ [EHR] → [Silverback] → [New Lantern]   Notes: ""
☐ [Manual Entry] → [Silverback] → [New Lantern]   Notes: ""
```

Each row is a `SwimLaneRow` component with:
- A checkbox (maps to `paths.ordersFromRIS`)
- Source system box (e.g., "RIS")
- Arrow → Middleware box (e.g., "Silverback")
- Arrow → Destination box (e.g., "New Lantern")
- Notes input field (maps to `notes.ordersFromRIS_note`)

Active rows are highlighted in purple; inactive rows are grayed out.

---

## How It Looks in Notion (Current State)

In Notion, the "Answer" property is a **rich_text** field containing the raw JSON string:

```
{"paths":{"ordersFromRIS":true},"systems":{},"notes":{"ordersFromRIS_note":"fa"}}
```

**This is the legibility problem you noticed** — engineers looking at Notion see raw JSON blobs instead of human-readable data.

---

## Data Flow (Read/Write/Sync)

### Writing (Portal → Notion + MySQL):
1. User checks/unchecks swim-lane paths on the portal
2. Frontend calls `saveMutation` with `response: JSON.stringify(config)`
3. Server writes to MySQL (`intakeResponses.response` column)
4. Server also calls `syncAnswerToNotion()` which writes the JSON string to Notion's "Answer" property (truncated to 2000 chars)

### Reading (MySQL → Portal):
1. Portal loads responses from MySQL via tRPC query
2. Frontend does `JSON.parse(savedConfig)` to reconstruct the object
3. Passes the parsed object to `<WorkflowDiagram configuration={...} />`
4. Each path boolean maps to a checkbox, each note maps to an input field

### Sync-Back (Notion → MySQL):
1. Every 5 min, `notionSyncBack` queries Notion for recently edited rows
2. Reads the "Answer" rich_text property (raw JSON string)
3. Upserts it directly into MySQL `intakeResponses.response` column
4. **No transformation** — the JSON string passes through as-is

### Updating in Notion:
If an engineer edits the "Answer" field in Notion, they must:
- Write valid JSON (e.g., change `"ordersFromRIS": false` to `true`)
- The sync-back job will pick it up within 5 minutes and update MySQL
- Next time the portal loads, the swim-lane diagram reflects the change

---

## The Legibility Problem

| Where | What Engineers See |
|-------|-------------------|
| Portal | Beautiful interactive swim-lane diagrams with checkboxes and notes |
| MySQL | Raw JSON string in `response` column |
| Notion | Raw JSON string in "Answer" rich_text property |

**The Notion view is unreadable for engineers** who want to quickly see which workflows are active for a site without parsing JSON mentally.

---

## Potential Improvements

1. **Expand JSON into separate Notion properties** — e.g., "Orders from RIS" (checkbox), "Orders from EHR" (checkbox), "Orders Notes" (text) — but this would require a schema redesign
2. **Add a "Human Readable" computed column** in Notion that summarizes the JSON (e.g., "Active: Orders from RIS, Images from Modalities")
3. **Keep JSON as-is but add a Notion formula** that extracts key info for quick scanning
4. **Create a separate "Workflow Summary" view** in Notion that flattens the JSON into readable rows

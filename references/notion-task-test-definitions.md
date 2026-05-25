# Notion Task & Test Definitions — Claude Reference

This document tells Claude (or any AI agent) how to add, edit, and archive rows in the **Task Definitions** and **Test Definitions** Notion databases that power the New Lantern Implementation Portal.

---

## Architecture Overview

```
Notion (source of truth)
    ↓  cron sync every 5 min
MySQL (read cache for portal)
    ↑  dual-write on user edits
Portal UI
```

- **Notion** holds the canonical definitions. Changes here propagate to MySQL within 5 minutes.
- **MySQL** is the fast read layer. The portal never queries Notion directly for page loads.
- **Dual-write**: When a user edits via the portal, the router writes to both Notion and MySQL simultaneously for instant feedback.
- **Cron sync-back**: Every 5 minutes, a background job reads all rows from Notion and upserts them into MySQL, catching any changes made directly in Notion.

---

## Database IDs

| Database | Notion Database ID | Data Source ID |
|----------|-------------------|----------------|
| Task Definitions | `20145e64-99de-4436-829e-e8b70de1bed0` | `cb58aaf7-f353-4872-9b82-f6f40b04e65f` |
| Test Definitions | `7e5fb5d3-717b-49df-af78-30ed22ecfc46` | `20939f11-cbca-4ccb-acd9-3f90f8c5e4fe` |
| Questionnaire | `c16396a9-b4c9-48f0-9264-6e58f3742676` | `0ee29093-c05c-4fdf-b3ad-bd9e2405b3b7` |
| Contacts | `c6f04901-bba7-4e3c-bf8e-51847c45ef06` | `d1f270d6-9090-467d-9872-ba95937d6f93` |
| Systems | `6eac7e0d-8a38-4279-86f4-db6a1bf6061b` | `5bff84ad-ebe7-408f-9296-563608cac725` |
| Sync Log | `7a409211-a784-4970-bd5a-5d243a4aa21f` | — |
| Connectivity | (env: NOTION_CONNECTIVITY_DATABASE_ID) | (env: NOTION_CONNECTIVITY_DATASOURCE_ID) |

---

## Task Definitions Schema

| Property | Type | Description |
|----------|------|-------------|
| Title | title | Display name of the task (e.g., "VPN Tunnel Configuration") |
| Key | rich_text | Stable unique identifier (e.g., `network:vpn`). Format: `section:slug` |
| Description | rich_text | Brief description of what "done" looks like |
| Section | select | Section group ID: `network`, `hl7`, `config`, `templates`, `training`, `testing`, `prod-validation` |
| Section Title | rich_text | Human-readable section name (e.g., "Network & Connectivity") |
| Duration | rich_text | Expected duration for the section (e.g., "5–10 days") |
| Intake Link | rich_text | URL path to related intake section (e.g., `/intake?section=connectivity`) |
| Intake Link Label | rich_text | Display label for the intake link (e.g., "VPN Form (E.1)") |
| Spec Link | rich_text | URL path to related spec document (optional) |
| Spec Link Label | rich_text | Display label for the spec link (optional) |
| Active | checkbox | `true` = visible in portal. `false` = archived (hidden but preserved) |
| Sort Order | number | Display order (1-based, ascending). Tasks render in this order. |

### Key Format Convention

Keys follow the pattern `section:slug` where:
- `section` matches the Section select value (e.g., `network`, `hl7`, `config`)
- `slug` is a short kebab-case identifier unique within that section

Examples: `network:vpn`, `hl7:orm`, `config:proc`, `test:e2e`, `prod:golive`

---

## Test Definitions Schema

| Property | Type | Description |
|----------|------|-------------|
| Name | title | Test name (e.g., "VPN Tunnel Connectivity") |
| Key | rich_text | Stable unique identifier. Format: `phaseIndex:testIndex` (e.g., `0:0`, `1:2`, `3:14`) |
| Description | rich_text | What the test validates |
| Phase | select | Phase group: `Connectivity Validation`, `HL7 Message Validation`, `Image Routing Validation`, `User Acceptance Testing` |
| Related Questions | rich_text | Comma-separated question IDs and labels (e.g., "E.1 (VPN Form), H.1 (Number of Sites)") |
| Active | checkbox | `true` = visible in portal. `false` = archived |
| Sort Order | number | Display order (1-based, ascending) |

### Key Format Convention

Test keys use `phaseIndex:testIndex` (both 0-based):
- Phase 0 = Connectivity Validation
- Phase 1 = HL7 Message Validation
- Phase 2 = Image Routing Validation
- Phase 3 = User Acceptance Testing

Example: `2:1` = Image Routing Validation → Prior Image Query/Retrieve

---

## How to Add a New Task

Use the Notion MCP `notion-create-pages` tool:

```json
{
  "data_source_id": "cb58aaf7-f353-4872-9b82-f6f40b04e65f",
  "pages": [
    {
      "properties": {
        "Title": "New Task Name",
        "Key": "section:new-slug",
        "Description": "What done looks like",
        "Section": "network",
        "Section Title": "Network & Connectivity",
        "Duration": "5–10 days",
        "Intake Link": "/intake?section=connectivity",
        "Intake Link Label": "VPN Form (E.1)",
        "Active": "__YES__",
        "Sort Order": 6
      }
    }
  ]
}
```

**Important**: Assign a `Sort Order` that places the task in the correct position. If inserting between existing tasks, you may need to renumber subsequent tasks.

---

## How to Add a New Test

```json
{
  "data_source_id": "20939f11-cbca-4ccb-acd9-3f90f8c5e4fe",
  "pages": [
    {
      "properties": {
        "Name": "New Test Name",
        "Key": "3:15",
        "Description": "What this test validates",
        "Phase": "User Acceptance Testing",
        "Related Questions": "IW.orders_description (Orders Workflow), G.3 (ORC-1 Values)",
        "Active": "__YES__",
        "Sort Order": 29
      }
    }
  ]
}
```

**Important**: The Key must be unique. For new tests appended to the end of a phase, use the next available index for that phase.

---

## How to Edit an Existing Row

Use `notion-update-page` with the page URL or ID:

```json
{
  "page_id": "<page_id>",
  "properties": {
    "Description": "Updated description text",
    "Active": "__YES__"
  }
}
```

Only include the properties you want to change. Omitted properties remain unchanged.

---

## How to Archive (Soft Delete)

Never delete rows. Set `Active` to `false`:

```json
{
  "page_id": "<page_id>",
  "properties": {
    "Active": "__NO__"
  }
}
```

The portal will stop showing this task/test, but the row remains in Notion for audit history. The MySQL cache will also mark it as inactive on the next sync cycle (within 5 minutes).

---

## How to Find a Row

Use `notion-search` or query the data source:

```
Search for "VPN Tunnel" in data source cb58aaf7-f353-4872-9b82-f6f40b04e65f
```

Or search by Key:
```
Find row where Key = "network:vpn" in Task Definitions
```

---

## How to Reorder Tasks/Tests

Update the `Sort Order` number property on the rows you want to move. The portal renders tasks/tests in ascending Sort Order within each section/phase.

---

## Adding a New Section (Tasks) or Phase (Tests)

1. Create rows with the new Section/Phase select value — Notion auto-creates the select option.
2. Assign appropriate Sort Order values (typically after existing sections).
3. Update the frontend if the section/phase needs special rendering (colors, icons, etc.).

---

## Sync Behavior

| Event | Latency |
|-------|---------|
| Edit in Notion | Appears in portal within 5 minutes (next cron cycle) |
| Edit in portal | Instant (dual-write to both Notion and MySQL) |
| Admin clicks "Refresh Sync" | Immediate full sync of all tables |
| New row in Notion | Appears in portal within 5 minutes |
| Archive in Notion (Active=false) | Hidden in portal within 5 minutes |

---

## Cron Schedule

| Job | Schedule | Offset |
|-----|----------|--------|
| Questionnaire sync | `*/5 * * * *` | :00, :05, :10... |
| Contacts & Systems sync | `2-57/5 * * * *` | :02, :07, :12... |
| Task & Test Definitions sync | `4-59/5 * * * *` | :04, :09, :14... |
| Hourly log to Notion | `0 * * * *` | Top of hour |
| Purge old sync logs | `0 3 */3 * *` | Every 3 days at 3 AM |

---

## Environment Variables (in `server/_core/env.ts`)

```
NOTION_TASKS_DATABASE_ID = "20145e64-99de-4436-829e-e8b70de1bed0"
NOTION_TASKS_DATASOURCE_ID = "cb58aaf7-f353-4872-9b82-f6f40b04e65f"
NOTION_TESTS_DATABASE_ID = "7e5fb5d3-717b-49df-af78-30ed22ecfc46"
NOTION_TESTS_DATASOURCE_ID = "20939f11-cbca-4ccb-acd9-3f90f8c5e4fe"
```

---

## Rules

1. **Never delete rows** — always archive by setting `Active = false`.
2. **Keys are immutable** — once assigned, a Key must never change (it's the stable identifier used across MySQL, portal, and completion tracking).
3. **Sort Order must be unique** within a section/phase — duplicates cause undefined render order.
4. **Section/Phase values must match exactly** — they're used as lookup keys in the portal.
5. **Changes propagate within 5 minutes** — or instantly if the admin clicks "Refresh Sync".

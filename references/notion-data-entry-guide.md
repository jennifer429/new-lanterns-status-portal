# Notion Data Entry Guide

> **Purpose:** Instructions for Claude and humans on how to correctly populate and update the Notion databases that sync to the Implementation Portal.

---

## Overview

The portal reads from **6 Notion databases**. Four sync automatically via cron (every 5 minutes), one is fetched on-demand, and two are read-only reference tables.

| Database | Notion ID | Sync Direction | Frequency | Key Linking Field |
|---|---|---|---|---|
| **Questionnaire** | `0ee29093-c05c-4fdf-b3ad-bd9e2405b3b7` | Notion → MySQL | Every 5 min (`:00, :05, :10...`) | `Slug` (rich_text) |
| **Contacts v2** | `d1f270d6-9090-467d-9872-ba95937d6f93` | Bidirectional | Every 5 min (`:02, :07, :12...`) | `Institution Group` (multi_select) |
| **Systems v2** | `5bff84ad-ebe7-408f-9296-563608cac725` | Bidirectional | Every 5 min (`:02, :07, :12...`) | `Institution Group` (multi_select) |
| **Connectivity** | `53f78f54-...` | On-demand (API call) | Real-time | `Institution Group` (multi_select) |
| **Task Completions** | `ddf65e15-4b76-459a-a0fc-15c0fab023b0` | Bidirectional | Every 5 min (`:03, :08, :13...`) | `Organization ID` (number) |
| **Validation Results** | `2294cf68-e0b5-40b9-87d5-60c2da095926` | Bidirectional | Every 5 min (`:03, :08, :13...`) | `Organization ID` (number) |

**Read-only reference tables** (not synced back, used for definitions):
- Task Definitions: `0c6fc19c-9422-472b-a44e-c140df00b621`
- Test Definitions: `a1e174e5-c7a4-45eb-8601-3f2a497f102e`

---

## Critical Rules (All Tables)

1. **ALWAYS set the org-linking field.** Without it, the row will not appear on the portal.
2. **Use the exact org slug** as it appears in the portal (e.g., `RMCA`, `RRAL`, `BCO`, `Valley`).
3. **Never delete rows** — archive them instead (the sync respects Notion's archive flag).
4. **Changes appear on the portal within 5 minutes** (or immediately for connectivity).

---

## 1. Contacts v2

**Notion Database:** Implementation Portal Contacts v2

### Required Fields

| Field | Type | Required | Description |
|---|---|---|---|
| **Name** | Title | Yes | Full name of the contact |
| **Institution Group** | Multi-select | **YES — CRITICAL** | Must contain the org slug (e.g., `RMCA`). Without this, the contact will NOT appear on the portal. |
| **Role** | Select | Recommended | Contact's role (e.g., `Admin`, `IT`, `Clinical`, `Radiologist`, `PM`). Any value is accepted — roles are NOT hardcoded. |
| **Email** | Email | Recommended | Contact email address |
| **Phone** | Rich text | Optional | Phone number |
| **Notes** | Rich text | Optional | Context about the contact's responsibilities |
| **Site** | Select | Optional | Redundant with Institution Group but helps with filtering |
| **Partner** | Select | Optional | The partner/client name (e.g., `TRC`) |
| **Updated By** | Rich text | Auto-set | Set by portal when portal writes; leave blank when entering manually |

### How It Works

- The cron job reads ALL rows from this database every 5 minutes.
- It resolves the org by reading `Institution Group` (first value) or `Site` as fallback.
- The slug must match an existing organization in the portal's `organizations` table.
- Contacts are displayed in the intake questionnaire under the "Contacts" section.
- Users can also add/edit contacts from the portal UI (which writes back to Notion).

### Example: Adding RMCA Contacts

```
Name: Pete Furlow
Institution Group: [RMCA]
Role: Admin
Email: pfurlow@rmccares.org
Phone: 205-235-5862
Notes: Main contact for New Lantern portal, document uploads, and HL7 coordination.
```

### Common Mistakes

- **Empty Institution Group** → Contact won't appear on portal (this was the RMCA bug)
- **Wrong slug** (e.g., `rmca` lowercase) → Won't match. Use exact case from portal.
- **Duplicate contacts** → Check if the person already exists before adding. The sync uses `notionPageId` to deduplicate.

---

## 2. Systems v2

**Notion Database:** Implementation Portal Systems v2

### Required Fields

| Field | Type | Required | Description |
|---|---|---|---|
| **System Name** | Title | Yes | Name of the system (e.g., `Change Healthcare PACS`, `Corepoint`) |
| **Institution Group** | Multi-select | **YES — CRITICAL** | Must contain the org slug |
| **Type** | Select | Recommended | System type (e.g., `PACS`, `RIS`, `EHR`, `Integration Engine`, `VPN`) |
| **Vendor** | Rich text | Optional | Vendor name |
| **Version** | Rich text | Optional | Software version |
| **Notes** | Rich text | Optional | Additional context |
| **Site** | Select | Optional | Fallback for org resolution |

### How It Works

- Same sync mechanism as Contacts (every 5 min, resolves org from Institution Group).
- Systems are displayed on the portal's systems/infrastructure section.

### Example: Adding RMCA Systems

```
System Name: Altera Paragon
Institution Group: [RMCA]
Type: EHR
Notes: Hospital EHR — ORU filing via Corepoint integration engine.
```

---

## 3. Connectivity (Integration Connection Registry)

**Notion Database:** Integration Connection Registry

### Required Fields

| Field | Type | Required | Description |
|---|---|---|---|
| **Flow Name** | Title | Yes | Format: `{ORG} {Protocol} — {Description}` (e.g., `RMCA ORM — Orders Test`) |
| **Institution Group** | Multi-select | **YES — CRITICAL** | Must contain the org slug |
| **Status** | Select | Recommended | `Planning`, `Testing`, `Live`, `Blocked` |
| **Protocol** | Select | Recommended | `HL7 ORM`, `HL7 ORU`, `HL7 ADT`, `DICOM C-STORE`, `DICOM Q/R`, `VPN` |
| **Direction** | Select | Optional | `Inbound`, `Outbound`, `Bidirectional` |
| **Source** | Rich text | Optional | Source system |
| **Destination** | Rich text | Optional | Destination system |
| **Port** | Rich text | Optional | Port number |
| **IP** | Rich text | Optional | IP address |
| **Notes** | Rich text | Optional | Additional context |

### How It Works

- Connectivity is fetched **on-demand** (not via cron) — changes appear immediately on page refresh.
- The filter checks `Institution Group` multi-select for the org slug.
- **Fallback:** If Institution Group is empty, the filter will also match if the Flow Name starts with the org slug (e.g., `RMCA ORM — ...`). But always set Institution Group to be safe.

### Example: Adding RMCA Connectivity Flows

```
Flow Name: RMCA ORM — Orders Production
Institution Group: [RMCA]
Status: Testing
Protocol: HL7 ORM
Direction: Inbound
Source: Altera Paragon
Destination: Corepoint → New Lantern
Port: 6661
Notes: Production order feed. Waiting on Paragon team to send valid test cases.
```

---

## 4. Questionnaire (Implementation Portal Questionnaire)

**Notion Database:** Implementation Portal Questionnaire

### Required Fields

| Field | Type | Required | Description |
|---|---|---|---|
| **Name** | Title | Yes | Display label (not used for matching) |
| **Slug** | Rich text | **YES — CRITICAL** | The org slug (e.g., `RMCA`) |
| **Question ID** | Rich text | **YES — CRITICAL** | Must match a question ID from the portal's question definitions (e.g., `B.1`, `C.2`, `D.3`) |
| **Answer** | Rich text | Yes | The answer text |
| **Institution Group** | Select | Optional | Redundant with Slug but used as fallback |

### How It Works

- The sync queries for rows changed since the last checkpoint (using `last_edited_time`).
- It resolves the org from `Slug` (primary) or `Institution Group` (fallback).
- The `Question ID` must match an existing question in the portal's questionnaire structure.
- Answers appear in the intake questionnaire on the portal.

### Important Notes

- **Every site needs a row for every question.** Blank answers are fine — just create the row with an empty Answer field.
- **Question IDs are immutable.** Don't change them. They map to specific questions in the portal.
- **The portal can also write answers** (which syncs back to Notion via dual-write).

### Example: Filling RMCA Questionnaire

```
Name: RMCA — Go-live Date
Slug: RMCA
Question ID: B.1
Answer: August 15, 2026
Institution Group: RMCA
```

---

## 5. Task Completions

**Notion Database:** Implementation Task Completions

### Required Fields

| Field | Type | Required | Description |
|---|---|---|---|
| **Name** | Title | Yes | Format: `{orgSlug}/{taskId}` (e.g., `RMCA/hl7:orm`) |
| **Organization ID** | Number | **YES — CRITICAL** | The numeric org ID from MySQL (e.g., `990001` for RMCA) |
| **Task Key** | Rich text | **YES — CRITICAL** | The task identifier (e.g., `hl7:orm`, `dicom:cstore`) |
| **Status** | Select | Yes | `Not Started`, `In Progress`, `Blocked`, `Complete` |
| **Section Name** | Rich text | Optional | Which section this task belongs to |
| **Completed By** | Rich text | Optional | Who completed it |
| **Target Date** | Rich text | Optional | Expected completion date |
| **Notes** | Rich text | Optional | Context |
| **Completed At** | Rich text | Optional | When it was completed |
| **Site** | Rich text | Optional | Org name for display |
| **Last Updated From** | Rich text | Auto-set | `Portal` or `Notion` — used to prevent echo loops |

### How It Works

- The sync queries for rows changed since the last checkpoint.
- It matches rows to MySQL by `organizationId` + `taskKey`.
- The portal also writes to this database (dual-write) when users update task status.
- **Echo prevention:** If `Last Updated From` = `Portal`, the sync-back skips the row to avoid overwriting portal changes.

### Organization IDs

| Org Slug | Organization ID |
|---|---|
| RMCA | 990001 |
| RRAL | 1 |

(Check the `organizations` table in MySQL for the full list.)

---

## 6. Validation Results

**Notion Database:** Implementation Validation Results

### Required Fields

| Field | Type | Required | Description |
|---|---|---|---|
| **Name** | Title | Yes | Format: `{orgSlug}/{testKey}` (e.g., `RMCA/orm:order_create`) |
| **Organization ID** | Number | **YES — CRITICAL** | The numeric org ID from MySQL |
| **Test Key** | Rich text | **YES — CRITICAL** | The test identifier |
| **Status** | Select | Yes | `Not Tested`, `Pass`, `Fail`, `Blocked` |
| **Actual** | Rich text | Optional | Actual result observed |
| **Sign Off** | Rich text | Optional | Who signed off |
| **Notes** | Rich text | Optional | Context |
| **Tested Date** | Rich text | Optional | When the test was run |
| **Updated By** | Rich text | Optional | Who last updated |
| **Last Updated From** | Rich text | Auto-set | `Portal` or `Notion` |

### How It Works

- Same mechanism as Task Completions (sync-back every 5 min, dual-write from portal).
- Matches by `organizationId` + `testKey`.

---

## Troubleshooting

### Data not appearing on portal

1. **Check the org-linking field** — Is `Institution Group`, `Slug`, or `Organization ID` set correctly?
2. **Check the org slug matches** — Must be exact case match (e.g., `RMCA` not `rmca`).
3. **Wait 5 minutes** — Cron jobs run on a 5-minute cycle.
4. **Check the sync health page** — The admin panel shows sync status and errors.
5. **Check for archived rows** — Archived Notion pages are soft-deleted in MySQL.

### Duplicate rows

- Contacts/Systems: Deduplication is by `notionPageId`. If you create a new row instead of editing, you'll get a duplicate.
- Task/Validation: Deduplication is by `organizationId` + `taskKey`/`testKey`. The sync will upsert (update if exists).
- Questionnaire: Deduplication is by `organizationId` + `questionId`. Same upsert behavior.

### Sync errors

- Check the Notion Sync Log (in Notion) for hourly status reports.
- Check the portal admin panel's "Sync Health" section.
- The reconciliation job runs hourly at `:30` and flags rows where MySQL and Notion are out of sync.

---

## Quick Reference: Org Slugs

| Slug | Full Name | Org ID |
|---|---|---|
| RMCA | Regional Medical Center Anniston | 990001 |
| RRAL | Radiology Regional Associates of Lakeland | 1 |

(Add new orgs to this list as they're onboarded.)

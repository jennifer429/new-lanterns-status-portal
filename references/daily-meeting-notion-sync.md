# Daily Meeting → Notion Sync Playbook

> **Audience:** Claude (or any AI assistant).
> **Trigger:** Once per day, after the user's client meetings.
> **Goal:** Turn each client meeting into structured updates in the right Notion databases so the portal stays in sync with reality.
> **Prime directive:** Notion is the source of truth. Update Notion — do **not** write directly to MySQL. The portal will pick up changes within 5 minutes via cron (`server/notionSyncContacts.ts`, `server/notionSyncBack.ts`, etc.).

---

## 1. Tools You Will Use

| Purpose | MCP server | Key tools |
|---------|------------|-----------|
| List today's meetings | Google Calendar MCP | `list_calendars`, `list_events` |
| Get meeting transcript + summary | Fireflies MCP | `fireflies_get_transcripts`, `fireflies_get_transcript`, `fireflies_get_summary`, `fireflies_search` |
| Read/write Notion CRM | Notion MCP | `notion-search`, `notion-fetch`, `notion-update-page`, `notion-create-pages`, `notion-update-data-source` |
| (Optional) follow-up tasks | ClickUp MCP | `clickup_create_task`, `clickup_create_task_comment` |
| (Optional) post status to client portal | this codebase | `organizations.postReply` (manual activity feed entry — see `server/routers/organizations.ts`) |

Do **not** spin up new infrastructure; only use the MCP tools above.

---

## 2. Notion Databases In Scope

These are the tables you may update. IDs are stable — copy them as-is.

| Database | Database ID | Data Source ID | Used for |
|----------|-------------|----------------|----------|
| Questionnaire | `c16396a9-b4c9-48f0-9264-6e58f3742676` | `0ee29093-c05c-4fdf-b3ad-bd9e2405b3b7` | Answers to intake questions per org × question |
| Contacts | `c6f04901-bba7-4e3c-bf8e-51847c45ef06` | `d1f270d6-9090-467d-9872-ba95937d6f93` | Per-org people (name, role, email, phone) |
| Systems | `6eac7e0d-8a38-4279-86f4-db6a1bf6061b` | `5bff84ad-ebe7-408f-9296-563608cac725` | Per-org systems (PACS/RIS/EHR/router/etc.) |
| Connectivity | env: `NOTION_CONNECTIVITY_DATABASE_ID` | env: `NOTION_CONNECTIVITY_DATASOURCE_ID` | HL7 / DICOM / network flows |
| Task Definitions | `20145e64-99de-4436-829e-e8b70de1bed0` | `cb58aaf7-f353-4872-9b82-f6f40b04e65f` | **Global** task catalog — only touch if user explicitly asks for catalog changes |
| Test Definitions | `7e5fb5d3-717b-49df-af78-30ed22ecfc46` | `20939f11-cbca-4ccb-acd9-3f90f8c5e4fe` | **Global** test catalog — same rule |

The **Activity Feed** lives in MySQL (`activityFeed` table) and is not on Notion. Skip it unless the user asks for a client-portal status post.

---

## 3. Daily Run — Step by Step

### Step 1. Pull today's meetings
```
list_calendars             → pick the user's primary calendar
list_events                → time_min = today 00:00 local, time_max = now
```
Filter to meetings that look client-facing (attendees include an external domain, or the title contains a known org name — RadOne, SRV, Marshall, Munson, Boulder, RRAL, etc.). Skip internal-only standups.

### Step 2. Match each meeting to a transcript
```
fireflies_get_transcripts  → filter by date = today
```
Match by meeting title + start time (±10 min). If no transcript exists, **stop for that meeting** and note it in the daily summary — do not invent updates.

For matched meetings, pull:
- `fireflies_get_summary` (action items, key topics, decisions)
- `fireflies_get_transcript` (only if the summary is insufficient and you need direct quotes)

### Step 3. Identify the org (Institution Group)
For each meeting, determine the **org slug** used in Notion's `Institution Group` field. Candidates live in the portal DB; common slugs include `RRAL`, `Marshall`, `Munson`, `boulder`, `marshallmedical`, etc. Confirm by:
```
notion-search   query: "<org name>"   filter to Questionnaire DB
```
If you cannot confidently resolve the org, ask the user — do **not** write updates against the wrong Institution Group.

### Step 4. Extract structured updates
For every meeting, scan the summary/transcript for the categories in §4 and produce a **proposed change list**. Each proposed change must say: target DB, target row (page ID or "new"), fields to set, and the source quote.

### Step 5. Confirm before writing
Present the proposed change list to the user in a short table. Only proceed after they say "go" (or its equivalent). Do not auto-write — meetings produce ambiguous claims, and writing the wrong vendor name into Notion poisons the portal for everyone.

### Step 6. Write to Notion
Apply changes via `notion-update-page` / `notion-create-pages`. For every write set `Updated By` = `"claude-meeting-sync@<YYYY-MM-DD>"` so the source is auditable. For Questionnaire writes, also set `Last Updated From` = `"Notion"` (cron sync expects this; see `server/notion.ts:128`).

### Step 7. Report
End with a single message containing:
- Meetings processed and skipped (+ reason)
- Per-Notion-table counts: rows created / updated
- Action items recorded as ClickUp tasks (if any)
- Open ambiguities the user should resolve manually

---

## 4. What To Extract — Per-Table Rules

### 4.1 Contacts (`c6f04901-bba7-4e3c-bf8e-51847c45ef06`)

Update when a meeting establishes a person's identity, role, or contact info.

| Notion property | Type | Source signal in meeting |
|-----------------|------|--------------------------|
| `Name` | title | Self-intro, attendee list, "you'll want to talk to Sarah Chen" |
| `Role` | rich_text | "I'm the PACS admin", "Sarah is their CMIO" |
| `Email` | email | Stated email or attendee email |
| `Phone` | phone_number | Stated phone |
| `Notes` | rich_text | One-line context, e.g. "Primary escalation for downtimes" |
| `Partner` | rich_text | `RadOne` / `SRV` — inferred from org's client |
| `Institution Group` | multi_select | Org slug (see Step 3) |
| `Updated By` | rich_text | `claude-meeting-sync@YYYY-MM-DD` |

Rules:
- Match existing rows by `Name` + `Institution Group`. Only create a new row if no match.
- Never overwrite a non-empty field with an empty one. (Cron treats blanks as nulls — see `server/notionSyncContacts.ts:140`.)
- If a contact leaves the org, **archive the page** (set Notion's built-in `archived: true`) — don't delete.

### 4.2 Systems (`6eac7e0d-8a38-4279-86f4-db6a1bf6061b`)

Update when a system, vendor, or version is confirmed/corrected.

| Notion property | Source signal |
|-----------------|---------------|
| `System Name` (title) | Product name, e.g. "Sectra IDS7" |
| `System Type` | One of: PACS, RIS, EHR/EMR, Interface Engine, VNA, AI Platform, Modality Router, Dose Tracking, … |
| `Vendor` | Vendor company, e.g. "Sectra", "Epic" |
| `Version` | If stated |
| `Notes` | Any quirks ("on-prem", "shared with Boulder Radiology") |
| `Institution Group` | Org slug |
| `Partner` | Client slug |
| `Updated By` | `claude-meeting-sync@YYYY-MM-DD` |

Rules:
- Match by `System Name` (case-insensitive) + `Institution Group`.
- If they're swapping a system (e.g. "we're moving off Cerner to Epic next quarter"), **don't** flip the row immediately. Add a note like "Planned EHR swap to Epic — target Q3" and surface this as an action item.

### 4.3 Connectivity (env: `NOTION_CONNECTIVITY_DATABASE_ID`)

Update when an HL7 feed, DICOM route, IP/port, AE title, router, or modality changes. Properties (see `server/routers/connectivity.ts:67`):

| Property | Notes |
|----------|-------|
| `Flow Name` (title) | e.g. "Epic → NL ORM" |
| `Protocol / Message Type` | HL7-ORM, HL7-ORU, DICOM C-STORE, DICOM C-FIND, … |
| `Direction` | Inbound / Outbound / Bidirectional |
| `Sender System / AE Title`, `Receiver System / AE Title` | Free text |
| `Sender IP / Port`, `Receiver IP / Port` | Format `"10.1.2.3:104"` — see `parseIpPort()` |
| `SRC AE Title`, `DST AE Title` | DICOM only |
| `ENV` | `Prod` / `Test` / `Both` |
| `Status` | Use existing select values; don't invent new ones without confirming |
| `Router Present`, `Router Type`, `Modalities`, `Rad Group` | If discussed |
| `Last Verified`, `Verified By` | Set when client confirms a flow is live and tested |
| `Institution Group` | multi_select — org slug |

Rules:
- Match a row by `(Protocol / Message Type, Sender System, Receiver System)` — that's the composite key the sync uses (`rowKey()` in `server/routers/connectivity.ts:222`).
- IP/port changes are high-impact. Always confirm with the user before writing.

### 4.4 Questionnaire (`c16396a9-b4c9-48f0-9264-6e58f3742676`)

Use this when the client answers an intake question during the call (the question IDs map to `shared/questionnaireData.ts`).

| Property | Value |
|----------|-------|
| `Question ID` (rich_text) | Existing ID, e.g. `H.1`, `A.6`, `ARCH.1`, `IW.orders_description` |
| `Answer` (rich_text) | Plain string (≤ 2000 chars). For multi-field answers, JSON-stringify exactly like the portal does. |
| `Status` (select) | `Complete` when an answer is provided, otherwise leave |
| `Institution Group` (select) | Org slug |
| `Updated By` (rich_text) | `claude-meeting-sync@YYYY-MM-DD` |
| `Last Updated From` (rich_text) | `Notion` |
| `Files` (files) | Only if a file was shared; attach as external URL |

Rules:
- One row per **org × question**. Find it with `notion-search` filtered by Institution Group, then by `Question ID` — mirror the logic in `findNotionPageForQuestion()` in `server/notion.ts:56`. If no row exists, the org's questionnaire wasn't seeded — flag to the user, don't auto-create.
- For known JSON shapes (e.g. `IW.*_systems`, `ARCH.systems`, contacts table) preserve the existing schema. If unsure, surface the raw text and let the user format it.
- Don't overwrite a richer existing answer with a shorter meeting paraphrase. Prefer **appending** under a "—— Meeting update YYYY-MM-DD:" line, unless the client explicitly corrected the prior answer.

### 4.5 Tasks & Tests (catalogs)

**Skip unless the user explicitly asks.** These are global definitions (`references/notion-task-test-definitions.md`), not per-meeting data.

---

## 5. Action Items → ClickUp (optional)

When the Fireflies summary lists an action item:
- Owner = New Lantern → create a `clickup_create_task` in the appropriate list (`Implementation`, the org's list, etc.). Include: meeting title, date, Notion page links for any context you updated, and the source quote.
- Owner = client → record as a Note on the relevant Contact in Notion. Do not create a ClickUp task.
- Owner = unclear → flag for the user.

---

## 6. Guardrails

1. **Never auto-write without confirmation** when a single meeting touches more than 5 rows or any IP/port/vendor/contact email.
2. **Never delete rows.** Archive (`archived: true`) instead. The cron treats archive as soft-delete (`server/notionSyncContacts.ts:152`).
3. **Don't fabricate.** If the transcript is ambiguous, ask the user. A missing update is recoverable; a wrong update writes through to every site that views the portal.
4. **Stay scoped to the org of the meeting.** Don't update Munson based on something said in a Marshall call, even if it sounds related.
5. **Tag every write** with `Updated By = claude-meeting-sync@<date>` so the next-day audit query (`notion-search` by Updated By) shows exactly what you touched.
6. **Don't touch MySQL.** The portal's read cache rebuilds from Notion every 5 minutes; bypassing it causes drift.
7. **Don't bump `Last Verified`** on connectivity rows unless the client explicitly confirmed the flow is working in prod that day.

---

## 7. Example Run (abridged)

```
You: run the daily meeting sync

Claude:
  Pulled 3 meetings from today's calendar:
    • 9:00 RRAL weekly sync          → Fireflies transcript ✓
    • 11:30 Marshall PACS deep-dive  → Fireflies transcript ✓
    • 14:00 Internal standup         → skipped (no client)

  Proposed Notion changes:
    Contacts (2):
      + RRAL / "Jamie Lee" (IT Connectivity, jamie.lee@rral.example) — new
      ~ Marshall / "Pat Singh" — update Phone to 555-0101 (was empty)
    Systems (1):
      ~ Marshall / "Sectra IDS7" — set Version "24.1.3" (was empty)
    Connectivity (1):
      ~ Marshall / DICOM C-STORE Modalities → NL — Last Verified = today, Verified By = "Pat Singh"
    Questionnaire (1):
      ~ RRAL / H.1 — Answer "4 sites" (was "3"; client corrected)
    ClickUp (1):
      + "Send security questionnaire link to Marshall" — owner NL, due Fri

  Confirm to write? (yes / edit / cancel)

You: yes

Claude:
  Wrote 5 Notion updates, 1 ClickUp task created.
  Open items for you:
    • Marshall mentioned an EHR swap to Epic in Q3 — captured as a System note,
      no row flipped. Want me to draft a remediation project record?
```

---

## 8. References

- `server/notion.ts` — questionnaire write helpers
- `server/routers/connectivity.ts` — connectivity schema + composite key
- `server/notionSyncContacts.ts` — Contacts & Systems sync (read direction)
- `references/notion-task-test-definitions.md` — task/test catalog rules
- `references/sync-architecture.md` — Notion ↔ MySQL data flow
- `docs/design-notion-crm-architecture.md` — why Notion is the source of truth

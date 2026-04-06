# Design: Notion as CRM — Portal as UI Layer

**Status:** Design complete — not yet implemented  
**Date:** April 6, 2026  
**Author:** Manus + NL team design session

---

## Core Principle

**Notion is the database. The portal is a UI layer.**

The portal does not own org/CRM data. Notion does. The portal reads from Notion to display, and writes to Notion when users make changes. Engineers can skip the portal entirely and edit Notion directly — the portal reflects those changes in real time.

---

## System Architecture

```
Users (hospital IT, partners, NL staff)
  │
  ▼
Portal (this app)
  ├── Questionnaire → structured data collection
  ├── Projects → workflow to trigger collection/review
  ├── Connectivity dashboard → visual CRM view
  ├── Tasks/testing → operational workflow
  │
  ▼ (bidirectional sync)
Notion (the CRM / source of truth)
  ├── Org profiles (summary database)
  ├── Architecture details (per-org detail pages)
  ├── Connectivity configs
  ├── Contact info
  ├── Status tracking
  └── Everything else
```

---

## Data Model

### What the Questionnaire Really Is

The questionnaire is the **data collection mechanism** for the org's CRM record. The answers *are* the CRM data. It is not a project artifact — it is the org's living knowledge base. Projects are just the *reason* you update it.

### Organization Lifecycle

```
Created → Active (has projects) → Deactivated (hidden from all dashboards, read-only)
```

- Deactivated orgs are hidden from the UI entirely. Only platform admins can reactivate.
- One active project per org at a time.

### Project Lifecycle

```
Planning → In Progress → Testing → Complete → Archived
```

- **Implementation:** First-time data collection + go-live. Org starts with blank questionnaire. Every field is new.
- **Remediation:** Triggered when something changes (EHR swap, modality add, router change). Fixed set of change reasons. Same questionnaire — user reviews everything, confirms what hasn't changed, updates what has.

### What Belongs Where

**On the Organization (permanent/operational):**

| Data | Rationale |
|------|-----------|
| Questionnaire responses (CRM data) | The org's living knowledge base — always current |
| Connectivity matrix | Live production state — what's connected right now |
| Active modalities/routers | Physical infrastructure that exists regardless of projects |
| VPN/network config | Production network state |
| User access/accounts | Users belong to orgs, not projects |
| Status (active/deactivated) | Org-level lifecycle |
| Partner/client assignment | Relationship data |

**On the Project (engagement-scoped):**

| Data | Rationale |
|------|-----------|
| Scope (which sections are in-scope) | What this engagement is reviewing |
| Change log (what changed during this project) | Historical record of the delta |
| Review tracking (who confirmed what, when) | Accountability for the review cycle |
| Tasks and task completion | Work items for this engagement |
| Test results/validation | Testing done per-engagement |
| Files and uploads | Documents submitted during this engagement |
| Notes and timeline | Communication during this engagement |
| Progress tracking | How far along this engagement is |

### Remediation Review Flow

During a remediation, every question gets a three-state response:

| State | Meaning | UI Treatment |
|-------|---------|-------------|
| **Carried forward** | Answer pulled from current org data, user hasn't reviewed yet | Gray text, yellow "Needs Review" badge |
| **Confirmed (N/A)** | User reviewed, answer is still correct, no change needed | Check mark, "Reviewed — No Change" label, timestamp + who confirmed |
| **Updated** | User changed the answer — old value logged in project change history | Updated value shown, change indicator, old value in audit trail |

The questionnaire is always editable by authorized users, project or no project. Every edit is timestamped. A project ensures a structured review happens — it doesn't control access.

---

## Notion Structure (Hybrid Approach)

### Summary Database (one table, orgs as rows)

The main Notion database with ~30-40 key properties that enable cross-site filtering and pattern recognition:

| Category | Key Fields |
|----------|-----------|
| Identity | Org name, status, partner, primary contact, go-live date |
| Architecture | EHR name, RIS name, PACS vendor, modality count, modality types |
| Connectivity | Router vendor, VPN type, connection status |
| Progress | Implementation %, current project type, project status |

This is the database the user shared: queryable, filterable, groupable across all sites.

### Detail Pages (linked from each row)

Each org row links to a detail page containing the full questionnaire depth — organized by section. All the granular fields that matter for a specific site but that you'd never compare across 50 sites at once.

### Write Strategy

- **Key fields** (EHR name, router, modalities): Portal writes to both the summary database property AND the detail page
- **Detail fields** (specific IP address, firewall rule): Portal writes only to the detail page
- **Writes are real-time:** Save in the portal → immediate Notion API call
- **Reads are bidirectional:** Engineer edits Notion directly → portal reflects the change

---

## Sync Architecture

### Portal → Notion (user saves in portal)

1. User answers a question in the portal
2. Portal saves to local DB (for fast reads and offline resilience)
3. Portal fires Notion API call to update the corresponding property/page
4. If the field is a "key field," update both summary DB property and detail page

### Notion → Portal (engineer edits Notion)

Two options (to be decided during implementation):

**Option A: Webhook/polling** — Notion webhooks or periodic polling detects changes and syncs back to local DB.

**Option B: Read-through** — Portal always reads from Notion API (with caching). No local DB for CRM data at all. Simpler but slower and dependent on Notion API availability.

Recommendation: Start with Option A (local DB as cache, Notion as source of truth, periodic sync). This gives you speed + resilience while keeping Notion authoritative.

---

## What Stays in the Portal's Local Database

| Data | Why |
|------|-----|
| User accounts and sessions | Auth is portal-managed |
| Project workflow state | Task lists, test results, review tracking |
| Audit logs | AI actions, change history |
| File upload references | S3 keys and metadata |
| Session state and preferences | UI state |

---

## Migration Path

1. Every existing org gets one auto-created "Implementation" project
2. All current questionnaire answers, tasks, files, progress data re-parent to that project
3. The org becomes a lighter-weight container pointing to Notion
4. Existing connectivity data syncs to Notion (expanding current integration)
5. Zero user-visible change on day one — same UI, same data, different plumbing

---

## Open Questions

1. **Notion workspace layout:** Is the shared database the summary-level database, or does it need restructuring?
2. **Sync latency tolerance:** How fast does Notion → Portal sync need to be? (seconds vs. minutes)
3. **Offline behavior:** What happens if Notion API is down? Read from local cache? Block writes?
4. **Remediation change reasons:** What is the fixed set? (EHR swap, modality add, router change, ...?)
5. **Project creation:** Who can create a remediation project? Platform admin only, or partner admin too?

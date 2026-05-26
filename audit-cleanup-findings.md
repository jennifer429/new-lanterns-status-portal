# Cleanup Audit: Unused Databases, Env Vars, and Dead Code

## 1. Notion Databases — Unused / Duplicates

| Database | ID | Status | Recommendation |
|----------|-----|--------|---------------|
| Implementation Portal - Site Projects | 36585719-79e7-8065-96f9-ea4eec7ec214 | **Empty, never wired** | Delete |
| File Activity Log | 472debfd-9da8-4049-9052-aee42b880a9a | **Created but not wired** (NOTION_FILE_AUDIT_DATASOURCE_ID secret not set) | Wire up or delete |
| Task Completion (old) | 21255cb8-08f4-4bb8-9547-c1336adbd3a9 | **Duplicate** — portal uses bf0d616d | Archive/delete |
| Validation Results (old) | ebdb542c-f97f-40e1-9bba-5ca3239199ec | **Duplicate** — portal uses 17813c6e | Archive/delete |
| Task Definitions (old) | 20145e64-99de-4436-829e-e8b70de1bed0 | **Duplicate** — portal uses 0c6fc19c | Archive/delete |
| Test Definitions (old) | 7e5fb5d3-717b-49df-af78-30ed22ecfc46 | **Duplicate** — portal uses a1e174e5 | Archive/delete |

**Actively used databases (keep):**
- Implementation Portal Questionnaire (c16396a9)
- Implementation Portal Contacts v2 (c6f04901)
- Implementation Portal Systems v2 (6eac7e0d)
- Implementation Portal Connectivity Info (36585719-79e7-8020)
- Implementation Portal Task Definitions (0c6fc19c)
- Test Definitions (a1e174e5)
- Task Completion Records (bf0d616d)
- Validation Results (17813c6e)
- Portal Sync Log (7a409211)

---

## 2. Environment Variables — Unused / Unnecessary

### Completely unused (not referenced in any code):

| Env Var | Status | Recommendation |
|---------|--------|---------------|
| NOTION_SYNC_CONFIG_DATASOURCE_ID | Declared in secrets, never used in code | Remove from secrets |
| VITE_ANALYTICS_ENDPOINT | In secrets list, zero references in frontend | Remove |
| VITE_ANALYTICS_WEBSITE_ID | In secrets list, zero references in frontend | Remove |
| VITE_FRONTEND_FORGE_API_KEY | In secrets list, zero references in frontend | Remove |
| VITE_FRONTEND_FORGE_API_URL | In secrets list, zero references in frontend | Remove |

### Declared in env.ts but never accessed via ENV.*:

| ENV Property | Status | Recommendation |
|-------------|--------|---------------|
| ENV.notionSyncConfigDataSourceId | Declared, never used anywhere | Remove from env.ts |
| ENV.notionTaskDefinitionsDbId | Declared, never used (code uses datasource ID directly) | Remove from env.ts |
| ENV.notionTestDefinitionsDbId | Declared, never used (code uses datasource ID directly) | Remove from env.ts |
| ENV.notionTaskCompletionDbId | Declared, never used (code uses datasource ID) | Remove from env.ts |
| ENV.notionValidationResultsDbId | Declared, never used (code uses datasource ID) | Remove from env.ts |

### Google-related (partially dead):

| Env Var | Status | Recommendation |
|---------|--------|---------------|
| GOOGLE_SERVICE_ACCOUNT_EMAIL | Used by googleDrive.ts (file uploads) | Keep if Google Drive is active |
| GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY | Used by googleDrive.ts | Keep if Google Drive is active |
| GOOGLE_DRIVE_FOLDER_ID | Used as default parent folder | Keep if Google Drive is active |
| GOOGLE_AUDIT_SHEET_ID | **Dead** — old fileAuditLog.ts no longer uses it (replaced with Notion) | Remove |

### Oddly-cased duplicate:

| Env Var | Status | Recommendation |
|---------|--------|---------------|
| Notion_API_Key (mixed case) | Only used as fallback in fileAuditLog.ts | Remove (use NOTION_API_KEY only) |

---

## 3. Dead Code / Stale Files

### One-time migration scripts (scripts/ directory — 22 files, 3019 lines):
All of these are one-time migration scripts that have already run. They're not harmful but add clutter:
- backfill-notion-last-edited.mjs
- backfill-notion-site-column.mjs
- backfill-notion-summary.mjs / rebackfill-notion-summary.mjs
- migrate-contacts-systems-v2.mjs
- migrate-tasks-tests-to-notion.mjs
- migrate-validation-results.mjs
- create-tasks-tests-notion-dbs.mjs
- create-sync-config-pages.mjs
- fix-sync-config.mjs / unarchive-sync-config.mjs
- clear-stuck-marks.mjs
- populate-tasks-tests-notion.mjs
- seed-demo-org.mjs / seed-vpn-templates.sql
- send-invite-emails.mjs
- sync-questions.mjs
- check-arch-json.mjs
- verify-navigation-urls.ts
- sync-config-page-ids.md

**Recommendation:** Move to `scripts/_archive/` or delete. Only keep `purge-sync-log.mjs` and `sync-quality-check.mjs` if they're still useful as maintenance tools.

### Dead feature code:
- `server/fileAuditLog.ts` — Now writes to Notion, but still has remnant Google Sheets references in comments. The `GOOGLE_AUDIT_SHEET_ID` and old `createGoogleSheet` logic is gone, but the file could be cleaner.

---

## 4. Summary

| Category | Unused Items | Action |
|----------|-------------|--------|
| Notion databases | 6 (4 duplicates + 2 empty) | Archive/delete |
| Env vars (secrets) | 5 completely unused | Remove from secrets panel |
| ENV.* properties | 5 declared but never accessed | Remove from env.ts |
| Google env vars | 1 dead (AUDIT_SHEET_ID) | Remove |
| Migration scripts | 20+ one-time scripts | Archive |

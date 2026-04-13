# Claude Code Rules — New Lanterns Status Portal

Operational rules for AI-assisted work on this codebase. These complement the code index in `CLAUDE.md`.

---

## Before Touching Any File

1. **Check for merge conflict markers** before editing. Run:
   ```
   grep -rn "<<<<<<\|=======\|>>>>>>>" server/ client/ shared/ drizzle/
   ```
   Resolve all conflicts before adding new code on top.

2. **Read the file before editing it.** Never patch code you haven't read in this session.

3. **Work on the designated feature branch only.** Never push to `main`.

---

## Partner/Client Identity — Never Hardcode

All partner logic must be data-driven via `clientId` from the `clients` table.

**Forbidden patterns:**
```ts
// WRONG — hardcodes a partner name
COALESCE(clients.name, 'RadOne')

// WRONG — special-cases a partner by name
if (user.partner === 'SRV') { ... }

// WRONG — encodes partner differences in shared data files
'Rad One clients use X. SRV clients use Y.'
```

**Correct pattern:** Filter by `clientId` at runtime. If a client has no record, return `null`/`''` or throw — do not substitute a default partner name.

**Why:** There are multiple partners (SRV, RadOne, and future ones). Hardcoding any partner name silently misbehaves for all others.

---

## User Identity — Know Who You're Dealing With

| User type | `role` | `clientId` | `organizationId` |
|-----------|--------|-----------|-----------------|
| Platform admin | `admin` | `null` | `null` |
| Partner admin (e.g. SRV admin) | `admin` | SRV's client ID | `null` |
| Org user (e.g. SRV hospital staff) | `user` | SRV's client ID | their org's ID |

**Rules:**
- Org users have **both** `clientId` and `organizationId` set.
- Never assume `clientId` alone identifies an admin — check `role`.
- Never assume `organizationId` being null means the user is an admin.
- When filtering data by partner, use `clientId`. When filtering by org, use `organizationId`.

---

## File Access — Never Return Stale URLs

Forge/S3 pre-signed URLs **expire**. Google Drive `webViewLink` URLs are permanent.

**Rule:** Never store a Forge URL in the DB and return it directly to clients later. Instead:
1. Store the storage key (`s3Key` or `driveFileId`).
2. Add a server-side endpoint that calls `storageGet(key)` to generate a fresh URL on demand.
3. The frontend fetches the fresh URL via tRPC before opening the file.

See `server/routers/proceduralLibrary.ts → getDownloadUrl` for the reference implementation.

---

## Routing — New-Style and Legacy URLs Must Stay in Sync

Two URL formats coexist:
- Legacy: `/org/:slug/page`
- New-style: `/org/:clientSlug/:orgSlug/page`

**Rule:** Any time you add a route for one format, add it for the other. Check `App.tsx` for the complete list and add in pairs.

**Current new-style routes that need a match for every legacy route:**
```
/org/:clientSlug/:slug/intake
/org/:clientSlug/:slug/implement
/org/:clientSlug/:slug/validation
/org/:clientSlug/:slug/workflows
/org/:clientSlug/:slug/specs
/org/:clientSlug/:slug/connectivity
/org/:clientSlug/:slug/tasks
/org/:clientSlug/:slug/library    ← recently added
/org/:clientSlug/:slug/complete
```

**Building sibling links in components:** Use `orgPath()` from `UserMenu.tsx`, not manual regex on `window.location.pathname`.

---

## Procedure (tRPC) Access Control

| Procedure type | When to use |
|----------------|-------------|
| `publicProcedure` | Truly public data (org info by slug for intake, vendor options). No user data. |
| `protectedProcedure` | Any endpoint that reads or writes user/org/partner data. |
| `adminProcedure` | Admin-only operations (create/delete orgs, manage users, templates). |

**Red flag:** If a `publicProcedure` returns rows filtered by `clientId` or `organizationId`, it should be `protectedProcedure`.

---

## Git Safety

- Always use `git push -u origin <branch>` — never `--force` without explicit approval.
- Never `--no-verify` on commits.
- Retry push on network failure (up to 4× with exponential backoff: 2s, 4s, 8s, 16s).
- Run `npm run check` before committing.

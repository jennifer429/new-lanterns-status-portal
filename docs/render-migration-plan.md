# Render + Manus Dual-Platform Plan

Goal: the same codebase runs and compiles on **both Manus and Render**, flipped by a single environment variable. One shared MySQL database. No divergent branches.

---

## 1. The "switch" — what differs between the two platforms

| Coupling point | File | What's Manus-specific | Fix |
|---|---|---|---|
| Build-time vite plugins | `vite.config.ts:152` | `vitePluginManusRuntime()` + Manus debug collector | Gate behind `DEPLOY_TARGET` — only include when not `render` |
| Cron jobs | `server/_core/index.ts:68` (`startCronJobs()`) | Notion sync-back / retry queue / reconciliation — must run on only ONE environment when sharing a DB | Gate behind `ENABLE_CRON=true`; enable on the primary env only |
| File storage proxy | `server/storage.ts` | Forge API (`BUILT_IN_FORGE_API_URL` / `_KEY`) | No code change — Forge is just an HTTPS endpoint; copy the env vars to Render |
| OAuth login | `server/_core/sdk.ts` | `OAUTH_SERVER_URL` points at Manus auth server | OAuth button may not redirect correctly to Render's domain; email/password login (`authRoutes.ts`) works on Render either way |

Everything else (tRPC, Drizzle, Notion, Google Drive, React build output) is platform-agnostic.

---

## 2. Database migration (the prerequisite)

Render cannot reach the Manus-hosted MySQL, so the database has to move to a host both environments can reach.

### Pick a host
Any externally-reachable managed MySQL with TLS. Candidates:
- **PlanetScale** — MySQL-compatible, branching, simplest for "drop in for Render."
- **Railway** — quickest provisioning, ~$5/mo.
- **Aiven** — small free tier.
- **AWS RDS MySQL** / **DigitalOcean Managed MySQL** — if existing infra.

Outcome: a `mysql://user:pass@host:port/db?ssl={"rejectUnauthorized":true}` connection string usable from both Manus and Render.

### Cutover steps
1. Stop writes on Manus briefly (or pick a low-use window).
2. Dump current Manus MySQL:
   ```bash
   mysqldump --single-transaction --routines --triggers \
     --set-gtid-purged=OFF <db> > dump.sql
   ```
3. Import to the new host:
   ```bash
   mysql -h <new-host> -u <user> -p <db> < dump.sql
   ```
4. Update `DATABASE_URL` on **both** Manus and Render to the new connection string.
5. Redeploy both. Verify with `npm run db:push` (drizzle-kit will report drift; should be none).
6. Sanity-check Notion sync, file uploads, login on both environments.

---

## 3. Environment variables — three buckets

### A. Portable — copy identical values to Render
Work anywhere; no platform coupling.
- `JWT_SECRET`
- `NOTION_API_KEY` and all other `NOTION_*` (database IDs, datasource IDs)
- `GOOGLE_SERVICE_ACCOUNT_EMAIL`, `GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY`, `GOOGLE_DRIVE_FOLDER_ID`
- `EXTERNAL_API_KEY`
- `INVITE_WEBHOOK_URL`, `INVITE_WEBHOOK_SECRET`, `INVITE_WEBHOOK_ENABLED`
- `SITE_BASE_URL` — portable but environment-specific (set to the Render URL on Render)

### B. Manus-platform endpoints — copy values; HTTPS-reachable from Render
- `BUILT_IN_FORGE_API_URL`, `BUILT_IN_FORGE_API_KEY` — file storage, LLM, image, voice. Render can reach this; same values work.
- `OAUTH_SERVER_URL`, `VITE_APP_ID`, `OWNER_OPEN_ID` — Manus OAuth login. Only fully works on Render if the Manus auth server has Render's callback URL whitelisted. Email/password login is the safe fallback.

### C. New / environment-specific
- `DATABASE_URL` — same value on both, pointing at the new shared MySQL.
- `DEPLOY_TARGET` — `manus` (default) on Manus, `render` on Render.
- `ENABLE_CRON` — `true` on the primary environment, `false` (or unset) on the other.
- `PORT` — set by Render automatically; do not override.

---

## 4. Code changes to make (small, additive)

1. **`vite.config.ts`** — read `process.env.DEPLOY_TARGET`. If `=== "render"`, build the plugin list as `[react(), tailwindcss()]` only.
2. **`server/_core/index.ts`** — wrap `startCronJobs()` in `if (process.env.ENABLE_CRON === "true")`.
3. **`render.yaml`** (new, repo root) — captures Render config in the repo:
   - `buildCommand: pnpm install --frozen-lockfile && pnpm build`
   - `startCommand: pnpm start`
   - `envVars` listing the required keys (values set in dashboard, not committed).
4. No change to `server/storage.ts` — Forge proxy works from Render as-is.

All changes are additive; defaults preserve current Manus behavior.

---

## 5. Decisions still open

- **MySQL host** — PlanetScale / Railway / Aiven / existing infra?
- **Cron primary** — which env runs Notion sync? (Recommendation: Render once it's the production target; Manus during development.)
- **OAuth on Render** — whitelist Render's callback in the Manus auth server, or rely on email/password?

---

## 6. Execution order

1. Provision new MySQL; capture the connection string.
2. Dump + import data; update `DATABASE_URL` on Manus, verify Manus still works.
3. Land the code switch (vite gate, cron gate, `render.yaml`) on `claude/compassionate-mendel-O8lkg`.
4. Configure Render env vars (bucket A + B + `DATABASE_URL` + `DEPLOY_TARGET=render` + `ENABLE_CRON=true` if Render is primary).
5. Deploy Render from the same branch.
6. Disable cron on whichever environment is the secondary.
7. Smoke test: login, intake save, file upload, Notion sync, admin dashboard — on both environments.

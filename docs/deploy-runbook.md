# Deploy Runbook — Why "Publish" Fails Silently, and How to Fix It

> **Mental model:** On this project, **a green build does not mean the app will
> deploy.** The build (`vite build` + `esbuild`) strips types and never runs the
> app. Every deploy failure we've hit has been **invisible to the build** — it
> happens either at the publish's *type-check gate* or at *container startup*.
> This runbook lists the silent-failure modes, how to confirm each from logs, and
> the exact fix.

---

## First rule of diagnosis: look at the RIGHT logs

| Log type | Shows | Catches |
|----------|-------|---------|
| **Build logs** | `vite build` / `esbuild` output | almost nothing real — esbuild ignores type errors |
| **Type-check gate** (publish runs `tsc`) | `tsc --noEmit` errors | type errors (mode A) |
| **Runtime / boot logs** (container stdout/stderr) | what the server prints when it launches | env crash, port bind, any startup throw (modes B, C) |

If Manus only surfaces **build logs** in its UI, that is *the reason these failures look silent* — the build is green and the real failure is in the type-check gate or the runtime logs. **Always get the publish's runtime/boot logs.**

---

## Silent-failure mode A — type errors fail the publish's `tsc` gate

**Symptom:** `npm run build` passes locally; publish fails (or "Max's branch had 51 errors").
**Why:** `"build": "vite build && esbuild …"` has **no type gate**. esbuild bundles type-broken code happily. The publish pipeline runs `tsc --noEmit` separately and rejects it.

**Confirm:** run `npm run check` (`tsc --noEmit`). It must be **0**.

**Fixes (both belong on `main`):**
1. Put `tsc` in the build so "build passes" can't hide type errors:
   ```jsonc
   "build": "tsc --noEmit && vite build && esbuild server/_core/index.ts ..."
   ```
2. Set a real `target` in `tsconfig.json`:
   ```jsonc
   "target": "ES2022"
   ```
   Without it TS defaults to ES3 and emits phantom `TS2802` "Map/Set can only be iterated" errors that mask the real ones (this is why counts looked like 3 vs 15 vs 51).

See `docs/data-dictionary.md` for the recurring type-contract mistakes (DB column ↔ payload field naming, upload return shapes, etc.).

---

## Silent-failure mode B — missing production secrets (boot crash) ⭐ current blocker

**Symptom:** build green, `tsc` clean, but the published container **exits immediately**; nothing serves.

**Why:** `server/_core/env.ts` validates required secrets at startup and **refuses to boot** if any are missing:
```js
const PROD_REQUIRED = ["JWT_SECRET", "DATABASE_URL"];
if (isProduction) {
  const missing = PROD_REQUIRED.filter(k => !e[k]);
  if (missing.length > 0) {
    console.error(`[env] Missing required environment variables in production: ${missing.join(", ")}`);
    throw new Error("Environment validation failed; refusing to start.");
  }
}
```
- Secrets come **only** from `process.env` (no committed `.env`, not in `ENV_OVERRIDES`, read **synchronously** at import — so **no race**, and an unset var = `""` = correctly flagged).
- This is **correct behavior** — do **not** remove the guard. Booting with `JWT_SECRET=""` makes session cookies forgeable; `DATABASE_URL=""` makes every DB call fail while the app still answers health checks (a "live" but dead app — worse than failing).

**Confirm:** in the **publish runtime/boot logs**, look for:
```
[env] Missing required environment variables in production: ...
```
Whatever it lists is what the production container isn't receiving.

**Root cause:** the built-in secrets are injected into the **dev/preview sandbox** (the app runs there) but **not into the publish/production container.** This is a **platform/pipeline** fix, not a code change.

**Fix (escalate to whoever manages the publish infra):** inject the same built-in
secrets into the **publish** target as the dev sandbox — at minimum `JWT_SECRET`
and the db-feature's `DATABASE_URL`. Escalation template at the bottom.

---

## Silent-failure mode C — wrong port binding (next in line after B)

**Symptom:** env passes, build green, but the platform still reports the app unhealthy.

**Why:** `server/_core/index.ts` (prod entry, bundled to `dist/index.js`) uses
`findAvailablePort()` — if the injected `PORT` looks busy it **silently binds to a
different port**, so the platform's router/health-check (which targets `PORT`)
never reaches the app.

**Fix (one line — bind exactly to `PORT` in production):**
```ts
const preferredPort = parseInt(process.env.PORT || "3000");
const port = process.env.NODE_ENV === "production"
  ? preferredPort                          // prod: bind EXACTLY the injected port
  : await findAvailablePort(preferredPort); // dev convenience only
```

Fold this into the same checkpoint as the mode-B fix so you clear both boot-time
silent failures at once instead of fixing B and discovering C.

---

## Environment variables the app reads

`PROD_REQUIRED` (hard-fail at boot if missing): **`JWT_SECRET`, `DATABASE_URL`**

All vars consumed by `server/_core/env.ts` — verify the **publish** target has the
ones it needs (secrets especially), not just the dev sandbox:

```
VITE_APP_ID, JWT_SECRET*, DATABASE_URL*, OAUTH_SERVER_URL, OWNER_OPEN_ID, NODE_ENV,
BUILT_IN_FORGE_API_URL, BUILT_IN_FORGE_API_KEY,
NOTION_API_KEY, NOTION_DATABASE_ID, NOTION_DATASOURCE_ID,
NOTION_CONNECTIVITY_DATABASE_ID, NOTION_CONNECTIVITY_DATASOURCE_ID,
NOTION_SYNC_LOG_DATASOURCE_ID, NOTION_SYNC_CONFIG_PAGE_ID,
NOTION_CONTACTS_DATABASE_ID, NOTION_CONTACTS_DATASOURCE_ID,
NOTION_SYSTEMS_DATABASE_ID, NOTION_SYSTEMS_DATASOURCE_ID,
NOTION_TASK_DEFINITIONS_DATABASE_ID, NOTION_TEST_DEFINITIONS_DATABASE_ID,
NOTION_TASK_COMPLETION_DATABASE_ID, NOTION_TASK_COMPLETION_DATASOURCE_ID,
NOTION_VALIDATION_RESULTS_DATABASE_ID, NOTION_VALIDATION_RESULTS_DATASOURCE_ID,
GOOGLE_SERVICE_ACCOUNT_EMAIL, GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY, GOOGLE_DRIVE_FOLDER_ID,
SITE_BASE_URL, EXTERNAL_API_KEY,
INVITE_WEBHOOK_URL, INVITE_WEBHOOK_SECRET, INVITE_WEBHOOK_ENABLED
```
`*` = required in production. The rest degrade gracefully (`.default("")`), but
features depending on them (Notion sync, Drive upload, OAuth, invites) won't work
until set.

---

## Pre-publish checklist

1. `npm run check` → **0** `tsc` errors (not "build passes").
2. `npm run build` → exits 0.
3. Boot test in prod mode locally **with** the required secrets:
   `JWT_SECRET=x DATABASE_URL=mysql://… NODE_ENV=production node dist/index.js`
   → expect `Server running on …` (no env throw, no port fallback message).
4. Publish target has `JWT_SECRET` + `DATABASE_URL` (and the feature secrets).
5. After publish: check **runtime logs** for the `[env] Missing required…` line and
   any `Port X is busy, using Y instead` message.

---

## Escalation template (secret injection)

> **Issue:** Production publish builds successfully but the container exits immediately on startup; nothing serves.
> **Cause:** `server/_core/env.ts` validates required secrets at boot and refuses to start if missing — required: `JWT_SECRET`, `DATABASE_URL`. (Correct behavior; the guard must stay.)
> **Root cause:** these built-in secrets are injected into the **dev/preview sandbox** (app runs fine there) but **not into the publish/production container**. They're sourced only from `process.env` (no `.env`, no override, read synchronously — no race).
> **Confirm:** publish runtime/boot logs show `[env] Missing required environment variables in production: …`.
> **Fix (platform):** inject the same built-in secrets into the **publish** target as the dev sandbox — `JWT_SECRET` and the db-feature `DATABASE_URL` at minimum. No code change is appropriate.

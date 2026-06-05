# Data-Quality Constraint Migrations (Phased)

These are **out-of-band, hand-reviewed DDL migrations** for the data-quality
hardening rollout. They live outside the `drizzle-kit` numbered sequence on
purpose: each one can fail if the data isn't clean, so they must be applied in a
controlled window — gated by the check script — rather than auto-run.

The matching definitions are already in `drizzle/schema.ts` (unique indexes,
`check()` constraints, enum columns, `.references()` FKs) so the ORM and types
reflect the destination state.

## The gate

```bash
DATABASE_URL="mysql://user:pass@host:3306/db" node scripts/data-quality-check.mjs
```
- §1 = referential integrity (gates Phase 3 FKs)
- §2 = uniqueness (gates Phase 1 unique keys)

`FAIL` findings **block** the corresponding phase — clean them, then re-run until clean.

## Apply order

| Phase | File | Gated by | Risk |
|-------|------|----------|------|
| 1 | `phase1_unique_keys.sql` | check §2 clean | low |
| 2 | `phase2_checks_enums.sql` | pre-flight SELECTs return 0 | low |
| 3 | `phase3_foreign_keys.sql` | check §1 clean | medium |

Run each phase, in order, against a **backup-verified** database during a low-traffic window:
```bash
mysql "$DATABASE_URL" < drizzle/manual/phase1_unique_keys.sql
# ...verify app + re-run the check script, then proceed to the next phase
```

## De-duping before Phase 1

`phase1_unique_keys.sql` ships with commented `DELETE` statements that keep the
**highest `id`** per key. If you'd rather keep the **most recently updated** row
(better for the upsert tables), use this variant per table, e.g.:

```sql
DELETE a FROM intakeResponses a
JOIN intakeResponses b
  ON a.organizationId = b.organizationId
 AND a.questionId = b.questionId
 AND (a.updatedAt < b.updatedAt OR (a.updatedAt = b.updatedAt AND a.id < b.id));
```
Always `SELECT` the duplicate groups and review them before deleting.

## After applying: reconcile the drizzle-kit snapshot

Because these were applied by hand (not via `drizzle-kit generate`), the
`drizzle/meta/*` snapshot doesn't yet know about them. After all phases are live,
baseline the snapshot so future `npm run db:push` runs don't try to re-add them:

```bash
npx drizzle-kit generate   # emits one migration matching schema.ts ↔ DB
```
The DDL is already applied, so **mark that generated migration as applied without
re-running it** (insert its hash into the `__drizzle_migrations` table), or run it
against a fresh/empty environment only. Confirm a subsequent `drizzle-kit generate`
reports no changes.

> Alternative (non-phased): if you ever stand up a brand-new database, you can skip
> these files entirely and let `npm run db:push` build the schema — constraints and
> all — directly from `schema.ts`.

## What's intentionally excluded

- **`contacts` / `systems`** — Notion is source of truth; no hard FK (sync ordering
  can transiently violate it). Covered by the scheduled data-quality check instead.
- **Audit tables** (`aiAuditLogs`, `vendorAuditLog`, `emailLog`, `partnerDocAudit.userId`)
  — left FK-free so history survives parent deletion.
- **`partnerDocuments.categoryId`** — no `partnerDocCategories` table exists.

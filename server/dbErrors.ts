/**
 * MySQL error classification helpers.
 *
 * Phase 3 of the database hardening rollout added foreign-key constraints to
 * most child tables (see drizzle/manual/phase3_foreign_keys.sql). Writes that
 * reference a non-existent parent row — an org deleted mid-request, a stale
 * payload replayed from the retry queue, a cron upsert racing a cascade delete —
 * are now *rejected* by MySQL where they previously succeeded silently.
 *
 * These helpers let call-sites recognize that specific failure and degrade
 * gracefully (translate to a clean 404 / skip the row / leave it on the retry
 * queue) instead of surfacing a raw 500. They never throw and tolerate the
 * various shapes an error can arrive in (mysql2 error, wrapped driver error,
 * plain Error with the code in the message).
 */

/** MySQL errno for "cannot add/update a child row: a FK constraint fails". */
export const ER_NO_REFERENCED_ROW = 1452;
/** MySQL errno for "cannot delete/update a parent row: a FK constraint fails". */
export const ER_ROW_IS_REFERENCED = 1451;

const FK_ERROR_CODES = new Set([
  "ER_NO_REFERENCED_ROW",
  "ER_NO_REFERENCED_ROW_2",
  "ER_ROW_IS_REFERENCED",
  "ER_ROW_IS_REFERENCED_2",
]);

const FK_ERRNOS = new Set([ER_NO_REFERENCED_ROW, ER_ROW_IS_REFERENCED]);

/**
 * True when `err` is (or wraps) a MySQL foreign-key constraint violation.
 *
 * Checks, in order: the numeric `errno`, the string `code`, and finally the
 * message text — mysql2 always sets `errno`/`code`, but errors re-thrown across
 * layers sometimes only carry the original message.
 */
export function isForeignKeyViolation(err: unknown): boolean {
  if (!err || typeof err !== "object") {
    // Last resort: a bare string message.
    return typeof err === "string" && /foreign key constraint fails/i.test(err);
  }

  const e = err as { errno?: unknown; code?: unknown; message?: unknown; cause?: unknown };

  if (typeof e.errno === "number" && FK_ERRNOS.has(e.errno)) return true;
  if (typeof e.code === "string" && FK_ERROR_CODES.has(e.code)) return true;
  if (typeof e.message === "string" && /foreign key constraint fails/i.test(e.message)) return true;

  // mysql2 / driver wrappers occasionally nest the real error under `cause`.
  if (e.cause && e.cause !== err) return isForeignKeyViolation(e.cause);

  return false;
}

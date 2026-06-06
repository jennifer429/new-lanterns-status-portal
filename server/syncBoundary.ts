/**
 * Sync boundary type coercion
 *
 * Values crossing the Notion → MySQL boundary arrive as free-form strings
 * (Notion `rich_text` / `select`), but the MySQL columns they land in are
 * strongly typed (DATETIME, ENUM). A malformed value used to take down a whole
 * sync run:
 *
 *   - `new Date("not a date")` → Invalid Date. Writing it to a DATETIME throws,
 *     and `.getTime()` returns NaN, which silently breaks the notionLastEdited
 *     version check (NaN === NaN is false → endless re-writes).
 *   - A `Status` select value Notion allows but the MySQL enum/CHECK does not
 *     (typo, renamed option) violates the constraint and rejects the row.
 *
 * These helpers coerce each value to a DB-safe shape *at the boundary*, logging
 * — never throwing — on bad input, so one poisoned Notion row can't sink the
 * batch. They are the single place type confusion is resolved on the way in.
 */

/** Validation result statuses the MySQL enum (and CHECK) will accept. */
export const VALIDATION_STATUSES = [
  "Pass",
  "Fail",
  "Not Tested",
  "Pending",
  "N/A",
  "In Progress",
  "Blocked",
] as const;

export type ValidationStatus = (typeof VALIDATION_STATUSES)[number];

const DEFAULT_VALIDATION_STATUS: ValidationStatus = "Not Tested";

/**
 * Coerce a Notion date string to a valid Date, or null.
 * Empty/whitespace and unparseable values both return null (with a warning for
 * the latter) rather than an Invalid Date.
 */
export function coerceNotionDate(
  value: string | Date | null | undefined,
  field = "date"
): Date | null {
  if (value == null) return null;
  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : value;
  }
  const trimmed = String(value).trim();
  if (trimmed === "") return null;

  const parsed = new Date(trimmed);
  if (Number.isNaN(parsed.getTime())) {
    console.warn(`[sync-boundary] Discarding unparseable ${field}: ${JSON.stringify(trimmed).slice(0, 80)}`);
    return null;
  }
  return parsed;
}

/**
 * Coerce a Notion status string to a value the validationResults enum accepts.
 * Unknown values fall back to "Not Tested" (with a warning) so the upsert can't
 * be rejected by the enum/CHECK constraint.
 */
export function coerceValidationStatus(
  value: string | null | undefined,
  field = "validation status"
): ValidationStatus {
  if (value == null) return DEFAULT_VALIDATION_STATUS;
  const trimmed = String(value).trim();
  const match = VALIDATION_STATUSES.find((s) => s === trimmed);
  if (match) return match;
  console.warn(
    `[sync-boundary] Unknown ${field} ${JSON.stringify(trimmed).slice(0, 80)} — defaulting to "${DEFAULT_VALIDATION_STATUS}"`
  );
  return DEFAULT_VALIDATION_STATUS;
}

/**
 * Parse a JSON string, returning `fallback` (default null) instead of throwing
 * on malformed input. Use at boundaries where a value *might* be JSON.
 */
export function safeJsonParse<T = unknown>(
  value: string | null | undefined,
  fallback: T | null = null,
  field = "value"
): T | null {
  if (value == null || value === "") return fallback;
  try {
    return JSON.parse(value) as T;
  } catch {
    console.warn(`[sync-boundary] Discarding unparseable JSON ${field}: ${String(value).slice(0, 80)}`);
    return fallback;
  }
}

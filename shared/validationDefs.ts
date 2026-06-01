/**
 * Validation test enumeration shared between the Validation page and the
 * server-side go-live logic.
 *
 * The full test definitions (names, expected values, source links) live in
 * `client/src/pages/Validation.tsx`. The server only needs to enumerate the
 * stable test keys (`"<phaseIndex>:<testIndex>"`), so we mirror just the
 * per-phase test counts here. KEEP IN SYNC with the `phases` array in
 * Validation.tsx if tests are added or removed.
 */
export const VALIDATION_PHASE_TEST_COUNTS = [4, 5, 4, 15] as const;

export const TOTAL_VALIDATION_TESTS = VALIDATION_PHASE_TEST_COUNTS.reduce((a, b) => a + b, 0); // 28

/** All test keys in the same `${phaseIndex}:${testIndex}` form used on the client. */
export function getAllTestKeys(): string[] {
  const keys: string[] = [];
  VALIDATION_PHASE_TEST_COUNTS.forEach((count, phaseIndex) => {
    for (let testIndex = 0; testIndex < count; testIndex++) {
      keys.push(`${phaseIndex}:${testIndex}`);
    }
  });
  return keys;
}

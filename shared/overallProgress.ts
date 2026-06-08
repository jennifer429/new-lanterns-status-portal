/**
 * Single source of truth for the "overall implementation progress" percentage.
 *
 * Three views render this number — the site dashboard, the admin portal, and
 * the status-update email — and they MUST agree. Previously each had its own
 * copy of the math and they drifted apart (74% / 64% / higher). Route every
 * caller through `computeOverallProgress` instead.
 *
 * Model (decided with product):
 *  - overall = qPct*0.4 + validation*0.3 + tasks*0.3, rounded once at the end.
 *  - In-progress / blocked items earn partial credit.
 *  - N/A counts as resolved (same as Pass/Complete) and stays in the
 *    denominator — i.e. the denominator is the fixed total, not "applicable".
 *    An all-N/A category therefore reads 100% ("nothing left to do").
 */

export interface ValidationCounts {
  pass: number;
  fail: number;
  inProgress: number;
  blocked: number;
  na: number;
  /** Full test count (e.g. 28) — the fixed denominator. */
  total: number;
}

export interface TaskCounts {
  completed: number;
  inProgress: number;
  blocked: number;
  na: number;
  /** Full task count — the fixed denominator. */
  total: number;
}

export interface OverallProgressInput {
  completedSections: number;
  totalSections: number;
  validation: ValidationCounts;
  tasks: TaskCounts;
}

export interface OverallProgressResult {
  /** Component percentages, 0-100, unrounded. Round at the display edge. */
  qPct: number;
  vPct: number;
  iPct: number;
  /** Blended overall percentage, rounded to an integer. */
  overallPct: number;
}

export function computeOverallProgress(
  input: OverallProgressInput
): OverallProgressResult {
  const { completedSections, totalSections, validation: v, tasks: t } = input;

  const qPct = totalSections > 0 ? (completedSections / totalSections) * 100 : 0;

  // N/A counts as resolved (like Pass/Complete); denominator is the fixed total.
  const vPct =
    v.total > 0
      ? ((v.pass + v.na + v.fail * 0.25 + v.inProgress * 0.5 + v.blocked * 0.25) /
          v.total) *
        100
      : 0;

  const iPct =
    t.total > 0
      ? ((t.completed + t.na + t.inProgress * 0.5 + t.blocked * 0.25) / t.total) *
        100
      : 0;

  const overallPct = Math.round(qPct * 0.4 + vPct * 0.3 + iPct * 0.3);

  return { qPct, vPct, iPct, overallPct };
}

/**
 * "Next up" derivations shared by BOTH the customer site dashboard
 * (client/src/hooks/useHomeData.ts) and the Platform Admin dashboard
 * (server/routers/admin.ts → getAdminSummary). Keeping this logic in one place
 * means the admin view and the site view can never drift apart.
 *
 * Status fields are intentionally loosely typed (`unknown`) so the same
 * functions work whether a caller passes booleans (client React Query data) or
 * 1/0 integers (raw Drizzle rows on the server) — both coerce correctly under
 * a truthiness check.
 */
import { getAllTestKeys } from "./validationDefs";

type StatusFlags = {
  completed?: unknown;
  inProgress?: unknown;
  blocked?: unknown;
  notApplicable?: unknown;
};

/** Section titles that still have incomplete questions, in section order. */
export function computeNextUpSections(
  sectionProgress: Record<string, { completed: number; total: number }>,
  limit = 3,
): string[] {
  return Object.entries(sectionProgress)
    .filter(([, s]) => s.completed < s.total)
    .slice(0, limit)
    .map(([title]) => title);
}

/** Test keys ("phase:test") not yet Pass or N/A, in canonical test order. */
export function computeNextUpTests(
  statusByKey: Record<string, { status?: string } | undefined>,
  limit = 3,
): string[] {
  return getAllTestKeys()
    .filter((k) => {
      const r = statusByKey[k];
      return !r || (r.status !== "Pass" && r.status !== "N/A");
    })
    .slice(0, limit);
}

/** Tasks that are still open (not done / in-progress / blocked / N/A). */
export function computeNextUpTasks<T extends { id: string; title: string }>(
  taskDefs: T[],
  statusById: Record<string, StatusFlags | undefined>,
  limit = 3,
): Array<{ id: string; title: string }> {
  return taskDefs
    .filter((t) => {
      const r = statusById[t.id];
      return !r?.completed && !r?.inProgress && !r?.blocked && !r?.notApplicable;
    })
    .slice(0, limit)
    .map((t) => ({ id: t.id, title: t.title }));
}

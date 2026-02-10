/**
 * Shared utility functions for admin dashboards
 */

/**
 * Transform sectionProgress from backend format to display format
 * Backend returns: Record<string, {completed: number, total: number}>
 * Returns: Array<{name: string, progress: number}>
 */
export function transformSectionProgress(
  sectionProgress: Record<string, { completed: number; total: number }> | undefined
): Array<{ name: string; progress: number }> {
  if (!sectionProgress) return [];

  return Object.entries(sectionProgress).map(([title, stats]) => ({
    name: title,
    progress: stats.total > 0 ? Math.round((stats.completed / stats.total) * 100) : 0,
  }));
}

/**
 * Filter sections to show only those in progress (> 0%)
 */
export function getInProgressSections(
  sectionProgress: Array<{ name: string; progress: number }>
): Array<{ name: string; progress: number }> {
  return sectionProgress.filter((s) => s.progress > 0);
}

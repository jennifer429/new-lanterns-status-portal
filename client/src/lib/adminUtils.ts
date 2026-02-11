/**
 * Shared utility functions for admin dashboards
 */

import { questionnaireSections } from "@shared/questionnaireData";

/**
 * All section titles from the questionnaire, used as a fallback
 * when sectionProgress data is not yet available (e.g., newly created org)
 */
const ALL_SECTION_TITLES = questionnaireSections.map(s => s.title);

/**
 * Transform sectionProgress from backend format to display format
 * Backend returns: Record<string, {completed: number, total: number}>
 * Returns: Array<{name: string, progress: number}>
 * 
 * Always returns all 9 sections. If sectionProgress is undefined or empty,
 * returns all sections at 0%.
 */
export function transformSectionProgress(
  sectionProgress: Record<string, { completed: number; total: number }> | undefined
): Array<{ name: string; progress: number }> {
  if (!sectionProgress || Object.keys(sectionProgress).length === 0) {
    // Return all sections at 0% as fallback
    return ALL_SECTION_TITLES.map(title => ({
      name: title,
      progress: 0,
    }));
  }

  // Map from backend data, ensuring all sections are present
  return ALL_SECTION_TITLES.map(title => {
    const stats = sectionProgress[title];
    return {
      name: title,
      progress: stats && stats.total > 0 ? Math.round((stats.completed / stats.total) * 100) : 0,
    };
  });
}


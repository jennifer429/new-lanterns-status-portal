/**
 * Shared progress calculation logic
 * Used by both admin dashboard and organization dashboard to ensure consistency
 */

export interface Question {
  id: string | number;
  sectionTitle: string;
  isWorkflow?: boolean; // True for workflow sections
  type?: string; // Question type: 'text', 'textarea', 'upload', 'dropdown', etc.
  conditionalOn?: { questionId: string; value: string } | null; // Conditional visibility
}

export interface Response {
  questionId: string | number | null;
  response: string | null;
}

export interface FileAttachment {
  questionId: string | number | null;
}

export interface SectionStats {
  [sectionTitle: string]: {
    completed: number;
    total: number;
  };
}

export interface ProgressResult {
  completionPercentage: number;
  sectionProgress: SectionStats;
  completedQuestions: number;
  totalQuestions: number;
  naQuestions: number;
}

/**
 * Determine if a conditional question should be visible based on the parent question's response.
 * A question is visible if:
 *   1. It has no conditionalOn (always visible), OR
 *   2. The parent question's response matches the required value
 */
export function isQuestionVisible(
  question: Question,
  responseMap: Map<string | number, Response>
): boolean {
  if (!question.conditionalOn) return true;

  const parentResponse = responseMap.get(question.conditionalOn.questionId);
  if (!parentResponse || !parentResponse.response) return false;

  return parentResponse.response.trim() === question.conditionalOn.value;
}

/**
 * Determine whether a question has been answered (ignoring N/A markers).
 * Single source of truth for "is this question complete" — used by both the
 * progress calculation and the go-live auto-N/A logic.
 */
export function isQuestionAnswered(
  q: Question,
  responseMap: Map<string | number, Response>,
  fileMap: Map<string | number, boolean>
): boolean {
  if (q.isWorkflow) {
    const resp = responseMap.get(q.id);
    if (resp && resp.response && resp.response.trim() !== "") {
      try {
        const config = JSON.parse(resp.response);
        return !!(config.paths && Object.values(config.paths).some((v: any) => v === true));
      } catch {
        return false;
      }
    }
    return false;
  }
  // Upload questions are only complete when a file exists
  if (q.type === "upload" || q.type === "upload-download") {
    return fileMap.has(q.id);
  }
  const resp = responseMap.get(q.id);
  const hasResponse = !!(resp && resp.response && resp.response.trim() !== "");
  return hasResponse || fileMap.has(q.id);
}

/** Build the N/A marker set, response map, and file map from raw rows. */
function buildLookups(responses: Response[], files: FileAttachment[]) {
  const naQuestionIds = new Set<string | number>();
  responses.forEach(r => {
    if (r.questionId && typeof r.questionId === "string" && r.questionId.startsWith("__question_na:")) {
      naQuestionIds.add(r.questionId.replace("__question_na:", ""));
    }
  });
  const responseMap = new Map(
    responses.filter(r => r.questionId !== null).map(r => [r.questionId, r])
  ) as Map<string | number, Response>;
  const fileMap = new Map(
    files.filter(f => f.questionId !== null).map(f => [f.questionId, true])
  ) as Map<string | number, boolean>;
  return { naQuestionIds, responseMap, fileMap };
}

/**
 * IDs of questions that are visible, NOT already marked N/A, and NOT yet answered.
 * Used when a site goes live to auto-mark every remaining open question as N/A.
 */
export function getIncompleteVisibleQuestionIds(
  questions: Question[],
  responses: Response[],
  files: FileAttachment[]
): (string | number)[] {
  const { naQuestionIds, responseMap, fileMap } = buildLookups(responses, files);
  const incomplete: (string | number)[] = [];
  for (const q of questions) {
    if (!isQuestionVisible(q, responseMap)) continue;
    if (naQuestionIds.has(q.id) || naQuestionIds.has(String(q.id))) continue;
    if (!isQuestionAnswered(q, responseMap, fileMap)) incomplete.push(q.id);
  }
  return incomplete;
}

/**
 * Calculate progress for an organization's intake questionnaire
 * @param questions - All questions in the questionnaire (including conditional ones)
 * @param responses - User's responses (includes __question_na: markers for N/A questions)
 * @param files - Uploaded files
 * @returns Progress statistics including overall percentage and per-section breakdown
 */
export function calculateProgress(
  questions: Question[],
  responses: Response[],
  files: FileAttachment[]
): ProgressResult {
  // Extract N/A question IDs from special marker responses
  const naQuestionIds = new Set<string | number>();
  responses.forEach(r => {
    if (r.questionId && typeof r.questionId === 'string' && r.questionId.startsWith('__question_na:')) {
      const qId = r.questionId.replace('__question_na:', '');
      naQuestionIds.add(qId);
    }
  });
  // Build maps for quick lookup (filter out null questionIds)
  const responseMap = new Map(
    responses.filter(r => r.questionId !== null).map(r => [r.questionId, r])
  );
  const fileMap = new Map(
    files.filter(f => f.questionId !== null).map(f => [f.questionId, true])
  );

  // Filter out conditional questions whose condition is NOT met.
  // When a parent question is answered with a value that hides the child,
  // the child should not count toward the total.
  const visibleQuestions = questions.filter(q => isQuestionVisible(q, responseMap as Map<string | number, Response>));

  // Calculate section stats
  const sectionStats: SectionStats = {};
  
  visibleQuestions.forEach(q => {
    if (!sectionStats[q.sectionTitle]) {
      sectionStats[q.sectionTitle] = {
        completed: 0,
        total: 0
      };
    }
    
    sectionStats[q.sectionTitle].total++;

    // N/A questions count as completed
    if (naQuestionIds.has(q.id) || naQuestionIds.has(String(q.id))) {
      sectionStats[q.sectionTitle].completed++;
      return;
    }

    if (isQuestionAnswered(q, responseMap as Map<string | number, Response>, fileMap as Map<string | number, boolean>)) {
      sectionStats[q.sectionTitle].completed++;
    }
  });

  // Calculate overall completion percentage
  const totalQuestions = visibleQuestions.length;
  const completedQuestions = Object.values(sectionStats).reduce(
    (sum, section) => sum + section.completed,
    0
  );
  const completionPercentage = totalQuestions > 0
    ? Math.round((completedQuestions / totalQuestions) * 100)
    : 0;

  return {
    completionPercentage,
    sectionProgress: sectionStats,
    completedQuestions,
    totalQuestions,
    naQuestions: naQuestionIds.size
  };
}

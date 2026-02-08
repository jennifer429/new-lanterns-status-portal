/**
 * Shared progress calculation logic
 * Used by both admin dashboard and organization dashboard to ensure consistency
 */

export interface Question {
  id: string | number;
  sectionTitle: string;
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
}

/**
 * Calculate progress for an organization's intake questionnaire
 * @param questions - All questions in the questionnaire
 * @param responses - User's responses
 * @param files - Uploaded files
 * @returns Progress statistics including overall percentage and per-section breakdown
 */
export function calculateProgress(
  questions: Question[],
  responses: Response[],
  files: FileAttachment[]
): ProgressResult {
  // Build maps for quick lookup (filter out null questionIds)
  const responseMap = new Map(
    responses.filter(r => r.questionId !== null).map(r => [r.questionId, r])
  );
  const fileMap = new Map(
    files.filter(f => f.questionId !== null).map(f => [f.questionId, true])
  );

  // Calculate section stats
  const sectionStats: SectionStats = {};
  
  questions.forEach(q => {
    if (!sectionStats[q.sectionTitle]) {
      sectionStats[q.sectionTitle] = {
        completed: 0,
        total: 0
      };
    }
    
    sectionStats[q.sectionTitle].total++;
    
    // Check if question has a text response OR uploaded file
    const resp = responseMap.get(q.id);
    const hasResponse = resp && resp.response && resp.response.trim() !== '';
    const hasFile = fileMap.has(q.id);
    
    if (hasResponse || hasFile) {
      sectionStats[q.sectionTitle].completed++;
    }
  });

  // Calculate overall completion percentage
  const totalQuestions = questions.length;
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
    totalQuestions
  };
}

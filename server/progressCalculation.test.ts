import { describe, it, expect } from 'vitest';
import { calculateProgress } from '../shared/progressCalculation';

describe('Progress Calculation', () => {
  it('should calculate 0% when no questions are answered', () => {
    const questions = [
      { id: '1', sectionTitle: 'Section 1' },
      { id: '2', sectionTitle: 'Section 1' },
      { id: '3', sectionTitle: 'Section 2' },
    ];
    const responses: any[] = [];
    const files: any[] = [];

    const result = calculateProgress(questions, responses, files);

    expect(result.completionPercentage).toBe(0);
    expect(result.completedQuestions).toBe(0);
    expect(result.totalQuestions).toBe(3);
  });

  it('should calculate 100% when all questions are answered', () => {
    const questions = [
      { id: '1', sectionTitle: 'Section 1' },
      { id: '2', sectionTitle: 'Section 1' },
    ];
    const responses = [
      { questionId: '1', response: 'Answer 1' },
      { questionId: '2', response: 'Answer 2' },
    ];
    const files: any[] = [];

    const result = calculateProgress(questions, responses, files);

    expect(result.completionPercentage).toBe(100);
    expect(result.completedQuestions).toBe(2);
    expect(result.totalQuestions).toBe(2);
  });

  it('should count file uploads as completed questions', () => {
    const questions = [
      { id: '1', sectionTitle: 'Section 1' },
      { id: '2', sectionTitle: 'Section 1' },
    ];
    const responses: any[] = [];
    const files = [
      { questionId: '1' },
      { questionId: '2' },
    ];

    const result = calculateProgress(questions, responses, files);

    expect(result.completionPercentage).toBe(100);
    expect(result.completedQuestions).toBe(2);
  });

  it('should handle mixed responses and files', () => {
    const questions = [
      { id: '1', sectionTitle: 'Section 1' },
      { id: '2', sectionTitle: 'Section 1' },
      { id: '3', sectionTitle: 'Section 2' },
      { id: '4', sectionTitle: 'Section 2' },
    ];
    const responses = [
      { questionId: '1', response: 'Answer 1' },
      { questionId: '3', response: '' }, // Empty response doesn't count
    ];
    const files = [
      { questionId: '2' }, // File counts
    ];

    const result = calculateProgress(questions, responses, files);

    expect(result.completionPercentage).toBe(50); // 2 out of 4
    expect(result.completedQuestions).toBe(2);
    expect(result.totalQuestions).toBe(4);
  });

  it('should calculate section-level progress correctly', () => {
    const questions = [
      { id: '1', sectionTitle: 'Section 1' },
      { id: '2', sectionTitle: 'Section 1' },
      { id: '3', sectionTitle: 'Section 2' },
      { id: '4', sectionTitle: 'Section 2' },
    ];
    const responses = [
      { questionId: '1', response: 'Answer 1' },
      { questionId: '2', response: 'Answer 2' },
      { questionId: '3', response: 'Answer 3' },
    ];
    const files: any[] = [];

    const result = calculateProgress(questions, responses, files);

    expect(result.sectionProgress['Section 1'].completed).toBe(2);
    expect(result.sectionProgress['Section 1'].total).toBe(2);
    expect(result.sectionProgress['Section 2'].completed).toBe(1);
    expect(result.sectionProgress['Section 2'].total).toBe(2);
  });

  it('should handle workflow sections correctly', () => {
    const questions = [
      { id: 'H.1', sectionTitle: 'Organization Information', isWorkflow: false },
      { id: 'orders-workflow_config', sectionTitle: 'Orders Workflow', isWorkflow: true },
      { id: 'priors-workflow_config', sectionTitle: 'Priors Workflow', isWorkflow: true },
    ];
    const responses = [
      { questionId: 'H.1', response: 'Test Org' },
      { questionId: 'orders-workflow_config', response: JSON.stringify({ paths: { risToNewLantern: true }, systems: {}, notes: {} }) },
      // priors-workflow has no response (not configured)
    ];
    const files: any[] = [];

    const result = calculateProgress(questions, responses, files);

    // H.1 complete, orders-workflow complete (has path), priors-workflow incomplete
    expect(result.completedQuestions).toBe(2);
    expect(result.totalQuestions).toBe(3);
    expect(result.completionPercentage).toBe(67); // 2/3 = 66.67% rounded to 67
    expect(result.sectionProgress['Organization Information'].completed).toBe(1);
    expect(result.sectionProgress['Orders Workflow'].completed).toBe(1);
    expect(result.sectionProgress['Priors Workflow'].completed).toBe(0);
  });

  it('should not count workflow with no paths selected', () => {
    const questions = [
      { id: 'orders-workflow_config', sectionTitle: 'Orders Workflow', isWorkflow: true },
    ];
    const responses = [
      { questionId: 'orders-workflow_config', response: JSON.stringify({ paths: {}, systems: {}, notes: {} }) },
    ];
    const files: any[] = [];

    const result = calculateProgress(questions, responses, files);

    expect(result.completedQuestions).toBe(0); // No paths selected
    expect(result.sectionProgress['Orders Workflow'].completed).toBe(0);
  });

  it('should ignore null questionIds', () => {
    const questions = [
      { id: '1', sectionTitle: 'Section 1' },
      { id: '2', sectionTitle: 'Section 1' },
    ];
    const responses = [
      { questionId: '1', response: 'Answer 1' },
      { questionId: null, response: 'Invalid' },
    ];
    const files = [
      { questionId: null },
    ];

    const result = calculateProgress(questions, responses, files);

    expect(result.completionPercentage).toBe(50); // Only 1 out of 2
    expect(result.completedQuestions).toBe(1);
  });

  it('should handle empty strings as not completed', () => {
    const questions = [
      { id: '1', sectionTitle: 'Section 1' },
      { id: '2', sectionTitle: 'Section 1' },
    ];
    const responses = [
      { questionId: '1', response: '' },
      { questionId: '2', response: '   ' }, // Whitespace only
    ];
    const files: any[] = [];

    const result = calculateProgress(questions, responses, files);

    expect(result.completionPercentage).toBe(0);
    expect(result.completedQuestions).toBe(0);
  });
});

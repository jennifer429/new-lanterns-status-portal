/**
 * Workflow Diagram Tests
 * 
 * Tests for the workflow diagram data structure and questionnaire integration
 */

import { describe, it, expect } from 'vitest';
import { questionnaireSections } from '../shared/questionnaireData';

describe('Workflow Diagram Integration', () => {
  it('should have 4 workflow sections', () => {
    const workflowSections = questionnaireSections.filter(s => s.type === 'workflow');
    expect(workflowSections).toHaveLength(4);
  });

  it('should have correct workflow section IDs', () => {
    const workflowSections = questionnaireSections.filter(s => s.type === 'workflow');
    const ids = workflowSections.map(s => s.id);
    
    expect(ids).toContain('orders-workflow');
    expect(ids).toContain('images-workflow');
    expect(ids).toContain('priors-workflow');
    expect(ids).toContain('reports-out-workflow');
  });

  it('should have workflow sections without questions', () => {
    const workflowSections = questionnaireSections.filter(s => s.type === 'workflow');
    
    workflowSections.forEach(section => {
      expect(section.questions).toBeUndefined();
    });
  });

  it('should have non-workflow sections with questions', () => {
    const regularSections = questionnaireSections.filter(s => s.type !== 'workflow');
    
    regularSections.forEach(section => {
      expect(section.questions).toBeDefined();
      expect(Array.isArray(section.questions)).toBe(true);
      expect(section.questions!.length).toBeGreaterThan(0);
    });
  });

  it('should have correct section count (9 total)', () => {
    // 1 org info + 4 workflows + 4 other sections
    expect(questionnaireSections).toHaveLength(9);
  });

  it('should have workflow sections in correct order', () => {
    const sectionIds = questionnaireSections.map(s => s.id);
    const orderIndex = sectionIds.indexOf('orders-workflow');
    const imagesIndex = sectionIds.indexOf('images-workflow');
    const priorsIndex = sectionIds.indexOf('priors-workflow');
    const reportsIndex = sectionIds.indexOf('reports-out-workflow');

    // Workflows should be in order: orders, images, priors, reports
    expect(orderIndex).toBeLessThan(imagesIndex);
    expect(imagesIndex).toBeLessThan(priorsIndex);
    expect(priorsIndex).toBeLessThan(reportsIndex);
  });
});

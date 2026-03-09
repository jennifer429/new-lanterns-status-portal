/**
 * Integration Workflows Tests
 *
 * Tests for the integration workflows section data structure and questionnaire integration
 */

import { describe, it, expect } from 'vitest';
import { questionnaireSections } from '../shared/questionnaireData';

describe('Integration Workflows', () => {
  it('should have 1 integration-workflows section', () => {
    const integrationSections = questionnaireSections.filter(s => s.type === 'integration-workflows');
    expect(integrationSections).toHaveLength(1);
  });

  it('should have correct integration-workflows section ID', () => {
    const section = questionnaireSections.find(s => s.type === 'integration-workflows');
    expect(section?.id).toBe('integration-workflows');
  });

  it('should have integration-workflows section without questions', () => {
    const section = questionnaireSections.find(s => s.type === 'integration-workflows');
    expect(section?.questions).toBeUndefined();
  });

  it('should have non-integration-workflow sections with questions', () => {
    const regularSections = questionnaireSections.filter(
      s => s.type !== 'integration-workflows' && s.type !== 'workflow'
    );

    regularSections.forEach(section => {
      expect(section.questions).toBeDefined();
      expect(Array.isArray(section.questions)).toBe(true);
      expect(section.questions!.length).toBeGreaterThan(0);
    });
  });

  it('should have correct section count (6 total)', () => {
    // 1 org info + 1 data & integration + 1 integration-workflows + 1 config files + 1 vpn + 1 hl7
    expect(questionnaireSections).toHaveLength(6);
  });

  it('should have no legacy workflow sections', () => {
    const legacyWorkflows = questionnaireSections.filter(s => s.type === 'workflow');
    expect(legacyWorkflows).toHaveLength(0);
  });
});

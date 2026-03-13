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
    // 1 org info + 1 architecture + 1 integration-workflows + 1 connectivity + 1 config-files + 1 hl7 & dicom
    expect(questionnaireSections).toHaveLength(6);
  });

  it('should have no legacy workflow sections', () => {
    const legacyWorkflows = questionnaireSections.filter(s => s.type === 'workflow');
    expect(legacyWorkflows).toHaveLength(0);
  });

  it('should have 1 connectivity-table section', () => {
    const connSections = questionnaireSections.filter(s => s.type === 'connectivity-table');
    expect(connSections).toHaveLength(1);
    expect(connSections[0].id).toBe('connectivity');
  });

  it('should have D.1 in connectivity section', () => {
    const connSection = questionnaireSections.find(s => s.id === 'connectivity');
    expect(connSection?.questions?.some(q => q.id === 'D.1')).toBe(true);
  });

  it('should not have D.7 or D.8 in HL7 & DICOM section', () => {
    const hl7Section = questionnaireSections.find(s => s.id === 'hl7-dicom');
    expect(hl7Section?.questions?.some(q => q.id === 'D.7')).toBeFalsy();
    expect(hl7Section?.questions?.some(q => q.id === 'D.8')).toBeFalsy();
  });
});

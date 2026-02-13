import { describe, it, expect } from 'vitest';
import { questionnaireSections } from '../shared/questionnaireData';

describe('VPN Template Configuration', () => {
  it('should have VPN question E.1 as upload-download type', () => {
    // Find the VPN & Connectivity section
    const vpnSection = questionnaireSections.find(s => s.id === 'vpn-connectivity');
    expect(vpnSection).toBeDefined();
    
    // Find the VPN question (E.1)
    const vpnQuestion = vpnSection?.questions?.find(q => q.id === 'E.1');
    expect(vpnQuestion).toBeDefined();
    expect(vpnQuestion?.type).toBe('upload-download');
  });

  it('should not have hardcoded partner templates in question data (templates come from DB)', () => {
    const vpnSection = questionnaireSections.find(s => s.id === 'vpn-connectivity');
    const vpnQuestion = vpnSection?.questions?.find(q => q.id === 'E.1');
    
    // Partner templates are now managed via the admin Templates tab (partnerTemplates DB table)
    // They should NOT be hardcoded in questionnaireData.ts
    expect(vpnQuestion?.partnerTemplates).toBeUndefined();
    expect(vpnQuestion?.templateUrl).toBeUndefined();
  });

  it('should have no partner-specific references in question text', () => {
    // Verify all questions are partner-agnostic
    for (const section of questionnaireSections) {
      if (!section.questions) continue; // Skip workflow diagram sections without questions
      for (const question of section.questions) {
        expect(question.text).not.toMatch(/\bRad1\b/i);
        expect(question.text).not.toMatch(/\bRadOne\b/i);
        expect(question.text).not.toMatch(/\bSRV\b/i);
        expect(question.text).not.toMatch(/\bSilverback\b/i);
        expect(question.text).not.toMatch(/\bDataFirst\b/i);
      }
    }
  });
});

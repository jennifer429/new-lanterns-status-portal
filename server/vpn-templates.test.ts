import { describe, it, expect } from 'vitest';
import { questionnaireSections } from '../shared/questionnaireData';

describe('VPN Template Configuration', () => {
  it('should have partner-specific templates configured for VPN question', () => {
    // Find the VPN & Connectivity section
    const vpnSection = questionnaireSections.find(s => s.id === 'vpn-connectivity');
    expect(vpnSection).toBeDefined();
    
    // Find the VPN question (E.1)
    const vpnQuestion = vpnSection?.questions?.find(q => q.id === 'E.1');
    expect(vpnQuestion).toBeDefined();
    expect(vpnQuestion?.type).toBe('upload-download');
    
    // Verify partner templates are configured
    expect(vpnQuestion?.partnerTemplates).toBeDefined();
    expect(vpnQuestion?.partnerTemplates).toHaveProperty('1'); // RadOne
    expect(vpnQuestion?.partnerTemplates).toHaveProperty('2'); // SRV
  });

  it('should have correct RadOne template configuration', () => {
    const vpnSection = questionnaireSections.find(s => s.id === 'vpn-connectivity');
    const vpnQuestion = vpnSection?.questions?.find(q => q.id === 'E.1');
    
    const radOneTemplate = vpnQuestion?.partnerTemplates?.[1];
    expect(radOneTemplate).toBeDefined();
    expect(radOneTemplate?.fileName).toBe('VPN-Configuration-Form-RadOne.xlsx');
    expect(radOneTemplate?.url).toContain('.xlsx');
    expect(radOneTemplate?.url).toMatch(/^https:\/\/files\.manuscdn\.com\//);
  });

  it('should have correct SRV template configuration', () => {
    const vpnSection = questionnaireSections.find(s => s.id === 'vpn-connectivity');
    const vpnQuestion = vpnSection?.questions?.find(q => q.id === 'E.1');
    
    const srvTemplate = vpnQuestion?.partnerTemplates?.[2];
    expect(srvTemplate).toBeDefined();
    expect(srvTemplate?.fileName).toBe('VPN-Configuration-Form-SRV.docx');
    expect(srvTemplate?.url).toContain('.docx');
    expect(srvTemplate?.url).toMatch(/^https:\/\/files\.manuscdn\.com\//);
  });

  it('should not have fallback templateUrl when partner templates are configured', () => {
    const vpnSection = questionnaireSections.find(s => s.id === 'vpn-connectivity');
    const vpnQuestion = vpnSection?.questions?.find(q => q.id === 'E.1');
    
    // Partner templates replace the need for a default templateUrl
    expect(vpnQuestion?.templateUrl).toBeUndefined();
    expect(vpnQuestion?.templateFileName).toBeUndefined();
  });
});

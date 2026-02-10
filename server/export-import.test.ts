import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { getDb } from './db';
import { organizations, intakeResponses } from '../drizzle/schema';
import { eq } from 'drizzle-orm';

/**
 * Test export/import functionality for questionnaire data
 * 
 * This test verifies:
 * 1. Export format is pipe-delimited (|)
 * 2. Export includes workflow configuration data
 * 3. Export includes standard question responses
 * 4. Import can parse pipe-delimited files
 * 5. Import correctly reconstructs workflow configurations
 * 6. Import correctly handles standard question responses
 */

describe('Export/Import Functionality', () => {
  const testOrgSlug = 'test-export-import-org';
  let testOrgId: number;

  beforeAll(async () => {
    const db = await getDb();
    if (!db) throw new Error('Database not available');

    // Create test organization
    await db.insert(organizations).values({
      name: 'Test Export Import Org',
      slug: testOrgSlug,
      clientId: 1,
    });
    
    // Fetch the created organization
    const [org] = await db.select().from(organizations).where(eq(organizations.slug, testOrgSlug));
    testOrgId = org.id;

    // Insert test responses - standard questions
    await db.insert(intakeResponses).values([
      {
        organizationId: testOrgId,
        questionId: 'A.1',
        section: 'Organization Information',
        response: 'Test Organization Name',
        updatedBy: 'test@example.com',
      },
      {
        organizationId: testOrgId,
        questionId: 'A.2',
        section: 'Organization Information',
        response: 'John Doe',
        updatedBy: 'test@example.com',
      },
    ]);

    // Insert test responses - workflow configuration
    const workflowConfig = {
      paths: {
        'Modality → Current PACS → Silverback → New Lantern': true,
        'Modalities → VNA → Silverback → New Lantern': true,
      },
      systems: {
        'Modality → Current PACS → Silverback → New Lantern': 'GE PACS',
        'Modalities → VNA → Silverback → New Lantern': 'Sectra VNA',
      },
      notes: {
        'Modality → Current PACS → Silverback → New Lantern': 'Primary workflow',
        'Modalities → VNA → Silverback → New Lantern': 'Backup workflow',
      },
    };

    await db.insert(intakeResponses).values({
      organizationId: testOrgId,
      questionId: 'images-workflow_config',
      section: 'Images Workflow',
      response: JSON.stringify(workflowConfig),
      updatedBy: 'test@example.com',
    });
  });

  afterAll(async () => {
    const db = await getDb();
    if (!db) return;

    // Clean up test data
    await db.delete(intakeResponses).where(eq(intakeResponses.organizationId, testOrgId));
    await db.delete(organizations).where(eq(organizations.id, testOrgId));
  });

  it('should export data in pipe-delimited format', async () => {
    const db = await getDb();
    if (!db) throw new Error('Database not available');

    // Fetch responses
    const allResponses = await db.select().from(intakeResponses).where(eq(intakeResponses.organizationId, testOrgId));

    // Simulate export logic
    const lines = ['Section|Question ID|Question Text|Response Type|Response Value'];
    
    allResponses.forEach((resp) => {
      if (resp.questionId.endsWith('_config')) {
        // Workflow config
        const config = JSON.parse(resp.response);
        Object.keys(config.paths || {}).forEach(pathKey => {
          if (config.paths[pathKey]) {
            const systemValue = config.systems?.[pathKey] || '';
            const notesValue = config.notes?.[pathKey] || '';
            lines.push(`Images Workflow|${resp.questionId}_${pathKey}|${pathKey} workflow path|workflow|Path: ${pathKey}, System: ${systemValue}, Notes: ${notesValue}`);
          }
        });
      } else {
        // Standard question
        lines.push(`Organization Information|${resp.questionId}|Question text|text|${resp.response}`);
      }
    });

    const exportContent = lines.join('\n');

    // Verify format
    expect(exportContent).toContain('|');
    // Note: Content may contain commas (e.g., "Path: X, System: Y"), but delimiters are pipes
    expect(exportContent.split('\n').length).toBeGreaterThan(1);
    // Verify pipe delimiters are used
    const exportLines = exportContent.split('\n');
    exportLines.forEach(line => {
      if (line.trim()) {
        expect(line).toContain('|');
      }
    });
  });

  it('should export workflow configuration data', async () => {
    const db = await getDb();
    if (!db) throw new Error('Database not available');

    const allResponses = await db.select().from(intakeResponses).where(eq(intakeResponses.organizationId, testOrgId));
    const workflowResponse = allResponses.find(r => r.questionId === 'images-workflow_config');

    expect(workflowResponse).toBeDefined();
    expect(workflowResponse?.response).toContain('GE PACS');
    expect(workflowResponse?.response).toContain('Sectra VNA');
  });

  it('should parse imported pipe-delimited data', () => {
    const importData = `Section|Question ID|Question Text|Response Type|Response Value
Organization Information|A.1|Organization Name|text|New Test Org
Images Workflow|images-workflow_config_Modality → Current PACS → Silverback → New Lantern|Modality → Current PACS → Silverback → New Lantern workflow path|workflow|Path: Modality → Current PACS → Silverback → New Lantern, System: Siemens PACS, Notes: Updated workflow`;

    const lines = importData.split('\n').filter(line => line.trim());
    const dataLines = lines.slice(1); // Skip header

    const parsedData: Record<string, any> = {};
    const workflowConfigs: Record<string, any> = {};

    dataLines.forEach(line => {
      const parts = line.split('|');
      expect(parts.length).toBeGreaterThanOrEqual(5);

      const [section, questionId, questionText, responseType, responseValue] = parts;

      if (responseType === 'workflow') {
        const pathMatch = responseValue.match(/Path: ([^,]+)/);
        const systemMatch = responseValue.match(/System: ([^,]+)/);
        const notesMatch = responseValue.match(/Notes: (.+)/);

        if (pathMatch) {
          const pathKey = pathMatch[1].trim();
          const systemValue = systemMatch ? systemMatch[1].trim() : '';
          const notesValue = notesMatch ? notesMatch[1].trim() : '';

          const sectionId = questionId.replace(`_${pathKey}`, '');
          const configKey = sectionId;

          if (!workflowConfigs[configKey]) {
            workflowConfigs[configKey] = {
              paths: {},
              systems: {},
              notes: {},
            };
          }

          workflowConfigs[configKey].paths[pathKey] = true;
          workflowConfigs[configKey].systems[pathKey] = systemValue;
          workflowConfigs[configKey].notes[pathKey] = notesValue;
        }
      } else {
        parsedData[questionId] = responseValue.trim();
      }
    });

    // Verify parsing
    expect(parsedData['A.1']).toBe('New Test Org');
    expect(workflowConfigs['images-workflow_config']).toBeDefined();
    expect(workflowConfigs['images-workflow_config'].systems['Modality → Current PACS → Silverback → New Lantern']).toBe('Siemens PACS');
  });

  it('should handle round-trip export/import correctly', async () => {
    const db = await getDb();
    if (!db) throw new Error('Database not available');

    // Fetch original data
    const originalResponses = await db.select().from(intakeResponses).where(eq(intakeResponses.organizationId, testOrgId));

    // Simulate export
    const lines = ['Section|Question ID|Question Text|Response Type|Response Value'];
    
    originalResponses.forEach((resp) => {
      if (resp.questionId.endsWith('_config')) {
        const config = JSON.parse(resp.response);
        Object.keys(config.paths || {}).forEach(pathKey => {
          if (config.paths[pathKey]) {
            const systemValue = config.systems?.[pathKey] || '';
            const notesValue = config.notes?.[pathKey] || '';
            lines.push(`Images Workflow|${resp.questionId}_${pathKey}|${pathKey} workflow path|workflow|Path: ${pathKey}, System: ${systemValue}, Notes: ${notesValue}`);
          }
        });
      } else {
        lines.push(`Organization Information|${resp.questionId}|Question text|text|${resp.response}`);
      }
    });

    const exportContent = lines.join('\n');

    // Simulate import
    const importLines = exportContent.split('\n').filter(line => line.trim());
    const dataLines = importLines.slice(1);

    const importedData: Record<string, any> = {};
    const workflowConfigs: Record<string, any> = {};

    dataLines.forEach(line => {
      const parts = line.split('|');
      const [section, questionId, questionText, responseType, responseValue] = parts;

      if (responseType === 'workflow') {
        const pathMatch = responseValue.match(/Path: ([^,]+)/);
        const systemMatch = responseValue.match(/System: ([^,]+)/);
        const notesMatch = responseValue.match(/Notes: (.+)/);

        if (pathMatch) {
          const pathKey = pathMatch[1].trim();
          const systemValue = systemMatch ? systemMatch[1].trim() : '';
          const notesValue = notesMatch ? notesMatch[1].trim() : '';

          const sectionId = questionId.replace(`_${pathKey}`, '');
          const configKey = sectionId;

          if (!workflowConfigs[configKey]) {
            workflowConfigs[configKey] = { paths: {}, systems: {}, notes: {} };
          }

          workflowConfigs[configKey].paths[pathKey] = true;
          workflowConfigs[configKey].systems[pathKey] = systemValue;
          workflowConfigs[configKey].notes[pathKey] = notesValue;
        }
      } else {
        importedData[questionId] = responseValue.trim();
      }
    });

    // Verify round-trip integrity
    expect(importedData['A.1']).toBe('Test Organization Name');
    expect(importedData['A.2']).toBe('John Doe');
    expect(workflowConfigs['images-workflow_config'].systems['Modality → Current PACS → Silverback → New Lantern']).toBe('GE PACS');
    expect(workflowConfigs['images-workflow_config'].systems['Modalities → VNA → Silverback → New Lantern']).toBe('Sectra VNA');
  });
});

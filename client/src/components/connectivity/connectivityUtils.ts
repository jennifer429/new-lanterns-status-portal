import type { IntegrationSystem } from '../IntegrationWorkflows';

export type { IntegrationSystem };

// ── Types ─────────────────────────────────────────────────────────────────────

export interface ConnectivityRow {
  id: string;
  trafficType: string;
  sourceSystem: string;
  destinationSystem: string;
  sourceIp: string;
  sourcePort: string;
  destIp: string;
  destPort: string;
  sourceAeTitle: string;
  destAeTitle: string;
  envTest: boolean;
  envProd: boolean;
  notes: string;
  // Legacy fields for backward compat
  ip?: string;
  port?: string;
  aeTitle?: string;
}

// ── Constants ─────────────────────────────────────────────────────────────────

export const DEFAULT_TRAFFIC_TYPES = [
  'ADT',
  'Orders',
  'Reports',
  'Images',
  'Image Priors',
  'Image Q&R',
] as const;

// Map legacy traffic types to new names for display
export const LEGACY_TYPE_MAP: Record<string, string> = {
  'HL7 - Orders (ORM)': 'Orders',
  'HL7 - Results (ORU)': 'Reports',
  'HL7 - ADT': 'ADT',
  'DICOM - C-STORE (Images)': 'Images',
  'DICOM - C-FIND/C-MOVE (Query/Retrieve)': 'Image Q&R',
};

export const COMMON_SYSTEMS = [
  'Cerner', 'Cloverleaf', 'Epic', 'Epic Radiant', 'Fuji Synapse',
  'GE PACS', 'Mirth Connect', 'New Lantern PACS', 'Nuance PowerScribe',
  'Rhapsody', 'Sectra',
] as const;

// ── Pure utility functions ────────────────────────────────────────────────────

export function makeId() {
  return 'conn_' + Math.random().toString(36).slice(2, 10);
}

export function emptyRow(): ConnectivityRow {
  return {
    id: makeId(), trafficType: '', sourceSystem: '', destinationSystem: '',
    sourceIp: '', sourcePort: '', destIp: '', destPort: '',
    sourceAeTitle: '', destAeTitle: '', envTest: false, envProd: false, notes: '',
  };
}

export function migrateRow(r: ConnectivityRow): ConnectivityRow {
  return {
    ...r,
    trafficType: LEGACY_TYPE_MAP[r.trafficType] || r.trafficType,
    sourceIp: r.sourceIp || r.ip || '',
    sourcePort: r.sourcePort || r.port || '',
    destIp: r.destIp || '',
    destPort: r.destPort || '',
    sourceAeTitle: r.sourceAeTitle || '',
    destAeTitle: r.destAeTitle || r.aeTitle || '',
  };
}

export function parseCSV(text: string): ConnectivityRow[] {
  const lines = text.trim().split('\n').map(l => l.trim()).filter(Boolean);
  if (lines.length < 2) throw new Error('CSV needs a header row + at least one data row.');
  const headers = lines[0].split(',').map(h => h.trim().toLowerCase().replace(/[^a-z0-9]/g, ''));
  return lines.slice(1).map(line => {
    const values = line.split(',').map(v => v.trim().replace(/^["']|["']$/g, ''));
    const obj: Record<string, string> = {};
    headers.forEach((h, i) => { obj[h] = values[i] || ''; });
    return mapImportRow(obj);
  });
}

export function mapImportRow(obj: any): ConnectivityRow {
  const env = (obj.environment || obj.env || '').toLowerCase().trim();
  const legacyAe = obj.aeTitle || obj.aetitle || obj['ae title'] || obj.ae_title || '';
  return {
    id: makeId(),
    trafficType:       LEGACY_TYPE_MAP[obj.trafficType || obj.traffictype || obj['traffic type'] || obj.type || ''] || obj.trafficType || obj.traffictype || obj['traffic type'] || obj.type || '',
    sourceSystem:      obj.sourceSystem || obj.sourcesystem || obj['source system'] || obj.source || '',
    destinationSystem: obj.destinationSystem || obj.destinationsystem || obj['destination system'] || obj.destination || '',
    sourceIp:          obj.sourceIp || obj.sourceip || obj['source ip'] || obj.ip || '',
    sourcePort:        String(obj.sourcePort || obj.sourceport || obj['source port'] || obj.port || ''),
    destIp:            obj.destIp || obj.destip || obj['dest ip'] || obj.destinationIp || obj['destination ip'] || '',
    destPort:          String(obj.destPort || obj.destport || obj['dest port'] || obj.destinationPort || ''),
    sourceAeTitle:     obj.sourceAeTitle || obj.sourceaetitle || obj['source ae title'] || obj['source ae'] || '',
    destAeTitle:       obj.destAeTitle || obj.destaetitle || obj['dest ae title'] || obj['dest ae'] || legacyAe,
    envTest: env === 'test' || env === 'both' || obj.envTest === true || obj.test === true,
    envProd: env === 'production' || env === 'prod' || env === 'both' || obj.envProd === true || obj.prod === true,
    notes: obj.notes || '',
  };
}

export function exportCSV(rows: ConnectivityRow[]) {
  const headers = ['Traffic Type','Source System','Destination System','Source IP','Source Port','Dest IP','Dest Port','Source AE Title','Dest AE Title','Environment','Notes'];
  const csvRows = [headers.join(','), ...rows.map(r => {
    const env = r.envTest && r.envProd ? 'Both' : r.envTest ? 'Test' : r.envProd ? 'Production' : '';
    return [r.trafficType,r.sourceSystem,r.destinationSystem,r.sourceIp,r.sourcePort,r.destIp,r.destPort,r.sourceAeTitle,r.destAeTitle,env,r.notes]
      .map(v => `"${(v||'').replace(/"/g,'""')}"`).join(',');
  })];
  dlBlob(new Blob([csvRows.join('\n')], { type: 'text/csv' }), 'connectivity-endpoints.csv');
}

export function exportJSON(rows: ConnectivityRow[]) {
  const data = rows.map(r => ({
    trafficType: r.trafficType, sourceSystem: r.sourceSystem, destinationSystem: r.destinationSystem,
    sourceIp: r.sourceIp, sourcePort: r.sourcePort, destIp: r.destIp, destPort: r.destPort,
    sourceAeTitle: r.sourceAeTitle, destAeTitle: r.destAeTitle,
    environment: r.envTest && r.envProd ? 'both' : r.envTest ? 'test' : r.envProd ? 'production' : '',
    notes: r.notes,
  }));
  dlBlob(new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' }), 'connectivity-endpoints.json');
}

export function dlBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = filename;
  document.body.appendChild(a); a.click();
  document.body.removeChild(a); URL.revokeObjectURL(url);
}

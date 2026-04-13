// Static data for the Architecture Overview / Systems section

export const SYSTEM_TYPES = ['PACS', 'VNA', 'Router', 'EHR', 'RIS', 'Integration Engine', 'AI', 'Modality', 'Other'] as const;
export type SystemType = typeof SYSTEM_TYPES[number];

export const SYSTEM_TYPE_COLORS: Record<string, string> = {
  'PACS':             'bg-purple-500/20 text-purple-300 border-purple-500/30',
  'VNA':              'bg-pink-500/20 text-pink-300 border-pink-500/30',
  'Router':           'bg-orange-500/20 text-orange-300 border-orange-500/30',
  'EHR':              'bg-blue-500/20 text-blue-300 border-blue-500/30',
  'RIS':              'bg-cyan-500/20 text-cyan-300 border-cyan-500/30',
  'Integration Engine': 'bg-green-500/20 text-green-300 border-green-500/30',
  'AI':               'bg-indigo-500/20 text-indigo-300 border-indigo-500/30',
  'Modality':         'bg-yellow-500/20 text-yellow-300 border-yellow-500/30',
  'Reporting':        'bg-amber-500/20 text-amber-300 border-amber-500/30',
  'Other':            'bg-gray-500/20 text-gray-300 border-gray-500/30',
};

// Vendor/product options per system type
export const VENDOR_OPTIONS: Record<string, string[]> = {
  'PACS':             ['Agfa', 'Carestream', 'Cerner', 'Fujifilm Synapse', 'GE Centricity', 'Horos', 'Infinitt', 'McKesson', 'Merge', 'Philips IntelliSpace', 'Sectra', 'Siemens syngo.plaza', 'Visage', 'Other'],
  'VNA':              ['Agfa', 'Fujifilm', 'GE', 'Hyland', 'Merge', 'Philips', 'Umbra', 'Other'],
  'Router':           ['DCM4J proxy', 'Laurel Bridge', 'Mercure', 'Merge', 'Silverback', 'Other'],
  'EHR':              ['AllScripts', 'Athena', 'Cerner', 'eClinicalWorks', 'Epic', 'Meditech', 'NextGen', 'Other'],
  'RIS':              ['Abbadox', 'Agfa', 'Cerner', 'Epic', 'Fujifilm', 'Meditech', 'Sectra', 'Other'],
  'Integration Engine': ['Cloverleaf', 'MetInformatics', 'Mirth Connect', 'Rhapsody', 'Other'],
  'AI':               ['Aidoc', 'Arterys', 'Bayer (Calantic)', 'CADstream', 'Enlitic', 'HeartFlow', 'iCAD', 'Koios', 'Lunit', 'Nuance', 'Qure.ai', 'RapidAI', 'Viz.AI', 'Zebra Medical', 'Other'],
  'Reporting':        ['Fluency', 'mModal', 'Nuance PowerScribe', 'PowerScribe 360', 'RadReport', 'Speechnotes', 'Other'],
  'Modality':         ['Canon', 'Fujifilm', 'GE', 'Hologic', 'Philips', 'Siemens', 'Other'],
  'Other':            ['Abbadox', 'DataFirst', 'Fluency', 'Google Cloud DCM', 'Nuance PowerScribe', 'Other'],
};

// Default system rows that are always shown (pre-loaded)
export const DEFAULT_SYSTEM_ROWS: { type: string; label: string; multiSelect?: boolean }[] = [
  { type: 'PACS', label: 'PACS' },
  { type: 'VNA', label: 'VNA' },
  { type: 'Router', label: 'Router / Middleware' },
  { type: 'EHR', label: 'EHR' },
  { type: 'RIS', label: 'RIS' },
  { type: 'Integration Engine', label: 'Integration Engine' },
  { type: 'AI', label: 'AI Platforms', multiSelect: true },
  { type: 'Reporting', label: 'Reporting / Dictation' },
];

export interface SystemEntry {
  id: string;
  name: string;
  type: string;
  description: string;
}

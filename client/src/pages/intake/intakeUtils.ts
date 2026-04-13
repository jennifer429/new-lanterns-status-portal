// Pure utility functions for the intake module

export function getFileIconColor(fileName: string): string {
  const ext = fileName.split('.').pop()?.toLowerCase() || '';
  if (['xlsx', 'xls', 'csv'].includes(ext)) return 'text-green-400';
  if (['pdf'].includes(ext)) return 'text-red-400';
  if (['doc', 'docx'].includes(ext)) return 'text-blue-400';
  if (['png', 'jpg', 'jpeg', 'gif'].includes(ext)) return 'text-yellow-400';
  return 'text-purple-400';
}

export function getFileExtLabel(fileName: string): string {
  return (fileName.split('.').pop()?.toUpperCase() || 'FILE');
}

export function formatFileSize(bytes: number | null | undefined): string {
  if (!bytes) return '';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

import { useState, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Upload } from 'lucide-react';
import { parseCSV, mapImportRow } from './connectivityUtils';
import type { ConnectivityRow } from './connectivityUtils';

// ── Import Dialog ─────────────────────────────────────────────────────────────
export function ConnectivityImportDialog({ open, onOpenChange, onImport }: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onImport: (rows: ConnectivityRow[]) => void;
}) {
  const [text, setText] = useState('');
  const [error, setError] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);

  const handleImport = () => {
    setError('');
    try {
      const parsed = JSON.parse(text);
      onImport((Array.isArray(parsed) ? parsed : [parsed]).map(mapImportRow));
      setText(''); onOpenChange(false);
    } catch {
      try {
        const rows = parseCSV(text);
        if (!rows.length) { setError('No valid rows found.'); return; }
        onImport(rows); setText(''); onOpenChange(false);
      } catch (e: any) {
        setError(e.message || 'Invalid format — use JSON array or CSV.');
      }
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle>Import Endpoints</DialogTitle>
          <DialogDescription>Paste JSON or CSV, or upload a file.</DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div className="rounded-md border bg-muted/20 p-2 text-[10px] font-mono text-muted-foreground overflow-x-auto">
            <pre>{`[{ "trafficType": "Images", "sourceSystem": "CT Scanner",
  "destinationSystem": "New Lantern PACS", "sourceIp": "10.1.2.3",
  "sourcePort": "104", "destIp": "10.1.2.50", "destPort": "11112",
  "environment": "both" }]`}</pre>
          </div>
          <textarea
            value={text} onChange={e => setText(e.target.value)}
            placeholder="Paste JSON or CSV here..."
            className="w-full h-28 rounded-md border bg-background p-3 text-sm font-mono resize-y focus:outline-none focus:ring-1 focus:ring-primary"
          />
          {error && <p className="text-xs text-red-400">{error}</p>}
          <div className="flex items-center gap-2">
            <input ref={fileRef} type="file" accept=".json,.csv,.txt" className="hidden"
              onChange={e => {
                const f = e.target.files?.[0]; if (!f) return;
                const r = new FileReader();
                r.onload = ev => setText(ev.target?.result as string || '');
                r.readAsText(f); e.target.value = '';
              }} />
            <Button variant="outline" size="sm" onClick={() => fileRef.current?.click()} className="gap-1.5">
              <Upload className="w-3.5 h-3.5" /> Upload File
            </Button>
            <div className="flex-1" />
            <Button variant="outline" size="sm" onClick={() => { setText(''); onOpenChange(false); }}>Cancel</Button>
            <Button size="sm" onClick={handleImport} disabled={!text.trim()} className="gap-1.5">
              Import
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

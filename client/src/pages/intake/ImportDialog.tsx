import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Loader2 } from "lucide-react";

interface ImportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  importFile: File | null;
  onFileChange: (file: File | null) => void;
  onImport: () => void;
  isImporting: boolean;
}

export function ImportDialog({
  open,
  onOpenChange,
  importFile,
  onFileChange,
  onImport,
  isImporting,
}: ImportDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Import Questionnaire Data</DialogTitle>
          <DialogDescription>
            Upload a <strong>.json</strong> export file to restore responses. You can also
            import legacy pipe-delimited <code>.txt</code> or <code>.csv</code> files.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="import-file">Select File</Label>
            <Input
              id="import-file"
              type="file"
              accept=".json,.txt,.csv"
              onChange={(e) => {
                const file = e.target.files?.[0];
                onFileChange(file || null);
              }}
              className="!bg-white !text-black"
            />
            {importFile && (
              <div className="text-sm text-muted-foreground">
                Selected: {importFile.name}
              </div>
            )}
          </div>

          <div className="flex gap-2 justify-end">
            <Button
              variant="outline"
              onClick={() => {
                onOpenChange(false);
                onFileChange(null);
              }}
              disabled={isImporting}
            >
              Cancel
            </Button>
            <Button
              onClick={onImport}
              disabled={!importFile || isImporting}
            >
              {isImporting ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Importing...
                </>
              ) : (
                "Import"
              )}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

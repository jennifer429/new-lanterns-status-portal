import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Mail, Download } from "lucide-react";
import { toast } from "sonner";

interface EmailPreviewDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function EmailPreviewDialog({ open, onOpenChange }: EmailPreviewDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[85vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Mail className="w-5 h-5" />
            Remaining Tasks Email Preview
          </DialogTitle>
        </DialogHeader>
        <div className="flex-1 overflow-auto border border-border rounded-lg bg-white">
          <iframe
            srcDoc={(typeof window !== "undefined" && (window as any).__emailPreviewHtml) || ""}
            className="w-full h-full min-h-[500px] border-0"
            title="Email Preview"
          />
        </div>
        <div className="flex items-center justify-end gap-2 pt-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              const html = (window as any).__emailPreviewHtml;
              if (html) {
                navigator.clipboard.writeText(html).then(() => {
                  toast.success("Email HTML copied to clipboard");
                });
              }
            }}
          >
            Copy HTML
          </Button>
          <Button
            size="sm"
            onClick={() => {
              const html = (window as any).__emailPreviewHtml;
              const filename = (window as any).__emailPreviewFilename || "remaining-tasks.html";
              if (html) {
                const blob = new Blob([html], { type: "text/html" });
                const url = URL.createObjectURL(blob);
                const a = document.createElement("a");
                a.href = url;
                a.download = filename;
                a.click();
                URL.revokeObjectURL(url);
                toast.success(`Downloaded ${filename}`);
              }
            }}
          >
            <Download className="w-4 h-4 mr-1.5" />
            Download HTML
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

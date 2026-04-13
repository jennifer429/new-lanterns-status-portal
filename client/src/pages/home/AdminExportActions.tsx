import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { FileDown, Loader2, Printer, Mail } from "lucide-react";
import { toast } from "sonner";
import { useState } from "react";

interface AdminExportActionsProps {
  orgSlug: string;
  onEmailPreviewOpen: () => void;
}

export function AdminExportActions({ orgSlug, onEmailPreviewOpen }: AdminExportActionsProps) {
  const [exportLoading, setExportLoading] = useState<"pdf" | "email" | null>(null);

  return (
    <div className="flex items-center justify-end gap-2">
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="outline"
            size="sm"
            className="text-xs gap-1.5 border-border/50 hover:bg-accent/30"
            disabled={exportLoading !== null}
          >
            {exportLoading ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <FileDown className="w-3.5 h-3.5" />
            )}
            Export
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem
            onClick={async () => {
              setExportLoading("pdf");
              try {
                const res = await fetch(
                  `/api/trpc/exports.statusReport?input=${encodeURIComponent(JSON.stringify({ organizationSlug: orgSlug }))}`
                );
                const json = await res.json();
                const result = json?.result?.data;
                if (!result?.html) throw new Error("No data");
                const win = window.open("", "_blank");
                if (win) {
                  win.document.write(result.html);
                  win.document.close();
                  setTimeout(() => win.print(), 600);
                }
                toast.success("Status report opened — use Print to save as PDF");
              } catch {
                toast.error("Failed to generate status report");
              } finally {
                setExportLoading(null);
              }
            }}
          >
            <Printer className="w-4 h-4 mr-2" />
            Print Status Report (PDF)
          </DropdownMenuItem>
          <DropdownMenuItem
            onClick={async () => {
              setExportLoading("email");
              try {
                const res = await fetch(
                  `/api/trpc/exports.taskEmail?input=${encodeURIComponent(JSON.stringify({ organizationSlug: orgSlug }))}`
                );
                const json = await res.json();
                const result = json?.result?.data;
                if (!result?.html) throw new Error("No data");
                (window as any).__emailPreviewHtml = result.html;
                (window as any).__emailPreviewFilename = result.filename;
                onEmailPreviewOpen();
                toast.success("Email preview ready");
              } catch {
                toast.error("Failed to generate email");
              } finally {
                setExportLoading(null);
              }
            }}
          >
            <Mail className="w-4 h-4 mr-2" />
            Remaining Tasks Email
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}

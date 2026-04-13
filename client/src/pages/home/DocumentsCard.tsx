import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { UploadedFilesList } from "@/components/UploadedFileRow";
import { FolderOpen, ChevronDown, Upload, FileText, X, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

interface DocumentsCardProps {
  orgSlug: string;
  open: boolean;
  onToggle: () => void;
  adhocFilesList: any[];
  adhocFiles: File[];
  setAdhocFiles: React.Dispatch<React.SetStateAction<File[]>>;
  adhocUploading: boolean;
  notesLabel: string;
  setNotesLabel: (label: string) => void;
  notesCustomLabel: string;
  setNotesCustomLabel: (label: string) => void;
  onFileSelect: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onUpload: () => void;
  onDeleteNote: (noteId: number) => void;
}

const NOTE_LABELS = ["Call Notes", "Meeting Notes", "Template", "Action Items", "Reference Doc", "Other"];

export function DocumentsCard({
  adhocFilesList,
  adhocFiles,
  setAdhocFiles,
  adhocUploading,
  notesLabel,
  setNotesLabel,
  notesCustomLabel,
  setNotesCustomLabel,
  onFileSelect,
  onUpload,
  onDeleteNote,
  open,
  onToggle,
}: DocumentsCardProps) {
  return (
    <Card className="card-elevated overflow-hidden">
      <button
        onClick={onToggle}
        className="w-full px-4 py-3 flex items-center justify-between hover:bg-accent/30 transition-colors"
      >
        <div className="flex items-center gap-2.5">
          <div className="p-1.5 rounded-lg bg-primary/10">
            <FolderOpen className="w-4 h-4 text-primary" />
          </div>
          <div className="text-left">
            <span className="text-sm font-semibold">Documents & Notes</span>
            <p className="text-[11px] text-muted-foreground leading-none mt-0.5">Meeting transcripts, notes, and other files</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {adhocFilesList.length > 0 ? (
            <Badge variant="outline" className="text-[10px] border-primary/40 text-primary font-semibold">
              {adhocFilesList.length} file{adhocFilesList.length !== 1 ? "s" : ""}
            </Badge>
          ) : (
            <Badge variant="outline" className="text-[10px] text-muted-foreground">Upload</Badge>
          )}
          <ChevronDown
            className={cn(
              "w-4 h-4 text-muted-foreground transition-transform duration-200",
              open && "rotate-180"
            )}
          />
        </div>
      </button>
      {open && (
        <div className="border-t border-border/40 p-3 space-y-3">
          {/* Label selector */}
          <div className="space-y-1.5">
            <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Label this upload</p>
            <div className="flex flex-wrap gap-1.5">
              {NOTE_LABELS.map((opt) => (
                <button
                  key={opt}
                  onClick={() => setNotesLabel(opt)}
                  className={cn(
                    "px-2.5 py-1 rounded-full text-[11px] font-medium border transition-colors",
                    notesLabel === opt
                      ? "bg-primary/15 border-primary/50 text-primary"
                      : "bg-muted/30 border-border/50 text-muted-foreground hover:border-primary/30 hover:text-foreground"
                  )}
                >
                  {opt}
                </button>
              ))}
            </div>
            {notesLabel === "Other" && (
              <input
                type="text"
                value={notesCustomLabel}
                onChange={(e) => setNotesCustomLabel(e.target.value)}
                placeholder="Enter a custom label…"
                className="w-full px-2.5 py-1.5 text-xs rounded-md border border-border bg-muted/20 focus:outline-none focus:ring-1 focus:ring-primary/50"
              />
            )}
          </div>

          {/* Drop zone */}
          <label className="block cursor-pointer">
            <input
              type="file"
              className="hidden"
              multiple
              accept=".pdf,.doc,.docx,.png,.jpg,.jpeg,.txt,.xlsx,.xls,.mp3,.mp4,.wav,.m4a,.vtt,.srt"
              onChange={onFileSelect}
              disabled={adhocUploading}
            />
            <div className="border-2 border-dashed border-border rounded-lg p-4 flex items-center gap-3 hover:border-primary/50 hover:bg-primary/5 transition-colors">
              <Upload className="w-5 h-5 text-muted-foreground flex-shrink-0" />
              <div>
                <p className="text-xs font-medium">Click to add files</p>
                <p className="text-[10px] text-muted-foreground mt-0.5">PDFs, docs, images, audio, transcripts (max 25MB each)</p>
              </div>
            </div>
          </label>

          {/* Staged files */}
          {adhocFiles.length > 0 && (
            <div className="space-y-1.5">
              {adhocFiles.map((f, i) => (
                <div key={i} className="flex items-center gap-2 px-3 py-2 rounded-lg bg-muted/30 border border-border/40">
                  <FileText className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                  <span className="text-xs flex-1 truncate">{f.name}</span>
                  <span className="text-[10px] text-muted-foreground flex-shrink-0">
                    {f.size < 1024 * 1024 ? `${(f.size / 1024).toFixed(1)} KB` : `${(f.size / (1024 * 1024)).toFixed(1)} MB`}
                  </span>
                  <button
                    onClick={() => setAdhocFiles((prev) => prev.filter((_, j) => j !== i))}
                    className="text-muted-foreground hover:text-destructive transition-colors flex-shrink-0"
                    disabled={adhocUploading}
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
              <Button
                size="sm"
                className="w-full h-8 text-xs"
                onClick={onUpload}
                disabled={adhocUploading}
              >
                {adhocUploading ? (
                  <><Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" /> Uploading...</>
                ) : (
                  <><Upload className="w-3.5 h-3.5 mr-1.5" /> Upload {adhocFiles.length} File{adhocFiles.length !== 1 ? "s" : ""}</>
                )}
              </Button>
            </div>
          )}

          {/* Uploaded files list */}
          {adhocFilesList.length > 0 ? (
            <div className="space-y-1">
              <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Uploaded Files</p>
              <UploadedFilesList
                files={adhocFilesList.map((f: any) => ({
                  id: f.id,
                  fileName: f.fileName,
                  fileUrl: f.fileUrl,
                  fileSize: f.fileSize,
                  createdAt: f.createdAt,
                  uploadedBy: f.uploadedBy,
                  label: f.label,
                }))}
                onRemove={(noteId) => {
                  if (window.confirm("Remove this file?")) {
                    onDeleteNote(noteId);
                  }
                }}
                compact
              />
            </div>
          ) : adhocFiles.length === 0 ? (
            <p className="text-xs text-muted-foreground text-center py-2">No files uploaded yet. Add meeting notes, transcripts, or any supporting documents.</p>
          ) : null}
        </div>
      )}
    </Card>
  );
}

/**
 * UploadedFileRow — Clean, vertical file display with full filename, metadata, preview, download, remove.
 * Used across Questionnaire file uploads, Architecture diagram uploads, and Dashboard file sections.
 */
import { Button } from "@/components/ui/button";
import {
  FileText,
  FileImage,
  FileSpreadsheet,
  File as FileGeneric,
  Eye,
  Download,
  Trash2,
} from "lucide-react";
import { useState } from "react";

export interface UploadedFile {
  id: number;
  fileName: string;
  fileUrl: string;
  fileSize?: number | null;
  createdAt?: Date | string | null;
  uploadedBy?: string | null;
  label?: string | null;
}

interface UploadedFileRowProps {
  file: UploadedFile;
  onRemove?: (fileId: number) => void;
  isRemoving?: boolean;
  /** Compact mode for inline questionnaire usage */
  compact?: boolean;
}

function getFileIcon(fileName: string) {
  const ext = fileName.split(".").pop()?.toLowerCase() || "";
  if (["png", "jpg", "jpeg", "gif", "webp", "svg", "bmp"].includes(ext)) {
    return <FileImage className="w-5 h-5 text-blue-400" />;
  }
  if (["xls", "xlsx", "csv"].includes(ext)) {
    return <FileSpreadsheet className="w-5 h-5 text-green-400" />;
  }
  if (["pdf", "doc", "docx", "txt", "rtf"].includes(ext)) {
    return <FileText className="w-5 h-5 text-orange-400" />;
  }
  return <FileGeneric className="w-5 h-5 text-muted-foreground" />;
}

function formatFileSize(bytes: number | null | undefined) {
  if (!bytes) return null;
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function formatDate(date: Date | string | null | undefined) {
  if (!date) return null;
  const d = typeof date === "string" ? new Date(date) : date;
  return d.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function isPreviewable(fileName: string) {
  const ext = fileName.split(".").pop()?.toLowerCase() || "";
  return ["png", "jpg", "jpeg", "gif", "webp", "svg", "bmp", "pdf"].includes(ext);
}

export function UploadedFileRow({ file, onRemove, isRemoving, compact }: UploadedFileRowProps) {
  const [imagePreview, setImagePreview] = useState(false);
  const ext = file.fileName.split(".").pop()?.toLowerCase() || "";
  const isImage = ["png", "jpg", "jpeg", "gif", "webp", "svg", "bmp"].includes(ext);
  const canPreview = isPreviewable(file.fileName);
  const sizeStr = formatFileSize(file.fileSize);
  const dateStr = formatDate(file.createdAt);

  const metaParts: string[] = [];
  if (dateStr) metaParts.push(dateStr);
  if (sizeStr) metaParts.push(sizeStr);

  const handlePreview = () => {
    if (isImage) {
      setImagePreview(true);
    } else {
      window.open(file.fileUrl, "_blank");
    }
  };

  return (
    <>
      <div className={`flex items-center gap-3 rounded-lg border border-border/50 bg-muted/20 hover:bg-muted/40 transition-colors ${compact ? "px-3 py-2" : "px-4 py-3"}`}>
        {/* Icon */}
        <div className="flex-shrink-0">
          {getFileIcon(file.fileName)}
        </div>

        {/* File info — full name, no truncation */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5 flex-wrap">
            <p className={`font-medium text-foreground break-words ${compact ? "text-xs" : "text-sm"}`}>
              {file.fileName}
            </p>
            {file.label && (
              <span className={`inline-flex items-center rounded-full border border-primary/30 bg-primary/10 text-primary font-medium px-1.5 ${compact ? "text-[9px] py-0" : "text-[10px] py-0.5"}`}>
                {file.label}
              </span>
            )}
          </div>
          {metaParts.length > 0 && (
            <p className={`text-muted-foreground mt-0.5 ${compact ? "text-[10px]" : "text-xs"}`}>
              {metaParts.join(" · ")}
              {file.uploadedBy && ` · ${file.uploadedBy}`}
            </p>
          )}
        </div>

        {/* Action buttons */}
        <div className="flex items-center gap-1 flex-shrink-0">
          {canPreview && (
            <Button
              variant="ghost"
              size="icon"
              className={`text-muted-foreground hover:text-blue-400 ${compact ? "h-7 w-7" : "h-8 w-8"}`}
              onClick={handlePreview}
              title="Preview"
            >
              <Eye className={compact ? "w-3.5 h-3.5" : "w-4 h-4"} />
            </Button>
          )}
          <Button
            variant="ghost"
            size="icon"
            className={`text-muted-foreground hover:text-primary ${compact ? "h-7 w-7" : "h-8 w-8"}`}
            onClick={() => {
              const link = document.createElement("a");
              link.href = file.fileUrl;
              link.download = file.fileName;
              link.target = "_blank";
              link.click();
            }}
            title="Download"
          >
            <Download className={compact ? "w-3.5 h-3.5" : "w-4 h-4"} />
          </Button>
          {onRemove && (
            <Button
              variant="ghost"
              size="icon"
              className={`text-muted-foreground hover:text-destructive ${compact ? "h-7 w-7" : "h-8 w-8"}`}
              onClick={() => onRemove(file.id)}
              disabled={isRemoving}
              title="Remove"
            >
              <Trash2 className={compact ? "w-3.5 h-3.5" : "w-4 h-4"} />
            </Button>
          )}
        </div>
      </div>

      {/* Inline image preview modal */}
      {imagePreview && isImage && (
        <div
          className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-8 cursor-pointer"
          onClick={() => setImagePreview(false)}
        >
          <div className="relative max-w-4xl max-h-[80vh]" onClick={(e) => e.stopPropagation()}>
            <img
              src={file.fileUrl}
              alt={file.fileName}
              className="max-w-full max-h-[80vh] rounded-lg shadow-2xl object-contain"
            />
            <div className="mt-3 flex items-center justify-center gap-3">
              <Button
                size="sm"
                variant="outline"
                className="bg-background/80"
                onClick={() => {
                  const link = document.createElement("a");
                  link.href = file.fileUrl;
                  link.download = file.fileName;
                  link.target = "_blank";
                  link.click();
                }}
              >
                <Download className="w-4 h-4 mr-1.5" /> Download
              </Button>
              <Button
                size="sm"
                variant="outline"
                className="bg-background/80"
                onClick={() => setImagePreview(false)}
              >
                Close
              </Button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

/**
 * UploadedFilesList — Renders a vertical list of uploaded files.
 * Drop-in replacement for the old inline file display.
 */
interface UploadedFilesListProps {
  files: UploadedFile[];
  onRemove?: (fileId: number) => void;
  isRemoving?: boolean;
  compact?: boolean;
  emptyMessage?: string;
}

export function UploadedFilesList({
  files,
  onRemove,
  isRemoving,
  compact,
  emptyMessage = "No files uploaded",
}: UploadedFilesListProps) {
  if (files.length === 0) {
    return (
      <p className={`text-muted-foreground ${compact ? "text-xs" : "text-sm"}`}>
        {emptyMessage}
      </p>
    );
  }

  return (
    <div className="space-y-2">
      {files.map((file) => (
        <UploadedFileRow
          key={file.id}
          file={file}
          onRemove={onRemove}
          isRemoving={isRemoving}
          compact={compact}
        />
      ))}
    </div>
  );
}

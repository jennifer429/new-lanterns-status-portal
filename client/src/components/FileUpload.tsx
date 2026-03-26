import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Upload, X, FileIcon, Loader2 } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";

interface FileUploadProps {
  organizationId: number;
  taskId: string;
  taskName: string;
  clickupListId?: string;
  linearIssueId?: string;
  onUploadComplete?: () => void;
}

export function FileUpload({
  organizationId,
  taskId,
  taskName,
  clickupListId,
  linearIssueId,
  onUploadComplete,
}: FileUploadProps) {
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [isUploading, setIsUploading] = useState(false);

  const uploadMutation = trpc.files.upload.useMutation({
    onError: (error) => {
      toast.error(`Upload failed: ${error.message}`);
    },
  });

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files || []);
    const valid = files.filter((file) => {
      if (file.size > 10 * 1024 * 1024) {
        toast.error(`${file.name} exceeds 10MB limit`);
        return false;
      }
      return true;
    });
    setSelectedFiles((prev) => [...prev, ...valid]);
    // Reset input so same files can be re-selected if removed
    event.target.value = "";
  };

  const removeFile = (index: number) => {
    setSelectedFiles((prev) => prev.filter((_, i) => i !== index));
  };

  const handleUpload = async () => {
    if (selectedFiles.length === 0) return;
    setIsUploading(true);

    let successCount = 0;
    for (const file of selectedFiles) {
      try {
        const base64Content = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = (e) => {
            const result = e.target?.result as string;
            resolve(result.split(",")[1]);
          };
          reader.onerror = reject;
          reader.readAsDataURL(file);
        });

        await uploadMutation.mutateAsync({
          organizationId,
          taskId,
          taskName,
          fileName: file.name,
          fileData: base64Content,
          mimeType: file.type,
          clickupTaskId: clickupListId,
          linearIssueId: linearIssueId,
        });
        successCount++;
      } catch {
        // error already shown via onError
      }
    }

    setIsUploading(false);
    if (successCount > 0) {
      toast.success(
        successCount === selectedFiles.length
          ? successCount === 1
            ? "File uploaded successfully!"
            : `${successCount} files uploaded successfully!`
          : `${successCount} of ${selectedFiles.length} files uploaded.`
      );
      setSelectedFiles([]);
      onUploadComplete?.();
    }
  };

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  return (
    <div className="space-y-3">
      {/* Drop zone */}
      <label className="block">
        <input
          type="file"
          className="hidden"
          onChange={handleFileSelect}
          accept=".pdf,.doc,.docx,.png,.jpg,.jpeg,.txt,.xlsx,.xls"
          multiple
          disabled={isUploading}
        />
        <Card className="p-4 border-2 border-dashed border-border hover:border-primary/50 cursor-pointer transition-colors">
          <div className="flex flex-col items-center gap-2 text-center">
            <Upload className="w-6 h-6 text-muted-foreground" />
            <div>
              <p className="text-sm font-medium">Click to add files</p>
              <p className="text-xs text-muted-foreground mt-0.5">
                PDF, DOC, PNG, JPG, TXT, XLSX (max 10MB each)
              </p>
            </div>
          </div>
        </Card>
      </label>

      {/* Selected files list */}
      {selectedFiles.length > 0 && (
        <div className="space-y-2">
          {selectedFiles.map((file, i) => (
            <Card key={i} className="p-3">
              <div className="flex items-center gap-3">
                <FileIcon className="w-6 h-6 text-primary flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{file.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {formatFileSize(file.size)}
                  </p>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7 flex-shrink-0"
                  onClick={() => removeFile(i)}
                  disabled={isUploading}
                >
                  <X className="w-3.5 h-3.5" />
                </Button>
              </div>
            </Card>
          ))}

          <Button
            className="w-full"
            onClick={handleUpload}
            disabled={isUploading}
          >
            {isUploading ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Uploading...
              </>
            ) : (
              <>
                <Upload className="w-4 h-4 mr-2" />
                Upload {selectedFiles.length > 1 ? `${selectedFiles.length} Files` : "File"}
              </>
            )}
          </Button>
        </div>
      )}
    </div>
  );
}

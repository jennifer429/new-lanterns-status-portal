/**
 * FilesManagement - Admin component for viewing and managing all uploaded files
 */

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { trpc } from "@/lib/trpc";
import { Download, Trash2, FileText, Calendar, Building2, AlertCircle } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { useState } from "react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

export function FilesManagement() {
  const { data: files, isLoading, refetch } = trpc.admin.getAllFiles.useQuery();
  const deleteMutation = trpc.admin.deleteFile.useMutation({
    onSuccess: () => {
      refetch();
      setDeleteDialogOpen(false);
      setFileToDelete(null);
    },
  });

  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [fileToDelete, setFileToDelete] = useState<number | null>(null);

  const handleDeleteClick = (fileId: number) => {
    setFileToDelete(fileId);
    setDeleteDialogOpen(true);
  };

  const handleDeleteConfirm = () => {
    if (fileToDelete) {
      deleteMutation.mutate({ id: fileToDelete });
    }
  };

  const formatFileSize = (bytes: number | null) => {
    if (!bytes) return "Unknown";
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  if (isLoading) {
    return (
      <Card className="card-elevated overflow-hidden">
        <div className="h-1 bg-gradient-to-r from-primary via-primary/60 to-emerald-500/40" />
        <CardContent className="py-12">
          <div className="text-center text-muted-foreground">Loading files...</div>
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <Card className="card-elevated overflow-hidden">
        <div className="h-1 bg-gradient-to-r from-primary via-primary/60 to-emerald-500/40" />
        <CardHeader>
          <CardTitle className="text-xl">Uploaded Files</CardTitle>
          <CardDescription>
            All files uploaded across organizations ({files?.length || 0} total)
          </CardDescription>
        </CardHeader>
        <CardContent>
          {files && files.length > 0 ? (
            <div className="space-y-3">
              {files.map((file) => (
                <Card
                  key={file.id}
                  className="card-elevated"
                >
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between gap-4">
                      {/* File Info */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-2">
                          <FileText className="w-4 h-4 text-primary flex-shrink-0" />
                          <h3 className="font-medium truncate">{file.fileName}</h3>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-3 gap-2 text-sm">
                          {/* Organization */}
                          <div className="flex items-center gap-2 text-muted-foreground">
                            <Building2 className="w-3 h-3" />
                            <span className="truncate">{file.organizationName || "Unknown"}</span>
                          </div>

                          {/* File Size */}
                          <div className="text-muted-foreground">
                            Size: {formatFileSize(file.fileSize)}
                          </div>

                          {/* Upload Date */}
                          <div className="flex items-center gap-2 text-muted-foreground">
                            <Calendar className="w-3 h-3" />
                            <span>
                              {file.createdAt
                                ? formatDistanceToNow(new Date(file.createdAt), { addSuffix: true })
                                : "Unknown"}
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* Actions */}
                      <div className="flex items-center gap-2 flex-shrink-0">
                        <a
                          href={file.fileUrl}
                          download
                          target="_blank"
                          rel="noopener noreferrer"
                        >
                          <Button size="sm" variant="outline">
                            <Download className="w-4 h-4" />
                          </Button>
                        </a>
                        <Button
                          size="sm"
                          variant="outline"
                          className="text-destructive hover:text-destructive hover:bg-destructive/10"
                          onClick={() => handleDeleteClick(file.id)}
                          disabled={deleteMutation.isPending}
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : (
            <div className="text-center py-12">
              <FileText className="w-12 h-12 text-muted-foreground/50 mx-auto mb-4" />
              <p className="text-muted-foreground">No files uploaded yet</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertCircle className="w-5 h-5 text-destructive" />
              Delete File
            </AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this file? This action cannot be undone.
              The file will be removed from the database but will remain in storage.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteConfirm}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              disabled={deleteMutation.isPending}
            >
              {deleteMutation.isPending ? "Deleting..." : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

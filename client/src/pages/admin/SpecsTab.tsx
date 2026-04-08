import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Plus, Edit, Download } from "lucide-react";
import { toast } from "sonner";

export function SpecsTab() {
  const [isUploadSpecDialogOpen, setIsUploadSpecDialogOpen] = useState(false);
  const [specTitle, setSpecTitle] = useState("");
  const [specDescription, setSpecDescription] = useState("");
  const [specCategory, setSpecCategory] = useState("");
  const [specFile, setSpecFile] = useState<File | null>(null);
  const [isEditSpecDialogOpen, setIsEditSpecDialogOpen] = useState(false);
  const [editSpecId, setEditSpecId] = useState<number | null>(null);
  const [editSpecTitle, setEditSpecTitle] = useState("");
  const [editSpecDescription, setEditSpecDescription] = useState("");
  const [editSpecCategory, setEditSpecCategory] = useState("");

  const { data: specs, refetch: refetchSpecs } = trpc.admin.getSpecifications.useQuery();

  const uploadSpecMutation = trpc.admin.uploadSpecification.useMutation({
    onSuccess: () => {
      toast.success("Specification uploaded successfully!");
      setIsUploadSpecDialogOpen(false); setSpecTitle(""); setSpecDescription(""); setSpecCategory(""); setSpecFile(null);
      refetchSpecs();
    },
    onError: (error: any) => toast.error(error.message || "Failed to upload specification"),
  });

  const updateSpecMutation = trpc.admin.updateSpecification.useMutation({
    onSuccess: () => {
      toast.success("Specification updated!");
      setIsEditSpecDialogOpen(false); setEditSpecId(null);
      refetchSpecs();
    },
    onError: (error: any) => toast.error(error.message || "Failed to update specification"),
  });

  const deactivateSpecMutation = trpc.admin.deactivateSpecification.useMutation({
    onSuccess: () => { toast.success("Specification removed"); refetchSpecs(); },
    onError: (error: any) => toast.error(error.message || "Failed to remove specification"),
  });

  const handleUploadSpec = async () => {
    if (!specTitle || !specFile) { toast.error("Please provide a title and file"); return; }
    const reader = new FileReader();
    reader.onload = () => {
      const base64 = (reader.result as string).split(",")[1];
      uploadSpecMutation.mutate({ title: specTitle, description: specDescription || undefined, category: specCategory || undefined, fileName: specFile.name, fileData: base64, mimeType: specFile.type });
    };
    reader.readAsDataURL(specFile);
  };

  const handleEditSpec = (spec: NonNullable<typeof specs>[number]) => {
    setEditSpecId(spec.id); setEditSpecTitle(spec.title); setEditSpecDescription(spec.description || "");
    setEditSpecCategory(spec.category || ""); setIsEditSpecDialogOpen(true);
  };

  const handleUpdateSpec = () => {
    if (!editSpecId || !editSpecTitle) { toast.error("Please provide a title"); return; }
    updateSpecMutation.mutate({ id: editSpecId, title: editSpecTitle, description: editSpecDescription || undefined, category: editSpecCategory || undefined });
  };

  const handleDeactivateSpec = (id: number) => {
    if (confirm("Are you sure you want to remove this specification? Clients will no longer see it.")) deactivateSpecMutation.mutate({ id });
  };

  return (
    <>
          <>
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-2xl font-bold">New Lantern Specifications</h2>
              <Dialog open={isUploadSpecDialogOpen} onOpenChange={setIsUploadSpecDialogOpen}>
                <DialogTrigger asChild>
                  <Button>
                    <Plus className="w-4 h-4 mr-2" />
                    Upload Specification
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Upload Specification</DialogTitle>
                  </DialogHeader>
                  <div className="space-y-4">
                    <div>
                      <Label>Title *</Label>
                      <Input
                        placeholder="e.g., HL7 Integration Guide"
                        value={specTitle}
                        onChange={(e) => setSpecTitle(e.target.value)}
                      />
                    </div>
                    <div>
                      <Label>Category</Label>
                      <Input
                        placeholder="e.g., Integration, Security, Setup"
                        value={specCategory}
                        onChange={(e) => setSpecCategory(e.target.value)}
                      />
                    </div>
                    <div>
                      <Label>Description</Label>
                      <Input
                        placeholder="Optional description"
                        value={specDescription}
                        onChange={(e) => setSpecDescription(e.target.value)}
                      />
                    </div>
                    <div>
                      <Label>File *</Label>
                      <Input
                        type="file"
                        onChange={(e) => setSpecFile(e.target.files?.[0] || null)}
                      />
                    </div>
                    <Button
                      onClick={handleUploadSpec}
                      disabled={uploadSpecMutation.isPending || !specTitle || !specFile}
                      className="w-full"
                    >
                      {uploadSpecMutation.isPending ? "Uploading..." : "Upload"}
                    </Button>
                  </div>
                </DialogContent>
              </Dialog>
            </div>

            {/* Edit Spec Dialog */}
            <Dialog open={isEditSpecDialogOpen} onOpenChange={setIsEditSpecDialogOpen}>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Edit Specification</DialogTitle>
                </DialogHeader>
                <div className="space-y-4">
                  <div>
                    <Label>Title *</Label>
                    <Input
                      value={editSpecTitle}
                      onChange={(e) => setEditSpecTitle(e.target.value)}
                    />
                  </div>
                  <div>
                    <Label>Category</Label>
                    <Input
                      value={editSpecCategory}
                      onChange={(e) => setEditSpecCategory(e.target.value)}
                    />
                  </div>
                  <div>
                    <Label>Description</Label>
                    <Input
                      value={editSpecDescription}
                      onChange={(e) => setEditSpecDescription(e.target.value)}
                    />
                  </div>
                  <Button
                    onClick={handleUpdateSpec}
                    disabled={updateSpecMutation.isPending || !editSpecTitle}
                    className="w-full"
                  >
                    {updateSpecMutation.isPending ? "Saving..." : "Save Changes"}
                  </Button>
                </div>
              </DialogContent>
            </Dialog>

            <Card>
              <CardContent className="p-6">
                {!specs || specs.length === 0 ? (
                  <div className="text-center py-12 text-muted-foreground">
                    <p className="text-lg font-medium">No specifications uploaded yet</p>
                    <p className="text-sm">Upload specification documents for clients to download.</p>
                  </div>
                ) : (
                  <table className="w-full border-collapse text-xs" style={{ tableLayout: 'fixed' }}>
                    <colgroup>
                      <col style={{ width: '22%' }} /><col style={{ width: '10%' }} />
                      <col style={{ width: '20%' }} /><col style={{ width: '7%'  }} />
                      <col style={{ width: '10%' }} /><col style={{ width: '9%'  }} />
                      <col style={{ width: '22%' }} />
                    </colgroup>
                    <thead>
                      <tr className="border-b border-border/30 bg-muted/15">
                        {['Title','Category','File','Size','By','Date',''].map((h,i)=>(
                          <th key={i} className="text-left px-3 py-2 text-[10px] font-medium text-muted-foreground uppercase tracking-wide">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {specs.map(spec => (
                        <tr key={spec.id} className="border-b border-border/20 hover:bg-muted/20 transition-colors">
                          <td className="px-3 py-1.5">
                            <div className="font-medium truncate">{spec.title}</div>
                            {spec.description && <div className="text-muted-foreground truncate text-[10px]">{spec.description}</div>}
                          </td>
                          <td className="px-3 py-1.5 text-muted-foreground truncate">{spec.category||'—'}</td>
                          <td className="px-3 py-1.5 truncate text-muted-foreground">{spec.fileName}</td>
                          <td className="px-3 py-1.5 text-muted-foreground whitespace-nowrap">{spec.fileSize?`${(spec.fileSize/1024).toFixed(0)}K`:'—'}</td>
                          <td className="px-3 py-1.5 text-muted-foreground truncate">{spec.uploadedBy}</td>
                          <td className="px-3 py-1.5 text-muted-foreground whitespace-nowrap">{new Date(spec.createdAt).toLocaleDateString()}</td>
                          <td className="px-2 py-1">
                            <div className="flex gap-1">
                              <a href={spec.fileUrl} target="_blank" rel="noopener noreferrer"
                                className="flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[10px] border border-border/40 hover:bg-muted/50 transition-colors">
                                <Download className="w-2.5 h-2.5" /> DL
                              </a>
                              <button onClick={() => handleEditSpec(spec)}
                                className="flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[10px] border border-border/40 hover:bg-muted/50 transition-colors">
                                <Edit className="w-2.5 h-2.5" /> Edit
                              </button>
                              <button onClick={() => handleDeactivateSpec(spec.id)}
                                className="flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[10px] border border-red-500/30 text-red-400 hover:bg-red-500/10 transition-colors">
                                Remove
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </CardContent>
            </Card>
          </>
    </>
  );
}

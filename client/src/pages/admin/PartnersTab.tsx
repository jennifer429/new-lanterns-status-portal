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
import { Plus, Edit, RotateCcw } from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import type { SharedAdminProps } from "./types";

type PartnersTabProps = Pick<SharedAdminProps, "clients" | "orgs" | "refetchOrgs">;

export function PartnersTab({ clients, orgs, refetchOrgs }: PartnersTabProps) {
  const [isCreatePartnerDialogOpen, setIsCreatePartnerDialogOpen] = useState(false);
  const [newPartnerName, setNewPartnerName] = useState("");
  const [newPartnerSlug, setNewPartnerSlug] = useState("");
  const [newPartnerDescription, setNewPartnerDescription] = useState("");
  const [isEditPartnerDialogOpen, setIsEditPartnerDialogOpen] = useState(false);
  const [editPartnerId, setEditPartnerId] = useState<number | null>(null);
  const [editPartnerName, setEditPartnerName] = useState("");
  const [editPartnerSlug, setEditPartnerSlug] = useState("");
  const [editPartnerDescription, setEditPartnerDescription] = useState("");

  const createClientMutation = trpc.admin.createClient.useMutation({
    onSuccess: () => {
      toast.success("Partner created successfully!");
      setIsCreatePartnerDialogOpen(false); setNewPartnerName(""); setNewPartnerSlug(""); setNewPartnerDescription("");
      refetchOrgs();
    },
    onError: (error: any) => toast.error(error.message || "Failed to create partner"),
  });

  const updateClientMutation = trpc.admin.updateClient.useMutation({
    onSuccess: () => {
      toast.success("Partner updated successfully!");
      setIsEditPartnerDialogOpen(false); setEditPartnerId(null);
      refetchOrgs();
    },
    onError: (error: any) => toast.error(error.message || "Failed to update partner"),
  });

  const deactivateClientMutation = trpc.admin.deactivateClient.useMutation({
    onSuccess: () => { toast.success("Partner deactivated"); refetchOrgs(); },
    onError: (error: any) => toast.error(error.message || "Failed to deactivate partner"),
  });

  const reactivateClientMutation = trpc.admin.reactivateClient.useMutation({
    onSuccess: () => { toast.success("Partner reactivated"); refetchOrgs(); },
    onError: (error: any) => toast.error(error.message || "Failed to reactivate partner"),
  });

  const handleCreatePartner = () => {
    if (!newPartnerName || !newPartnerSlug) { toast.error("Please fill in name and slug"); return; }
    createClientMutation.mutate({ name: newPartnerName, slug: newPartnerSlug, description: newPartnerDescription || undefined });
  };

  const handleEditPartner = (client: NonNullable<typeof clients>[number]) => {
    setEditPartnerId(client.id); setEditPartnerName(client.name); setEditPartnerSlug(client.slug);
    setEditPartnerDescription(client.description || ""); setIsEditPartnerDialogOpen(true);
  };

  const handleUpdatePartner = () => {
    if (!editPartnerId || !editPartnerName || !editPartnerSlug) { toast.error("Please fill in name and slug"); return; }
    updateClientMutation.mutate({ id: editPartnerId, name: editPartnerName, slug: editPartnerSlug, description: editPartnerDescription || undefined });
  };

  const handleDeactivatePartner = (id: number) => {
    if (confirm("Are you sure you want to deactivate this partner? This will not affect their organizations.")) deactivateClientMutation.mutate({ id });
  };

  const handleReactivatePartner = (id: number) => {
    reactivateClientMutation.mutate({ id });
  };

  return (
    <>
          <>
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-2xl font-bold">Partners ({clients?.length || 0})</h2>
              <Dialog open={isCreatePartnerDialogOpen} onOpenChange={setIsCreatePartnerDialogOpen}>
                <DialogTrigger asChild>
                  <Button className="gap-2">
                    <Plus className="w-4 h-4" />
                    Add Partner
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Create New Partner</DialogTitle>
                    <DialogDescription>
                      Add a new partner organization (e.g., RadOne, SRV).
                    </DialogDescription>
                  </DialogHeader>
                  <div className="space-y-4 mt-4">
                    <div className="space-y-2">
                      <Label>Name <span className="text-destructive">*</span></Label>
                      <Input
                        placeholder="e.g., RadOne"
                        value={newPartnerName}
                        onChange={(e) => {
                          setNewPartnerName(e.target.value);
                          setNewPartnerSlug(e.target.value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, ''));
                        }}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Slug <span className="text-destructive">*</span></Label>
                      <Input
                        placeholder="e.g., radone"
                        value={newPartnerSlug}
                        onChange={(e) => setNewPartnerSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ''))}
                      />
                      <p className="text-xs text-muted-foreground">URL-safe identifier. Auto-generated from name.</p>
                    </div>
                    <div className="space-y-2">
                      <Label>Description</Label>
                      <Input
                        placeholder="Optional description"
                        value={newPartnerDescription}
                        onChange={(e) => setNewPartnerDescription(e.target.value)}
                      />
                    </div>
                    <Button
                      onClick={handleCreatePartner}
                      disabled={createClientMutation.isPending || !newPartnerName || !newPartnerSlug}
                      className="w-full"
                    >
                      {createClientMutation.isPending ? "Creating..." : "Create Partner"}
                    </Button>
                  </div>
                </DialogContent>
              </Dialog>
            </div>

            {/* Edit Partner Dialog */}
            <Dialog open={isEditPartnerDialogOpen} onOpenChange={setIsEditPartnerDialogOpen}>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Edit Partner</DialogTitle>
                  <DialogDescription>
                    Update partner details.
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-4 mt-4">
                  <div className="space-y-2">
                    <Label>Name <span className="text-destructive">*</span></Label>
                    <Input
                      value={editPartnerName}
                      onChange={(e) => setEditPartnerName(e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Slug <span className="text-destructive">*</span></Label>
                    <Input
                      value={editPartnerSlug}
                      onChange={(e) => setEditPartnerSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ''))}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Description</Label>
                    <Input
                      value={editPartnerDescription}
                      onChange={(e) => setEditPartnerDescription(e.target.value)}
                    />
                  </div>
                  <Button
                    onClick={handleUpdatePartner}
                    disabled={updateClientMutation.isPending || !editPartnerName || !editPartnerSlug}
                    className="w-full"
                  >
                    {updateClientMutation.isPending ? "Saving..." : "Save Changes"}
                  </Button>
                </div>
              </DialogContent>
            </Dialog>

            <Card>
              <CardContent className="p-6">
                {!clients || clients.length === 0 ? (
                  <div className="text-center py-12 text-muted-foreground">
                    <p className="text-lg font-medium">No partners yet</p>
                    <p className="text-sm">Create a partner to start organizing your clients.</p>
                  </div>
                ) : (
                  <table className="w-full border-collapse text-xs" style={{ tableLayout: 'fixed' }}>
                    <colgroup>
                      <col style={{ width: '4%' }} /><col style={{ width: '16%' }} />
                      <col style={{ width: '14%' }} /><col style={{ width: '22%' }} />
                      <col style={{ width: '8%' }} /><col style={{ width: '8%' }} />
                      <col style={{ width: '10%' }} /><col style={{ width: '18%' }} />
                    </colgroup>
                    <thead>
                      <tr className="border-b border-border/30 bg-muted/15">
                        {['ID','Name','Slug','Description','Status','Orgs','Created',''].map((h,i)=>(
                          <th key={i} className="text-left px-3 py-2 text-[10px] font-medium text-muted-foreground uppercase tracking-wide">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {clients.map(c => {
                        const orgCount = orgs?.filter(o => o.clientId === c.id).length || 0;
                        return (
                          <tr key={c.id} className={cn("border-b border-border/20 hover:bg-muted/20 transition-colors", c.status==='inactive'&&"opacity-50")}>
                            <td className="px-3 py-1.5 font-mono text-muted-foreground">{c.id}</td>
                            <td className="px-3 py-1.5 font-medium truncate">{c.name}</td>
                            <td className="px-3 py-1.5 font-mono text-muted-foreground truncate">{c.slug}</td>
                            <td className="px-3 py-1.5 text-muted-foreground truncate">{c.description||'—'}</td>
                            <td className="px-3 py-1.5">
                              <span className={cn("px-1.5 py-0 rounded text-[10px] font-semibold leading-5 border",
                                c.status==='active'?"bg-green-500/15 text-green-400 border-green-500/30":"bg-muted/30 text-muted-foreground border-border/40")}>
                                {c.status}
                              </span>
                            </td>
                            <td className="px-3 py-1.5 text-muted-foreground">{orgCount}</td>
                            <td className="px-3 py-1.5 text-muted-foreground whitespace-nowrap">{new Date(c.createdAt).toLocaleDateString()}</td>
                            <td className="px-2 py-1">
                              <div className="flex gap-1">
                                <button onClick={() => handleEditPartner(c)}
                                  className="flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[10px] border border-border/40 hover:bg-muted/50 transition-colors">
                                  <Edit className="w-2.5 h-2.5" /> Edit
                                </button>
                                {c.status==='active' ? (
                                  <button onClick={() => handleDeactivatePartner(c.id)}
                                    className="flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[10px] border border-red-500/30 text-red-400 hover:bg-red-500/10 transition-colors">
                                    Deactivate
                                  </button>
                                ) : (
                                  <button onClick={() => handleReactivatePartner(c.id)}
                                    className="flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[10px] border border-border/40 hover:bg-muted/50 transition-colors">
                                    <RotateCcw className="w-2.5 h-2.5" /> Reactivate
                                  </button>
                                )}
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                )}
              </CardContent>
            </Card>
          </>
    </>
  );
}

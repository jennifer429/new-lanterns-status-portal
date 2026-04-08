import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { useAuth } from "@/_core/hooks/useAuth";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Building2, Plus, ExternalLink, Users, FileText, Download, FolderOpen, Upload, X, Loader2, ChevronDown } from "lucide-react";
import { UploadedFilesList } from "@/components/UploadedFileRow";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

interface PartnerAdminProps {
  partnerName: string; // "SRV" or "RadOne"
  allowedDomain: string; // "@srv.com" or "@radone.com"
}

/**
 * Partner Admin Dashboard - Shows only organizations for the specific partner
 * Access controlled by email domain
 */
export default function PartnerAdmin({ partnerName, allowedDomain }: PartnerAdminProps) {
  const [, setLocation] = useLocation();
  const { user, loading: authLoading } = useAuth();

  // Notes & Files state
  const [notesOpen, setNotesOpen] = useState(false);
  const [notesFiles, setNotesFiles] = useState<File[]>([]);
  const [notesLabel, setNotesLabel] = useState("Call Notes");
  const [notesCustomLabel, setNotesCustomLabel] = useState("");
  const [notesUploading, setNotesUploading] = useState(false);

  // Access control: Partner admins must have a clientId
  useEffect(() => {
    if (!authLoading && (!user || !user.clientId)) {
      setLocation("/");
    }
  }, [user, authLoading, setLocation]);

  // Get organizations and metrics filtered by user's clientId
  const { data: orgs, isLoading } = trpc.admin.getAllOrganizations.useQuery();
  const { data: metrics } = trpc.admin.getAdminSummary.useQuery();

  // Partner-level notes
  const { data: partnerNotes = [], refetch: refetchNotes } = trpc.notes.listByClient.useQuery(
    { clientId: user?.clientId! },
    { enabled: !!user?.clientId }
  );

  const uploadNoteMutation = trpc.notes.uploadForClient.useMutation({
    onSuccess: () => { refetchNotes(); },
  });

  const deleteNoteMutation = trpc.notes.delete.useMutation({
    onSuccess: () => { refetchNotes(); },
  });

  const handleNotesFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []).filter((f) => {
      if (f.size > 25 * 1024 * 1024) {
        toast.error(`${f.name} exceeds 25MB limit`);
        return false;
      }
      return true;
    });
    setNotesFiles((prev) => [...prev, ...files]);
    e.target.value = "";
  };

  const handleNotesUpload = async () => {
    if (notesFiles.length === 0 || !user?.clientId) return;
    const effectiveLabel = notesLabel === "Other" ? (notesCustomLabel.trim() || "Other") : notesLabel;
    setNotesUploading(true);
    let ok = 0;
    for (const file of notesFiles) {
      try {
        const base64 = await new Promise<string>((res, rej) => {
          const r = new FileReader();
          r.onload = (e) => res((e.target!.result as string).split(",")[1]);
          r.onerror = rej;
          r.readAsDataURL(file);
        });
        await uploadNoteMutation.mutateAsync({
          clientId: user.clientId!,
          label: effectiveLabel,
          fileName: file.name,
          fileData: base64,
          mimeType: file.type || "application/octet-stream",
        });
        ok++;
      } catch {
        toast.error(`Failed to upload ${file.name}`);
      }
    }
    setNotesUploading(false);
    if (ok > 0) {
      toast.success(ok === 1 ? "File uploaded!" : `${ok} files uploaded!`);
      setNotesFiles([]);
    }
  };

  // Create metrics map for quick lookup
  const metricsMap = metrics?.reduce((acc, m) => {
    acc[m.organizationId] = m;
    return acc;
  }, {} as Record<number, typeof metrics[number]>) || {};

  if (authLoading || isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border bg-card/50 backdrop-blur-sm">
        <div className="container py-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <img src="/images/new-lantern-logo.png" alt="New Lantern" className="h-12" />
              <div>
                <h1 className="text-3xl font-bold text-foreground">{partnerName} Admin</h1>
                <p className="text-sm text-muted-foreground mt-1">
                  Manage your organizations
                </p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <Button
                variant="outline"
                onClick={() => setLocation(`/org/${partnerName}/admin/users`)}
              >
                <Users className="w-4 h-4 mr-2" />
                Manage Users
              </Button>
              <Button onClick={() => setLocation(`/org/${partnerName}/admin/create`)}>
                <Plus className="w-4 h-4 mr-2" />
                Create Organization
              </Button>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <div className="container py-8">
        {/* Stats Card */}
        <Card className="mb-8">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Organizations</CardTitle>
            <Building2 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{orgs?.length || 0}</div>
            <p className="text-xs text-muted-foreground mt-1">
              {orgs?.filter(o => o.status === "active").length || 0} active
            </p>
          </CardContent>
        </Card>

        {/* Notes & Files */}
        <Card className="mb-8 overflow-hidden">
          <button
            onClick={() => setNotesOpen(!notesOpen)}
            className="w-full px-6 py-4 flex items-center justify-between hover:bg-accent/30 transition-colors"
          >
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-primary/10">
                <FolderOpen className="w-4 h-4 text-primary" />
              </div>
              <div className="text-left">
                <span className="text-sm font-semibold">Notes & Files</span>
                <p className="text-xs text-muted-foreground mt-0.5">Upload call notes, templates, and labeled documents for your team</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {partnerNotes.length > 0 ? (
                <Badge variant="outline" className="text-xs border-primary/40 text-primary font-semibold">
                  {partnerNotes.length} file{partnerNotes.length !== 1 ? "s" : ""}
                </Badge>
              ) : (
                <Badge variant="outline" className="text-xs text-muted-foreground">Upload</Badge>
              )}
              <ChevronDown className={cn("w-4 h-4 text-muted-foreground transition-transform duration-200", notesOpen && "rotate-180")} />
            </div>
          </button>

          {notesOpen && (
            <div className="border-t border-border/40 px-6 py-4 space-y-4">
              {/* Label selector */}
              <div className="space-y-2">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Label this upload</p>
                <div className="flex flex-wrap gap-2">
                  {["Call Notes", "Meeting Notes", "Template", "Action Items", "Reference Doc", "Other"].map((opt) => (
                    <button
                      key={opt}
                      onClick={() => setNotesLabel(opt)}
                      className={cn(
                        "px-3 py-1 rounded-full text-xs font-medium border transition-colors",
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
                    className="w-full px-3 py-2 text-sm rounded-md border border-border bg-muted/20 focus:outline-none focus:ring-1 focus:ring-primary/50"
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
                  onChange={handleNotesFileSelect}
                  disabled={notesUploading}
                />
                <div className="border-2 border-dashed border-border rounded-lg p-5 flex items-center gap-3 hover:border-primary/50 hover:bg-primary/5 transition-colors">
                  <Upload className="w-5 h-5 text-muted-foreground flex-shrink-0" />
                  <div>
                    <p className="text-sm font-medium">Click to add files</p>
                    <p className="text-xs text-muted-foreground mt-0.5">PDFs, docs, images, audio, transcripts (max 25MB each)</p>
                  </div>
                </div>
              </label>

              {/* Staged files */}
              {notesFiles.length > 0 && (
                <div className="space-y-2">
                  {notesFiles.map((f, i) => (
                    <div key={i} className="flex items-center gap-2 px-3 py-2 rounded-lg bg-muted/30 border border-border/40">
                      <FileText className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                      <span className="text-sm flex-1 truncate">{f.name}</span>
                      <span className="text-xs text-muted-foreground flex-shrink-0">
                        {f.size < 1024 * 1024 ? `${(f.size / 1024).toFixed(1)} KB` : `${(f.size / (1024 * 1024)).toFixed(1)} MB`}
                      </span>
                      <button
                        onClick={() => setNotesFiles((prev) => prev.filter((_, j) => j !== i))}
                        className="text-muted-foreground hover:text-destructive transition-colors"
                        disabled={notesUploading}
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                  <Button
                    className="w-full"
                    onClick={handleNotesUpload}
                    disabled={notesUploading}
                  >
                    {notesUploading ? (
                      <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Uploading...</>
                    ) : (
                      <><Upload className="w-4 h-4 mr-2" /> Upload {notesFiles.length} File{notesFiles.length !== 1 ? "s" : ""}</>
                    )}
                  </Button>
                </div>
              )}

              {/* Uploaded files */}
              {partnerNotes.length > 0 ? (
                <div className="space-y-2">
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Uploaded Files</p>
                  <UploadedFilesList
                    files={partnerNotes.map((f) => ({
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
                        deleteNoteMutation.mutate({ noteId });
                      }
                    }}
                  />
                </div>
              ) : notesFiles.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-3">No files uploaded yet. Add call notes, templates, or any supporting documents for your team.</p>
              ) : null}
            </div>
          )}
        </Card>

        {/* Organizations List */}
        <Card>
          <CardHeader>
            <CardTitle>Organizations</CardTitle>
            <CardDescription>
              All organizations managed by {partnerName}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {!orgs || orgs.length === 0 ? (
              <div className="text-center py-12">
                <Building2 className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                <p className="text-muted-foreground">No organizations yet</p>
                <Button
                  variant="outline"
                  className="mt-4"
                  onClick={() => setLocation(`/org/${partnerName}/admin/create`)}
                >
                  <Plus className="w-4 h-4 mr-2" />
                  Create First Organization
                </Button>
              </div>
            ) : (
              <div className="space-y-2">
                {orgs.map(org => {
                  const orgMetrics = metricsMap[org.id];
                  return (
                  <div
                    key={org.id}
                    className="flex items-center justify-between p-4 rounded-lg border border-border hover:bg-muted/50 transition-colors"
                  >
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <h3 className="font-medium text-lg">{org.name}</h3>
                        <Badge variant={org.status === "active" ? "default" : "secondary"}>
                          {org.status}
                        </Badge>
                      </div>
                      <p className="text-sm text-muted-foreground mb-3">
                        {org.contactName && `${org.contactName} • `}
                        {org.contactEmail}
                      </p>
                      {orgMetrics && (
                        <div className="flex items-center gap-6 text-sm">
                          <div className="flex items-center gap-2">
                            <Users className="w-4 h-4 text-muted-foreground" />
                            <span><strong>{orgMetrics.userCount}</strong> users</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="text-muted-foreground">Progress:</span>
                            <span className="font-semibold text-primary">{(() => {
                              const sp = orgMetrics.sectionProgress || {} as Record<string, {completed: number; total: number}>;
                              const spVals = Object.values(sp) as Array<{completed: number; total: number}>;
                              const secComplete = spVals.filter(s => s.completed === s.total && s.total > 0).length;
                              const secTotal = spVals.length || 6;
                              const qP = secTotal > 0 ? (secComplete / secTotal) * 100 : 0;
                              const v = orgMetrics.validationStats;
                              const vPass = v?.pass ?? 0;
                              const vInProg = v?.inProgress ?? 0;
                              const vFail = v?.fail ?? 0;
                              const vBlocked = v?.blocked ?? 0;
                              const vTot = v ? (v.total - (v.na ?? 0)) : 0;
                              const vP = vTot > 0 ? ((vPass + vInProg * 0.5 + vFail * 0.25 + vBlocked * 0.25) / vTot) * 100 : 0;
                              const t = orgMetrics.taskStats;
                              const tDone = t?.completed ?? 0;
                              const tTot = t ? (t.total - (t.notApplicable ?? 0)) : 0;
                              const tP = tTot > 0 ? (tDone / tTot) * 100 : 0;
                              return Math.round(qP * 0.4 + vP * 0.3 + tP * 0.3);
                            })()}%</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <FileText className="w-4 h-4 text-muted-foreground" />
                            <span><strong>{orgMetrics.files.length}</strong> files</span>
                            {orgMetrics.files.length > 0 && (
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-6 px-2"
                                onClick={() => {
                                  orgMetrics.files.forEach(f => {
                                    window.open(f.fileUrl, '_blank');
                                  });
                                }}
                              >
                                <Download className="w-3 h-3" />
                              </Button>
                            )}
                          </div>
                        </div>
                      )}
                      {org.startDate && (
                        <p className="text-xs text-muted-foreground mt-2">
                          Started: {org.startDate}
                        </p>
                      )}
                    </div>
                    <div className="flex items-center gap-3">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setLocation(`/org/${org.slug}/intake`)}
                      >
                        <ExternalLink className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

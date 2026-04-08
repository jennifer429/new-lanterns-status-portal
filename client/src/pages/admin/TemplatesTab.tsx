import { useMemo, useState } from "react";
import { useAuth } from "@/_core/hooks/useAuth";
import { trpc } from "@/lib/trpc";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Upload, FileText, FileUp, Download } from "lucide-react";
import { toast } from "sonner";
import { questionnaireSections } from "@shared/questionnaireData";
import type { SharedAdminProps } from "./types";

type TemplatesTabProps = Pick<SharedAdminProps, "isPlatformAdmin" | "clients">;

export function TemplatesTab({ isPlatformAdmin, clients }: TemplatesTabProps) {
  const { user } = useAuth();

  const clientMap = useMemo(() =>
    clients?.reduce((acc, c) => { acc[c.id] = c.name; return acc; }, {} as Record<number, string>) || {},
    [clients]
  );

  const partnerDisplayName = useMemo(() => {
    if (!user?.clientId) return "Your Partner";
    return clients?.find(c => c.id === user.clientId)?.name || `Partner ${user.clientId}`;
  }, [user, clients]);

  const [isUploadTemplateDialogOpen, setIsUploadTemplateDialogOpen] = useState(false);
  const [templateClientId, setTemplateClientId] = useState<number | undefined>();
  const [templateQuestionId, setTemplateQuestionId] = useState("");
  const [templateLabel, setTemplateLabel] = useState("");
  const [templateFile, setTemplateFile] = useState<File | null>(null);
  const [isReplaceTemplateDialogOpen, setIsReplaceTemplateDialogOpen] = useState(false);
  const [replaceTemplateId, setReplaceTemplateId] = useState<number | null>(null);
  const [replaceTemplateFile, setReplaceTemplateFile] = useState<File | null>(null);
  const [replaceTemplateLabel, setReplaceTemplateLabel] = useState("");
  const [showInactiveTemplates, setShowInactiveTemplates] = useState(false);

  const { data: templates, refetch: refetchTemplates } = trpc.admin.getTemplates.useQuery();
  const { data: inactiveTemplates, refetch: refetchInactiveTemplates } = trpc.admin.getInactiveTemplates.useQuery();

  const templateQuestions = questionnaireSections.flatMap(section =>
    (section.questions || []).filter(q => q.type === 'upload-download' || q.type === 'upload').map(q => ({
      id: q.id,
      text: q.text,
      sectionTitle: section.title,
    }))
  );

  const uploadTemplateMutation = trpc.admin.uploadTemplate.useMutation({
    onSuccess: () => {
      toast.success("Template uploaded successfully!");
      setIsUploadTemplateDialogOpen(false); setTemplateClientId(undefined); setTemplateQuestionId(""); setTemplateLabel(""); setTemplateFile(null);
      refetchTemplates();
    },
    onError: (error: any) => toast.error(error.message || "Failed to upload template"),
  });

  const replaceTemplateMutation = trpc.admin.replaceTemplate.useMutation({
    onSuccess: () => {
      toast.success("Template replaced successfully!");
      setIsReplaceTemplateDialogOpen(false); setReplaceTemplateId(null); setReplaceTemplateFile(null); setReplaceTemplateLabel("");
      refetchTemplates(); refetchInactiveTemplates();
    },
    onError: (error: any) => toast.error(error.message || "Failed to replace template"),
  });

  const handleUploadTemplate = async () => {
    const clientIdToUse = isPlatformAdmin ? templateClientId : user?.clientId;
    if (!clientIdToUse || !templateQuestionId || !templateLabel || !templateFile) {
      toast.error("Please fill in all required fields and select a file"); return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      const base64 = (reader.result as string).split(',')[1];
      uploadTemplateMutation.mutate({ clientId: clientIdToUse, questionId: templateQuestionId, label: templateLabel, fileName: templateFile.name, fileData: base64, mimeType: templateFile.type || 'application/octet-stream' });
    };
    reader.readAsDataURL(templateFile);
  };

  const handleReplaceTemplate = async () => {
    if (!replaceTemplateId || !replaceTemplateFile || !replaceTemplateLabel) {
      toast.error("Please provide a label and select a new file"); return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      const base64 = (reader.result as string).split(',')[1];
      replaceTemplateMutation.mutate({ id: replaceTemplateId, label: replaceTemplateLabel, fileName: replaceTemplateFile.name, fileData: base64, mimeType: replaceTemplateFile.type || 'application/octet-stream' });
    };
    reader.readAsDataURL(replaceTemplateFile);
  };

  return (
    <>
          <>
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-2xl font-bold">Partner Templates ({templates?.length || 0})</h2>
              <Dialog open={isUploadTemplateDialogOpen} onOpenChange={setIsUploadTemplateDialogOpen}>
                <DialogTrigger asChild>
                  <Button className="gap-2">
                    <Upload className="w-4 h-4" />
                    Upload Template
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Upload New Template</DialogTitle>
                    <DialogDescription>
                      Upload a template file that will be available for download on the intake form for the selected partner's organizations.
                    </DialogDescription>
                  </DialogHeader>
                  <div className="space-y-4 mt-4">
                    {isPlatformAdmin && (
                      <div className="space-y-2">
                        <Label>Partner <span className="text-destructive">*</span></Label>
                        <Select
                          value={templateClientId?.toString() || ""}
                          onValueChange={(value) => setTemplateClientId(parseInt(value))}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Select partner" />
                          </SelectTrigger>
                          <SelectContent>
                            {clients?.map(client => (
                              <SelectItem key={client.id} value={client.id.toString()}>
                                {client.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    )}
                    {!isPlatformAdmin && (
                      <div className="space-y-2">
                        <Label>Partner</Label>
                        <Input value={partnerDisplayName} disabled />
                      </div>
                    )}

                    <div className="space-y-2">
                      <Label>Question <span className="text-destructive">*</span></Label>
                      <Select
                        value={templateQuestionId}
                        onValueChange={(value) => setTemplateQuestionId(value)}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Select question" />
                        </SelectTrigger>
                        <SelectContent>
                          {templateQuestions.map(q => (
                            <SelectItem key={q.id} value={q.id}>
                              {q.id} - {q.text.substring(0, 60)}{q.text.length > 60 ? '...' : ''}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-2">
                      <Label>Label <span className="text-destructive">*</span></Label>
                      <Input
                        placeholder="e.g., VPN Configuration Form"
                        value={templateLabel}
                        onChange={(e) => setTemplateLabel(e.target.value)}
                      />
                    </div>

                    <div className="space-y-2">
                      <Label>File <span className="text-destructive">*</span></Label>
                      <Input
                        type="file"
                        onChange={(e) => setTemplateFile(e.target.files?.[0] || null)}
                      />
                      {templateFile && (
                        <p className="text-xs text-muted-foreground">
                          {templateFile.name} ({(templateFile.size / 1024).toFixed(1)} KB)
                        </p>
                      )}
                    </div>

                    <Button
                      onClick={handleUploadTemplate}
                      disabled={uploadTemplateMutation.isPending}
                      className="w-full"
                    >
                      {uploadTemplateMutation.isPending ? "Uploading..." : "Upload Template"}
                    </Button>
                  </div>
                </DialogContent>
              </Dialog>
            </div>

            {/* Replace Template Dialog */}
            <Dialog open={isReplaceTemplateDialogOpen} onOpenChange={setIsReplaceTemplateDialogOpen}>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Replace Template</DialogTitle>
                  <DialogDescription>
                    This will replace the current template file. The old version will be kept in the inactive history for reference.
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-4 mt-4">
                  <div className="p-3 bg-yellow-500/10 border border-yellow-500/30 rounded-md">
                    <p className="text-sm text-yellow-400 font-medium">⚠ Warning: This will deactivate the current template and replace it with a new file.</p>
                  </div>
                  <div className="space-y-2">
                    <Label>Label <span className="text-destructive">*</span></Label>
                    <Input
                      value={replaceTemplateLabel}
                      onChange={(e) => setReplaceTemplateLabel(e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>New File <span className="text-destructive">*</span></Label>
                    <Input
                      type="file"
                      onChange={(e) => setReplaceTemplateFile(e.target.files?.[0] || null)}
                    />
                    {replaceTemplateFile && (
                      <p className="text-xs text-muted-foreground">
                        {replaceTemplateFile.name} ({(replaceTemplateFile.size / 1024).toFixed(1)} KB)
                      </p>
                    )}
                  </div>
                  <Button
                    onClick={handleReplaceTemplate}
                    disabled={replaceTemplateMutation.isPending || !replaceTemplateFile}
                    className="w-full"
                  >
                    {replaceTemplateMutation.isPending ? "Replacing..." : "Replace Template"}
                  </Button>
                </div>
              </DialogContent>
            </Dialog>

            {/* Active Templates Table */}
            <Card>
              <CardContent className="p-6">
                <h3 className="text-lg font-semibold mb-4">Active Templates</h3>
                {!templates || templates.length === 0 ? (
                  <div className="text-center py-12 text-muted-foreground">
                    <FileUp className="w-12 h-12 mx-auto mb-4 opacity-50" />
                    <p className="text-lg font-medium">No templates yet</p>
                    <p className="text-sm">Upload a template to make it available on the intake form for your organizations.</p>
                  </div>
                ) : (
                  <table className="w-full border-collapse text-xs" style={{ tableLayout: 'fixed' }}>
                    <colgroup>
                      {isPlatformAdmin && <col style={{ width: '9%' }} />}
                      <col style={{ width: isPlatformAdmin ? '14%' : '16%' }} />
                      <col style={{ width: isPlatformAdmin ? '16%' : '20%' }} />
                      <col style={{ width: '18%' }} />
                      <col style={{ width: '7%'  }} />
                      <col style={{ width: '10%' }} />
                      <col style={{ width: '9%'  }} />
                      <col style={{ width: isPlatformAdmin ? '17%' : '20%' }} />
                    </colgroup>
                    <thead>
                      <tr className="border-b border-border/30 bg-muted/15">
                        {[...(isPlatformAdmin?['Partner']:[]),'Question','Label','File','Size','By','Updated',''].map((h,i)=>(
                          <th key={i} className="text-left px-3 py-2 text-[10px] font-medium text-muted-foreground uppercase tracking-wide">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {templates.map(t => (
                        <tr key={t.id} className="border-b border-border/20 hover:bg-muted/20 transition-colors">
                          {isPlatformAdmin && <td className="px-3 py-1.5 text-muted-foreground truncate">{clientMap[t.clientId] || `#${t.clientId}`}</td>}
                          <td className="px-3 py-1.5 font-mono truncate text-muted-foreground">{t.questionId}</td>
                          <td className="px-3 py-1.5 font-medium truncate">{t.label}</td>
                          <td className="px-3 py-1.5 truncate">
                            <a href={t.fileUrl} download={t.fileName} className="text-primary hover:underline flex items-center gap-1">
                              <Download className="w-3 h-3 shrink-0" /><span className="truncate">{t.fileName}</span>
                            </a>
                          </td>
                          <td className="px-3 py-1.5 text-muted-foreground whitespace-nowrap">{t.fileSize ? `${(t.fileSize/1024).toFixed(0)}K` : '—'}</td>
                          <td className="px-3 py-1.5 text-muted-foreground truncate">{t.uploadedBy || '—'}</td>
                          <td className="px-3 py-1.5 text-muted-foreground whitespace-nowrap">{new Date(t.updatedAt).toLocaleDateString()}</td>
                          <td className="px-2 py-1">
                            <div className="flex gap-1">
                              <a href={t.fileUrl} download={t.fileName}
                                className="flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[10px] border border-border/40 hover:bg-muted/50 transition-colors">
                                <Download className="w-2.5 h-2.5" /> DL
                              </a>
                              <button onClick={() => { setReplaceTemplateId(t.id); setReplaceTemplateLabel(t.label); setReplaceTemplateFile(null); setIsReplaceTemplateDialogOpen(true); }}
                                className="flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[10px] border border-border/40 hover:bg-muted/50 transition-colors">
                                <Upload className="w-2.5 h-2.5" /> Replace
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

            {/* Inactive Templates History */}
            <Card className="mt-6">
              <CardContent className="p-6">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-semibold text-muted-foreground">Inactive Templates History</h3>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setShowInactiveTemplates(!showInactiveTemplates)}
                  >
                    {showInactiveTemplates ? 'Hide' : 'Show'} ({inactiveTemplates?.length || 0})
                  </Button>
                </div>
                {showInactiveTemplates && (
                  <>
                    {!inactiveTemplates || inactiveTemplates.length === 0 ? (
                      <p className="text-sm text-muted-foreground text-center py-4">No inactive templates.</p>
                    ) : (
                      <table className="w-full border-collapse text-xs" style={{ tableLayout: 'fixed' }}>
                        <colgroup>
                          {isPlatformAdmin && <col style={{ width: '9%' }} />}
                          <col style={{ width: '14%' }} /><col style={{ width: '16%' }} />
                          <col style={{ width: '18%' }} /><col style={{ width: '10%' }} />
                          <col style={{ width: '9%'  }} /><col style={{ width: '12%' }} /><col style={{ width: '12%' }} />
                        </colgroup>
                        <thead>
                          <tr className="border-b border-border/30 bg-muted/15">
                            {[...(isPlatformAdmin?['Partner']:[]),'Question','Label','File','By','Created','Deact. By','Deact. At'].map((h,i)=>(
                              <th key={i} className="text-left px-3 py-2 text-[10px] font-medium text-muted-foreground uppercase tracking-wide">{h}</th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {inactiveTemplates.map(t => (
                            <tr key={t.id} className="border-b border-border/20 hover:bg-muted/20 transition-colors opacity-60">
                              {isPlatformAdmin && <td className="px-3 py-1.5 text-muted-foreground truncate">{clientMap[t.clientId]||`#${t.clientId}`}</td>}
                              <td className="px-3 py-1.5 font-mono truncate text-muted-foreground">{t.questionId}</td>
                              <td className="px-3 py-1.5 font-medium truncate">{t.label}</td>
                              <td className="px-3 py-1.5 truncate">
                                <a href={t.fileUrl} download={t.fileName} className="text-muted-foreground hover:underline flex items-center gap-1">
                                  <Download className="w-3 h-3 shrink-0" /><span className="truncate">{t.fileName}</span>
                                </a>
                              </td>
                              <td className="px-3 py-1.5 text-muted-foreground truncate">{t.uploadedBy||'—'}</td>
                              <td className="px-3 py-1.5 text-muted-foreground whitespace-nowrap">{new Date(t.createdAt).toLocaleDateString()}</td>
                              <td className="px-3 py-1.5 text-muted-foreground truncate">{t.deactivatedBy||'—'}</td>
                              <td className="px-3 py-1.5 text-muted-foreground whitespace-nowrap">{t.deactivatedAt?new Date(t.deactivatedAt).toLocaleDateString():'—'}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    )}
                  </>
                )}
              </CardContent>
            </Card>
          </>
    </>
  );
}

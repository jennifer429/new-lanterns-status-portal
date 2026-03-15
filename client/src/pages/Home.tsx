/**
 * Site Dashboard — the main landing page for a specific organization
 * Shows: Architecture Diagram, Connectivity Info (Notion placeholder),
 * Implementation Questionnaire status, Validation Checklist, Implementation Checklist
 */

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  ClipboardList,
  FileText,
  CheckCircle2,
  Circle,
  ExternalLink,
  Download,
  ArrowRight,
  Pencil,
  BookOpen,
  ShieldCheck,
  Wrench,
  Network,
  Image as ImageIcon,
  AlertTriangle,
  Clock,
  ChevronDown,
  ChevronRight,
  Trash2,
} from "lucide-react";

import { Link, useRoute } from "wouter";
import { trpc } from "@/lib/trpc";
import { useEffect, useState } from "react";
import { questionnaireSections } from "@shared/questionnaireData";
import { calculateProgress } from "@shared/progressCalculation";
import { PhiDisclaimer } from "@/components/PhiDisclaimer";

// ── Mock checklist data (summary stats only) ────────────────────────────────
const implementationTasks = [
  { title: "VPN Tunnel Configuration", status: "Complete" },
  { title: "Firewall Rules & Port Openings", status: "Complete" },
  { title: "DICOM Endpoint Testing (Test Env)", status: "Complete" },
  { title: "DICOM Endpoint Testing (Production)", status: "In Progress" },
  { title: "ORM Interface Configuration", status: "Complete" },
  { title: "ORU Interface Configuration", status: "In Progress" },
  { title: "ADT Interface Configuration", status: "Not Started" },
  { title: "HL7 Message Validation", status: "Not Started" },
  { title: "Procedure Code Mapping", status: "Complete" },
  { title: "User Account Provisioning", status: "Not Started" },
  { title: "Worklist Configuration", status: "Not Started" },
  { title: "Report Template Configuration", status: "Not Started" },
  { title: "Full Order-to-Report Workflow Test", status: "Not Started" },
  { title: "Go-Live Readiness Sign-Off", status: "Not Started" },
];

const validationTests = [
  { name: "VPN Tunnel Connectivity", status: "Pass" },
  { name: "DICOM Echo Test (C-ECHO)", status: "Pass" },
  { name: "HL7 Port Connectivity", status: "Pass" },
  { name: "ORM New Order (NW)", status: "Pass" },
  { name: "ORM Cancel Order (CA)", status: "Pass" },
  { name: "ORU Report Delivery", status: "Fail" },
  { name: "ADT Patient Update", status: "Not Tested" },
  { name: "DICOM Store from Modality", status: "Not Tested" },
  { name: "Prior Image Query/Retrieve", status: "Not Tested" },
  { name: "End-to-End Order Workflow", status: "Not Tested" },
  { name: "Radiologist Reading Workflow", status: "Not Tested" },
  { name: "Report Distribution", status: "Not Tested" },
];

// ── Collapsible Section ─────────────────────────────────────────────────────
function CollapsibleSection({
  title,
  icon,
  badge,
  defaultOpen = false,
  children,
}: {
  title: string;
  icon: React.ReactNode;
  badge?: React.ReactNode;
  defaultOpen?: boolean;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <Card className="border-border/50 overflow-hidden">
      <button
        onClick={() => setOpen(!open)}
        className="w-full px-5 py-4 flex items-center justify-between hover:bg-muted/30 transition-colors"
      >
        <div className="flex items-center gap-3">
          {icon}
          <h3 className="text-base font-semibold">{title}</h3>
        </div>
        <div className="flex items-center gap-3">
          {badge}
          {open ? <ChevronDown className="w-5 h-5 text-muted-foreground" /> : <ChevronRight className="w-5 h-5 text-muted-foreground" />}
        </div>
      </button>
      {open && <div className="border-t border-border/40">{children}</div>}
    </Card>
  );
}

// ── Main Component ──────────────────────────────────────────────────────────
export default function Home() {
  const [, params] = useRoute("/org/:slug");
  const orgSlug = params?.slug || "demo";

  // Fetch organization data
  const { data: organization, isLoading: orgLoading } = trpc.organizations.getBySlug.useQuery(
    { slug: orgSlug },
    { enabled: !!orgSlug }
  );

  // Fetch existing responses to calculate real progress
  const { data: existingResponses = [] } = trpc.intake.getResponses.useQuery(
    { organizationSlug: orgSlug },
    { enabled: !!orgSlug }
  );

  // Fetch all uploaded files
  const { data: allFiles = [] } = trpc.intake.getAllUploadedFiles.useQuery(
    { organizationSlug: orgSlug },
    { enabled: !!orgSlug }
  );

  // Fetch New Lantern specifications
  const { data: specs = [] } = trpc.admin.getSpecifications.useQuery();

  // Delete file mutation
  const utils = trpc.useUtils();
  const deleteFileMutation = trpc.intake.deleteFile.useMutation({
    onSuccess: () => {
      utils.intake.getAllUploadedFiles.invalidate({ organizationSlug: orgSlug });
    },
  });

  const handleRemoveDiagram = (fileId: number) => {
    if (window.confirm("Remove this architecture diagram?")) {
      deleteFileMutation.mutate({ fileId, organizationSlug: orgSlug });
    }
  };

  // Build responses map
  const responsesMap: Record<string, string> = {};
  existingResponses.forEach((r: any) => {
    if (r.questionId && r.response) {
      responsesMap[r.questionId] = r.response;
    }
  });

  // Architecture diagram files
  const diagramFiles = allFiles.filter((f: any) => f.questionId === "ARCH.diagram");

  // Flatten all questions from sections
  const allQuestions = questionnaireSections.flatMap((section) => {
    if (section.type === "workflow") {
      return [{ id: section.id + "_config", sectionTitle: section.title, isWorkflow: true, conditionalOn: null }];
    }
    return (section.questions || []).map((q) => ({
      id: q.id,
      sectionTitle: section.title,
      conditionalOn: q.conditionalOn || null,
    }));
  });

  // Use shared progress calculation
  const progress = calculateProgress(allQuestions, existingResponses, allFiles);

  const totalSections = Object.keys(progress.sectionProgress).length;
  const completedSections = Object.values(progress.sectionProgress).filter(
    (section: any) => section.completed === section.total
  ).length;

  // Section progress for display
  const sectionProgress = Object.entries(progress.sectionProgress).map(([name, stats]: [string, any]) => ({
    name,
    isComplete: stats.total > 0 && stats.completed === stats.total,
    completed: stats.completed,
    total: stats.total,
  }));

  // Implementation checklist stats
  const implCompleted = implementationTasks.filter((t) => t.status === "Complete").length;
  const implTotal = implementationTasks.length;

  // Validation stats
  const valPassed = validationTests.filter((t) => t.status === "Pass").length;
  const valFailed = validationTests.filter((t) => t.status === "Fail").length;
  const valTotal = validationTests.length;

  if (orgLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

  const orgName = organization?.name || "Your Organization";

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border/50 bg-card">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-3 sm:py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <img src="/images/new-lantern-logo.png" alt="New Lantern" className="h-10" />
          </div>
          <div className="text-right">
            <div className="text-sm font-medium">{orgName}</div>
            {organization?.clientName && (
              <div className="text-xs text-muted-foreground">{organization.clientName}</div>
            )}
          </div>
        </div>
      </header>

      {/* PHI Disclaimer */}
      <PhiDisclaimer />

      {/* Dashboard Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6 sm:py-8 space-y-6">

        {/* ── Architecture Diagram ── */}
        <CollapsibleSection
          title="Architecture Diagram"
          icon={<ImageIcon className="w-5 h-5 text-primary" />}
          badge={
            diagramFiles.length > 0
              ? <Badge className="bg-green-500/20 text-green-400 border-green-500/30 text-xs">Uploaded</Badge>
              : <Badge variant="outline" className="text-xs text-muted-foreground">Not Uploaded</Badge>
          }
          defaultOpen={true}
        >
          <CardContent className="p-5">
            {diagramFiles.length > 0 ? (
              <div className="space-y-4">
                {diagramFiles.map((file: any) => {
                  const isImage = /\.(png|jpg|jpeg|gif|webp|svg)$/i.test(file.fileName);
                  return (
                    <div key={file.id}>
                      {isImage ? (
                        <div className="border border-border/50 rounded-lg overflow-hidden bg-muted/10">
                          <img
                            src={file.fileUrl}
                            alt={file.fileName}
                            className="w-full max-h-[600px] object-contain"
                          />
                          <div className="flex items-center justify-between px-4 py-2 bg-muted/20 border-t border-border/30">
                            <span className="text-sm text-muted-foreground">{file.fileName}</span>
                            <div className="flex items-center gap-2">
                              <a href={file.fileUrl} download={file.fileName}>
                                <Button size="sm" variant="ghost">
                                  <Download className="w-4 h-4 mr-1" /> Download
                                </Button>
                              </a>
                              <Button
                                size="sm"
                                variant="ghost"
                                className="text-red-400 hover:text-red-300 hover:bg-red-500/10"
                                onClick={() => handleRemoveDiagram(file.id)}
                              >
                                <Trash2 className="w-4 h-4 mr-1" /> Remove
                              </Button>
                            </div>
                          </div>
                        </div>
                      ) : (
                        <div className="flex items-center justify-between p-4 border border-border/50 rounded-lg bg-muted/10">
                          <div className="flex items-center gap-3">
                            <FileText className="w-5 h-5 text-muted-foreground" />
                            <span className="text-sm font-medium">{file.fileName}</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <a href={file.fileUrl} download={file.fileName}>
                              <Button size="sm" variant="ghost">
                                <Download className="w-4 h-4 mr-1" /> Download
                              </Button>
                            </a>
                            <Button
                              size="sm"
                              variant="ghost"
                              className="text-red-400 hover:text-red-300 hover:bg-red-500/10"
                              onClick={() => handleRemoveDiagram(file.id)}
                            >
                              <Trash2 className="w-4 h-4 mr-1" /> Remove
                            </Button>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="text-center py-12 text-muted-foreground">
                <ImageIcon className="w-12 h-12 mx-auto mb-3 opacity-30" />
                <p className="text-sm">No architecture diagram uploaded yet</p>
                <Link href={`/org/${orgSlug}/intake`}>
                  <Button size="sm" variant="outline" className="mt-3">
                    <ArrowRight className="w-4 h-4 mr-2" />
                    Go to Questionnaire to Upload
                  </Button>
                </Link>
              </div>
            )}
          </CardContent>
        </CollapsibleSection>

        {/* ── Connectivity Info (Notion placeholder) ── */}
        <CollapsibleSection
          title="Connectivity Info"
          icon={<Network className="w-5 h-5 text-primary" />}
          badge={<Badge variant="outline" className="text-xs text-muted-foreground">Notion Database</Badge>}
          defaultOpen={false}
        >
          <CardContent className="p-5">
            <div className="text-center py-12 border-2 border-dashed border-border/50 rounded-lg">
              <Network className="w-12 h-12 mx-auto mb-3 text-muted-foreground opacity-30" />
              <p className="text-sm font-medium text-muted-foreground mb-1">Notion Database Integration</p>
              <p className="text-xs text-muted-foreground max-w-md mx-auto">
                This section will display connectivity data (AE Titles, IPs, Ports, Systems) from your Notion database, filtered for this site. Configuration coming soon.
              </p>
            </div>
          </CardContent>
        </CollapsibleSection>

        {/* ── Implementation Questionnaire Status ── */}
        <CollapsibleSection
          title="Implementation Questionnaire"
          icon={<ClipboardList className="w-5 h-5 text-primary" />}
          badge={
            <Badge
              variant="outline"
              className={`text-xs ${
                completedSections === totalSections && totalSections > 0
                  ? "border-green-500/40 text-green-400"
                  : "border-border text-muted-foreground"
              }`}
            >
              {completedSections} of {totalSections} sections
            </Badge>
          }
          defaultOpen={true}
        >
          <CardContent className="p-5">
            <div className="space-y-3 mb-5">
              {sectionProgress.map((section, index) => (
                <div key={index} className="flex items-center justify-between py-2 px-3 rounded-lg bg-muted/20">
                  <div className="flex items-center gap-3 min-w-0">
                    {section.isComplete ? (
                      <CheckCircle2 className="w-5 h-5 text-green-500 shrink-0" />
                    ) : (
                      <Circle className="w-5 h-5 text-muted-foreground shrink-0" />
                    )}
                    <span className="text-sm truncate">{section.name}</span>
                  </div>
                  <span className={`text-xs font-medium shrink-0 ${section.isComplete ? "text-green-400" : "text-muted-foreground"}`}>
                    {section.completed}/{section.total}
                  </span>
                </div>
              ))}
            </div>

            {/* Files summary */}
            {allFiles.length > 0 && (
              <div className="border-t border-border/40 pt-4 mb-4">
                <div className="flex items-center gap-2 mb-2">
                  <FileText className="w-4 h-4 text-muted-foreground" />
                  <span className="text-sm font-medium">{allFiles.length} files uploaded</span>
                </div>
              </div>
            )}

            {/* CTA */}
            <Link href={`/org/${orgSlug}/intake`}>
              <Button className="w-full" variant="outline">
                {completedSections === totalSections && totalSections > 0 ? (
                  <>
                    <Pencil className="w-4 h-4 mr-2" />
                    Review & Edit Responses
                  </>
                ) : (
                  <>
                    <ExternalLink className="w-4 h-4 mr-2" />
                    {progress.completionPercentage === 0 ? "Start Questionnaire" : "Continue Questionnaire"}
                  </>
                )}
              </Button>
            </Link>
          </CardContent>
        </CollapsibleSection>

        {/* ── Validation Checklist ── */}
        <Card className="border-border/50">
          <div className="px-5 py-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <ShieldCheck className="w-5 h-5 text-primary" />
              <h3 className="text-base font-semibold">Validation Checklist</h3>
            </div>
            <div className="flex items-center gap-2">
              {valFailed > 0 && (
                <Badge className="bg-red-500/20 text-red-400 border-red-500/30 text-xs">{valFailed} Failed</Badge>
              )}
              {(() => {
                const notTested = validationTests.filter(t => t.status === "Not Tested").length;
                return (
                  <>
                    <Badge variant="outline" className="text-xs bg-green-500/10 text-green-400 border-green-500/30">{valPassed} Passed</Badge>
                    {notTested > 0 && <Badge variant="outline" className="text-xs text-muted-foreground">{notTested} Pending</Badge>}
                  </>
                );
              })()}
            </div>
          </div>
          <div className="px-5 pb-4">
            <div className="flex gap-1 mb-3">
              {validationTests.map((test, i) => (
                <div
                  key={i}
                  title={test.name}
                  className={`h-2 flex-1 rounded-sm ${
                    test.status === "Pass" ? "bg-green-500" :
                    test.status === "Fail" ? "bg-red-400" :
                    "bg-muted-foreground/20"
                  }`}
                />
              ))}
            </div>
            <p className="text-xs text-muted-foreground mb-3">
              {valPassed} of {valTotal} tests passed{valFailed > 0 ? ` · ${valFailed} failed` : ""}
            </p>
            <Link href={`/org/${orgSlug}/validation`}>
              <Button size="sm" variant="outline" className="w-full">
                <ExternalLink className="w-4 h-4 mr-2" />
                Open Validation Checklist
              </Button>
            </Link>
          </div>
        </Card>

        {/* ── Implementation Checklist ── */}
        <Card className="border-border/50">
          <div className="px-5 py-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Wrench className="w-5 h-5 text-primary" />
              <h3 className="text-base font-semibold">Implementation Checklist</h3>
            </div>
            <Badge
              variant="outline"
              className={`text-xs ${implCompleted === implTotal ? "border-green-500/40 text-green-400" : "border-border text-muted-foreground"}`}
            >
              {implCompleted}/{implTotal} Tasks
            </Badge>
          </div>
          <div className="px-5 pb-4">
            <div className="w-full bg-muted/30 rounded-full h-2 mb-3">
              <div
                className="bg-primary h-2 rounded-full transition-all"
                style={{ width: `${implTotal > 0 ? Math.round((implCompleted / implTotal) * 100) : 0}%` }}
              />
            </div>
            {(() => {
              const inProgress = implementationTasks.filter(t => t.status === "In Progress");
              const blocked = implementationTasks.filter(t => t.status === "Blocked");
              const highlights = [...blocked, ...inProgress].slice(0, 3);
              return highlights.length > 0 ? (
                <div className="space-y-1 mb-3">
                  {highlights.map((task, i) => (
                    <div key={i} className="flex items-center gap-2 text-xs">
                      {task.status === "Blocked"
                        ? <AlertTriangle className="w-3 h-3 text-red-400 shrink-0" />
                        : <Clock className="w-3 h-3 text-amber-400 shrink-0" />
                      }
                      <span className="text-muted-foreground truncate">{task.title}</span>
                    </div>
                  ))}
                </div>
              ) : null;
            })()}
            <Link href={`/org/${orgSlug}/implement`}>
              <Button size="sm" variant="outline" className="w-full">
                <ExternalLink className="w-4 h-4 mr-2" />
                Open Implementation Checklist
              </Button>
            </Link>
          </div>
        </Card>

        {/* ── Specifications ── */}
        {specs.length > 0 && (
          <CollapsibleSection
            title="New Lantern Specifications"
            icon={<BookOpen className="w-5 h-5 text-primary" />}
            badge={<Badge variant="outline" className="text-xs text-muted-foreground">{specs.length} docs</Badge>}
            defaultOpen={false}
          >
            <CardContent className="p-5">
              <div className="space-y-2">
                {specs.map((spec: any) => (
                  <a
                    key={spec.id}
                    href={spec.fileUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center justify-between p-3 rounded-lg border border-border/50 hover:bg-muted/50 transition-colors group"
                  >
                    <div className="flex items-center gap-3">
                      <Download className="w-4 h-4 text-primary group-hover:text-primary/80" />
                      <div>
                        <div className="text-sm font-medium">{spec.title}</div>
                        {spec.description && (
                          <div className="text-xs text-muted-foreground">{spec.description}</div>
                        )}
                      </div>
                    </div>
                    {spec.category && (
                      <span className="text-xs bg-primary/10 text-primary px-2 py-0.5 rounded">{spec.category}</span>
                    )}
                  </a>
                ))}
              </div>
            </CardContent>
          </CollapsibleSection>
        )}

      </div>
    </div>
  );
}

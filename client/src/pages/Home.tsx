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

// ── Status helpers ──────────────────────────────────────────────────────────
function OwnerBadge({ owner }: { owner: string }) {
  const styles: Record<string, string> = {
    Client: "border-blue-500/40 text-blue-300 bg-blue-500/10",
    "New Lantern": "border-primary/40 text-primary bg-primary/10",
    Joint: "border-amber-500/40 text-amber-300 bg-amber-500/10",
  };
  return (
    <Badge variant="outline" className={`text-xs font-medium ${styles[owner] || "border-border text-muted-foreground"}`}>
      {owner}
    </Badge>
  );
}

function StatusBadge({ status }: { status: string }) {
  const styles: Record<string, string> = {
    Complete: "bg-green-500/20 text-green-400 border-green-500/30",
    "In Progress": "bg-amber-500/20 text-amber-400 border-amber-500/30",
    "Not Started": "bg-muted text-muted-foreground border-border",
    Blocked: "bg-red-500/20 text-red-400 border-red-500/30",
    Pass: "bg-green-500/20 text-green-400 border-green-500/30",
    Fail: "bg-red-500/20 text-red-400 border-red-500/30",
    "Not Tested": "bg-muted text-muted-foreground border-border",
    Pending: "bg-amber-500/20 text-amber-400 border-amber-500/30",
  };
  return (
    <Badge variant="outline" className={`text-xs font-medium ${styles[status] || "border-border text-muted-foreground"}`}>
      {status}
    </Badge>
  );
}

// ── Mock checklist data ─────────────────────────────────────────────────────
const implementationTasks = [
  { title: "VPN Tunnel Configuration", owner: "Client", status: "Complete" },
  { title: "Firewall Rules & Port Openings", owner: "Client", status: "Complete" },
  { title: "DICOM Endpoint Testing (Test Env)", owner: "New Lantern", status: "Complete" },
  { title: "DICOM Endpoint Testing (Production)", owner: "Joint", status: "In Progress" },
  { title: "ORM Interface Configuration", owner: "New Lantern", status: "Complete" },
  { title: "ORU Interface Configuration", owner: "New Lantern", status: "In Progress" },
  { title: "ADT Interface Configuration", owner: "New Lantern", status: "Not Started" },
  { title: "HL7 Message Validation", owner: "Joint", status: "Not Started" },
  { title: "Procedure Code Mapping", owner: "New Lantern", status: "Complete" },
  { title: "User Account Provisioning", owner: "New Lantern", status: "Not Started" },
  { title: "Worklist Configuration", owner: "New Lantern", status: "Not Started" },
  { title: "Report Template Configuration", owner: "New Lantern", status: "Not Started" },
  { title: "Full Order-to-Report Workflow Test", owner: "Joint", status: "Not Started" },
  { title: "Go-Live Readiness Sign-Off", owner: "Joint", status: "Not Started" },
];

const validationTests = [
  { name: "VPN Tunnel Connectivity", expected: "Bidirectional ping < 50ms", status: "Pass", signOff: "J. Smith, Mar 18" },
  { name: "DICOM Echo Test (C-ECHO)", expected: "Success from all AE titles", status: "Pass", signOff: "J. Smith, Mar 18" },
  { name: "HL7 Port Connectivity", expected: "ACK received on all ports", status: "Pass", signOff: "J. Smith, Mar 18" },
  { name: "ORM New Order (NW)", expected: "Order in worklist within 5s", status: "Pass", signOff: "A. Chen, Mar 22" },
  { name: "ORM Cancel Order (CA)", expected: "Order removed from worklist", status: "Pass", signOff: "A. Chen, Mar 22" },
  { name: "ORU Report Delivery", expected: "Report delivered within 10s", status: "Fail" },
  { name: "ADT Patient Update", expected: "Demographics updated in PACS", status: "Not Tested" },
  { name: "DICOM Store from Modality", expected: "Images arrive in < 30s", status: "Not Tested" },
  { name: "Prior Image Query/Retrieve", expected: "Priors available within 60s", status: "Not Tested" },
  { name: "End-to-End Order Workflow", expected: "Order → Image → Report", status: "Not Tested" },
  { name: "Radiologist Reading Workflow", expected: "Study opens, report signed", status: "Not Tested" },
  { name: "Report Distribution", expected: "Final report reaches provider", status: "Not Tested" },
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
        <CollapsibleSection
          title="Validation Checklist"
          icon={<ShieldCheck className="w-5 h-5 text-primary" />}
          badge={
            <div className="flex items-center gap-2">
              {valFailed > 0 && (
                <Badge className="bg-red-500/20 text-red-400 border-red-500/30 text-xs">{valFailed} Failed</Badge>
              )}
              <Badge
                variant="outline"
                className={`text-xs ${valPassed === valTotal ? "border-green-500/40 text-green-400" : "border-border text-muted-foreground"}`}
              >
                {valPassed}/{valTotal} Passed
              </Badge>
            </div>
          }
          defaultOpen={false}
        >
          <CardContent className="p-0">
            {/* Column headers */}
            <div className="hidden md:grid grid-cols-[auto_1fr_1fr_80px_1fr] gap-2 px-5 py-2 text-xs text-muted-foreground uppercase tracking-wider border-b border-border/20 bg-muted/10">
              <div className="w-5" />
              <div>Test</div>
              <div>Expected</div>
              <div className="text-center">Result</div>
              <div>Sign-Off</div>
            </div>

            {validationTests.map((test, idx) => {
              const icon =
                test.status === "Pass" ? <CheckCircle2 className="w-4 h-4 text-green-500 shrink-0" /> :
                test.status === "Fail" ? <AlertTriangle className="w-4 h-4 text-red-400 shrink-0" /> :
                <Circle className="w-4 h-4 text-muted-foreground/40 shrink-0" />;

              return (
                <div
                  key={idx}
                  className={`grid grid-cols-1 md:grid-cols-[auto_1fr_1fr_80px_1fr] gap-2 items-center px-5 py-3 ${
                    idx < validationTests.length - 1 ? "border-b border-border/20" : ""
                  } ${test.status === "Pass" ? "opacity-70" : ""}`}
                >
                  {icon}
                  <span className="text-sm font-medium truncate">{test.name}</span>
                  <span className="text-xs text-muted-foreground hidden md:block">{test.expected}</span>
                  <div className="hidden md:flex justify-center">
                    <StatusBadge status={test.status} />
                  </div>
                  <span className="text-xs text-muted-foreground hidden md:block">
                    {test.signOff || (test.status === "Not Tested" ? "Pending" : "-")}
                  </span>
                </div>
              );
            })}
          </CardContent>

          <div className="px-5 py-3 border-t border-border/40">
            <Link href={`/org/${orgSlug}/validation`}>
              <Button size="sm" variant="outline" className="w-full">
                <ExternalLink className="w-4 h-4 mr-2" />
                Open Full Validation Checklist
              </Button>
            </Link>
          </div>
        </CollapsibleSection>

        {/* ── Implementation Checklist ── */}
        <CollapsibleSection
          title="Implementation Checklist"
          icon={<Wrench className="w-5 h-5 text-primary" />}
          badge={
            <Badge
              variant="outline"
              className={`text-xs ${
                implCompleted === implTotal
                  ? "border-green-500/40 text-green-400"
                  : "border-border text-muted-foreground"
              }`}
            >
              {implCompleted}/{implTotal} Tasks
            </Badge>
          }
          defaultOpen={false}
        >
          <CardContent className="p-0">
            {implementationTasks.map((task, idx) => {
              const icon =
                task.status === "Complete" ? <CheckCircle2 className="w-4 h-4 text-green-500 shrink-0" /> :
                task.status === "In Progress" ? <Clock className="w-4 h-4 text-amber-400 shrink-0" /> :
                task.status === "Blocked" ? <AlertTriangle className="w-4 h-4 text-red-400 shrink-0" /> :
                <Circle className="w-4 h-4 text-muted-foreground shrink-0" />;

              return (
                <div
                  key={idx}
                  className={`flex items-center gap-4 px-5 py-3 ${
                    idx < implementationTasks.length - 1 ? "border-b border-border/20" : ""
                  } ${task.status === "Complete" ? "opacity-70" : ""}`}
                >
                  {icon}
                  <span className="flex-1 text-sm font-medium min-w-0 truncate">{task.title}</span>
                  <OwnerBadge owner={task.owner} />
                  <div className="w-24 flex-shrink-0 flex justify-end">
                    <StatusBadge status={task.status} />
                  </div>
                </div>
              );
            })}
          </CardContent>

          <div className="px-5 py-3 border-t border-border/40">
            <Link href={`/org/${orgSlug}/implement`}>
              <Button size="sm" variant="outline" className="w-full">
                <ExternalLink className="w-4 h-4 mr-2" />
                Open Full Implementation Checklist
              </Button>
            </Link>
          </div>
        </CollapsibleSection>

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

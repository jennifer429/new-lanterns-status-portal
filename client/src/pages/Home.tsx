/**
 * Organization Landing Page - Matches Admin Dashboard Card Design
 * Single card layout with progress overview and file list
 * Dynamic messaging based on completion state
 */

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ClipboardList, FileText, TrendingUp, CheckCircle2, Circle, ExternalLink, Download, PartyPopper, ArrowRight, Pencil, BookOpen, ShieldCheck, GraduationCap, Upload, Image } from "lucide-react";
import { Link, useRoute } from "wouter";
import { trpc } from "@/lib/trpc";
import { useEffect, useRef, useState } from "react";
import { questionnaireSections } from "@shared/questionnaireData";
import { calculateProgress } from "@shared/progressCalculation";
import { PhiDisclaimer } from "@/components/PhiDisclaimer";

type HomeTab = "overview" | "validation" | "training";

export default function Home() {
  const [, params] = useRoute("/org/:slug");
  const orgSlug = params?.slug || "demo";
  const [activeTab, setActiveTab] = useState<HomeTab>("overview");
  const [organizationId, setOrganizationId] = useState<number | null>(null);

  // Validation tab state
  const [validationDiagrams, setValidationDiagrams] = useState<{ name: string; url: string; isImage: boolean }[]>([]);
  const validationDiagramRef = useRef<HTMLInputElement>(null);

  // Training tab state
  const [trainingDiagrams, setTrainingDiagrams] = useState<{ name: string; url: string; isImage: boolean }[]>([]);
  const trainingDiagramRef = useRef<HTMLInputElement>(null);

  const handleDiagramUpload = (
    files: FileList | null,
    setter: React.Dispatch<React.SetStateAction<{ name: string; url: string; isImage: boolean }[]>>
  ) => {
    if (!files) return;
    Array.from(files).forEach(file => {
      const url = URL.createObjectURL(file);
      const isImage = file.type.startsWith("image/");
      setter(prev => [...prev, { name: file.name, url, isImage }]);
    });
  };

  // Fetch organization data
  const { data: organization, isLoading: orgLoading } = trpc.organizations.getBySlug.useQuery(
    { slug: orgSlug },
    { enabled: !!orgSlug }
  );

  // Update organizationId when organization loads
  useEffect(() => {
    if (organization) {
      setOrganizationId(organization.id);
    }
  }, [organization]);

  const orgData = {
    name: organization?.name || "Your Organization",
    goalDate: organization?.goalDate || "TBD",
  };

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

  // Fetch New Lantern specifications (available to all authenticated users)
  const { data: specs = [] } = trpc.admin.getSpecifications.useQuery();

  const filesUploaded = allFiles.length;

  // Flatten all questions from sections, including workflow sections
  const allQuestions = questionnaireSections.flatMap(section => {
    if (section.type === 'workflow') {
      return [{
        id: section.id + '_config',
        sectionTitle: section.title,
        isWorkflow: true,
        conditionalOn: null,
      }];
    }
    return (section.questions || []).map(q => ({
      id: q.id,
      sectionTitle: section.title,
      conditionalOn: q.conditionalOn || null,
    }));
  });

  // Use shared progress calculation function
  const progress = calculateProgress(
    allQuestions,
    existingResponses,
    allFiles
  );

  const intakeCompletion = progress.completionPercentage;

  // Calculate completed sections (100% complete)
  const totalSections = Object.keys(progress.sectionProgress).length;
  const completedSections = Object.values(progress.sectionProgress).filter(
    section => section.completed === section.total
  ).length;

  // Convert section progress to array format for display
  const sectionProgress = Object.entries(progress.sectionProgress).map(([name, stats]) => ({
    name,
    progress: stats.total > 0 ? Math.round((stats.completed / stats.total) * 100) : 0
  }));

  // Determine completion state for dynamic messaging
  const isComplete = intakeCompletion === 100;
  const isNotStarted = intakeCompletion === 0;

  // Find the first incomplete section for the CTA
  const firstIncompleteSection = sectionProgress.find(s => s.progress < 100);

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

  return (
    <div className="min-h-screen bg-background">
      {/* Header with Logo */}
      <div className="border-b border-border/50 bg-card">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 py-3 sm:py-4 flex items-center justify-between">
          <img src="/images/new-lantern-logo.png" alt="New Lantern" className="h-10" />
          <div className="text-sm text-muted-foreground">{orgData.name}</div>
        </div>
      </div>

      {/* PHI Disclaimer */}
      <PhiDisclaimer />

      {/* Tab Navigation */}
      <div className="border-b border-border/50 bg-card">
        <div className="max-w-3xl mx-auto px-2 sm:px-6">
          <div className="flex gap-1 sm:gap-6 overflow-x-auto">
            {(["overview", "validation", "training"] as HomeTab[]).map(tab => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`pb-3 pt-3 px-1 sm:px-2 font-medium text-xs sm:text-sm transition-colors relative capitalize flex items-center gap-1 sm:gap-2 whitespace-nowrap ${
                  activeTab === tab
                    ? "text-primary"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {tab === "overview" && <ClipboardList className="w-4 h-4" />}
                {tab === "validation" && <ShieldCheck className="w-4 h-4" />}
                {tab === "training" && <GraduationCap className="w-4 h-4" />}
                {tab.charAt(0).toUpperCase() + tab.slice(1)}
                {activeTab === tab && (
                  <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary" />
                )}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="flex items-center justify-center p-3 sm:p-6">
        <div className="w-full max-w-3xl space-y-4 sm:space-y-6">

          {/* ── OVERVIEW TAB ── */}
          {activeTab === "overview" && (
            <>
              {/* Welcome / Status Banner */}
              {isComplete ? (
                <Card className="border-2 border-green-500/30 bg-gradient-to-r from-green-500/10 to-emerald-500/10">
                  <CardContent className="p-6">
                    <div className="flex items-center gap-4">
                      <div className="rounded-full bg-green-100 dark:bg-green-900/30 p-3 shrink-0">
                        <PartyPopper className="w-8 h-8 text-green-600 dark:text-green-400" />
                      </div>
                      <div>
                        <h2 className="text-lg font-semibold text-green-700 dark:text-green-300">Intake Complete!</h2>
                        <p className="text-sm text-muted-foreground mt-1">
                          All sections have been submitted. The New Lantern team is reviewing your responses and will reach out with next steps. You can still update your answers anytime.
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ) : isNotStarted ? (
                <Card className="border-2 border-blue-500/30 bg-gradient-to-r from-blue-500/10 to-indigo-500/10">
                  <CardContent className="p-6">
                    <div className="flex items-center gap-4">
                      <div className="rounded-full bg-blue-100 dark:bg-blue-900/30 p-3 shrink-0">
                        <ClipboardList className="w-8 h-8 text-blue-600 dark:text-blue-400" />
                      </div>
                      <div>
                        <h2 className="text-lg font-semibold text-blue-700 dark:text-blue-300">Welcome to Your Onboarding Portal</h2>
                        <p className="text-sm text-muted-foreground mt-1">
                          Get started by completing the intake questionnaire below. Your progress is saved automatically as you go.
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ) : (
                <Card className="border-2 border-amber-500/30 bg-gradient-to-r from-amber-500/10 to-orange-500/10">
                  <CardContent className="p-6">
                    <div className="flex items-center gap-4">
                      <div className="rounded-full bg-amber-100 dark:bg-amber-900/30 p-3 shrink-0">
                        <TrendingUp className="w-8 h-8 text-amber-600 dark:text-amber-400" />
                      </div>
                      <div>
                        <h2 className="text-lg font-semibold text-amber-700 dark:text-amber-300">Welcome Back!</h2>
                        <p className="text-sm text-muted-foreground mt-1">
                          You're <span className="font-semibold">{intakeCompletion}%</span> through the intake questionnaire.
                          {firstIncompleteSection && (
                            <> Continue with <span className="font-medium">{firstIncompleteSection.name}</span> to keep going.</>
                          )}
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Main Card */}
              <Card className="border-2 border-primary/30 bg-gradient-to-b from-card to-card/50">
                <CardContent className="p-4 sm:p-8">
                  {/* Header with Organization Name */}
                  <div className="flex items-center justify-between mb-6 sm:mb-8">
                    <div className="flex items-center gap-3">
                      <ClipboardList className="w-6 h-6 sm:w-8 sm:h-8 text-primary" />
                      <h1 className="text-xl sm:text-2xl font-bold truncate">{orgData.name}</h1>
                    </div>
                    {isComplete && <CheckCircle2 className="w-6 h-6 text-green-500" />}
                  </div>

                  {/* Stats Row */}
                  <div className="grid grid-cols-2 gap-3 sm:gap-6 mb-6 sm:mb-8">
                    <div className="flex items-center gap-3">
                      <TrendingUp className="w-5 h-5 text-muted-foreground" />
                      <div>
                        <div className="text-2xl font-bold">{intakeCompletion}%</div>
                        <div className="text-sm text-muted-foreground">Complete</div>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <FileText className="w-5 h-5 text-muted-foreground" />
                      <div>
                        <div className="text-2xl font-bold">{filesUploaded}</div>
                        <div className="text-sm text-muted-foreground">Files Uploaded</div>
                      </div>
                    </div>
                  </div>

                  <div className="border-t border-border/50 pt-6 mb-6">
                    {/* Overall Progress Section */}
                    <div className="mb-6">
                      <h2 className="text-xl font-semibold mb-2">Overall Progress</h2>
                      <p className="text-sm text-muted-foreground mb-4">
                        {completedSections} of {totalSections} sections complete
                      </p>

                      {/* Big Percentage Box */}
                      <div className={`text-center p-5 sm:p-8 rounded-xl border-2 mb-6 ${
                        isComplete
                          ? "bg-gradient-to-br from-green-500/20 to-emerald-500/10 border-green-500/30"
                          : "bg-gradient-to-br from-primary/20 to-primary/10 border-primary/30"
                      }`}>
                        <div className={`text-5xl sm:text-7xl font-bold mb-2 ${isComplete ? "text-green-500" : "text-primary"}`}>
                          {intakeCompletion}%
                        </div>
                        <div className="text-lg text-muted-foreground">
                          {isComplete ? "All Done!" : "Complete"}
                        </div>
                      </div>

                      {/* Section List */}
                      <div className="space-y-3 mb-6">
                        {sectionProgress.map((section, index) => (
                          <div key={index} className="flex items-center justify-between">
                            <div className="flex items-center gap-2 sm:gap-3 min-w-0">
                              {section.progress === 100 ? (
                                <CheckCircle2 className="w-4 h-4 sm:w-5 sm:h-5 text-green-500 shrink-0" />
                              ) : (
                                <Circle className="w-4 h-4 sm:w-5 sm:h-5 text-muted-foreground shrink-0" />
                              )}
                              <span className="text-xs sm:text-sm truncate">{section.name}</span>
                            </div>
                            <span className={`text-sm font-bold ${section.progress === 100 ? "text-green-500" : ""}`}>
                              {section.progress}%
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Uploaded Files Section */}
                    {allFiles.length > 0 && (
                      <div className="border-t border-border/50 pt-6 mb-6">
                        <h3 className="text-base font-semibold mb-3">Uploaded Files:</h3>
                        <div className="space-y-2 max-h-48 overflow-y-auto">
                          {allFiles.map((file) => (
                            <a
                              key={file.id}
                              href={file.fileUrl}
                              download
                              className="flex items-center gap-2 text-sm text-primary hover:underline"
                            >
                              <Download className="w-4 h-4" />
                              <span>{file.fileName}</span>
                            </a>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* New Lantern Specifications Section */}
                    {specs.length > 0 && (
                      <div className="border-t border-border/50 pt-6 mb-6">
                        <div className="flex items-center gap-2 mb-3">
                          <BookOpen className="w-5 h-5 text-primary" />
                          <h3 className="text-base font-semibold">New Lantern Specifications</h3>
                        </div>
                        <p className="text-sm text-muted-foreground mb-3">Reference documents from the New Lantern team.</p>
                        <div className="space-y-2">
                          {specs.map((spec) => (
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
                      </div>
                    )}

                    {/* CTA Buttons */}
                    <div className="space-y-3">
                      {isComplete ? (
                        <>
                          <Link href={`/org/${orgSlug}/intake`}>
                            <Button size="lg" variant="outline" className="w-full text-lg py-6">
                              <Pencil className="w-5 h-5 mr-2" />
                              Review & Edit Responses
                            </Button>
                          </Link>
                          <p className="text-xs text-center text-muted-foreground">
                            Your responses have been submitted. You can still make changes if needed.
                          </p>
                        </>
                      ) : isNotStarted ? (
                        <Link href={`/org/${orgSlug}/intake`}>
                          <Button size="lg" className="w-full text-lg py-6">
                            <ArrowRight className="w-5 h-5 mr-2" />
                            Get Started
                          </Button>
                        </Link>
                      ) : (
                        <Link href={`/org/${orgSlug}/intake`}>
                          <Button size="lg" className="w-full text-lg py-6">
                            <ExternalLink className="w-5 h-5 mr-2" />
                            Continue Questionnaire
                          </Button>
                        </Link>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            </>
          )}

          {/* ── VALIDATION TAB ── */}
          {activeTab === "validation" && (
            <>
              <Card className="border-2 border-purple-500/30 bg-gradient-to-r from-purple-500/10 to-violet-500/10">
                <CardContent className="p-6">
                  <div className="flex items-center gap-4">
                    <div className="rounded-full bg-purple-100 dark:bg-purple-900/30 p-3 shrink-0">
                      <ShieldCheck className="w-8 h-8 text-purple-600 dark:text-purple-400" />
                    </div>
                    <div>
                      <h2 className="text-lg font-semibold text-purple-700 dark:text-purple-300">System Validation</h2>
                      <p className="text-sm text-muted-foreground mt-1">
                        Track qualification and validation milestones. Your technical team can upload diagrams and documentation here.
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Validation Checklist */}
              <Card className="border border-border/50">
                <CardContent className="p-6">
                  <h3 className="text-base font-semibold mb-4 flex items-center gap-2">
                    <ShieldCheck className="w-5 h-5 text-primary" />
                    Validation Checklist
                  </h3>
                  <div className="space-y-3">
                    {[
                      { id: "iq", label: "Installation Qualification (IQ)", description: "Verify system is installed per specifications" },
                      { id: "oq", label: "Operational Qualification (OQ)", description: "Confirm system operates within defined parameters" },
                      { id: "pq", label: "Performance Qualification (PQ)", description: "Validate system performs consistently in production" },
                      { id: "uat", label: "User Acceptance Testing (UAT)", description: "End-user sign-off on workflows and functionality" },
                      { id: "hl7", label: "HL7 Integration Validation", description: "Verify message routing and field mapping" },
                      { id: "dicom", label: "DICOM Connectivity Validation", description: "Confirm image routing and worklist integration" },
                      { id: "signoff", label: "Clinical Sign-Off", description: "Final approval from clinical stakeholders" },
                    ].map(item => (
                      <div key={item.id} className="flex items-start gap-3 p-3 rounded-lg border border-border/40 bg-muted/20">
                        <Circle className="w-5 h-5 text-muted-foreground mt-0.5 shrink-0" />
                        <div className="flex-1 min-w-0">
                          <div className="text-sm font-medium">{item.label}</div>
                          <div className="text-xs text-muted-foreground mt-0.5">{item.description}</div>
                        </div>
                        <Badge variant="outline" className="text-xs shrink-0">Pending</Badge>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>

              {/* Diagram Upload — 3rd Party Tech */}
              <Card className="border border-border/50">
                <CardContent className="p-6">
                  <div className="flex flex-wrap items-center justify-between gap-2 mb-4">
                    <h3 className="text-base font-semibold flex items-center gap-2">
                      <Image className="w-5 h-5 text-primary" />
                      Validation Diagrams
                    </h3>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => validationDiagramRef.current?.click()}
                    >
                      <Upload className="w-4 h-4 mr-2" />
                      Upload Diagram
                    </Button>
                    <input
                      ref={validationDiagramRef}
                      type="file"
                      accept="image/*,.pdf,.png,.jpg,.jpeg,.svg,.drawio"
                      multiple
                      className="hidden"
                      onChange={e => handleDiagramUpload(e.target.files, setValidationDiagrams)}
                    />
                  </div>
                  <p className="text-xs text-muted-foreground mb-4">
                    Your technical team can upload network diagrams, architecture diagrams, and validation documents here.
                  </p>
                  {validationDiagrams.length === 0 ? (
                    <div
                      className="border-2 border-dashed border-border/50 rounded-lg p-8 text-center cursor-pointer hover:border-primary/50 hover:bg-muted/20 transition-colors"
                      onClick={() => validationDiagramRef.current?.click()}
                    >
                      <Image className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
                      <p className="text-sm text-muted-foreground">Drop diagrams here or click to upload</p>
                      <p className="text-xs text-muted-foreground mt-1">PNG, JPG, SVG, PDF supported</p>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {validationDiagrams.map((d, i) => (
                        <div key={i} className="border border-border/50 rounded-lg overflow-hidden">
                          {d.isImage ? (
                            <img src={d.url} alt={d.name} className="w-full max-h-64 object-contain bg-muted/20" />
                          ) : null}
                          <div className="flex items-center gap-2 p-3 bg-muted/20">
                            <FileText className="w-4 h-4 text-muted-foreground shrink-0" />
                            <span className="text-sm flex-1 truncate">{d.name}</span>
                            <a href={d.url} download={d.name}>
                              <Button size="sm" variant="ghost">
                                <Download className="w-4 h-4" />
                              </Button>
                            </a>
                          </div>
                        </div>
                      ))}
                      <Button
                        size="sm"
                        variant="outline"
                        className="w-full"
                        onClick={() => validationDiagramRef.current?.click()}
                      >
                        <Upload className="w-4 h-4 mr-2" />
                        Add More
                      </Button>
                    </div>
                  )}
                </CardContent>
              </Card>
            </>
          )}

          {/* ── TRAINING TAB ── */}
          {activeTab === "training" && (
            <>
              <Card className="border-2 border-teal-500/30 bg-gradient-to-r from-teal-500/10 to-cyan-500/10">
                <CardContent className="p-6">
                  <div className="flex items-center gap-4">
                    <div className="rounded-full bg-teal-100 dark:bg-teal-900/30 p-3 shrink-0">
                      <GraduationCap className="w-8 h-8 text-teal-600 dark:text-teal-400" />
                    </div>
                    <div>
                      <h2 className="text-lg font-semibold text-teal-700 dark:text-teal-300">Training</h2>
                      <p className="text-sm text-muted-foreground mt-1">
                        Track staff training completion and access training materials. Upload training diagrams and resources below.
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Training Completion Checklist */}
              <Card className="border border-border/50">
                <CardContent className="p-6">
                  <h3 className="text-base font-semibold mb-4 flex items-center gap-2">
                    <GraduationCap className="w-5 h-5 text-primary" />
                    Training Completion
                  </h3>
                  <div className="space-y-3">
                    {[
                      { id: "admin-training", label: "System Admin Training", description: "Configuration, user management, system settings" },
                      { id: "radiologist", label: "Radiologist Workflow Training", description: "Reading worklist, reporting, priors access" },
                      { id: "tech-training", label: "Technologist Training", description: "Order entry, image acquisition, routing" },
                      { id: "helpdesk", label: "Help Desk / IT Training", description: "Troubleshooting, escalation procedures" },
                      { id: "superuser", label: "Super User Training", description: "Advanced features, peer training support" },
                    ].map(item => (
                      <div key={item.id} className="flex items-start gap-3 p-3 rounded-lg border border-border/40 bg-muted/20">
                        <Circle className="w-5 h-5 text-muted-foreground mt-0.5 shrink-0" />
                        <div className="flex-1 min-w-0">
                          <div className="text-sm font-medium">{item.label}</div>
                          <div className="text-xs text-muted-foreground mt-0.5">{item.description}</div>
                        </div>
                        <Badge variant="outline" className="text-xs shrink-0">Not Started</Badge>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>

              {/* Training Materials & Diagrams */}
              <Card className="border border-border/50">
                <CardContent className="p-6">
                  <div className="flex flex-wrap items-center justify-between gap-2 mb-4">
                    <h3 className="text-base font-semibold flex items-center gap-2">
                      <Image className="w-5 h-5 text-primary" />
                      Training Materials & Diagrams
                    </h3>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => trainingDiagramRef.current?.click()}
                    >
                      <Upload className="w-4 h-4 mr-2" />
                      Upload
                    </Button>
                    <input
                      ref={trainingDiagramRef}
                      type="file"
                      accept="image/*,.pdf,.png,.jpg,.jpeg,.svg"
                      multiple
                      className="hidden"
                      onChange={e => handleDiagramUpload(e.target.files, setTrainingDiagrams)}
                    />
                  </div>
                  <p className="text-xs text-muted-foreground mb-4">
                    Upload workflow diagrams, training guides, and reference materials for your team.
                  </p>
                  {trainingDiagrams.length === 0 ? (
                    <div
                      className="border-2 border-dashed border-border/50 rounded-lg p-8 text-center cursor-pointer hover:border-primary/50 hover:bg-muted/20 transition-colors"
                      onClick={() => trainingDiagramRef.current?.click()}
                    >
                      <GraduationCap className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
                      <p className="text-sm text-muted-foreground">Drop training materials here or click to upload</p>
                      <p className="text-xs text-muted-foreground mt-1">PNG, JPG, SVG, PDF supported</p>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {trainingDiagrams.map((d, i) => (
                        <div key={i} className="border border-border/50 rounded-lg overflow-hidden">
                          {d.isImage ? (
                            <img src={d.url} alt={d.name} className="w-full max-h-64 object-contain bg-muted/20" />
                          ) : null}
                          <div className="flex items-center gap-2 p-3 bg-muted/20">
                            <FileText className="w-4 h-4 text-muted-foreground shrink-0" />
                            <span className="text-sm flex-1 truncate">{d.name}</span>
                            <a href={d.url} download={d.name}>
                              <Button size="sm" variant="ghost">
                                <Download className="w-4 h-4" />
                              </Button>
                            </a>
                          </div>
                        </div>
                      ))}
                      <Button
                        size="sm"
                        variant="outline"
                        className="w-full"
                        onClick={() => trainingDiagramRef.current?.click()}
                      >
                        <Upload className="w-4 h-4 mr-2" />
                        Add More
                      </Button>
                    </div>
                  )}
                </CardContent>
              </Card>
            </>
          )}

        </div>
      </div>
    </div>
  );
}

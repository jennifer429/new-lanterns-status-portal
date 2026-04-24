import { useState, useEffect, useRef } from "react";
import { useLocation } from "wouter";
import { useOrgParams } from "@/hooks/useOrgParams";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Loader2, Shield, Ban } from "lucide-react";
import { toast } from "sonner";
import { questionnaireSections } from "@shared/questionnaireData";
import { WorkflowDiagram } from "@/components/WorkflowDiagram";
import { IntegrationWorkflows } from "@/components/IntegrationWorkflows";
import { ConnectivityTable } from "@/components/ConnectivityTable";
import { useIntakeData } from "@/hooks/useIntakeData";
import { IntakeSidebar } from "./intake/IntakeSidebar";
import { IntakeHeader } from "./intake/IntakeHeader";
import { ArchitectureOverview } from "./intake/ArchitectureOverview";
import { QuestionRenderer } from "./intake/QuestionRenderer";
import { FeedbackModal } from "./intake/FeedbackModal";
import { ImportDialog } from "./intake/ImportDialog";
import { MobileBottomNav } from "./intake/MobileBottomNav";

export default function IntakeNewRedesign() {
  const { clientSlug, slug } = useOrgParams("intake");
  const [, setLocation] = useLocation();

  // ── UI state ─────────────────────────────────────────────────────────────────
  const [currentSection, setCurrentSection] = useState<string>(() => {
    const params = new URLSearchParams(window.location.search);
    const s = params.get("section");
    return s && questionnaireSections.find((sec) => sec.id === s) ? s : "org-info";
  });
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [unansweredQuestions, setUnansweredQuestions] = useState<Set<string>>(new Set());
  const [showFeedbackModal, setShowFeedbackModal] = useState(false);
  const [feedbackRating, setFeedbackRating] = useState(0);
  const [feedbackComments, setFeedbackComments] = useState("");
  const [importDialogOpen, setImportDialogOpen] = useState(false);
  const [importFile, setImportFile] = useState<File | null>(null);
  const [isImporting, setIsImporting] = useState(false);
  const hasNavigatedRef = useRef(false);

  // ── Data hook ─────────────────────────────────────────────────────────────────
  const {
    org,
    orgLoading,
    existingResponses,
    responses,
    setResponses,
    setSaveStatus,
    fileCount,
    allUploadedFiles,
    connRows,
    dbTemplateMap,
    uploadedFilesMap,
    naQuestions,
    uploadingFiles,
    saveMutation,
    submitFeedbackMutation,
    deleteMutation,
    handleFileUpload,
    handleExportData,
    handleImportFile,
    handleConnChange,
    toggleQuestionNa,
    calculateSectionProgress,
    user,
  } = useIntakeData(slug, clientSlug);

  // ── Deep-link / auto-navigate effects ────────────────────────────────────────
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const sectionParam = params.get("section");
    const questionParam = params.get("q");
    if (sectionParam) {
      const validSection = questionnaireSections.find((s) => s.id === sectionParam);
      if (validSection) {
        hasNavigatedRef.current = true;
        if (questionParam) {
          setTimeout(() => {
            const el = document.getElementById(`question-${questionParam}`);
            if (el) {
              el.scrollIntoView({ behavior: "smooth", block: "center" });
              el.classList.add("ring-2", "ring-primary", "ring-offset-2", "ring-offset-background", "rounded-lg");
              setTimeout(() => {
                el.classList.remove("ring-2", "ring-primary", "ring-offset-2", "ring-offset-background", "rounded-lg");
              }, 3000);
            }
          }, 500);
        }
      }
    }
  }, []);

  useEffect(() => {
    const urlSection = new URLSearchParams(window.location.search).get("section");
    if (hasNavigatedRef.current || Object.keys(responses).length === 0 || urlSection) return;
    const firstIncompleteSection = questionnaireSections.find(
      (section) => calculateSectionProgress(section) < 100
    );
    if (firstIncompleteSection) {
      setCurrentSection(firstIncompleteSection.id);
    }
    hasNavigatedRef.current = true;
  }, [responses]);

  // ── Derived section info ──────────────────────────────────────────────────────
  const currentSectionData = questionnaireSections.find((s) => s.id === currentSection);
  const currentSectionIndex = questionnaireSections.findIndex((s) => s.id === currentSection);
  const isLastSection = currentSectionIndex === questionnaireSections.length - 1;

  // ── Next / navigation handler ─────────────────────────────────────────────────
  const handleNext = async () => {
    if (currentSectionData?.type === "workflow") {
      const configKey = currentSectionData.id + "_config";
      const savedConfig = responses[configKey];
      let isValid = false;
      let errorMessage = "Please select at least one workflow path";
      if (savedConfig) {
        try {
          const config = typeof savedConfig === "string" ? JSON.parse(savedConfig) : savedConfig;
          const selectedPathKeys = Object.keys(config.paths || {}).filter((key) => config.paths[key]);
          if (selectedPathKeys.length > 0) {
            const workflowsRequiringSystemNames = ["priors-workflow", "reports-out-workflow"];
            if (!workflowsRequiringSystemNames.includes(currentSectionData.id)) {
              isValid = true;
            } else {
              const pathToSystemKeyMap: Record<string, string> = {
                priorsPush: "priorsPushSource",
                priorsQuery: "priorsQuerySource",
                reportsToPortal: "reportsPortalDestination",
              };
              const missingSystems = selectedPathKeys.filter((pathKey) => {
                const systemKey = pathToSystemKeyMap[pathKey];
                if (!systemKey) return false;
                const systemValue = config.systems?.[systemKey];
                return !systemValue || systemValue.trim() === "";
              });
              if (missingSystems.length > 0) {
                errorMessage = "Please fill in system names for all selected workflow paths";
              } else {
                isValid = true;
              }
            }
          }
        } catch {
          errorMessage = "Invalid workflow configuration";
        }
      }
      if (!isValid) {
        toast.error(errorMessage);
        return;
      }
      if (!isLastSection) {
        setCurrentSection(questionnaireSections[currentSectionIndex + 1].id);
      } else {
        setShowFeedbackModal(true);
      }
      return;
    }

    // Check for unanswered questions in current section
    const currentQuestions = currentSectionData?.questions || [];
    const unanswered = currentQuestions
      .filter((q) => {
        if (naQuestions.has(q.id)) return false;
        if (q.conditionalOn) {
          const parentResponse = responses[q.conditionalOn.questionId];
          if (parentResponse !== q.conditionalOn.value) return false;
        }
        if (q.type === "upload" || q.type === "upload-download") {
          return !uploadedFilesMap.has(q.id) || uploadedFilesMap.get(q.id) === 0;
        }
        return !responses[q.id] || responses[q.id] === "";
      })
      .map((q) => q.id);

    if (unanswered.length > 0) {
      setUnansweredQuestions(new Set(unanswered));
      const firstUnanswered = document.querySelector(`[data-question-id="${unanswered[0]}"]`);
      firstUnanswered?.scrollIntoView({ behavior: "smooth", block: "center" });
      return;
    }

    setUnansweredQuestions(new Set());
    try {
      setSaveStatus("saving");
      const savePromises = Object.entries(responses).map(([questionId, value]) =>
        saveMutation.mutateAsync({
          organizationSlug: slug,
          questionId,
          response: typeof value === "object" ? JSON.stringify(value) : String(value),
          userEmail: user?.email || "",
        })
      );
      await Promise.all(savePromises);
      setSaveStatus("saved");
    } catch (error) {
      console.error("Failed to save responses:", error);
      toast.error("Failed to save responses. Please try again.");
      return;
    }

    if (!isLastSection) {
      setCurrentSection(questionnaireSections[currentSectionIndex + 1].id);
    } else {
      setShowFeedbackModal(true);
    }
  };

  // ── Loading state ─────────────────────────────────────────────────────────────
  if (orgLoading || existingResponses === undefined) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  // ── Render ────────────────────────────────────────────────────────────────────
  return (
    <div
      className="min-h-screen flex"
      style={{
        background: "linear-gradient(135deg, #1a0b2e 0%, #2d1b4e 50%, #1a0b2e 100%)",
      }}
    >
      {/* Mobile sidebar backdrop */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/60 md:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Left Sidebar */}
      <IntakeSidebar
        clientSlug={clientSlug}
        slug={slug}
        sidebarOpen={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
        currentSection={currentSection}
        onSectionChange={setCurrentSection}
        calculateSectionProgress={calculateSectionProgress}
        fileCount={fileCount}
      />

      {/* Main Content */}
      <div className="flex-1 flex flex-col bg-transparent">
        {/* Header + breadcrumb + stats banner */}
        <IntakeHeader
          slug={slug}
          clientSlug={clientSlug}
          orgName={org?.name}
          orgClientName={org?.clientName ?? undefined}
          onOpenSidebar={() => setSidebarOpen(true)}
          onExport={handleExportData}
          onOpenImport={() => setImportDialogOpen(true)}
          calculateSectionProgress={calculateSectionProgress}
          fileCount={fileCount}
        />

        {/* Section Content */}
        <div className="flex-1 overflow-y-auto p-3 pb-20 sm:pb-8 md:p-8">
          <Card className="max-w-6xl mx-auto bg-black/40 backdrop-blur-sm border-purple-500/20">
            <div className="p-4 md:p-8">
              {/* Integration Workflows section — renders its own header */}
              {currentSectionData?.type === "integration-workflows" ? (
                <IntegrationWorkflows
                  values={responses}
                  onChange={(key, value) => {
                    setResponses((prev) => ({ ...prev, [key]: value }));
                    if (slug && user?.email) {
                      saveMutation.mutate({
                        organizationSlug: slug,
                        questionId: key,
                        response:
                          typeof value === "object" ? JSON.stringify(value) : String(value),
                        userEmail: user.email,
                      });
                    }
                  }}
                  organizationId={org?.id ?? 0}
                  onBack={() => setLocation(clientSlug ? `/org/${clientSlug}/${slug}` : `/org/${slug}`)}
                  onContinue={() => {
                    const idx = questionnaireSections.findIndex((s) => s.id === currentSection);
                    if (idx < questionnaireSections.length - 1) {
                      setCurrentSection(questionnaireSections[idx + 1].id);
                    } else {
                      setShowFeedbackModal(true);
                    }
                  }}
                />
              ) : (
                <>
                  {/* Section Header */}
                  <div className="mb-6">
                    <h2 className="text-2xl font-bold mb-2">{currentSectionData?.title}</h2>
                    {currentSectionData?.description && (
                      <p className="text-sm mb-2 text-muted-foreground">
                        {currentSectionData.description}
                      </p>
                    )}
                    {currentSectionData?.questions &&
                      currentSectionData?.type !== "architecture-overview" && (
                        <div className="flex items-center gap-4 text-sm text-muted-foreground mt-1">
                          <span>
                            {Math.round(
                              (calculateSectionProgress(currentSectionData) / 100) *
                                currentSectionData.questions.filter((q) => !q.inactive).length
                            )}
                            /
                            {
                              currentSectionData.questions.filter((q) => !q.inactive).length
                            }{" "}
                            questions answered
                          </span>
                        </div>
                      )}
                    {currentSectionData?.id === "connectivity" && (
                      <p className="text-xs text-yellow-400/80 mt-1.5 flex items-center gap-1.5">
                        <Shield className="w-3.5 h-3.5 flex-shrink-0" />
                        <span>
                          De-identify all files before uploading. Do not share PHI or patient data.
                        </span>
                      </p>
                    )}
                  </div>

                  {/* Questions Grid / Workflow Diagram / Architecture Overview / Connectivity Table */}
                  {currentSectionData?.type === "architecture-overview" ? (
                    <ArchitectureOverview
                      slug={slug}
                      diagramFiles={allUploadedFiles.filter((f) => f.questionId === "ARCH.diagram")}
                      isDiagramUploading={uploadingFiles.has("ARCH.diagram")}
                      onDiagramUpload={(file) => handleFileUpload("ARCH.diagram", file)}
                      onDiagramDelete={(fileId) =>
                        deleteMutation.mutate({ organizationSlug: slug, fileId })
                      }
                      systemsJson={responses["ARCH.systems"]}
                      onSystemsChange={(json) => {
                        setResponses((prev) => ({ ...prev, "ARCH.systems": json }));
                        if (slug && user?.email) {
                          saveMutation.mutate({
                            organizationSlug: slug,
                            questionId: "ARCH.systems",
                            response: json,
                            userEmail: user.email,
                          });
                        }
                      }}
                    />
                  ) : currentSectionData?.type === "connectivity-table" ? (
                    <div className="mt-6 space-y-8">
                      {/* Render D.1 and other standard questions first */}
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 md:gap-x-8 gap-y-5 md:gap-y-6">
                        {currentSectionData?.questions
                          ?.filter((question) => {
                            if (question.inactive) return false;
                            if (question.type === "upload" || question.type === "upload-download")
                              return false;
                            if (question.conditionalOn) {
                              const parentResponse = responses[question.conditionalOn.questionId];
                              if (parentResponse !== question.conditionalOn.value) return false;
                            }
                            return true;
                          })
                          .map((question) => {
                            const isNa = naQuestions.has(question.id);
                            return (
                              <div
                                key={question.id}
                                id={`question-${question.id}`}
                                className={`${question.type === "textarea" ? "col-span-1 md:col-span-2" : "col-span-1"} ${isNa ? "opacity-60" : ""}`}
                              >
                                <div className="flex items-start justify-between gap-2 mb-3">
                                  <Label className="block text-base flex-1">
                                    <span className="text-purple-400 font-bold mr-2">
                                      [{question.id}]
                                    </span>
                                    {isNa ? (
                                      <span className="line-through">{question.text}</span>
                                    ) : (
                                      question.text
                                    )}
                                    {isNa && (
                                      <Badge className="ml-2 bg-amber-500/20 text-amber-400 border-amber-500/30 text-xs">
                                        <Ban className="w-3 h-3 mr-1" />
                                        N/A
                                      </Badge>
                                    )}
                                  </Label>
                                  <Button
                                    type="button"
                                    variant={isNa ? "default" : "outline"}
                                    size="sm"
                                    className={`shrink-0 text-xs h-7 px-2 ${isNa ? "bg-amber-600 hover:bg-amber-700 text-white" : "text-muted-foreground hover:text-foreground"}`}
                                    onClick={() => toggleQuestionNa(question.id)}
                                  >
                                    <Ban className="w-3 h-3 mr-1" />
                                    {isNa ? "Undo N/A" : "N/A"}
                                  </Button>
                                </div>
                                {!isNa && (
                                  <QuestionRenderer
                                    question={question}
                                    responses={responses}
                                    setResponses={setResponses}
                                    uploadingFiles={uploadingFiles}
                                    allUploadedFiles={allUploadedFiles}
                                    dbTemplateMap={dbTemplateMap}
                                    onFileUpload={handleFileUpload}
                                    onFileDelete={(fileId) =>
                                      deleteMutation.mutate({ organizationSlug: slug, fileId })
                                    }
                                    slug={slug}
                                    isFileDeleting={deleteMutation.isPending}
                                  />
                                )}
                                {!isNa && question.notes && (
                                  <p className="text-xs text-muted-foreground mt-1">
                                    {question.notes}
                                  </p>
                                )}
                              </div>
                            );
                          })}
                      </div>

                      {/* Endpoint Table */}
                      <div className="space-y-1">
                        <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
                          Network Endpoints
                        </h3>
                        <ConnectivityTable
                          rows={connRows}
                          systems={(() => {
                            try {
                              const v = responses["ARCH.systems"];
                              if (!v) return [];
                              return typeof v === "string" ? JSON.parse(v) : v;
                            } catch {
                              return [];
                            }
                          })()}
                          onChange={handleConnChange}
                        />
                      </div>

                      {/* File uploads section */}
                      <div className="space-y-3">
                        <div className="flex items-center gap-2">
                          <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
                            Configuration File Uploads
                          </h3>
                          <div className="flex items-center gap-1 text-xs text-muted-foreground/70">
                            <Shield className="w-3 h-3 flex-shrink-0" />
                            <span>De-identify files before uploading</span>
                          </div>
                        </div>
                        <div className="grid grid-cols-1 gap-y-3">
                          {currentSectionData?.questions
                            ?.filter(
                              (q) => q.type === "upload" || q.type === "upload-download"
                            )
                            .map((question) => {
                              const isNa = naQuestions.has(question.id);
                              return (
                                <div
                                  key={question.id}
                                  id={`question-${question.id}`}
                                  className={`p-3 rounded-md bg-muted/30 border border-border/40 col-span-1 ${isNa ? "opacity-60" : ""}`}
                                >
                                  <div className="flex items-start justify-between gap-2 mb-2">
                                    <Label className="block text-sm flex-1">
                                      <span className="text-muted-foreground font-mono text-xs mr-1.5">
                                        [{question.id}]
                                      </span>
                                      {isNa ? (
                                        <span className="line-through">{question.text}</span>
                                      ) : (
                                        question.text
                                      )}
                                      {isNa && (
                                        <Badge className="ml-2 bg-amber-500/20 text-amber-400 border-amber-500/30 text-xs">
                                          <Ban className="w-3 h-3 mr-1" />
                                          N/A
                                        </Badge>
                                      )}
                                    </Label>
                                    <Button
                                      type="button"
                                      variant={isNa ? "default" : "outline"}
                                      size="sm"
                                      className={`shrink-0 text-xs h-7 px-2 ${isNa ? "bg-amber-600 hover:bg-amber-700 text-white" : "text-muted-foreground hover:text-foreground"}`}
                                      onClick={() => toggleQuestionNa(question.id)}
                                    >
                                      <Ban className="w-3 h-3 mr-1" />
                                      {isNa ? "Undo N/A" : "N/A"}
                                    </Button>
                                  </div>
                                  {!isNa && question.notes && (
                                    <p className="text-xs text-muted-foreground mb-2">
                                      {question.notes}
                                    </p>
                                  )}
                                  {!isNa && (
                                    <QuestionRenderer
                                      question={question}
                                      responses={responses}
                                      setResponses={setResponses}
                                      uploadingFiles={uploadingFiles}
                                      allUploadedFiles={allUploadedFiles}
                                      dbTemplateMap={dbTemplateMap}
                                      onFileUpload={handleFileUpload}
                                      onFileDelete={(fileId) =>
                                        deleteMutation.mutate({ organizationSlug: slug, fileId })
                                      }
                                      slug={slug}
                                      isFileDeleting={deleteMutation.isPending}
                                    />
                                  )}
                                </div>
                              );
                            })}
                        </div>
                      </div>
                    </div>
                  ) : currentSectionData?.type === "workflow" ? (
                    <div className="mt-6">
                      <WorkflowDiagram
                        workflowType={currentSectionData.workflowType as any}
                        configuration={(() => {
                          const configKey = currentSectionData.id + "_config";
                          const savedConfig = responses[configKey];
                          if (!savedConfig) return { paths: {}, systems: {}, notes: {} };
                          if (typeof savedConfig === "string") {
                            try {
                              return JSON.parse(savedConfig);
                            } catch {
                              return { paths: {}, systems: {}, notes: {} };
                            }
                          }
                          return savedConfig;
                        })()}
                        onConfigurationChange={(config) => {
                          console.log(
                            "[Workflow Debug] Configuration changed:",
                            currentSectionData.id,
                            config
                          );
                          console.log(
                            "[Workflow Debug] slug:",
                            slug,
                            "user.email:",
                            user?.email
                          );
                          setResponses((prev) => ({
                            ...prev,
                            [currentSectionData.id + "_config"]: JSON.stringify(config),
                          }));
                          if (slug && user?.email) {
                            console.log(
                              "[Workflow Debug] Calling save mutation for:",
                              currentSectionData.id + "_config"
                            );
                            saveMutation.mutate(
                              {
                                organizationSlug: slug,
                                questionId: currentSectionData.id + "_config",
                                response: JSON.stringify(config),
                                userEmail: user.email,
                              },
                              {
                                onSuccess: () => {
                                  console.log(
                                    "[Workflow Debug] Save successful for:",
                                    currentSectionData.id + "_config"
                                  );
                                },
                                onError: (error) => {
                                  console.error("[Workflow Debug] Save failed:", error);
                                },
                              }
                            );
                          } else {
                            console.warn(
                              "[Workflow Debug] Cannot save - missing slug or user.email"
                            );
                          }
                        }}
                      />
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 md:gap-x-8 gap-y-5 md:gap-y-6">
                      {currentSectionData?.questions
                        ?.filter((question) => {
                          if (question.inactive) return false;
                          if (question.conditionalOn) {
                            const parentResponse =
                              responses[question.conditionalOn.questionId];
                            if (parentResponse !== question.conditionalOn.value) return false;
                          }
                          return true;
                        })
                        .map((question) => {
                          const isUnanswered = unansweredQuestions.has(question.id);
                          const isUploadType =
                            question.type === "upload" ||
                            question.type === "upload-download";
                          const isNa = naQuestions.has(question.id);

                          return (
                            <div
                              key={question.id}
                              data-question-id={question.id}
                              id={`question-${question.id}`}
                              className={`${
                                question.type === "textarea" ||
                                question.type === "contacts-table" ||
                                isUploadType
                                  ? "col-span-1 md:col-span-2"
                                  : "col-span-1"
                              } ${
                                isUnanswered
                                  ? "p-4 border-2 border-red-500 rounded-lg bg-red-500/5"
                                  : ""
                              } ${
                                isUploadType && !isUnanswered
                                  ? "p-3 rounded-md bg-muted/30 border border-border/40"
                                  : ""
                              } ${isNa ? "opacity-60" : ""}`}
                            >
                              <div className="flex items-start justify-between gap-2 mb-2">
                                <Label className="block text-sm flex-1">
                                  <span className="text-muted-foreground font-mono text-xs mr-1.5">
                                    [{question.id}]
                                  </span>
                                  {isNa ? (
                                    <span className="line-through">{question.text}</span>
                                  ) : (
                                    question.text
                                  )}
                                  {isUnanswered && (
                                    <span className="text-red-500 ml-2 font-semibold">
                                      * Required
                                    </span>
                                  )}
                                  {isNa && (
                                    <Badge className="ml-2 bg-amber-500/20 text-amber-400 border-amber-500/30 text-xs">
                                      <Ban className="w-3 h-3 mr-1" />
                                      N/A
                                    </Badge>
                                  )}
                                </Label>
                                <Button
                                  type="button"
                                  variant={isNa ? "default" : "outline"}
                                  size="sm"
                                  className={`shrink-0 text-xs h-7 px-2 ${
                                    isNa
                                      ? "bg-amber-600 hover:bg-amber-700 text-white"
                                      : "text-muted-foreground hover:text-foreground"
                                  }`}
                                  onClick={() => toggleQuestionNa(question.id)}
                                >
                                  <Ban className="w-3 h-3 mr-1" />
                                  {isNa ? "Undo N/A" : "N/A"}
                                </Button>
                              </div>
                              {!isNa && question.notes && isUploadType && (
                                <p className="text-xs text-muted-foreground mb-3">
                                  {question.notes}
                                </p>
                              )}
                              {!isNa && (
                                <QuestionRenderer
                                  question={question}
                                  responses={responses}
                                  setResponses={setResponses}
                                  uploadingFiles={uploadingFiles}
                                  allUploadedFiles={allUploadedFiles}
                                  dbTemplateMap={dbTemplateMap}
                                  onFileUpload={handleFileUpload}
                                  onFileDelete={(fileId) =>
                                    deleteMutation.mutate({
                                      organizationSlug: slug,
                                      fileId,
                                    })
                                  }
                                  slug={slug}
                                  isFileDeleting={deleteMutation.isPending}
                                />
                              )}
                              {!isNa && question.notes && !isUploadType && (
                                <p className="text-xs text-muted-foreground mt-1">
                                  {question.notes}
                                </p>
                              )}
                            </div>
                          );
                        })}
                    </div>
                  )}

                  {/* Bottom Buttons */}
                  <div className="flex items-center justify-between border-t mt-8 pt-6">
                    <Button
                      variant="outline"
                      onClick={() => setLocation(`/org/${clientSlug}/${slug}`)}
                    >
                      Back to Overview
                    </Button>
                    <Button onClick={handleNext}>
                      {isLastSection ? "Complete" : "Save & Continue"}
                    </Button>
                  </div>
                </>
              )}
            </div>
          </Card>
        </div>
      </div>

      {/* Feedback Modal */}
      <FeedbackModal
        open={showFeedbackModal}
        onOpenChange={setShowFeedbackModal}
        rating={feedbackRating}
        onRatingChange={setFeedbackRating}
        comments={feedbackComments}
        onCommentsChange={setFeedbackComments}
        onSkip={() => {
          setShowFeedbackModal(false);
          setLocation(
            clientSlug ? `/org/${clientSlug}/${slug}/complete` : `/org/${slug}/complete`
          );
        }}
        onSubmit={() => {
          submitFeedbackMutation.mutate({
            organizationSlug: slug,
            rating: feedbackRating,
            comments: feedbackComments || undefined,
          });
        }}
        isSubmitting={submitFeedbackMutation.isPending}
      />

      {/* Import Dialog */}
      <ImportDialog
        open={importDialogOpen}
        onOpenChange={setImportDialogOpen}
        importFile={importFile}
        onFileChange={setImportFile}
        onImport={() =>
          importFile &&
          handleImportFile(
            importFile,
            () => {
              setImportDialogOpen(false);
              setImportFile(null);
            },
            setIsImporting
          )
        }
        isImporting={isImporting}
      />

      {/* Mobile sticky bottom nav */}
      <MobileBottomNav
        currentSectionIndex={currentSectionIndex}
        isLastSection={isLastSection}
        onPrev={() =>
          setCurrentSection(questionnaireSections[currentSectionIndex - 1].id)
        }
        onNext={() =>
          setCurrentSection(questionnaireSections[currentSectionIndex + 1].id)
        }
      />
    </div>
  );
}

/**
 * Site Dashboard — rich command-center view for a specific organization.
 * Shows: 3 expandable resource cards (Connectivity, Architecture, Specs),
 * overall progress hero, workflow phase cards.
 * Designed to fit in a single viewport without scrolling.
 */

import { useRoute, useLocation } from "wouter";
import { useState, useEffect } from "react";
import { PhiDisclaimer } from "@/components/PhiDisclaimer";
import { UserMenu } from "@/components/UserMenu";
import { useAuth } from "@/_core/hooks/useAuth";
import { InlineChatPanel } from "@/components/InlineChatPanel";
import { useHomeData } from "@/hooks/useHomeData";

import { DiagramLightbox } from "./home/DiagramLightbox";
import { ConnectivityCard } from "./home/ConnectivityCard";
import { ArchitectureCard } from "./home/ArchitectureCard";
import { SpecificationsCard } from "./home/SpecificationsCard";
import { ProgressHero } from "./home/ProgressHero";
import { AdminExportActions } from "./home/AdminExportActions";
import { QuestionnairePhaseCard } from "./home/QuestionnairePhaseCard";
import { TestingPhaseCard } from "./home/TestingPhaseCard";
import { TaskListPhaseCard } from "./home/TaskListPhaseCard";
import { DocumentsCard } from "./home/DocumentsCard";
import { EmailPreviewDialog } from "./home/EmailPreviewDialog";

export default function Home() {
  const [, paramsNew] = useRoute("/org/:clientSlug/:slug");
  const [, paramsOld] = useRoute("/org/:slug");
  const orgSlug = paramsNew?.slug || paramsOld?.slug || "demo";
  const clientSlug = paramsNew?.clientSlug || "";
  const [, setLocation] = useLocation();
  const { user: currentUser } = useAuth();

  // UI state — expand/lightbox/dialog toggles only
  const [connectivityOpen, setConnectivityOpen] = useState(false);
  const [architectureOpen, setArchitectureOpen] = useState(false);
  const [specsOpen, setSpecsOpen] = useState(false);
  const [adhocOpen, setAdhocOpen] = useState(false);
  const [lightboxSrc, setLightboxSrc] = useState<{ src: string; alt: string } | null>(null);
  const [emailPreviewOpen, setEmailPreviewOpen] = useState(false);

  const data = useHomeData(orgSlug);

  // Redirect legacy /org/:slug URLs to canonical /org/:clientSlug/:slug
  useEffect(() => {
    if (!clientSlug && data.organization?.clientSlug) {
      setLocation(`/org/${data.organization.clientSlug}/${orgSlug}`, { replace: true });
    }
  }, [clientSlug, data.organization?.clientSlug, orgSlug, setLocation]);

  if (data.orgLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center space-y-3">
          <div className="animate-spin rounded-full h-10 w-10 border-2 border-primary border-t-transparent mx-auto" />
          <p className="text-sm text-muted-foreground">Loading dashboard...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background animate-page-in">
      {/* Lightbox overlay */}
      {lightboxSrc && (
        <DiagramLightbox
          src={lightboxSrc.src}
          alt={lightboxSrc.alt}
          onClose={() => setLightboxSrc(null)}
        />
      )}

      {/* ── Glass Header ── */}
      <header className="header-glass sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-3 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 min-w-0">
            <img src="/images/new-lantern-logo.png" alt="New Lantern" className="h-8 flex-shrink-0" />
            <div className="hidden sm:block border-l border-border/40 pl-3 min-w-0">
              <div className="text-sm font-bold tracking-tight truncate">Site Dashboard</div>
              {data.orgName && (
                <div className="text-xs text-muted-foreground truncate">
                  {data.orgName}{data.partnerName ? ` · ${data.partnerName}` : ""}
                </div>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2">
            <UserMenu />
          </div>
        </div>
      </header>

      <PhiDisclaimer />

      {/* Dashboard Content */}
      <div className="max-w-7xl mx-auto px-3 sm:px-5 py-2 space-y-2">

        {/* ── AI Assistant (admin only) ── */}
        {currentUser?.role === "admin" && (
          <InlineChatPanel isPlatformAdmin={!currentUser?.clientId} orgSlug={orgSlug} />
        )}

        {/* ── TOP ROW: 3 Expandable Resource Cards ── */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
          <ConnectivityCard
            clientSlug={clientSlug}
            orgSlug={orgSlug}
            connRows={data.connRows}
            onConnChange={data.handleConnChange}
            connSaving={data.connSaving}
            connectivityLoading={data.connectivityLoading}
            open={connectivityOpen}
            onToggle={() => setConnectivityOpen(o => !o)}
          />
          <ArchitectureCard
            clientSlug={clientSlug}
            orgSlug={orgSlug}
            diagramFiles={data.diagramFiles}
            open={architectureOpen}
            onToggle={() => setArchitectureOpen(o => !o)}
            onLightbox={(src, alt) => setLightboxSrc({ src, alt })}
            onRemoveDiagram={data.handleRemoveDiagram}
          />
          <SpecificationsCard
            clientSlug={clientSlug}
            orgSlug={orgSlug}
            specs={data.specs}
            specsByCategory={data.specsByCategory}
            allFiles={data.allFiles}
            open={specsOpen}
            onToggle={() => setSpecsOpen(o => !o)}
          />
        </div>

        {/* ── PROGRESS HERO (full width) ── */}
        <ProgressHero
          overallPct={data.overallPct}
          activePhase={data.activePhase}
          completedSections={data.completedSections}
          totalSections={data.totalSections}
          qPct={data.qPct}
          qDone={data.qDone}
          valCompleted={data.valCompleted}
          valApplicable={data.valApplicable}
          vPct={data.vPct}
          implCompleted={data.implCompleted}
          implApplicable={data.implApplicable}
          iPct={data.iPct}
          allFilesCount={data.allFiles.length}
          diagramFilesCount={data.diagramFiles.length}
        />

        {/* ── EXPORT ACTIONS (admin only) ── */}
        {currentUser?.role === "admin" && (
          <AdminExportActions
            orgSlug={orgSlug}
            onEmailPreviewOpen={() => setEmailPreviewOpen(true)}
          />
        )}

        {/* ── WORKFLOW PHASE CARDS ── */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
          <QuestionnairePhaseCard
            clientSlug={clientSlug}
            orgSlug={orgSlug}
            completedSections={data.completedSections}
            totalSections={data.totalSections}
            qInProgressSections={data.qInProgressSections}
            qNotStartedSections={data.qNotStartedSections}
            naQuestions={data.progress.naQuestions}
            nextUpSections={data.nextUpSections}
            activePhase={data.activePhase}
          />
          <TestingPhaseCard
            clientSlug={clientSlug}
            orgSlug={orgSlug}
            valTotal={data.valTotal}
            valCompleted={data.valCompleted}
            valNaCount={data.valNaCount}
            valFailedCount={data.valFailedCount}
            valInProgressCount={data.valInProgressCount}
            valBlockedCount={data.valBlockedCount}
            valNotTestedCount={data.valNotTestedCount}
            nextUpTests={data.nextUpTests}
            activePhase={data.activePhase}
            VAL_PHASES={data.VAL_PHASES}
          />
          <TaskListPhaseCard
            clientSlug={clientSlug}
            orgSlug={orgSlug}
            iPct={data.iPct}
            implCompleted={data.implCompleted}
            implApplicable={data.implApplicable}
            implInProgressCount={data.implInProgressCount}
            implBlockedCount={data.implBlockedCount}
            implNaCount={data.implNaCount}
            implOpenCount={data.implOpenCount}
            nextUpTasks={data.nextUpTasks}
            activePhase={data.activePhase}
          />
        </div>

        {/* ── DOCUMENTS & NOTES ── */}
        <DocumentsCard
          orgSlug={orgSlug}
          open={adhocOpen}
          onToggle={() => setAdhocOpen(o => !o)}
          adhocFilesList={data.adhocFilesList}
          adhocFiles={data.adhocFiles}
          setAdhocFiles={data.setAdhocFiles}
          adhocUploading={data.adhocUploading}
          notesLabel={data.notesLabel}
          setNotesLabel={data.setNotesLabel}
          notesCustomLabel={data.notesCustomLabel}
          setNotesCustomLabel={data.setNotesCustomLabel}
          onFileSelect={data.handleAdhocFileSelect}
          onUpload={data.handleAdhocUpload}
          onDeleteNote={(noteId) => data.deleteNoteMutation.mutate({ noteId })}
        />

        {/* Bottom spacer */}
        <div className="h-2" />
      </div>

      {/* ── EMAIL PREVIEW DIALOG ── */}
      <EmailPreviewDialog
        open={emailPreviewOpen}
        onOpenChange={setEmailPreviewOpen}
      />
    </div>
  );
}

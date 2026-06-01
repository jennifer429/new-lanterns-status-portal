/**
 * Site Dashboard — rich command-center view for a specific organization.
 * Shows: 3 expandable resource cards (Connectivity, Architecture, Specs),
 * overall progress hero, workflow phase cards.
 * Designed to fit in a single viewport without scrolling.
 */

import { useRoute, useLocation, Link } from "wouter";
import { useState, useEffect } from "react";
import { LayoutDashboard, ClipboardList, FlaskConical, ListChecks, FolderOpen, RefreshCw } from "lucide-react";
import { cn } from "@/lib/utils";
import { trpc } from "@/lib/trpc";
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
  const activePhase = data.activePhase as
    | "questionnaire"
    | "testing"
    | "implementation";

  // Top-bar refresh — invalidate all queries so the dashboard re-pulls.
  const utils = trpc.useUtils();
  const [refreshing, setRefreshing] = useState(false);
  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      await utils.invalidate();
    } finally {
      setTimeout(() => setRefreshing(false), 600);
    }
  };

  // Horizontal nav — always build both slugs (see CLAUDE.md slug rules).
  const orgBase = `/org/${clientSlug}/${orgSlug}`;
  const navItems = [
    { label: "Dashboard", href: orgBase, icon: LayoutDashboard, active: true },
    { label: "Questionnaire", href: `${orgBase}/intake`, icon: ClipboardList, active: false },
    { label: "Testing", href: `${orgBase}/validation`, icon: FlaskConical, active: false },
    { label: "Tasks", href: `${orgBase}/implement`, icon: ListChecks, active: false },
    { label: "Documents", href: `${orgBase}/library`, icon: FolderOpen, active: false },
  ];

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

      {/* ── Top bar ── */}
      <header className="header-glass sticky top-0 z-50">
        <div className="max-w-[1180px] mx-auto px-4 sm:px-6 h-[60px] flex items-center gap-4">
          {/* Logo + org */}
          <div className="flex items-center gap-3 min-w-0">
            <img src="/images/new-lantern-logo.png" alt="New Lantern" className="h-7 flex-shrink-0" />
            <div className="hidden md:block border-l border-border pl-3 min-w-0">
              <div className="text-sm font-bold tracking-tight truncate leading-tight">
                {data.orgName || "Site Dashboard"}
              </div>
              {data.partnerName && (
                <div className="text-[11px] text-muted-foreground truncate leading-tight">
                  {data.partnerName} · Implementation Portal
                </div>
              )}
            </div>
          </div>

          {/* Center nav (desktop) */}
          <nav className="hidden lg:flex items-center gap-1 mx-auto">
            {navItems.map((item) => (
              <Link key={item.label} href={item.href}>
                <span
                  className={cn(
                    "flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-colors",
                    item.active
                      ? "bg-primary/15 text-primary"
                      : "text-muted-foreground hover:text-foreground hover:bg-muted/40"
                  )}
                >
                  <item.icon className="w-4 h-4" />
                  {item.label}
                </span>
              </Link>
            ))}
          </nav>

          {/* Right cluster */}
          <div className="flex items-center gap-1.5 ml-auto lg:ml-0">
            <span className="hidden sm:flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] text-muted-foreground">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
              Synced · just now
            </span>
            <button
              onClick={handleRefresh}
              title="Refresh"
              className="p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted/40 transition-colors"
            >
              <RefreshCw className={cn("w-4 h-4", refreshing && "animate-spin")} />
            </button>
            <UserMenu />
          </div>
        </div>

        {/* Mobile nav strip */}
        <nav className="lg:hidden flex items-center gap-1 px-3 pb-2 overflow-x-auto border-t border-border/60">
          {navItems.map((item) => (
            <Link key={item.label} href={item.href}>
              <span
                className={cn(
                  "flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs font-medium whitespace-nowrap transition-colors",
                  item.active
                    ? "bg-primary/15 text-primary"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                <item.icon className="w-3.5 h-3.5" />
                {item.label}
              </span>
            </Link>
          ))}
        </nav>
      </header>

      <PhiDisclaimer />

      {/* Dashboard Content */}
      <div className="max-w-[1180px] mx-auto px-4 sm:px-6 py-5 space-y-3.5">

        {/* ── AI Assistant (admin only) ── */}
        {currentUser?.role === "admin" && (
          <InlineChatPanel isPlatformAdmin={!currentUser?.clientId} orgSlug={orgSlug} />
        )}

        {/* ── TOP ROW: 3 Expandable Resource Cards ── */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3.5">
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
          activePhase={activePhase}
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
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3.5">
          <QuestionnairePhaseCard
            clientSlug={clientSlug}
            orgSlug={orgSlug}
            completedSections={data.completedSections}
            totalSections={data.totalSections}
            qInProgressSections={data.qInProgressSections}
            qNotStartedSections={data.qNotStartedSections}
            naQuestions={data.progress.naQuestions}
            nextUpSections={data.nextUpSections}
            activePhase={activePhase}
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
            activePhase={activePhase}
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
            activePhase={activePhase}
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

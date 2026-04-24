/**
 * SwimlaneView — Static PM Coordination Tracker
 *
 * 5 phases × 5 party rows. One card per cell.
 * Vendor display names pulled from ARCH.systems questionnaire data.
 */

import { useState, useMemo } from "react";
import { cn } from "@/lib/utils";
import { X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { trpc } from "@/lib/trpc";

// ── Types ──────────────────────────────────────────────────────────────────

type Status = "open" | "in_progress" | "done" | "blocked" | "n_a";
type PartyId = "hospital" | "ehr" | "pacs" | "partner" | "nl";
type PhaseId = "questionnaire" | "connectivity" | "implementation" | "golive" | "golive_support";

interface Party {
  id: PartyId;
  label: string;
  badge: string;
  badgeColor: string;
}

interface Phase {
  id: PhaseId;
  title: string;
}

interface MilestoneCard {
  id: string;
  line1: string;
  line2: string;
  party: PartyId;
  phase: PhaseId;
  status: Status;
  blocker: string;
  followUp: string;
  notes: string;
}

// ── Reference data ─────────────────────────────────────────────────────────

const PARTIES: Party[] = [
  { id: "hospital", label: "Health Care Org",   badge: "hospital",  badgeColor: "bg-sky-500/20 text-sky-400 border-sky-500/30" },
  { id: "ehr",      label: "EHR / RIS Vendor",  badge: "ehr / ris", badgeColor: "bg-cyan-500/20 text-cyan-400 border-cyan-500/30" },
  { id: "pacs",     label: "PACS Vendor",        badge: "pacs",      badgeColor: "bg-indigo-500/20 text-indigo-400 border-indigo-500/30" },
  { id: "partner",  label: "Partner",            badge: "partner",   badgeColor: "bg-violet-500/20 text-violet-400 border-violet-500/30" },
  { id: "nl",       label: "New Lantern",        badge: "new lantern", badgeColor: "bg-purple-500/20 text-purple-400 border-purple-500/30" },
];

const PHASES: Phase[] = [
  { id: "questionnaire",    title: "Questionnaire" },
  { id: "connectivity",     title: "Connectivity" },
  { id: "implementation",   title: "Data Implementation" },
  { id: "golive",           title: "Go-Live Pre-Prod Tasks" },
  { id: "golive_support",   title: "Go-Live" },
];

// ── Cards ──────────────────────────────────────────────────────────────────

const CARDS: MilestoneCard[] = [
  // Health Care Org
  { id: "h1", line1: "Complete questionnaire",    line2: "workflows",                            party: "hospital", phase: "questionnaire",  status: "done",        blocker: "", followUp: "", notes: "" },
  { id: "h2", line1: "Enable VPN access",         line2: "",                                     party: "hospital", phase: "connectivity",   status: "in_progress", blocker: "", followUp: "", notes: "" },
  { id: "h3", line1: "Generate tech sheets &",    line2: "place orders for workflows",           party: "hospital", phase: "implementation", status: "open",        blocker: "", followUp: "", notes: "" },
  { id: "h4", line1: "Resolve network issues",    line2: "",                                     party: "hospital", phase: "golive",         status: "open",        blocker: "", followUp: "", notes: "" },
  { id: "h5", line1: "Troubleshoot studies",      line2: "& workflows",                          party: "hospital", phase: "golive_support", status: "open",        blocker: "", followUp: "", notes: "" },

  // EHR / RIS Vendor
  { id: "e1", line1: "Complete questionnaire",    line2: "orders & results",                     party: "ehr", phase: "questionnaire",  status: "done",        blocker: "", followUp: "", notes: "" },
  { id: "e2", line1: "Deliver endpoint details",  line2: "",                                     party: "ehr", phase: "connectivity",   status: "in_progress", blocker: "", followUp: "", notes: "" },
  { id: "e3", line1: "Implement HL7 interface,",  line2: "resolve errors, share reports",        party: "ehr", phase: "implementation", status: "open",        blocker: "", followUp: "", notes: "" },
  { id: "e4", line1: "Confirm feed ready",        line2: "",                                     party: "ehr", phase: "golive",         status: "open",        blocker: "", followUp: "", notes: "" },
  { id: "e5", line1: "Troubleshoot results,",     line2: "worklist & orders",                    party: "ehr", phase: "golive_support", status: "open",        blocker: "", followUp: "", notes: "" },

  // PACS Vendor
  { id: "p1", line1: "Complete questionnaire",    line2: "DICOM workflows",                      party: "pacs", phase: "questionnaire",  status: "in_progress", blocker: "", followUp: "", notes: "" },
  { id: "p2", line1: "Deliver DICOM routing",     line2: "",                                     party: "pacs", phase: "connectivity",   status: "open",        blocker: "", followUp: "", notes: "" },
  { id: "p3", line1: "Validate image flow",       line2: "live & comparison",                    party: "pacs", phase: "implementation", status: "open",        blocker: "", followUp: "", notes: "" },
  { id: "p4", line1: "Confirm DICOM ready",       line2: "",                                     party: "pacs", phase: "golive",         status: "open",        blocker: "", followUp: "", notes: "" },
  { id: "p5", line1: "Troubleshoot DICOM",        line2: "issues",                               party: "pacs", phase: "golive_support", status: "open",        blocker: "", followUp: "", notes: "" },

  // Partner
  { id: "d1", line1: "Diagram solution",          line2: "",                                     party: "partner", phase: "questionnaire",  status: "done",        blocker: "", followUp: "", notes: "" },
  { id: "d2", line1: "Submit VPN form,",          line2: "configure router & firewall",          party: "partner", phase: "connectivity",   status: "in_progress", blocker: "", followUp: "", notes: "" },
  { id: "d3", line1: "Support validation",        line2: "",                                     party: "partner", phase: "implementation", status: "open",        blocker: "", followUp: "", notes: "" },
  { id: "d4", line1: "Confirm connectivity",      line2: "stable",                               party: "partner", phase: "golive",         status: "open",        blocker: "", followUp: "", notes: "" },
  { id: "d5", line1: "Troubleshoot connectivity",  line2: "& processing errors",                  party: "partner", phase: "golive_support", status: "open",        blocker: "", followUp: "", notes: "" },

  // New Lantern
  { id: "n1", line1: "Lead questionnaire",        line2: "discovery",                            party: "nl", phase: "questionnaire",  status: "done",        blocker: "", followUp: "", notes: "" },
  { id: "n2", line1: "Confirm routing",           line2: "& ports",                              party: "nl", phase: "connectivity",   status: "in_progress", blocker: "", followUp: "", notes: "" },
  { id: "n3", line1: "Lead data validation",      line2: "",                                     party: "nl", phase: "implementation", status: "open",        blocker: "", followUp: "", notes: "" },
  { id: "n4", line1: "Lead launch prep",          line2: "",                                     party: "nl", phase: "golive",         status: "open",        blocker: "", followUp: "", notes: "" },
  { id: "n5", line1: "Monitor data processing",   line2: "& support users",                      party: "nl", phase: "golive_support", status: "open",        blocker: "", followUp: "", notes: "" },
];

// ── Status styling ─────────────────────────────────────────────────────────

const STATUS_CARD: Record<Status, { bg: string; border: string; text: string; subtext: string }> = {
  done:        { bg: "bg-emerald-500",  border: "border-emerald-400/50", text: "text-white",              subtext: "text-emerald-100" },
  in_progress: { bg: "bg-amber-500",    border: "border-amber-400/50",   text: "text-amber-950",          subtext: "text-amber-900/80" },
  open:        { bg: "bg-slate-800",    border: "border-slate-600/50",   text: "text-slate-100",          subtext: "text-slate-400" },
  blocked:     { bg: "bg-red-600",      border: "border-red-400/50",     text: "text-white",              subtext: "text-red-100" },
  n_a:         { bg: "bg-slate-800/50", border: "border-slate-700/40",   text: "text-slate-500",          subtext: "text-slate-600" },
};

const STATUS_DOT: Record<Status, string> = {
  done: "bg-emerald-400",
  in_progress: "bg-amber-400",
  open: "bg-muted-foreground/40",
  blocked: "bg-red-400",
  n_a: "bg-muted-foreground/20",
};

const STATUS_LABEL: Record<Status, string> = {
  done: "Done",
  in_progress: "In Progress",
  open: "Open",
  blocked: "Blocked",
  n_a: "N/A",
};

// ── Props ────────────────────────────────────────────────────────────────

interface SwimlaneViewProps {
  organizationSlug: string;
  taskMap: Record<string, {
    completed: boolean;
    notApplicable: boolean;
    inProgress: boolean;
    blocked: boolean;
    completedAt: Date | null;
    owner: string | null;
    targetDate: string | null;
    notes: string | null;
  }>;
}

// ── Component ──────────────────────────────────────────────────────────────

export function SwimlaneView({ organizationSlug }: SwimlaneViewProps) {
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const { data: vendorNames } = trpc.swimlane.getVendorNames.useQuery(
    { organizationSlug },
    { enabled: !!organizationSlug }
  );

  const cells = useMemo(() => {
    const map: Record<string, MilestoneCard> = {};
    for (const c of CARDS) map[`${c.party}:${c.phase}`] = c;
    return map;
  }, []);

  const selectedCard = selectedId ? CARDS.find(c => c.id === selectedId) ?? null : null;

  return (
    <div className="space-y-3">
      {/* Status legend */}
      <div className="flex items-center gap-4 text-xs">
        {(["open", "in_progress", "done", "blocked"] as Status[]).map(s => (
          <div key={s} className="flex items-center gap-1.5">
            <div className={cn("w-2.5 h-2.5 rounded-full", STATUS_DOT[s])} />
            <span className="text-muted-foreground">{STATUS_LABEL[s]}</span>
          </div>
        ))}
      </div>

      {/* Swimlane grid */}
      <div className="overflow-x-auto">
        <div className="min-w-[860px]">
          {/* Phase column headers */}
          <div
            className="grid gap-1"
            style={{ gridTemplateColumns: `170px repeat(${PHASES.length}, 1fr)` }}
          >
            <div className="px-2 py-2 text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
              Organization
            </div>
            {PHASES.map(phase => (
              <div key={phase.id} className="px-2 py-2 text-center">
                <div className="text-[11px] font-semibold text-foreground">{phase.title}</div>
              </div>
            ))}
          </div>

          {/* Party rows */}
          {PARTIES.map((party, rowIdx) => {
            const displayName = vendorNames?.[party.id] ?? "";

            return (
              <div
                key={party.id}
                className={cn(
                  "grid gap-1 border-t border-border/30",
                  rowIdx % 2 === 0 ? "bg-muted/5" : "bg-transparent"
                )}
                style={{ gridTemplateColumns: `170px repeat(${PHASES.length}, 1fr)` }}
              >
                {/* Row label */}
                <div className="px-2 py-2 flex items-center gap-2">
                  <Badge
                    variant="outline"
                    className={cn("text-[9px] whitespace-nowrap shrink-0", party.badgeColor)}
                  >
                    {party.badge}
                  </Badge>
                  <span className="text-[11px] font-medium text-foreground/70 leading-tight truncate" title={displayName || party.label}>
                    {displayName}
                  </span>
                </div>

                {/* Phase cells */}
                {PHASES.map(phase => {
                  const key = `${party.id}:${phase.id}`;
                  const card = cells[key];
                  if (!card) return <div key={key} className="px-0.5 py-1 min-h-[48px]" />;

                  const style = STATUS_CARD[card.status];
                  const isSelected = selectedId === card.id;

                  return (
                    <div key={key} className="px-0.5 py-1 min-h-[48px]">
                      <button
                        onClick={() => setSelectedId(isSelected ? null : card.id)}
                        className={cn(
                          "w-full rounded-md border px-2 py-1.5 text-left transition-all",
                          style.bg, style.border,
                          isSelected && "ring-2 ring-primary",
                          "hover:brightness-110 cursor-pointer",
                        )}
                      >
                        <div className={cn("text-[11px] font-semibold leading-snug", style.text)}>
                          {card.line1}
                        </div>
                        {card.line2 && (
                          <div className={cn("text-[10px] leading-snug mt-0.5", style.subtext)}>
                            {card.line2}
                          </div>
                        )}
                      </button>
                    </div>
                  );
                })}
              </div>
            );
          })}
        </div>
      </div>

      {/* Edit Panel */}
      {selectedCard && (
        <div className="fixed top-0 right-0 h-full w-[340px] bg-card border-l border-border shadow-2xl z-50 flex flex-col animate-in slide-in-from-right duration-200">
          <div className="flex items-center justify-between px-5 py-4 border-b border-border">
            <h2 className="text-base font-bold text-foreground">Edit Milestone</h2>
            <button
              onClick={() => setSelectedId(null)}
              className="w-8 h-8 flex items-center justify-center rounded-md hover:bg-muted text-muted-foreground hover:text-foreground"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
          <div className="flex-1 overflow-y-auto px-5 py-4 space-y-5">
            <PanelField label="Task" value={`${selectedCard.line1} ${selectedCard.line2}`.trim()} />
            <PanelField label="Owner">
              <div className="flex items-center gap-2 mt-1">
                {(() => {
                  const p = PARTIES.find(pp => pp.id === selectedCard.party);
                  return p ? (
                    <>
                      <Badge variant="outline" className={cn("text-[10px]", p.badgeColor)}>{p.badge}</Badge>
                      <span className="text-sm text-foreground">{p.label}</span>
                    </>
                  ) : null;
                })()}
              </div>
            </PanelField>
            <PanelField label="Status">
              <div className="flex items-center gap-2 mt-1">
                <span className={cn("w-2.5 h-2.5 rounded-full", STATUS_DOT[selectedCard.status])} />
                <span className="text-sm text-foreground">{STATUS_LABEL[selectedCard.status]}</span>
              </div>
            </PanelField>
            <PanelField label="Phase" value={PHASES.find(p => p.id === selectedCard.phase)?.title ?? ""} />
            <PanelField label="Blocker" value={selectedCard.blocker || "None"} />
            <PanelField label="Next Follow-up" value={selectedCard.followUp || "—"} />
            <PanelField label="Notes" value={selectedCard.notes || "—"} />
          </div>
          <div className="px-5 py-4 border-t border-border">
            <button
              onClick={() => setSelectedId(null)}
              className="w-full py-2.5 rounded-lg bg-red-600 hover:bg-red-500 text-sm font-semibold text-white transition-colors"
            >
              Save Changes
            </button>
          </div>
        </div>
      )}

      <div className="text-center text-xs text-muted-foreground pt-1">
        Click any milestone to edit details, change status, or add comments.
      </div>
    </div>
  );
}

function PanelField({ label, value, children }: { label: string; value?: string; children?: React.ReactNode }) {
  return (
    <div>
      <div className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">{label}</div>
      {children ?? <div className="mt-1 text-sm text-foreground">{value}</div>}
    </div>
  );
}

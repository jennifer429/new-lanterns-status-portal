/**
 * SwimlaneView — Static PM Coordination Tracker
 *
 * "This is a coordination tracker, not an integration teaching tool."
 *
 * 5 phases × 6 party rows (no Rad Group — they know what they do).
 * Bold saturated status-colored card backgrounds matching the portal theme.
 * Silverback system box in Scipiotech & Data First Connectivity cell.
 * Edit panel slide-out on card click.
 * Vendor display names pulled from ARCH.systems questionnaire data.
 * No drag/drop, no assignment dropdowns — purely static.
 */

import { useState, useMemo } from "react";
import { cn } from "@/lib/utils";
import { X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { trpc } from "@/lib/trpc";

// ── Types ──────────────────────────────────────────────────────────────────

type Status = "open" | "in_progress" | "done" | "blocked" | "n_a";

type PartyId = "hospital" | "ehr" | "ris" | "pacs" | "df" | "nl";

type PhaseId = "discovery" | "connectivity" | "datafeed" | "prodconfig" | "golive";

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
  owner: PartyId;
  party: PartyId;
  phase: PhaseId;
  status: Status;
  blocker: string;
  followUp: string;
  notes: string;
}

// ── Reference data ─────────────────────────────────────────────────────────

const PARTIES: Party[] = [
  { id: "hospital", label: "Hospital IT",              badge: "hospital",     badgeColor: "bg-sky-500/20 text-sky-400 border-sky-500/30" },
  { id: "ehr",      label: "EHR Vendor",               badge: "ehr vendor",   badgeColor: "bg-cyan-500/20 text-cyan-400 border-cyan-500/30" },
  { id: "ris",      label: "RIS Vendor",               badge: "ris vendor",   badgeColor: "bg-teal-500/20 text-teal-400 border-teal-500/30" },
  { id: "pacs",     label: "PACS/VNA Vendor",          badge: "pacs vendor",  badgeColor: "bg-indigo-500/20 text-indigo-400 border-indigo-500/30" },
  { id: "df",       label: "Scipiotech & Data First",  badge: "scipiotech",   badgeColor: "bg-violet-500/20 text-violet-400 border-violet-500/30" },
  { id: "nl",       label: "New Lantern",              badge: "new lantern",  badgeColor: "bg-purple-500/20 text-purple-400 border-purple-500/30" },
];

const PHASES: Phase[] = [
  { id: "discovery",   title: "Discovery" },
  { id: "connectivity", title: "Connectivity" },
  { id: "datafeed",    title: "Data Feed Testing" },
  { id: "prodconfig",  title: "Production Configuration" },
  { id: "golive",      title: "Go Live" },
];

// ── Default cards from the PM prompt ───────────────────────────────────────

const CARDS: MilestoneCard[] = [
  // Hospital IT
  { id: "h1", line1: "Complete site &",           line2: "connectivity questionnaire",     owner: "hospital", party: "hospital", phase: "discovery",    status: "done",        blocker: "", followUp: "", notes: "" },
  { id: "h2", line1: "Work with Scipiotech",      line2: "on VPN/firewall",                owner: "hospital", party: "hospital", phase: "connectivity", status: "in_progress", blocker: "", followUp: "", notes: "" },
  { id: "h3", line1: "Confirm production",        line2: "access works",                   owner: "hospital", party: "hospital", phase: "datafeed",     status: "open",        blocker: "", followUp: "", notes: "" },
  { id: "h4", line1: "Available for access",      line2: "& network issues",               owner: "hospital", party: "hospital", phase: "prodconfig",   status: "open",        blocker: "", followUp: "", notes: "" },
  { id: "h5", line1: "Support hospital-side",     line2: "network/access",                 owner: "hospital", party: "hospital", phase: "golive",       status: "open",        blocker: "", followUp: "", notes: "" },

  // EHR Vendor
  { id: "e1", line1: "Confirm EHR",               line2: "interface needs",                owner: "ehr", party: "ehr", phase: "discovery",    status: "done",        blocker: "", followUp: "", notes: "" },
  { id: "e2", line1: "Provide endpoint /",        line2: "feed details",                   owner: "ehr", party: "ehr", phase: "connectivity", status: "in_progress", blocker: "", followUp: "", notes: "" },
  { id: "e3", line1: "Validate EHR",              line2: "data / messages",                owner: "ehr", party: "ehr", phase: "datafeed",     status: "open",        blocker: "", followUp: "", notes: "" },
  { id: "e4", line1: "Confirm production",        line2: "feed readiness",                 owner: "ehr", party: "ehr", phase: "prodconfig",   status: "open",        blocker: "", followUp: "", notes: "" },
  { id: "e5", line1: "Support EHR-side",          line2: "issues",                         owner: "ehr", party: "ehr", phase: "golive",       status: "open",        blocker: "", followUp: "", notes: "" },

  // RIS Vendor
  { id: "r1", line1: "Confirm order/result",      line2: "status workflow",                owner: "ris", party: "ris", phase: "discovery",    status: "done",        blocker: "", followUp: "", notes: "" },
  { id: "r2", line1: "Provide RIS",               line2: "interface details",              owner: "ris", party: "ris", phase: "connectivity", status: "open",        blocker: "", followUp: "", notes: "" },
  { id: "r3", line1: "Validate orders /",         line2: "results / status",               owner: "ris", party: "ris", phase: "datafeed",     status: "open",        blocker: "", followUp: "", notes: "" },
  { id: "r4", line1: "Confirm RIS",               line2: "production readiness",           owner: "ris", party: "ris", phase: "prodconfig",   status: "open",        blocker: "", followUp: "", notes: "" },
  { id: "r5", line1: "Support RIS-side",          line2: "issues",                         owner: "ris", party: "ris", phase: "golive",       status: "open",        blocker: "", followUp: "", notes: "" },

  // PACS / VNA Vendor
  { id: "p1", line1: "Confirm DICOM /",           line2: "archive / prior workflow",       owner: "pacs", party: "pacs", phase: "discovery",    status: "in_progress", blocker: "", followUp: "", notes: "" },
  { id: "p2", line1: "Provide DICOM routing",     line2: "& connectivity details",         owner: "pacs", party: "pacs", phase: "connectivity", status: "open",        blocker: "", followUp: "", notes: "" },
  { id: "p3", line1: "Validate DICOM",            line2: "image flow",                     owner: "pacs", party: "pacs", phase: "datafeed",     status: "open",        blocker: "", followUp: "", notes: "" },
  { id: "p4", line1: "Confirm production",        line2: "DICOM readiness",                owner: "pacs", party: "pacs", phase: "prodconfig",   status: "open",        blocker: "", followUp: "", notes: "" },
  { id: "p5", line1: "Support PACS /",            line2: "VNA issues",                     owner: "pacs", party: "pacs", phase: "golive",       status: "open",        blocker: "", followUp: "", notes: "" },

  // Scipiotech & Data First
  { id: "d1", line1: "Review connectivity",       line2: "needs & network inputs",         owner: "df", party: "df", phase: "discovery",    status: "done",        blocker: "", followUp: "", notes: "" },
  { id: "d2", line1: "Own VPN / firewall /",      line2: "routing to Silverback",          owner: "df", party: "df", phase: "connectivity", status: "in_progress", blocker: "", followUp: "", notes: "" },
  { id: "d3", line1: "Support connectivity",      line2: "validation",                     owner: "df", party: "df", phase: "datafeed",     status: "open",        blocker: "", followUp: "", notes: "" },
  { id: "d4", line1: "Confirm production",        line2: "connectivity ready",             owner: "df", party: "df", phase: "prodconfig",   status: "open",        blocker: "", followUp: "", notes: "" },
  { id: "d5", line1: "Support connectivity",      line2: "issues",                         owner: "df", party: "df", phase: "golive",       status: "open",        blocker: "", followUp: "", notes: "" },

  // New Lantern
  { id: "n1", line1: "Review completed",          line2: "questionnaire & diagram",        owner: "nl", party: "nl", phase: "discovery",    status: "done",        blocker: "", followUp: "", notes: "" },
  { id: "n2", line1: "Receive confirmed",         line2: "connectivity details",           owner: "nl", party: "nl", phase: "connectivity", status: "n_a",         blocker: "", followUp: "", notes: "" },
  { id: "n3", line1: "Lead data / workflow",      line2: "validation",                     owner: "nl", party: "nl", phase: "datafeed",     status: "open",        blocker: "", followUp: "", notes: "" },
  { id: "n4", line1: "Support go-live",           line2: "readiness & launch",             owner: "nl", party: "nl", phase: "prodconfig",   status: "open",        blocker: "", followUp: "", notes: "" },
  { id: "n5", line1: "Own New Lantern",           line2: "support path",                   owner: "nl", party: "nl", phase: "golive",       status: "open",        blocker: "", followUp: "", notes: "" },
];

// ── Status styling — bold saturated colors matching mockup ─────────────────

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

const PARTY_LOOKUP: Record<PartyId, Party> = Object.fromEntries(PARTIES.map(p => [p.id, p])) as Record<PartyId, Party>;

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

  // Fetch vendor display names from questionnaire data
  const { data: vendorNames } = trpc.swimlane.getVendorNames.useQuery(
    { organizationSlug },
    { enabled: !!organizationSlug }
  );

  // Index cards by (party, phase)
  const cells = useMemo(() => {
    const map: Record<string, MilestoneCard> = {};
    for (const c of CARDS) map[`${c.party}:${c.phase}`] = c;
    return map;
  }, []);

  // Status counts for legend
  const totals = useMemo(() => {
    const t: Record<Status, number> = { done: 0, in_progress: 0, open: 0, blocked: 0, n_a: 0 };
    for (const c of CARDS) t[c.status]++;
    return t;
  }, []);

  const selectedCard = selectedId ? CARDS.find(c => c.id === selectedId) ?? null : null;

  return (
    <div className="space-y-3">
      {/* Status legend */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4 text-xs">
          {(["open", "in_progress", "done", "n_a", "blocked"] as Status[]).map(s => (
            <div key={s} className="flex items-center gap-1.5">
              <div className={cn("w-2.5 h-2.5 rounded-full", STATUS_DOT[s])} />
              <span className="text-muted-foreground">{STATUS_LABEL[s]}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Swimlane grid */}
      <div className="overflow-x-auto">
        <div className="min-w-[900px]">
          {/* Phase column headers */}
          <div
            className="grid gap-px"
            style={{ gridTemplateColumns: `180px repeat(${PHASES.length}, 1fr)` }}
          >
            <div className="px-2 py-2 text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
              Organization
            </div>
            {PHASES.map(phase => (
              <div
                key={phase.id}
                className="px-2 py-2 text-center"
              >
                <div className="text-xs font-semibold text-foreground">
                  {phase.title}
                </div>
              </div>
            ))}
          </div>

          {/* Party rows */}
          {PARTIES.map((party, rowIdx) => {
            // Get the display name from questionnaire data
            const displayName = vendorNames?.[party.id] ?? "";

            return (
              <div
                key={party.id}
                className={cn(
                  "grid gap-px border-t border-border/30",
                  rowIdx % 2 === 0 ? "bg-muted/5" : "bg-transparent"
                )}
                style={{ gridTemplateColumns: `180px repeat(${PHASES.length}, 1fr)` }}
              >
                {/* Party label — badge circle + vendor name from questionnaire */}
                <div className="px-2 py-2 flex items-center gap-2">
                  <Badge
                    variant="outline"
                    className={cn("text-[9px] whitespace-nowrap shrink-0", party.badgeColor)}
                  >
                    {party.badge}
                  </Badge>
                  <span className="text-[11px] font-medium text-foreground/70 leading-tight truncate" title={displayName}>
                    {displayName}
                  </span>
                </div>

                {/* Phase cells */}
                {PHASES.map(phase => {
                  const key = `${party.id}:${phase.id}`;
                  const card = cells[key];
                  if (!card) return <div key={key} className="px-1 py-1 min-h-[56px]" />;

                  const isNa = card.status === "n_a";
                  const style = STATUS_CARD[card.status];
                  const isSelected = selectedId === card.id;
                  const showSilverback = party.id === "df" && phase.id === "connectivity";

                  return (
                    <div key={key} className="px-1 py-1 min-h-[56px] relative">
                      <button
                        onClick={() => setSelectedId(isSelected ? null : card.id)}
                        className={cn(
                          "w-full rounded-md border px-2 py-1.5 text-left transition-all",
                          style.bg, style.border,
                          isSelected && "ring-2 ring-primary",
                          !isNa && "hover:brightness-110 cursor-pointer",
                        )}
                      >
                        {isNa ? (
                          <div className="flex flex-col items-center justify-center py-1">
                            <div className={cn("text-[10px] font-medium", style.text)}>{card.line1}</div>
                            <div className={cn("text-[10px] mt-0.5", style.subtext)}>{card.line2}</div>
                            <div className="text-sm font-bold text-slate-600 mt-0.5">N/A</div>
                          </div>
                        ) : (
                          <div className="flex flex-col">
                            <div className={cn("text-[11px] font-semibold leading-snug", style.text)}>
                              {card.line1}
                            </div>
                            <div className={cn("text-[10px] leading-snug mt-0.5", style.subtext)}>
                              {card.line2}
                            </div>
                          </div>
                        )}
                      </button>

                      {/* Silverback system box */}
                      {showSilverback && (
                        <div className="absolute -bottom-1.5 left-1/2 -translate-x-1/2 translate-y-1/2 z-10 px-2 py-0.5 rounded bg-emerald-600/80 border border-emerald-400/50 text-[9px] font-semibold text-emerald-100 whitespace-nowrap shadow-lg">
                          Silverback System
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            );
          })}
        </div>
      </div>

      {/* Edit Panel (slide-out) */}
      {selectedCard && (
        <div className="fixed top-0 right-0 h-full w-[360px] bg-card border-l border-border shadow-2xl z-50 flex flex-col animate-in slide-in-from-right duration-200">
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
            <PanelField label="Issue" value={`${selectedCard.line1} ${selectedCard.line2}`} />
            <PanelField label="Owner">
              <div className="flex items-center gap-2 mt-1">
                {(() => {
                  const p = PARTY_LOOKUP[selectedCard.owner];
                  return p ? (
                    <>
                      <Badge variant="outline" className={cn("text-[10px]", p.badgeColor)}>
                        {p.badge}
                      </Badge>
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

      {/* Footer */}
      <div className="text-center text-xs text-muted-foreground pt-1">
        Click any milestone to edit details, change status, or add comments.
      </div>
    </div>
  );
}

// ── Sub-components ─────────────────────────────────────────────────────────

function PanelField({ label, value, children }: { label: string; value?: string; children?: React.ReactNode }) {
  return (
    <div>
      <div className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">{label}</div>
      {children ?? <div className="mt-1 text-sm text-foreground">{value}</div>}
    </div>
  );
}

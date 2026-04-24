/**
 * SwimlaneView — PM Coordination Tracker
 *
 * 5 phases × 5 party rows. One card per cell.
 * Vendor display names pulled from ARCH.systems questionnaire data.
 *
 * Interactions:
 *  - Click a tile to cycle its color/status: white → yellow → green → red → gray → white
 *  - Click the edit icon on a tile (or right-click) to open the side panel
 *  - Side panel lets you edit status, blocker, next follow-up, and notes
 *  - Export / Import the full swim-lane state as JSON
 *
 * State is persisted to localStorage, scoped by organizationSlug.
 */

import { useState, useMemo, useEffect, useRef, useCallback } from "react";
import { cn } from "@/lib/utils";
import { X, Download, Upload, Pencil } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
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

// ── Default cards ──────────────────────────────────────────────────────────

const DEFAULT_CARDS: MilestoneCard[] = [
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
// Colors map to the user-requested palette: white / yellow / green / red / gray.

const STATUS_CARD: Record<Status, { bg: string; border: string; text: string; subtext: string }> = {
  open:        { bg: "bg-white",         border: "border-slate-300",      text: "text-slate-900",  subtext: "text-slate-600" },
  in_progress: { bg: "bg-amber-400",     border: "border-amber-500/60",   text: "text-amber-950",  subtext: "text-amber-900/80" },
  done:        { bg: "bg-emerald-500",   border: "border-emerald-400/60", text: "text-white",      subtext: "text-emerald-50/90" },
  blocked:     { bg: "bg-red-600",       border: "border-red-400/60",     text: "text-white",      subtext: "text-red-50/90" },
  n_a:         { bg: "bg-slate-500",     border: "border-slate-400/50",   text: "text-white",      subtext: "text-slate-200" },
};

const STATUS_DOT: Record<Status, string> = {
  open: "bg-white border border-slate-400",
  in_progress: "bg-amber-400",
  done: "bg-emerald-500",
  blocked: "bg-red-500",
  n_a: "bg-slate-400",
};

const STATUS_LABEL: Record<Status, string> = {
  open: "Open",
  in_progress: "In Progress",
  done: "Done",
  blocked: "Blocked",
  n_a: "N/A",
};

// Cycle order when clicking a tile
const STATUS_CYCLE: Status[] = ["open", "in_progress", "done", "blocked", "n_a"];
const nextStatus = (s: Status): Status => {
  const i = STATUS_CYCLE.indexOf(s);
  return STATUS_CYCLE[(i + 1) % STATUS_CYCLE.length];
};

// ── Persistence ────────────────────────────────────────────────────────────

const STORAGE_PREFIX = "swimlane:v1:";

function loadCards(slug: string): MilestoneCard[] {
  if (typeof window === "undefined") return DEFAULT_CARDS;
  try {
    const raw = window.localStorage.getItem(STORAGE_PREFIX + slug);
    if (!raw) return DEFAULT_CARDS;
    const parsed = JSON.parse(raw) as unknown;
    const merged = mergeCards(DEFAULT_CARDS, parsed);
    return merged;
  } catch {
    return DEFAULT_CARDS;
  }
}

function saveCards(slug: string, cards: MilestoneCard[]) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_PREFIX + slug, JSON.stringify(cards));
  } catch {
    // quota / disabled storage — silently ignore
  }
}

/**
 * Merge saved/imported state onto the default card list. Only the mutable
 * fields (status, blocker, followUp, notes) come from the incoming data —
 * labels and grid positions always come from DEFAULT_CARDS so the layout
 * stays stable across code changes.
 */
function mergeCards(base: MilestoneCard[], incoming: unknown): MilestoneCard[] {
  if (!Array.isArray(incoming)) return base;
  const byId = new Map<string, Partial<MilestoneCard>>();
  for (const entry of incoming) {
    if (entry && typeof entry === "object" && "id" in entry && typeof (entry as { id: unknown }).id === "string") {
      byId.set((entry as { id: string }).id, entry as Partial<MilestoneCard>);
    }
  }
  return base.map((card) => {
    const override = byId.get(card.id);
    if (!override) return card;
    return {
      ...card,
      status: STATUS_CYCLE.includes(override.status as Status) ? (override.status as Status) : card.status,
      blocker: typeof override.blocker === "string" ? override.blocker : card.blocker,
      followUp: typeof override.followUp === "string" ? override.followUp : card.followUp,
      notes: typeof override.notes === "string" ? override.notes : card.notes,
    };
  });
}

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
  const [cards, setCards] = useState<MilestoneCard[]>(() => loadCards(organizationSlug));
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [importError, setImportError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Reload state when org changes
  useEffect(() => {
    setCards(loadCards(organizationSlug));
    setSelectedId(null);
  }, [organizationSlug]);

  // Persist on every change
  useEffect(() => {
    saveCards(organizationSlug, cards);
  }, [organizationSlug, cards]);

  const { data: vendorNames } = trpc.swimlane.getVendorNames.useQuery(
    { organizationSlug },
    { enabled: !!organizationSlug }
  );

  const cells = useMemo(() => {
    const map: Record<string, MilestoneCard> = {};
    for (const c of cards) map[`${c.party}:${c.phase}`] = c;
    return map;
  }, [cards]);

  const selectedCard = selectedId ? cards.find(c => c.id === selectedId) ?? null : null;

  const updateCard = useCallback((id: string, patch: Partial<MilestoneCard>) => {
    setCards(prev => prev.map(c => c.id === id ? { ...c, ...patch } : c));
  }, []);

  const cycleStatus = useCallback((id: string) => {
    setCards(prev => prev.map(c => c.id === id ? { ...c, status: nextStatus(c.status) } : c));
  }, []);

  const handleExport = () => {
    const payload = {
      version: 1,
      organizationSlug,
      exportedAt: new Date().toISOString(),
      cards: cards.map(c => ({
        id: c.id,
        party: c.party,
        phase: c.phase,
        line1: c.line1,
        line2: c.line2,
        status: c.status,
        blocker: c.blocker,
        followUp: c.followUp,
        notes: c.notes,
      })),
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `swimlane-${organizationSlug}-${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleImportClick = () => {
    setImportError(null);
    fileInputRef.current?.click();
  };

  const handleImportFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = ""; // allow re-importing the same file
    if (!file) return;
    try {
      const text = await file.text();
      const parsed = JSON.parse(text) as unknown;
      const incoming =
        parsed && typeof parsed === "object" && "cards" in parsed
          ? (parsed as { cards: unknown }).cards
          : parsed;
      const merged = mergeCards(DEFAULT_CARDS, incoming);
      setCards(merged);
      setImportError(null);
    } catch (err) {
      setImportError(err instanceof Error ? err.message : "Failed to import file");
    }
  };

  const handleReset = () => {
    setCards(DEFAULT_CARDS);
    setSelectedId(null);
  };

  return (
    <div className="space-y-3">
      {/* Toolbar: legend + export/import */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-4 text-xs">
          {STATUS_CYCLE.map(s => (
            <div key={s} className="flex items-center gap-1.5">
              <div className={cn("w-2.5 h-2.5 rounded-full", STATUS_DOT[s])} />
              <span className="text-muted-foreground">{STATUS_LABEL[s]}</span>
            </div>
          ))}
        </div>

        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={handleExport} className="h-8 gap-1.5">
            <Download className="w-3.5 h-3.5" />
            Export JSON
          </Button>
          <Button variant="outline" size="sm" onClick={handleImportClick} className="h-8 gap-1.5">
            <Upload className="w-3.5 h-3.5" />
            Import JSON
          </Button>
          <Button variant="ghost" size="sm" onClick={handleReset} className="h-8">
            Reset
          </Button>
          <input
            ref={fileInputRef}
            type="file"
            accept="application/json,.json"
            onChange={handleImportFile}
            className="hidden"
          />
        </div>
      </div>

      {importError && (
        <div className="text-xs text-red-400 bg-red-500/10 border border-red-500/30 rounded px-3 py-2">
          Import failed: {importError}
        </div>
      )}

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
                  const hasMeta = !!(card.blocker || card.followUp || card.notes);

                  return (
                    <div key={key} className="px-0.5 py-1 min-h-[48px]">
                      <div
                        className={cn(
                          "group relative w-full rounded-md border transition-all",
                          style.bg, style.border,
                          isSelected && "ring-2 ring-primary",
                        )}
                      >
                        <button
                          type="button"
                          onClick={() => cycleStatus(card.id)}
                          onContextMenu={(e) => {
                            e.preventDefault();
                            setSelectedId(card.id);
                          }}
                          title="Click to cycle status · Right-click to edit"
                          className={cn(
                            "w-full text-left px-2 py-1.5 pr-7 rounded-md hover:brightness-105 cursor-pointer",
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
                          {hasMeta && (
                            <div
                              className={cn(
                                "absolute bottom-1 right-1 w-1.5 h-1.5 rounded-full",
                                style.text === "text-white" ? "bg-white/70" : "bg-slate-700/60"
                              )}
                              title="Has notes"
                            />
                          )}
                        </button>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedId(card.id);
                          }}
                          title="Edit details"
                          className={cn(
                            "absolute top-1 right-1 p-0.5 rounded hover:bg-black/10 dark:hover:bg-white/10",
                            style.text,
                          )}
                        >
                          <Pencil className="w-3 h-3" />
                        </button>
                      </div>
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

            <PanelField label="Phase" value={PHASES.find(p => p.id === selectedCard.phase)?.title ?? ""} />

            <PanelField label="Status">
              <div className="mt-2 grid grid-cols-5 gap-1.5">
                {STATUS_CYCLE.map(s => {
                  const active = s === selectedCard.status;
                  return (
                    <button
                      key={s}
                      type="button"
                      onClick={() => updateCard(selectedCard.id, { status: s })}
                      className={cn(
                        "flex flex-col items-center gap-1 px-1.5 py-2 rounded-md border text-[10px] font-medium transition-all",
                        active
                          ? "border-primary ring-2 ring-primary/40"
                          : "border-border hover:border-foreground/40",
                      )}
                    >
                      <span className={cn("w-3.5 h-3.5 rounded-full", STATUS_DOT[s])} />
                      <span className="text-foreground/80">{STATUS_LABEL[s]}</span>
                    </button>
                  );
                })}
              </div>
            </PanelField>

            <PanelField label="Blocker">
              <Input
                value={selectedCard.blocker}
                onChange={(e) => updateCard(selectedCard.id, { blocker: e.target.value })}
                placeholder="e.g., waiting on network team"
                className="mt-1"
              />
            </PanelField>

            <PanelField label="Next Follow-up">
              <Input
                type="date"
                value={selectedCard.followUp}
                onChange={(e) => updateCard(selectedCard.id, { followUp: e.target.value })}
                className="mt-1"
              />
            </PanelField>

            <PanelField label="Notes">
              <Textarea
                value={selectedCard.notes}
                onChange={(e) => updateCard(selectedCard.id, { notes: e.target.value })}
                placeholder="Add any details, updates, or comments…"
                rows={6}
                className="mt-1"
              />
            </PanelField>
          </div>
          <div className="px-5 py-4 border-t border-border">
            <button
              onClick={() => setSelectedId(null)}
              className="w-full py-2.5 rounded-lg bg-primary hover:bg-primary/90 text-sm font-semibold text-primary-foreground transition-colors"
            >
              Done
            </button>
          </div>
        </div>
      )}

      <div className="text-center text-xs text-muted-foreground pt-1">
        Click a tile to cycle its color · Click the pencil (or right-click) to edit notes · Changes auto-save locally.
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

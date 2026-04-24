/**
 * SwimlaneMockup — PM Coordination Tracker
 *
 * A simple swimlane board for a Rad Group PM to coordinate work across
 * 7 parties and 5 phases. Visual only — no real editing or data mapping.
 *
 * Route: /swimlane-mockup
 *
 * "This is a coordination tracker, not an integration teaching tool."
 */

import { useState, useMemo } from "react";
import { cn } from "@/lib/utils";
import {
  X,
  Filter,
  Search,
  Compass,
  Cable,
  Database,
  Rocket,
  Headphones,
} from "lucide-react";

// ── Types ──────────────────────────────────────────────────────────────────

type Status = "open" | "in_progress" | "done" | "blocked" | "n_a";

type PartyId = "hospital" | "ehr" | "ris" | "pacs" | "rad" | "df" | "nl";

type PhaseId = "discovery" | "connectivity" | "validation" | "golive" | "support";

interface Party {
  id: PartyId;
  name: string;
  initial: string;
  color: string; // tailwind bg class for avatar
}

interface Phase {
  id: PhaseId;
  num: number;
  title: string;
  Icon: typeof Compass;
}

interface Card {
  id: string;
  assignment: string;
  subtitle: string;
  owner: PartyId;
  party: PartyId;
  phase: PhaseId;
  status: Status;
  dueDate: string;
  blocker: string;
  followUp: string;
  notes: string;
}

// ── Reference data ─────────────────────────────────────────────────────────

const PARTIES: Party[] = [
  { id: "hospital", name: "Hospital IT", initial: "H", color: "bg-sky-500" },
  { id: "ehr", name: "EHR Vendor", initial: "E", color: "bg-amber-500" },
  { id: "ris", name: "RIS Vendor", initial: "R", color: "bg-rose-500" },
  { id: "pacs", name: "PACS / VNA Vendor", initial: "P", color: "bg-indigo-500" },
  { id: "rad", name: "Rad Group PM", initial: "G", color: "bg-orange-500" },
  { id: "df", name: "DataFirst + Scipio", initial: "F", color: "bg-teal-500" },
  { id: "nl", name: "New Lantern", initial: "N", color: "bg-emerald-500" },
];

const PHASES: Phase[] = [
  { id: "discovery", num: 1, title: "Discovery", Icon: Search },
  { id: "connectivity", num: 2, title: "Connectivity", Icon: Cable },
  { id: "validation", num: 3, title: "Data Validation", Icon: Database },
  { id: "golive", num: 4, title: "Go-Live", Icon: Rocket },
  { id: "support", num: 5, title: "Support", Icon: Headphones },
];

const PARTY_SHORT: Record<PartyId, string> = {
  hospital: "Hospital IT",
  ehr: "EHR Vendor",
  ris: "RIS Vendor",
  pacs: "PACS Vendor",
  rad: "Rad Group PM",
  df: "DataFirst",
  nl: "New Lantern",
};

// ── Default cards per the spec ─────────────────────────────────────────────

const CARDS: Card[] = [
  // Hospital IT
  { id: "h1", assignment: "Complete site &", subtitle: "connectivity questionnaire", owner: "hospital", party: "hospital", phase: "discovery", status: "done", dueDate: "Jan 20", blocker: "", followUp: "", notes: "" },
  { id: "h2", assignment: "Work with DataFirst +", subtitle: "Scipio on VPN/firewall", owner: "hospital", party: "hospital", phase: "connectivity", status: "in_progress", dueDate: "Feb 5", blocker: "", followUp: "", notes: "" },
  { id: "h3", assignment: "Confirm production", subtitle: "access works", owner: "hospital", party: "hospital", phase: "validation", status: "open", dueDate: "Feb 20", blocker: "", followUp: "", notes: "" },
  { id: "h4", assignment: "Available for access", subtitle: "& network issues", owner: "hospital", party: "hospital", phase: "golive", status: "open", dueDate: "Mar 1", blocker: "", followUp: "", notes: "" },
  { id: "h5", assignment: "Support hospital-side", subtitle: "network/access", owner: "hospital", party: "hospital", phase: "support", status: "open", dueDate: "", blocker: "", followUp: "", notes: "" },

  // EHR Vendor
  { id: "e1", assignment: "Confirm EHR", subtitle: "interface needs", owner: "ehr", party: "ehr", phase: "discovery", status: "done", dueDate: "Jan 18", blocker: "", followUp: "", notes: "" },
  { id: "e2", assignment: "Provide endpoint /", subtitle: "feed details", owner: "ehr", party: "ehr", phase: "connectivity", status: "in_progress", dueDate: "Feb 3", blocker: "", followUp: "", notes: "" },
  { id: "e3", assignment: "Validate EHR", subtitle: "data / messages", owner: "ehr", party: "ehr", phase: "validation", status: "open", dueDate: "Feb 18", blocker: "", followUp: "", notes: "" },
  { id: "e4", assignment: "Confirm production", subtitle: "feed readiness", owner: "ehr", party: "ehr", phase: "golive", status: "open", dueDate: "Mar 1", blocker: "", followUp: "", notes: "" },
  { id: "e5", assignment: "Support EHR-side", subtitle: "issues", owner: "ehr", party: "ehr", phase: "support", status: "open", dueDate: "", blocker: "", followUp: "", notes: "" },

  // RIS Vendor
  { id: "r1", assignment: "Confirm order/result", subtitle: "status workflow", owner: "ris", party: "ris", phase: "discovery", status: "done", dueDate: "Jan 20", blocker: "", followUp: "", notes: "" },
  { id: "r2", assignment: "Provide RIS", subtitle: "interface details", owner: "ris", party: "ris", phase: "connectivity", status: "open", dueDate: "", blocker: "", followUp: "", notes: "" },
  { id: "r3", assignment: "Validate orders /", subtitle: "results / status", owner: "ris", party: "ris", phase: "validation", status: "open", dueDate: "", blocker: "", followUp: "", notes: "" },
  { id: "r4", assignment: "Confirm RIS", subtitle: "production readiness", owner: "ris", party: "ris", phase: "golive", status: "open", dueDate: "", blocker: "", followUp: "", notes: "" },
  { id: "r5", assignment: "Support RIS-side", subtitle: "issues", owner: "ris", party: "ris", phase: "support", status: "open", dueDate: "", blocker: "", followUp: "", notes: "" },

  // PACS / VNA Vendor
  { id: "p1", assignment: "Confirm DICOM /", subtitle: "archive / prior workflow", owner: "pacs", party: "pacs", phase: "discovery", status: "in_progress", dueDate: "Jan 25", blocker: "", followUp: "", notes: "" },
  { id: "p2", assignment: "Provide DICOM routing", subtitle: "& connectivity details", owner: "pacs", party: "pacs", phase: "connectivity", status: "open", dueDate: "", blocker: "", followUp: "", notes: "" },
  { id: "p3", assignment: "Validate DICOM", subtitle: "image flow", owner: "pacs", party: "pacs", phase: "validation", status: "open", dueDate: "", blocker: "", followUp: "", notes: "" },
  { id: "p4", assignment: "Confirm production", subtitle: "DICOM readiness", owner: "pacs", party: "pacs", phase: "golive", status: "open", dueDate: "", blocker: "", followUp: "", notes: "" },
  { id: "p5", assignment: "Support PACS /", subtitle: "VNA issues", owner: "pacs", party: "pacs", phase: "support", status: "open", dueDate: "", blocker: "", followUp: "", notes: "" },

  // Rad Group PM
  { id: "g1", assignment: "Coordinate questionnaire", subtitle: "& identify missing owners", owner: "rad", party: "rad", phase: "discovery", status: "in_progress", dueDate: "Jan 22", blocker: "", followUp: "", notes: "" },
  { id: "g2", assignment: "Track connectivity", subtitle: "progress & escalate", owner: "rad", party: "rad", phase: "connectivity", status: "open", dueDate: "", blocker: "", followUp: "", notes: "" },
  { id: "g3", assignment: "Coordinate validation", subtitle: "participation", owner: "rad", party: "rad", phase: "validation", status: "open", dueDate: "", blocker: "", followUp: "", notes: "" },
  { id: "g4", assignment: "Confirm rad group", subtitle: "readiness", owner: "rad", party: "rad", phase: "golive", status: "open", dueDate: "", blocker: "", followUp: "", notes: "" },
  { id: "g5", assignment: "Track open issues", subtitle: "& escalation path", owner: "rad", party: "rad", phase: "support", status: "open", dueDate: "", blocker: "", followUp: "", notes: "" },

  // DataFirst + Scipio
  { id: "d1", assignment: "Review connectivity", subtitle: "needs & network inputs", owner: "df", party: "df", phase: "discovery", status: "done", dueDate: "Jan 17", blocker: "", followUp: "", notes: "" },
  { id: "d2", assignment: "Own VPN / firewall /", subtitle: "routing to Silverback", owner: "df", party: "df", phase: "connectivity", status: "in_progress", dueDate: "Feb 8", blocker: "", followUp: "", notes: "" },
  { id: "d3", assignment: "Support connectivity", subtitle: "validation", owner: "df", party: "df", phase: "validation", status: "open", dueDate: "", blocker: "", followUp: "", notes: "" },
  { id: "d4", assignment: "Confirm production", subtitle: "connectivity ready", owner: "df", party: "df", phase: "golive", status: "open", dueDate: "", blocker: "", followUp: "", notes: "" },
  { id: "d5", assignment: "Support connectivity", subtitle: "issues", owner: "df", party: "df", phase: "support", status: "open", dueDate: "", blocker: "", followUp: "", notes: "" },

  // New Lantern
  { id: "n1", assignment: "Review completed", subtitle: "questionnaire & diagram", owner: "nl", party: "nl", phase: "discovery", status: "done", dueDate: "Jan 24", blocker: "", followUp: "", notes: "" },
  { id: "n2", assignment: "Receive confirmed", subtitle: "connectivity details", owner: "nl", party: "nl", phase: "connectivity", status: "n_a", dueDate: "", blocker: "", followUp: "", notes: "" },
  { id: "n3", assignment: "Lead data / workflow", subtitle: "validation", owner: "nl", party: "nl", phase: "validation", status: "open", dueDate: "", blocker: "", followUp: "", notes: "" },
  { id: "n4", assignment: "Support go-live", subtitle: "readiness & launch", owner: "nl", party: "nl", phase: "golive", status: "open", dueDate: "", blocker: "", followUp: "", notes: "" },
  { id: "n5", assignment: "Own New Lantern", subtitle: "support path", owner: "nl", party: "nl", phase: "support", status: "open", dueDate: "", blocker: "", followUp: "", notes: "" },
];

// ── Status styling ─────────────────────────────────────────────────────────

const STATUS_BG: Record<Status, string> = {
  done: "bg-emerald-600",
  in_progress: "bg-amber-500",
  open: "bg-slate-700",
  blocked: "bg-red-600",
  n_a: "bg-slate-800/60",
};

const STATUS_BORDER: Record<Status, string> = {
  done: "border-emerald-500/60",
  in_progress: "border-amber-400/60",
  open: "border-slate-600/60",
  blocked: "border-red-500/60",
  n_a: "border-slate-700/40 border-dashed",
};

const STATUS_DOT: Record<Status, string> = {
  done: "bg-emerald-400",
  in_progress: "bg-amber-400",
  open: "bg-slate-400",
  blocked: "bg-red-400",
  n_a: "bg-slate-600",
};

const STATUS_LABEL: Record<Status, string> = {
  done: "Done",
  in_progress: "In Progress",
  open: "Open",
  blocked: "Blocked",
  n_a: "N/A",
};

// ── Component ──────────────────────────────────────────────────────────────

export default function SwimlaneMockup() {
  const [selectedId, setSelectedId] = useState<string | null>(null);

  // Index cards by (party, phase)
  const cells = useMemo(() => {
    const map: Record<string, Card> = {};
    for (const c of CARDS) {
      map[`${c.party}:${c.phase}`] = c;
    }
    return map;
  }, []);

  // Per-party status counts
  const partyCounts = useMemo(() => {
    const out: Record<PartyId, Record<Status, number>> = {} as any;
    for (const p of PARTIES) {
      out[p.id] = { done: 0, in_progress: 0, open: 0, blocked: 0, n_a: 0 };
    }
    for (const c of CARDS) out[c.party][c.status]++;
    return out;
  }, []);

  // Overall totals
  const totals = useMemo(() => {
    const t: Record<Status, number> = { done: 0, in_progress: 0, open: 0, blocked: 0, n_a: 0 };
    for (const c of CARDS) t[c.status]++;
    return t;
  }, []);

  const totalTracked = totals.done + totals.in_progress + totals.open + totals.blocked;
  const pctDone = totalTracked === 0 ? 0 : Math.round((totals.done / totalTracked) * 100);

  const selectedCard = selectedId ? CARDS.find((c) => c.id === selectedId) ?? null : null;

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col">
      {/* ── Header ── */}
      <header className="border-b border-slate-800 bg-slate-900/60 backdrop-blur px-6 py-3 flex items-center gap-4 shrink-0">
        <button className="flex items-center gap-2 px-3 py-2 rounded-lg bg-slate-800/60 border border-slate-700 hover:border-slate-500 text-sm font-medium">
          Memorial General Hospital
          <span className="text-slate-500 text-xs">▾</span>
        </button>

        <h1 className="flex-1 text-center text-lg font-bold tracking-tight">
          Implementation Progress — Swimlane View
        </h1>

        {/* Legend */}
        <div className="flex items-center gap-3 text-xs text-slate-400">
          {(["open", "in_progress", "done", "n_a", "blocked"] as Status[]).map((s) => (
            <div key={s} className="flex items-center gap-1.5">
              <span className={cn("w-2 h-2 rounded-full", STATUS_DOT[s])} />
              <span>{STATUS_LABEL[s]}</span>
            </div>
          ))}
        </div>

        {/* Progress donut */}
        <div className="flex items-center gap-3 px-3 py-2 rounded-lg border border-slate-700 bg-slate-800/40">
          <div className="relative w-10 h-10">
            <svg viewBox="0 0 36 36" className="w-10 h-10 -rotate-90">
              <circle cx="18" cy="18" r="15" fill="none" stroke="currentColor" strokeWidth="3" className="text-slate-700" />
              <circle
                cx="18" cy="18" r="15" fill="none" stroke="currentColor" strokeWidth="3"
                strokeDasharray={`${(pctDone * 94.2) / 100} 94.2`}
                className="text-emerald-400" strokeLinecap="round"
              />
            </svg>
            <div className="absolute inset-0 flex items-center justify-center text-[10px] font-bold">{pctDone}%</div>
          </div>
          <div className="flex gap-3 text-[10px]">
            <StatBlock label="Done" value={totals.done} cls="text-emerald-400" />
            <StatBlock label="In Progress" value={totals.in_progress} cls="text-amber-400" />
            <StatBlock label="Open" value={totals.open} cls="text-slate-300" />
            <StatBlock label="Blocked" value={totals.blocked} cls="text-red-400" />
          </div>
        </div>

        <button className="flex items-center gap-1.5 px-3 py-2 rounded-lg border border-slate-700 hover:border-slate-500 text-sm text-slate-300">
          <Filter className="w-3.5 h-3.5" />
          Filters
        </button>
      </header>

      {/* ── Grid ── */}
      <div className="flex-1 overflow-auto px-6 py-5">
        <div className="flex gap-0 min-w-[1200px]">
          {/* Party column (fixed left) */}
          <div className="w-[180px] shrink-0">
            {/* Phase header spacer */}
            <div className="h-[72px]" />
            {PARTIES.map((party) => (
              <div key={party.id} className="h-[120px] flex items-center gap-3 pr-4">
                <div className={cn("w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold text-white shrink-0", party.color)}>
                  {party.initial}
                </div>
                <div className="min-w-0">
                  <div className="text-sm font-semibold text-slate-100 leading-tight truncate">{party.name}</div>
                  <div className="mt-1 flex items-center gap-1">
                    {(["done", "in_progress", "open", "blocked", "n_a"] as Status[]).map((s) => (
                      <span key={s} className={cn("w-2 h-2 rounded-full", STATUS_DOT[s], partyCounts[party.id][s] === 0 && "opacity-20")} />
                    ))}
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Phase columns */}
          <div className="flex-1 grid gap-1" style={{ gridTemplateColumns: `repeat(${PHASES.length}, 1fr)` }}>
            {/* Phase headers */}
            {PHASES.map((phase) => (
              <div key={phase.id} className="h-[72px] flex flex-col items-center justify-center text-center rounded-t-lg bg-slate-800/40 border-b border-slate-700/50 px-2">
                <div className="text-[10px] uppercase tracking-widest text-slate-500 font-semibold">
                  {phase.num}. {phase.title}
                </div>
              </div>
            ))}

            {/* Card cells */}
            {PARTIES.map((party) =>
              PHASES.map((phase) => {
                const key = `${party.id}:${phase.id}`;
                const card = cells[key];
                if (!card) return <div key={key} className="h-[120px]" />;

                const isNa = card.status === "n_a";
                const isSelected = selectedId === card.id;

                // Silverback system box in DataFirst connectivity cell
                const showSilverback = party.id === "df" && phase.id === "connectivity";

                return (
                  <div key={key} className="h-[120px] px-1 py-1 relative">
                    <button
                      onClick={() => setSelectedId(isSelected ? null : card.id)}
                      className={cn(
                        "w-full h-full rounded-lg border px-3 py-2.5 text-left transition-all",
                        isNa
                          ? "border-dashed border-slate-700/50 bg-slate-900/40"
                          : STATUS_BG[card.status] + "/15 " + STATUS_BORDER[card.status],
                        isSelected && "ring-2 ring-sky-400",
                        !isNa && "hover:brightness-110 cursor-pointer",
                      )}
                    >
                      {isNa ? (
                        <div className="h-full flex items-center justify-center text-sm text-slate-600 font-medium">N/A</div>
                      ) : (
                        <div className="flex flex-col h-full">
                          <div className="text-xs font-semibold text-slate-100 leading-snug">{card.assignment}</div>
                          <div className="text-[11px] text-slate-400 leading-snug mt-0.5">{card.subtitle}</div>
                          <div className="mt-auto flex items-center justify-between">
                            <span className="text-[10px] text-slate-500">• {PARTY_SHORT[card.owner]}</span>
                            {card.dueDate && <span className="text-[10px] text-slate-500">{card.dueDate}</span>}
                          </div>
                        </div>
                      )}
                    </button>

                    {/* Silverback system box */}
                    {showSilverback && (
                      <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 translate-y-1/2 z-10 px-3 py-1.5 rounded-md bg-emerald-700/80 border border-emerald-500/50 text-[10px] font-semibold text-emerald-100 whitespace-nowrap shadow-lg">
                        Silverback System
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>

      {/* ── Edit Panel (slide-out) ── */}
      {selectedCard && (
        <div className="fixed top-0 right-0 h-full w-[380px] bg-slate-900 border-l border-slate-700 shadow-2xl z-50 flex flex-col animate-in slide-in-from-right duration-200">
          <div className="flex items-center justify-between px-5 py-4 border-b border-slate-800">
            <h2 className="text-base font-bold">Edit Milestone</h2>
            <button onClick={() => setSelectedId(null)} className="w-8 h-8 flex items-center justify-center rounded-md hover:bg-slate-800 text-slate-400 hover:text-slate-100">
              <X className="w-4 h-4" />
            </button>
          </div>
          <div className="flex-1 overflow-y-auto px-5 py-4 space-y-5">
            <PanelField label="Assignment" value={`${selectedCard.assignment} ${selectedCard.subtitle}`} />
            <PanelField label="Owner">
              <div className="flex items-center gap-2 mt-1">
                {(() => {
                  const p = PARTIES.find((p) => p.id === selectedCard.owner);
                  return p ? (
                    <>
                      <div className={cn("w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold text-white", p.color)}>{p.initial}</div>
                      <span className="text-sm text-slate-200">{p.name}</span>
                    </>
                  ) : null;
                })()}
              </div>
            </PanelField>
            <PanelField label="Status">
              <div className="flex items-center gap-2 mt-1">
                <span className={cn("w-2.5 h-2.5 rounded-full", STATUS_DOT[selectedCard.status])} />
                <span className="text-sm text-slate-200">{STATUS_LABEL[selectedCard.status]}</span>
              </div>
            </PanelField>
            <PanelField label="Phase" value={PHASES.find((p) => p.id === selectedCard.phase)?.title ?? ""} />
            <PanelField label="Due Date" value={selectedCard.dueDate || "—"} />
            <PanelField label="Blocker" value={selectedCard.blocker || "None"} />
            <PanelField label="Next Follow-up" value={selectedCard.followUp || "—"} />
            <PanelField label="Notes" value={selectedCard.notes || "—"} />
          </div>
          <div className="px-5 py-4 border-t border-slate-800">
            <button
              onClick={() => setSelectedId(null)}
              className="w-full py-2.5 rounded-lg bg-red-600 hover:bg-red-500 text-sm font-semibold text-white transition-colors"
            >
              Save Changes
            </button>
          </div>
        </div>
      )}

      {/* ── Footer ── */}
      <div className="border-t border-slate-800 bg-slate-900/30 px-6 py-2.5 text-center text-xs text-slate-500 shrink-0">
        Click any milestone to edit details, change status, or add comments.
      </div>
    </div>
  );
}

// ── Sub-components ─────────────────────────────────────────────────────────

function StatBlock({ label, value, cls }: { label: string; value: number; cls: string }) {
  return (
    <div className="flex flex-col items-center">
      <span className={cn("uppercase tracking-wider font-semibold", cls)}>{label}</span>
      <span className="text-sm font-bold text-slate-100">{value}</span>
    </div>
  );
}

function PanelField({ label, value, children }: { label: string; value?: string; children?: React.ReactNode }) {
  return (
    <div>
      <div className="text-[10px] uppercase tracking-wider text-slate-500 font-semibold">{label}</div>
      {children ?? <div className="mt-1 text-sm text-slate-200">{value}</div>}
    </div>
  );
}

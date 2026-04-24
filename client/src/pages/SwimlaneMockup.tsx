/**
 * SwimlaneMockup — rows × columns grid: parties (rows) × phases (columns).
 * Route: /swimlane-mockup (not linked from nav; open directly).
 *
 * Each cell is a milestone card with title + owner pill + status color,
 * or an explicit N/A block. Status counts per row show up next to the
 * party label. Dependency arrows and the edit drawer are out of scope
 * for this first pass; we'll layer those on after the grid feels right.
 */

import { useLayoutEffect, useMemo, useRef, useState } from "react";
import { cn } from "@/lib/utils";
import {
  Activity,
  Boxes,
  CheckCircle2,
  Circle,
  Cpu,
  Ban,
  FileCheck2,
  GitBranch,
  GraduationCap,
  Grid3x3,
  LayoutList,
  ListChecks,
  Network,
  Filter,
  MoreVertical,
  Plus,
  ShieldCheck,
  UserPlus,
} from "lucide-react";

// ── Types ───────────────────────────────────────────────────────────────────

type Status = "open" | "in_progress" | "done" | "n_a" | "blocked";

type PartyId =
  | "it"
  | "ehr"
  | "ris"
  | "pacs"
  | "rad"
  | "sdf"
  | "nl";

interface Party {
  id: PartyId;
  name: string;
  initial: string;
  avatarRing: string; // tailwind text-* for the initial circle
}

interface Phase {
  id: string;
  num: number;
  title: string;
  Icon: typeof Network;
}

interface Milestone {
  id: string;
  title: string;
  owner: PartyId;
  phase: string; // phase.id
  party: PartyId; // which row it lives in (usually same as owner)
  status: Status;
}

// ── Reference data ──────────────────────────────────────────────────────────

const PARTIES: Party[] = [
  { id: "it", name: "Hospital IT", initial: "H", avatarRing: "text-sky-300 bg-sky-500/20" },
  { id: "ehr", name: "EHR Vendor", initial: "E", avatarRing: "text-amber-300 bg-amber-500/20" },
  { id: "ris", name: "RIS Vendor", initial: "R", avatarRing: "text-rose-300 bg-rose-500/20" },
  { id: "pacs", name: "PACS/VNA Vendor", initial: "P", avatarRing: "text-indigo-300 bg-indigo-500/20" },
  { id: "rad", name: "Rad Group", initial: "G", avatarRing: "text-lime-300 bg-lime-500/20" },
  { id: "sdf", name: "Silverback / Data First", initial: "S", avatarRing: "text-slate-200 bg-slate-500/30" },
  { id: "nl", name: "New Lantern", initial: "N", avatarRing: "text-emerald-300 bg-emerald-500/20" },
];

const PARTY_LABEL: Record<PartyId, string> = {
  it: "IT",
  ehr: "EHR",
  ris: "RIS",
  pacs: "PACS",
  rad: "RAD",
  sdf: "SDF",
  nl: "NL",
};

const PHASES: Phase[] = [
  { id: "network", num: 1, title: "Network & Connectivity", Icon: Network },
  { id: "hl7", num: 2, title: "HL7 Interface Build", Icon: GitBranch },
  { id: "config", num: 3, title: "System Configuration", Icon: Cpu },
  { id: "templates", num: 4, title: "Worklist & Templates", Icon: LayoutList },
  { id: "training", num: 5, title: "Training & Go-Live Preparation", Icon: GraduationCap },
  { id: "testing", num: 6, title: "End-to-End Testing", Icon: FileCheck2 },
  { id: "prod", num: 7, title: "Production Data Validation", Icon: ShieldCheck },
];

// ── Sample milestones (plausible data, not pixel-matched to ref image) ──────

const MILESTONES: Milestone[] = [
  // Hospital IT
  { id: "m1", title: "VPN Tunnel", owner: "it", party: "it", phase: "network", status: "done" },
  { id: "m2", title: "Firewall Rules", owner: "it", party: "it", phase: "network", status: "done" },
  { id: "m3", title: "Interface Engine Access", owner: "it", party: "it", phase: "hl7", status: "done" },
  { id: "m4", title: "AD Accounts & Permissions", owner: "it", party: "it", phase: "config", status: "done" },
  { id: "m5", title: "Template Access Provision", owner: "it", party: "it", phase: "templates", status: "done" },
  { id: "m6", title: "Performance Test Support", owner: "it", party: "it", phase: "testing", status: "done" },
  { id: "m7", title: "Go-Live Validation Support", owner: "it", party: "it", phase: "prod", status: "done" },

  // EHR Vendor
  { id: "m10", title: "ORM Samples", owner: "ehr", party: "ehr", phase: "hl7", status: "in_progress" },
  { id: "m11", title: "ADT Build", owner: "ehr", party: "ehr", phase: "hl7", status: "in_progress" },
  { id: "m12", title: "Results Interface Build", owner: "ehr", party: "ehr", phase: "hl7", status: "done" },
  { id: "m13", title: "Admin Training", owner: "ehr", party: "ehr", phase: "training", status: "in_progress" },
  { id: "m14", title: "Interface Test (End-to-End)", owner: "ehr", party: "ehr", phase: "testing", status: "done" },
  { id: "m15", title: "Go-Live Validation", owner: "ehr", party: "ehr", phase: "prod", status: "done" },

  // RIS Vendor
  { id: "m20", title: "Order Message Mapping", owner: "ris", party: "ris", phase: "hl7", status: "open" },
  { id: "m21", title: "Procedure Code Mapping", owner: "ris", party: "ris", phase: "config", status: "done" },
  { id: "m22", title: "Worklist Rules Configuration", owner: "ris", party: "ris", phase: "templates", status: "done" },
  { id: "m23", title: "Front Desk Training", owner: "ris", party: "ris", phase: "training", status: "done" },
  { id: "m24", title: "Worklist Test", owner: "ris", party: "ris", phase: "testing", status: "done" },
  { id: "m25", title: "Go-Live Validation", owner: "ris", party: "ris", phase: "prod", status: "blocked" },

  // PACS/VNA Vendor
  { id: "m30", title: "DICOM Endpoint Provision", owner: "pacs", party: "pacs", phase: "network", status: "done" },
  { id: "m31", title: "DICOM Connectivity Test", owner: "pacs", party: "pacs", phase: "network", status: "done" },
  { id: "m32", title: "Storage Configuration", owner: "pacs", party: "pacs", phase: "config", status: "done" },
  { id: "m33", title: "Modality Worklist Enablement", owner: "pacs", party: "pacs", phase: "templates", status: "in_progress" },
  { id: "m34", title: "DICOM Echo Test", owner: "pacs", party: "pacs", phase: "testing", status: "done" },
  { id: "m35", title: "Data Consistency Check", owner: "pacs", party: "pacs", phase: "prod", status: "open" },

  // Rad Group
  { id: "m40", title: "Clinical Template Review", owner: "rad", party: "rad", phase: "templates", status: "in_progress" },
  { id: "m41", title: "Physician Training", owner: "rad", party: "rad", phase: "training", status: "done" },
  { id: "m42", title: "Clinical Workflow Test", owner: "rad", party: "rad", phase: "testing", status: "done" },
  { id: "m43", title: "Go-Live Sign-Off", owner: "rad", party: "rad", phase: "prod", status: "open" },

  // Silverback / Data First
  { id: "m50", title: "Data Extraction Plan", owner: "sdf", party: "sdf", phase: "network", status: "done" },
  { id: "m51", title: "Data Mapping Build", owner: "sdf", party: "sdf", phase: "hl7", status: "in_progress" },
  { id: "m52", title: "Data Validation Sample", owner: "sdf", party: "sdf", phase: "config", status: "done" },
  { id: "m53", title: "Data Reconciliation Test", owner: "sdf", party: "sdf", phase: "testing", status: "done" },
  { id: "m54", title: "Final Data Validation", owner: "sdf", party: "sdf", phase: "prod", status: "open" },

  // New Lantern
  { id: "m60", title: "Template Configuration", owner: "nl", party: "nl", phase: "config", status: "done" },
  { id: "m61", title: "Template Publishing", owner: "nl", party: "nl", phase: "templates", status: "done" },
  { id: "m62", title: "End User Training", owner: "nl", party: "nl", phase: "training", status: "done" },
];

// Cells that are explicitly not applicable for a (party, phase) combo.
const NA_CELLS = new Set<string>([
  "nl:network",
  "nl:hl7",
  "nl:testing",
  "nl:prod",
]);

// Who is *required to be involved* in each phase. This is distinct from who
// owns milestones: a party may attend as a reviewer/dependency without
// owning any card. The mockup exposes this at the column-header level so
// the scheduler can see the full attendee list and edit it (e.g. add a
// 3rd-party IT group that isn't in the default party list).
const PHASE_ATTENDEES: Record<string, PartyId[]> = {
  network: ["it", "sdf", "pacs"],
  hl7: ["ehr", "ris", "sdf", "nl"],
  config: ["it", "pacs", "ris", "nl"],
  templates: ["rad", "ris", "pacs", "nl"],
  training: ["rad", "ehr", "ris", "nl"],
  testing: ["it", "ehr", "ris", "pacs", "rad", "sdf"],
  prod: ["it", "ehr", "ris", "pacs", "rad", "sdf", "nl"],
};

// ── Status styling ──────────────────────────────────────────────────────────

const STATUS_STYLE: Record<
  Status,
  { card: string; dot: string; label: string }
> = {
  done: {
    card: "bg-emerald-600/25 border-emerald-500/50 hover:border-emerald-400/70",
    dot: "bg-emerald-400",
    label: "Done",
  },
  in_progress: {
    card: "bg-amber-600/25 border-amber-500/50 hover:border-amber-400/70",
    dot: "bg-amber-400",
    label: "In Progress",
  },
  open: {
    card: "bg-slate-700/40 border-slate-500/40 hover:border-slate-400/60",
    dot: "bg-slate-400",
    label: "Open",
  },
  blocked: {
    card: "bg-red-600/25 border-red-500/50 hover:border-red-400/70",
    dot: "bg-red-400",
    label: "Blocked",
  },
  n_a: {
    card: "bg-slate-900/60 border-dashed border-slate-700/70",
    dot: "bg-slate-600",
    label: "N/A",
  },
};

// ── Dependencies (from → to, by milestone id) ──────────────────────────────

const DEPENDENCIES: Array<{ from: string; to: string }> = [
  // Hospital IT: network prerequisites feed HL7 interface access
  { from: "m1", to: "m3" },
  { from: "m2", to: "m3" },
  { from: "m3", to: "m4" },
  { from: "m4", to: "m5" },
  { from: "m5", to: "m6" },
  { from: "m6", to: "m7" },
  // EHR build flow
  { from: "m10", to: "m12" },
  { from: "m11", to: "m12" },
  { from: "m12", to: "m13" },
  { from: "m13", to: "m14" },
  { from: "m14", to: "m15" },
  // RIS build flow
  { from: "m20", to: "m21" },
  { from: "m21", to: "m22" },
  { from: "m22", to: "m23" },
  { from: "m23", to: "m24" },
  { from: "m24", to: "m25" },
  // PACS flow
  { from: "m30", to: "m31" },
  { from: "m31", to: "m32" },
  { from: "m32", to: "m33" },
  { from: "m33", to: "m34" },
  { from: "m34", to: "m35" },
  // Rad Group flow
  { from: "m40", to: "m41" },
  { from: "m41", to: "m42" },
  { from: "m42", to: "m43" },
  // Silverback flow
  { from: "m50", to: "m51" },
  { from: "m51", to: "m52" },
  { from: "m52", to: "m53" },
  { from: "m53", to: "m54" },
  // New Lantern flow (within its active phases)
  { from: "m60", to: "m61" },
  { from: "m61", to: "m62" },
];

// ── Component ───────────────────────────────────────────────────────────────

// Named export so this can be embedded inside another page (e.g. the
// Swimlane toggle on Implementation.tsx). Default export renders the same
// component as a full page via the /swimlane-mockup route.
export function SwimlaneMockup() {
  const [selectedId, setSelectedId] = useState<string | null>("m60");

  // Arrow overlay — measure each milestone card's position relative to the
  // grid and draw orthogonal paths between dependent cards.
  const gridRef = useRef<HTMLDivElement>(null);
  const cardRefs = useRef<Map<string, HTMLElement>>(new Map());
  const setCardRef = (id: string, el: HTMLElement | null) => {
    if (el) cardRefs.current.set(id, el);
    else cardRefs.current.delete(id);
  };
  const [arrows, setArrows] = useState<Array<{ id: string; d: string }>>([]);
  const [overlaySize, setOverlaySize] = useState<{ w: number; h: number }>({ w: 0, h: 0 });

  useLayoutEffect(() => {
    const compute = () => {
      const container = gridRef.current;
      if (!container) return;
      const cRect = container.getBoundingClientRect();
      setOverlaySize({ w: container.scrollWidth, h: container.scrollHeight });
      const out: Array<{ id: string; d: string }> = [];
      for (const dep of DEPENDENCIES) {
        const fromEl = cardRefs.current.get(dep.from);
        const toEl = cardRefs.current.get(dep.to);
        if (!fromEl || !toEl) continue;
        const f = fromEl.getBoundingClientRect();
        const t = toEl.getBoundingClientRect();
        const x1 = f.right - cRect.left;
        const y1 = f.top + f.height / 2 - cRect.top;
        const x2 = t.left - cRect.left - 4; // leave room for arrowhead
        const y2 = t.top + t.height / 2 - cRect.top;
        // Orthogonal path: out 10px, jog to target Y at midpoint, into target.
        const elbow = Math.max(x1 + 10, (x1 + x2) / 2);
        const d =
          Math.abs(y2 - y1) < 1
            ? `M ${x1} ${y1} H ${x2}`
            : `M ${x1} ${y1} H ${elbow} V ${y2} H ${x2}`;
        out.push({ id: `${dep.from}->${dep.to}`, d });
      }
      setArrows(out);
    };
    compute();
    const ro = new ResizeObserver(compute);
    if (gridRef.current) ro.observe(gridRef.current);
    window.addEventListener("resize", compute);
    return () => {
      ro.disconnect();
      window.removeEventListener("resize", compute);
    };
  }, []);

  // Index milestones by (party, phase)
  const cells = useMemo(() => {
    const map: Record<string, Milestone[]> = {};
    for (const m of MILESTONES) {
      const key = `${m.party}:${m.phase}`;
      (map[key] ??= []).push(m);
    }
    return map;
  }, []);

  // Per-party status counts
  const partyCounts = useMemo(() => {
    const out: Record<PartyId, Record<Status, number>> = {} as Record<
      PartyId,
      Record<Status, number>
    >;
    for (const p of PARTIES) {
      out[p.id] = { done: 0, in_progress: 0, open: 0, blocked: 0, n_a: 0 };
      for (const ph of PHASES) {
        if (NA_CELLS.has(`${p.id}:${ph.id}`)) out[p.id].n_a++;
      }
    }
    for (const m of MILESTONES) out[m.party][m.status]++;
    return out;
  }, []);

  const totals = useMemo(() => {
    const t: Record<Status, number> = { done: 0, in_progress: 0, open: 0, blocked: 0, n_a: 0 };
    for (const p of PARTIES) for (const s of Object.keys(t) as Status[]) t[s] += partyCounts[p.id][s];
    return t;
  }, [partyCounts]);

  const totalTracked = totals.done + totals.in_progress + totals.open + totals.blocked;
  const pctDone = totalTracked === 0 ? 0 : Math.round((totals.done / totalTracked) * 100);

  return (
    <div className="bg-slate-950 text-slate-100 rounded-xl overflow-hidden border border-slate-800">
      {/* Top bar */}
      <header className="border-b border-slate-800 bg-slate-900/50 backdrop-blur px-6 py-3 flex items-center gap-6">
        <div className="w-12 h-12 rounded-lg bg-slate-800 border border-slate-700 flex items-center justify-center">
          <Boxes className="w-5 h-5 text-slate-300" />
        </div>
        <div className="flex-1 flex items-center gap-6">
          <button className="flex items-center gap-2 px-3 py-1.5 rounded-md bg-slate-800/50 border border-slate-700 hover:border-slate-500 text-sm">
            <Grid3x3 className="w-4 h-4 text-slate-400" />
            Memorial General Hospital
            <span className="text-slate-500">▾</span>
          </button>
          <div className="flex-1 text-center">
            <h1 className="text-2xl font-semibold">Implementation Progress — Swimlane View</h1>
            <div className="mt-1 flex items-center justify-center gap-3 text-xs text-slate-400">
              <Legend status="open" />
              <Legend status="in_progress" />
              <Legend status="done" />
              <Legend status="n_a" />
              <Legend status="blocked" />
            </div>
          </div>
          <ProgressCard totals={totals} pct={pctDone} />
          <button className="flex items-center gap-1.5 px-3 py-1.5 rounded-md border border-slate-700 hover:border-slate-500 text-sm text-slate-300">
            <Filter className="w-3.5 h-3.5" />
            Filters
          </button>
          <button className="w-8 h-8 flex items-center justify-center rounded-md border border-slate-700 text-slate-400 hover:text-slate-200">
            <MoreVertical className="w-4 h-4" />
          </button>
        </div>
      </header>

      {/* Grid */}
      <div className="px-6 py-6 overflow-x-auto">
        <div className="relative" ref={gridRef}>
          <div
            className="grid gap-2 min-w-[1400px]"
            style={{
              gridTemplateColumns: `220px repeat(${PHASES.length}, minmax(170px, 1fr))`,
            }}
          >
            {/* Column headers */}
            <div className="text-[10px] uppercase tracking-wider text-slate-500 font-semibold self-end pb-3">
              Party / Vendor
            </div>
            {PHASES.map((p) => (
              <PhaseHeader key={p.id} phase={p} />
            ))}

            {/* Rows */}
            {PARTIES.map((party) => (
              <RowFragment
                key={party.id}
                party={party}
                counts={partyCounts[party.id]}
                getCell={(phaseId) => {
                  const key = `${party.id}:${phaseId}`;
                  if (NA_CELLS.has(key)) return "n_a" as const;
                  return cells[key] ?? [];
                }}
                selectedId={selectedId}
                onSelect={(id) => setSelectedId(id)}
                setCardRef={setCardRef}
              />
            ))}

            {/* Add-party row — lets the scheduler add a custom party
                (e.g. "Third-party IT") that isn't in the default list. */}
            <AddPartyRow />
          </div>

          {/* Dependency arrows overlay */}
          <svg
            className="absolute inset-0 pointer-events-none text-sky-400/60"
            width={overlaySize.w}
            height={overlaySize.h}
            style={{ minWidth: 1400 }}
          >
            <defs>
              <marker
                id="arrowhead"
                viewBox="0 0 10 10"
                refX="9"
                refY="5"
                markerWidth="6"
                markerHeight="6"
                orient="auto-start-reverse"
              >
                <path d="M 0 0 L 10 5 L 0 10 z" fill="currentColor" />
              </marker>
            </defs>
            {arrows.map((a) => (
              <path
                key={a.id}
                d={a.d}
                stroke="currentColor"
                strokeWidth="1.5"
                fill="none"
                markerEnd="url(#arrowhead)"
              />
            ))}
          </svg>
        </div>
      </div>

      {/* Footer hint */}
      <div className="border-t border-slate-800 bg-slate-900/30 px-6 py-3 text-center text-xs text-slate-500">
        Click any milestone to (eventually) edit details, change status, or add comments.
      </div>
    </div>
  );
}

// ── Sub-components ──────────────────────────────────────────────────────────

function Legend({ status }: { status: Status }) {
  const s = STATUS_STYLE[status];
  return (
    <div className="flex items-center gap-1.5">
      <span className={cn("w-2 h-2 rounded-full", s.dot)} />
      <span>{s.label}</span>
    </div>
  );
}

function ProgressCard({ totals, pct }: { totals: Record<Status, number>; pct: number }) {
  return (
    <div className="flex items-center gap-4 px-4 py-2 rounded-lg border border-slate-700 bg-slate-800/40">
      <div className="relative w-12 h-12">
        <svg viewBox="0 0 36 36" className="w-12 h-12 -rotate-90">
          <circle cx="18" cy="18" r="15" fill="none" stroke="currentColor" strokeWidth="3" className="text-slate-700" />
          <circle
            cx="18"
            cy="18"
            r="15"
            fill="none"
            stroke="currentColor"
            strokeWidth="3"
            strokeDasharray={`${(pct * 94.2) / 100} 94.2`}
            className="text-emerald-400"
            strokeLinecap="round"
          />
        </svg>
        <div className="absolute inset-0 flex items-center justify-center text-xs font-semibold">
          {pct}%
        </div>
      </div>
      <div className="text-xs">
        <div className="text-slate-500 mb-1">Overall Progress</div>
        <div className="flex gap-3">
          <Stat label="Done" value={totals.done} tone="text-emerald-400" />
          <Stat label="In Progress" value={totals.in_progress} tone="text-amber-400" />
          <Stat label="Open" value={totals.open} tone="text-slate-300" />
          <Stat label="Blocked" value={totals.blocked} tone="text-red-400" />
        </div>
      </div>
    </div>
  );
}

function Stat({ label, value, tone }: { label: string; value: number; tone: string }) {
  return (
    <div className="flex flex-col">
      <span className={cn("text-[10px] uppercase tracking-wider", tone)}>{label}</span>
      <span className="font-semibold text-slate-100">{value}</span>
    </div>
  );
}

function PhaseHeader({ phase }: { phase: Phase }) {
  const { Icon } = phase;
  const attendees = PHASE_ATTENDEES[phase.id] ?? [];
  const partyById = Object.fromEntries(PARTIES.map((p) => [p.id, p]));
  return (
    <div className="flex flex-col items-center text-center gap-1.5 pb-2">
      <div className="w-8 h-8 rounded-md bg-slate-800 border border-slate-700 flex items-center justify-center">
        <Icon className="w-4 h-4 text-slate-400" />
      </div>
      <div className="text-[10px] uppercase tracking-wider text-slate-500 font-semibold">
        Phase {phase.num}
      </div>
      <div className="text-xs font-medium text-slate-200 leading-tight">{phase.title}</div>

      {/* Required attendees — who needs to be involved in this phase. */}
      <div className="mt-1 flex items-center gap-1">
        <div className="flex -space-x-1.5">
          {attendees.map((pid) => {
            const p = partyById[pid];
            if (!p) return null;
            return (
              <span
                key={pid}
                title={p.name}
                className={cn(
                  "w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-semibold ring-2 ring-slate-950",
                  p.avatarRing,
                )}
              >
                {p.initial}
              </span>
            );
          })}
        </div>
        <button
          title="Manage required attendees for this phase"
          className="w-5 h-5 rounded-full border border-dashed border-slate-600 text-slate-500 hover:text-slate-200 hover:border-slate-400 flex items-center justify-center ml-0.5"
        >
          <Plus className="w-3 h-3" />
        </button>
      </div>
    </div>
  );
}

function RowFragment({
  party,
  counts,
  getCell,
  selectedId,
  onSelect,
  setCardRef,
}: {
  party: Party;
  counts: Record<Status, number>;
  getCell: (phaseId: string) => "n_a" | Milestone[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  setCardRef: (id: string, el: HTMLElement | null) => void;
}) {
  return (
    <>
      {/* Party label */}
      <div className="flex items-start gap-3 py-3 border-t border-slate-800">
        <div
          className={cn(
            "w-8 h-8 rounded-full flex items-center justify-center font-semibold text-sm shrink-0",
            party.avatarRing,
          )}
        >
          {party.initial}
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-sm font-medium text-slate-100 leading-tight">{party.name}</div>
          <div className="mt-1.5 flex items-center gap-1.5 text-[10px]">
            <Chip dot="bg-emerald-400" value={counts.done} />
            <Chip dot="bg-amber-400" value={counts.in_progress} />
            <Chip dot="bg-slate-400" value={counts.open} />
            <Chip dot="bg-red-400" value={counts.blocked} />
            <Chip dot="bg-slate-600" value={counts.n_a} muted />
          </div>
        </div>
      </div>

      {/* Cells */}
      {PHASES.map((phase) => {
        const cell = getCell(phase.id);
        return (
          <div key={phase.id} className="py-3 border-t border-slate-800 flex flex-col gap-1.5">
            {cell === "n_a" ? (
              <NaCell />
            ) : cell.length === 0 ? (
              <EmptyCell />
            ) : (
              cell.map((m) => (
                <MilestoneCard
                  key={m.id}
                  milestone={m}
                  selected={selectedId === m.id}
                  onClick={() => onSelect(m.id)}
                  cardRef={(el) => setCardRef(m.id, el)}
                />
              ))
            )}
          </div>
        );
      })}
    </>
  );
}

function Chip({ dot, value, muted }: { dot: string; value: number; muted?: boolean }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full border",
        muted ? "border-slate-800 text-slate-500" : "border-slate-700 text-slate-300",
      )}
    >
      <span className={cn("w-1.5 h-1.5 rounded-full", dot)} />
      <span className="tabular-nums">{value}</span>
    </span>
  );
}

function MilestoneCard({
  milestone,
  selected,
  onClick,
  cardRef,
}: {
  milestone: Milestone;
  selected: boolean;
  onClick: () => void;
  cardRef?: (el: HTMLElement | null) => void;
}) {
  const s = STATUS_STYLE[milestone.status];
  return (
    <button
      ref={cardRef}
      onClick={onClick}
      className={cn(
        "text-left rounded-md border px-2.5 py-2 transition-all cursor-pointer",
        s.card,
        selected && "ring-2 ring-sky-400 ring-offset-0",
      )}
    >
      <div className="text-xs font-semibold text-slate-100 leading-snug">{milestone.title}</div>
      <div className="mt-2 flex items-center gap-1.5">
        <span className="inline-flex items-center gap-1 text-[10px] font-medium text-slate-300 bg-slate-900/50 border border-slate-700 rounded px-1.5 py-0.5">
          <Circle className="w-2 h-2 fill-current" />
          {PARTY_LABEL[milestone.owner]}
        </span>
      </div>
    </button>
  );
}

function AddPartyRow() {
  return (
    <>
      <button
        className="flex items-center gap-2 py-3 border-t border-slate-800 text-left text-slate-400 hover:text-slate-200"
        title="Add a new party (e.g. Third-party IT)"
      >
        <span className="w-8 h-8 rounded-full border border-dashed border-slate-600 flex items-center justify-center shrink-0">
          <UserPlus className="w-3.5 h-3.5" />
        </span>
        <span className="text-sm italic">Add party…</span>
      </button>
      {PHASES.map((p) => (
        <div
          key={p.id}
          className="py-3 border-t border-slate-800 border-dashed"
        />
      ))}
    </>
  );
}

function NaCell() {
  return (
    <div className="h-full min-h-[56px] flex items-center justify-center rounded-md border border-dashed border-slate-800 bg-slate-900/40 text-xs font-medium text-slate-600">
      N/A
    </div>
  );
}

function EmptyCell() {
  return <div className="h-full min-h-[56px]" />;
}

// Default export for the standalone /swimlane-mockup route — adds a page
// wrapper (full viewport background + padding) around the shared component.
export default function SwimlaneMockupPage() {
  return (
    <div className="min-h-screen bg-slate-950 p-4">
      <SwimlaneMockup />
    </div>
  );
}

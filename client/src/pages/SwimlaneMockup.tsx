/**
 * SwimlaneMockup — design exploration for the implementation schedule view.
 * Route: /swimlane-mockup (not linked from nav; open directly).
 *
 * Reframe: the current swimlane mixes "who owns the task" with "which phase"
 * in a grid that wastes space. The scheduler's real job is simpler:
 *   1. For each meeting, who needs to be there?
 *   2. Have they been invited yet?
 *   3. What's on the agenda?
 *
 * So this mockup makes each phase a MEETING CARD with:
 *   - Date + duration (editable by the scheduler)
 *   - Attendees (required / optional), each with an invite status
 *   - Agenda = the tasks in that phase
 *   - A single "Send pending invites" action
 *
 * All data is hardcoded — no tRPC, no DB. This is just a visual mockup.
 */

import { useState } from "react";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { SECTION_DEFS } from "@shared/taskDefs";
import {
  CalendarDays,
  Clock,
  Send,
  Check,
  Circle,
  CircleDashed,
  CircleCheck,
  Minus,
  ChevronLeft,
  AlertCircle,
} from "lucide-react";

// ── Sample data ─────────────────────────────────────────────────────────────

type OrgId =
  | "hospital"
  | "rad_group"
  | "silverback"
  | "scipio"
  | "new_lantern";

const ORGS: Record<OrgId, { label: string; contact: string; pill: string }> = {
  hospital: {
    label: "Hospital IT",
    contact: "Dana Pham",
    pill: "bg-blue-500/15 text-blue-300 border-blue-500/30",
  },
  rad_group: {
    label: "Rad Group",
    contact: "Dr. Okafor",
    pill: "bg-orange-500/15 text-orange-300 border-orange-500/30",
  },
  silverback: {
    label: "Silverback",
    contact: "Priya Naidu",
    pill: "bg-slate-500/20 text-slate-200 border-slate-500/30",
  },
  scipio: {
    label: "Scipio",
    contact: "Marcus Chen",
    pill: "bg-violet-500/15 text-violet-300 border-violet-500/30",
  },
  new_lantern: {
    label: "New Lantern",
    contact: "J. Starling",
    pill: "bg-purple-500/15 text-purple-300 border-purple-500/30",
  },
};

type InviteState = "sent" | "pending" | "none";
type AttendeeRole = "required" | "optional";
type TaskStatus = "open" | "in_progress" | "complete" | "n_a" | "blocked";

// Agenda content comes from three sources in the portal:
//   - intake  → shared/questionnaireData.ts (partner's answers)
//   - tasks   → shared/taskDefs.ts (implementation checklist)
//   - tests   → client/src/pages/Validation.tsx (test plan)
// Task list and test plan overlap in Phases 6–7 — same work described twice.
type AgendaSource = "intake" | "tasks" | "tests";

interface AgendaItem {
  id: string;
  title: string;
  status: TaskStatus;
  source: AgendaSource;
  duplicateWith?: string; // label from the other source that covers the same work
}

interface Meeting {
  // If phaseId is set, the meeting title + default agenda come from SECTION_DEFS.
  // If title/agenda are set, they override. Kickoff uses overrides since it
  // isn't a phase — it's the project-opening meeting.
  phaseId?: string;
  title?: string;
  agenda?: AgendaItem[];
  date: string | null; // human-readable; null = TBD
  duration: string;
  attendees: Partial<Record<OrgId, { role: AttendeeRole; invite: InviteState }>>;
  taskStatuses: Record<string, TaskStatus>;
}

// Meeting 1: project kickoff — everyone attends, agenda is orientation + plan.
// Meetings 2–8: one per phase, attendees reflect who actually does that work.
const MEETINGS: Meeting[] = [
  {
    title: "Project Kickoff",
    date: "Mon Apr 21 · 1:00 PM",
    duration: "90 min",
    attendees: {
      hospital: { role: "required", invite: "sent" },
      rad_group: { role: "required", invite: "sent" },
      silverback: { role: "required", invite: "sent" },
      scipio: { role: "required", invite: "sent" },
      new_lantern: { role: "required", invite: "sent" },
    },
    agenda: [
      { id: "kick:process", title: "Implementation process walk-through", status: "complete", source: "intake" },
      { id: "kick:questionnaire", title: "Review intake questionnaire", status: "complete", source: "intake" },
      { id: "kick:codes", title: "Procedure codes — list + mapping plan", status: "in_progress", source: "intake" },
      { id: "kick:routing", title: "Data routing plan (EHR → New Lantern → PACS)", status: "in_progress", source: "intake" },
      { id: "kick:users", title: "Users — roles, accounts, SSO approach", status: "open", source: "intake" },
      { id: "kick:timeline", title: "Timelines — confirm dates for all phases", status: "open", source: "intake" },
      { id: "kick:raci", title: "Assignments — who does what across orgs", status: "open", source: "intake" },
    ],
    taskStatuses: {},
  },
  {
    phaseId: "network",
    date: "Mon Apr 28 · 2:00 PM",
    duration: "60 min",
    attendees: {
      hospital: { role: "required", invite: "sent" },
      scipio: { role: "required", invite: "sent" },
      silverback: { role: "required", invite: "sent" },
      new_lantern: { role: "required", invite: "sent" },
    },
    taskStatuses: {
      "network:vpn": "complete",
      "network:firewall": "complete",
      "network:dicom-t": "complete",
      "network:dicom-p": "in_progress",
      "network:hl7-port": "complete",
    },
  },
  {
    phaseId: "hl7",
    date: "Mon May 5 · 10:00 AM",
    duration: "90 min",
    attendees: {
      silverback: { role: "required", invite: "sent" },
      hospital: { role: "required", invite: "sent" },
      new_lantern: { role: "required", invite: "pending" },
    },
    taskStatuses: {
      "hl7:orm": "in_progress",
      "hl7:oru": "in_progress",
      "hl7:adt": "open",
      "hl7:oru-spec": "complete",
      "hl7:orm-spec": "complete",
      "hl7:validate": "open",
    },
  },
  {
    phaseId: "config",
    date: null,
    duration: "60 min",
    attendees: {
      rad_group: { role: "required", invite: "none" },
      new_lantern: { role: "required", invite: "none" },
      hospital: { role: "optional", invite: "none" },
    },
    taskStatuses: {
      "config:proc": "open",
      "config:users": "open",
      "config:provider": "open",
      "config:worklist": "open",
      "config:sso": "n_a",
    },
  },
  {
    phaseId: "templates",
    date: null,
    duration: "60 min",
    attendees: {
      rad_group: { role: "required", invite: "none" },
      new_lantern: { role: "required", invite: "none" },
    },
    taskStatuses: {
      "tmpl:worklist": "open",
      "tmpl:reports": "open",
      "tmpl:macros": "open",
    },
  },
  {
    phaseId: "training",
    date: null,
    duration: "90 min",
    attendees: {
      rad_group: { role: "required", invite: "none" },
      hospital: { role: "required", invite: "none" },
      new_lantern: { role: "required", invite: "none" },
    },
    taskStatuses: {
      "train:admin": "open",
      "train:tech": "open",
      "train:users": "open",
      "train:downtime": "open",
      "train:troubleshoot": "open",
    },
  },
  {
    phaseId: "testing",
    date: null,
    duration: "half day",
    attendees: {
      hospital: { role: "required", invite: "none" },
      rad_group: { role: "required", invite: "none" },
      silverback: { role: "required", invite: "none" },
      new_lantern: { role: "required", invite: "none" },
      scipio: { role: "optional", invite: "none" },
    },
    taskStatuses: {
      "test:e2e": "open",
      "test:edge": "open",
      "test:perf": "open",
      "test:signoff": "open",
    },
  },
  {
    phaseId: "prod-validation",
    date: null,
    duration: "daily 15-min stand-ups",
    attendees: {
      hospital: { role: "required", invite: "none" },
      rad_group: { role: "required", invite: "none" },
      silverback: { role: "required", invite: "none" },
      new_lantern: { role: "required", invite: "none" },
    },
    taskStatuses: {},
  },
];

// Task-list IDs (from shared/taskDefs.ts) that describe the same work as an
// item in the test plan (client/src/pages/Validation.tsx). The string is the
// test-plan label so we can show the scheduler exactly what's duplicated.
const TASK_TEST_DUPLICATES: Record<string, string> = {
  "network:dicom-t": "Test plan · DICOM Echo Test (C-ECHO)",
  "network:dicom-p": "Test plan · DICOM Echo Test (C-ECHO)",
  "hl7:validate": "Test plan · ORM/ORU/ADT message tests",
  "test:e2e": "Test plan · End-to-End Order Workflow",
  "test:edge": "Test plan · STAT / Addendum / Cancel workflows",
  "test:perf": "Test plan · Performance & Load",
  "prod:stat": "Test plan · Priority Routing (STAT)",
  "prod:addendum": "Test plan · Addendum Workflow",
  "prod:cancel": "Test plan · Cancel a Study",
  "prod:downtime": "Test plan · Downtime Recovery",
  "prod:normal-wf": "Test plan · End-to-End Order Workflow",
};

// ── Status styling ──────────────────────────────────────────────────────────

const TASK_STATUS_STYLE: Record<
  TaskStatus,
  { dot: string; text: string; label: string; strike?: boolean }
> = {
  open: { dot: "bg-muted-foreground/30", text: "text-foreground/80", label: "Open" },
  in_progress: { dot: "bg-amber-400", text: "text-amber-200", label: "In progress" },
  complete: { dot: "bg-emerald-400", text: "text-emerald-200", label: "Done" },
  blocked: { dot: "bg-red-400", text: "text-red-200", label: "Blocked" },
  n_a: {
    dot: "bg-muted-foreground/15",
    text: "text-muted-foreground/60",
    label: "N/A",
    strike: true,
  },
};

// ── Helpers ─────────────────────────────────────────────────────────────────

function countPendingInvites(m: Meeting): number {
  return Object.values(m.attendees).filter((a) => a?.invite === "pending" || a?.invite === "none")
    .length;
}

function countSentInvites(m: Meeting): number {
  return Object.values(m.attendees).filter((a) => a?.invite === "sent").length;
}

function totalAttendees(m: Meeting): number {
  return Object.keys(m.attendees).length;
}

// ── Component ───────────────────────────────────────────────────────────────

export default function SwimlaneMockup() {
  const [dismissedNote, setDismissedNote] = useState(false);

  const totalMeetings = MEETINGS.length;
  const scheduledMeetings = MEETINGS.filter((m) => m.date).length;
  const totalInvites = MEETINGS.reduce((n, m) => n + totalAttendees(m), 0);
  const sentInvites = MEETINGS.reduce((n, m) => n + countSentInvites(m), 0);

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Top bar */}
      <div className="border-b border-border/40 bg-card/40 backdrop-blur">
        <div className="max-w-[1400px] mx-auto px-6 py-4 flex items-center justify-between">
          <div>
            <h1 className="text-lg font-semibold">Implementation Schedule — Mockup</h1>
            <p className="text-xs text-muted-foreground">
              Boulder Community Health · SRV · reframed as meeting-per-phase
            </p>
          </div>
          <div className="flex items-center gap-6 text-xs">
            <div>
              <span className="text-muted-foreground">Scheduled</span>{" "}
              <span className="font-semibold text-foreground">
                {scheduledMeetings}/{totalMeetings}
              </span>
            </div>
            <div>
              <span className="text-muted-foreground">Invites sent</span>{" "}
              <span className="font-semibold text-foreground">
                {sentInvites}/{totalInvites}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Designer note */}
      {!dismissedNote && (
        <div className="max-w-[1400px] mx-auto px-6 pt-4">
          <div className="rounded-lg border border-primary/30 bg-primary/5 p-3 text-xs flex items-start gap-3">
            <AlertCircle className="w-4 h-4 text-primary mt-0.5 shrink-0" />
            <div className="flex-1 space-y-1 text-muted-foreground">
              <p className="text-foreground font-medium">
                What's different vs. the current swimlane:
              </p>
              <ul className="list-disc pl-4 space-y-0.5">
                <li>
                  Each phase is a <span className="text-foreground">meeting card</span>, not a
                  column in an org-by-phase grid. Meeting 1 is the kickoff (process,
                  questionnaire, codes, routing, users, timelines, assignments).
                </li>
                <li>
                  Orgs only appear in meetings they attend — no more Hospital IT row padded
                  with five strikethrough HL7 items.
                </li>
                <li>
                  Every attendee has an <span className="text-foreground">invite state</span>{" "}
                  (sent / pending / none), with a per-meeting "Send pending" action.
                </li>
                <li>
                  Agenda pulls from three sources, tagged inline:{" "}
                  <span className="text-cyan-300">intake</span>,{" "}
                  <span className="text-indigo-300">tasks</span>,{" "}
                  <span className="text-pink-300">tests</span>. Items tracked in both the
                  task list and the test plan show a{" "}
                  <span className="text-amber-300">dup</span> warning — those need to be
                  reconciled (one source of truth) before this view ships.
                </li>
              </ul>
            </div>
            <button
              onClick={() => setDismissedNote(true)}
              className="text-muted-foreground hover:text-foreground"
              aria-label="Dismiss"
            >
              <ChevronLeft className="w-4 h-4 rotate-45" />
            </button>
          </div>
        </div>
      )}

      {/* Meeting strip */}
      <div className="max-w-[1400px] mx-auto px-6 py-6">
        <div className="overflow-x-auto pb-4 -mx-2 px-2">
          <div
            className="grid gap-4"
            style={{ gridTemplateColumns: `repeat(${MEETINGS.length}, minmax(280px, 1fr))` }}
          >
            {MEETINGS.map((m, idx) => (
              <MeetingCard key={m.phaseId ?? m.title ?? idx} meeting={m} index={idx} />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Meeting card ────────────────────────────────────────────────────────────

function MeetingCard({ meeting, index }: { meeting: Meeting; index: number }) {
  const section = meeting.phaseId
    ? SECTION_DEFS.find((s) => s.id === meeting.phaseId)
    : undefined;

  const title = meeting.title ?? section?.title ?? "Untitled meeting";

  // Agenda resolution: explicit override wins, else derive from phase tasks
  // with statuses looked up in taskStatuses (default "open").
  const agenda: AgendaItem[] =
    meeting.agenda ??
    section?.tasks.map((t) => ({
      id: t.id,
      title: t.title,
      status: meeting.taskStatuses[t.id] ?? "open",
      source: "tasks" as const,
      duplicateWith: TASK_TEST_DUPLICATES[t.id],
    })) ??
    [];

  const pending = countPendingInvites(meeting);
  const isScheduled = Boolean(meeting.date);

  return (
    <div
      className={cn(
        "rounded-xl border bg-card/60 flex flex-col overflow-hidden",
        isScheduled ? "border-border/60" : "border-dashed border-border/40",
      )}
    >
      {/* Header */}
      <div className="p-3 border-b border-border/40 space-y-2">
        <div className="flex items-center justify-between">
          <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">
            Meeting {index + 1}
          </span>
          <Badge
            variant="outline"
            className={cn(
              "text-[10px] px-1.5 py-0 h-4",
              isScheduled
                ? "border-emerald-500/40 text-emerald-300 bg-emerald-500/10"
                : "border-muted-foreground/30 text-muted-foreground",
            )}
          >
            {isScheduled ? "scheduled" : "unscheduled"}
          </Badge>
        </div>

        <h3 className="text-sm font-semibold text-foreground leading-snug">{title}</h3>

        <div className="flex items-center gap-3 text-[11px] text-muted-foreground">
          <span className="inline-flex items-center gap-1">
            <CalendarDays className="w-3 h-3" />
            {meeting.date ?? (
              <button className="underline underline-offset-2 hover:text-foreground">
                Set date
              </button>
            )}
          </span>
          <span className="inline-flex items-center gap-1">
            <Clock className="w-3 h-3" />
            {meeting.duration}
          </span>
        </div>
      </div>

      {/* Attendees */}
      <div className="p-3 border-b border-border/40">
        <div className="flex items-center justify-between mb-2">
          <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">
            Attendees
          </span>
          {pending > 0 && (
            <button className="inline-flex items-center gap-1 text-[10px] font-medium text-primary hover:underline">
              <Send className="w-3 h-3" />
              Send {pending} pending
            </button>
          )}
        </div>
        <div className="space-y-1.5">
          {(Object.entries(meeting.attendees) as Array<[OrgId, { role: AttendeeRole; invite: InviteState }]>).map(
            ([orgId, a]) => (
              <AttendeeRow key={orgId} orgId={orgId} role={a.role} invite={a.invite} />
            ),
          )}
        </div>
      </div>

      {/* Agenda */}
      <div className="p-3 flex-1">
        <div className="flex items-center justify-between mb-2">
          <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">
            Agenda
          </span>
          <span className="text-[10px] text-muted-foreground">{agenda.length} items</span>
        </div>
        <ul className="space-y-2">
          {agenda.map((item) => {
            const s = TASK_STATUS_STYLE[item.status];
            return (
              <li key={item.id} className="flex items-start gap-2 text-xs leading-snug">
                <span className={cn("w-1.5 h-1.5 rounded-full mt-1.5 shrink-0", s.dot)} />
                <div className="flex-1 min-w-0">
                  <div className="flex items-start gap-1.5">
                    <span className={cn("flex-1", s.text, s.strike && "line-through")}>
                      {item.title}
                    </span>
                    <SourceTag source={item.source} />
                  </div>
                  {item.duplicateWith && (
                    <div
                      className="mt-0.5 flex items-center gap-1 text-[10px] text-amber-300/80"
                      title="This work is also tracked in the test plan"
                    >
                      <AlertCircle className="w-3 h-3 shrink-0" />
                      <span className="truncate">dup · {item.duplicateWith}</span>
                    </div>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
}

// ── Attendee row ────────────────────────────────────────────────────────────

function AttendeeRow({
  orgId,
  role,
  invite,
}: {
  orgId: OrgId;
  role: AttendeeRole;
  invite: InviteState;
}) {
  const org = ORGS[orgId];
  return (
    <div className="flex items-center gap-2">
      <InviteIcon state={invite} />
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5">
          <Badge
            variant="outline"
            className={cn("text-[10px] h-4 px-1.5 py-0 shrink-0", org.pill)}
          >
            {org.label}
          </Badge>
          {role === "optional" && (
            <span className="text-[10px] text-muted-foreground italic">optional</span>
          )}
        </div>
        <div className="text-[10px] text-muted-foreground truncate">{org.contact}</div>
      </div>
    </div>
  );
}

function SourceTag({ source }: { source: AgendaSource }) {
  const styles: Record<AgendaSource, { label: string; className: string }> = {
    intake: {
      label: "intake",
      className: "bg-cyan-500/15 text-cyan-300 border-cyan-500/30",
    },
    tasks: {
      label: "tasks",
      className: "bg-indigo-500/15 text-indigo-300 border-indigo-500/30",
    },
    tests: {
      label: "tests",
      className: "bg-pink-500/15 text-pink-300 border-pink-500/30",
    },
  };
  const s = styles[source];
  return (
    <span
      className={cn(
        "shrink-0 text-[9px] font-medium uppercase tracking-wider border rounded px-1 py-[1px]",
        s.className,
      )}
      title={`Content comes from the ${source} data source`}
    >
      {s.label}
    </span>
  );
}

function InviteIcon({ state }: { state: InviteState }) {
  if (state === "sent") {
    return (
      <span title="Invite sent" className="text-emerald-400 shrink-0">
        <CircleCheck className="w-3.5 h-3.5" />
      </span>
    );
  }
  if (state === "pending") {
    return (
      <span title="Invite pending" className="text-amber-400 shrink-0">
        <CircleDashed className="w-3.5 h-3.5" />
      </span>
    );
  }
  return (
    <span title="Not yet invited" className="text-muted-foreground/50 shrink-0">
      <Circle className="w-3.5 h-3.5" />
    </span>
  );
}

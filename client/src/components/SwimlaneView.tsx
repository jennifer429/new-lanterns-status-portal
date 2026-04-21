/**
 * SwimlaneView — Visualizes tasks as colored blocks in org swimlanes.
 *
 * Layout:
 *   - Rows = implementation orgs (Hospital IT, EHR Vendor, Silverback, New Lantern, etc.)
 *   - Columns = phases (Network, HL7, Config, Templates, Training, Testing, Prod Validation)
 *   - Task blocks sit in the row of the org they're assigned to
 *   - Colors: yellow = in progress, green = done, red = blocked, gray = N/A, outline = open
 *
 * Rules:
 *   - New Lantern always on the right (highest sortOrder)
 *   - Silverback in the middle
 *   - PM can assign tasks to orgs via dropdown on each task block
 */

import { useState, useMemo } from "react";
import { trpc } from "@/lib/trpc";
import { SECTION_DEFS } from "@shared/taskDefs";
import { cn } from "@/lib/utils";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import {
  Building2,
  ChevronDown,
  Plus,
  Settings2,
  X,
  GripVertical,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";

// ── Status → Color mapping ───────────────────────────────────────────────────

type TaskStatus = "open" | "in_progress" | "complete" | "n_a" | "blocked";

const STATUS_STYLES: Record<TaskStatus, { bg: string; border: string; text: string; label: string }> = {
  open:        { bg: "bg-muted/30",          border: "border-border/60",        text: "text-foreground/70",    label: "Open" },
  in_progress: { bg: "bg-amber-500/15",      border: "border-amber-500/40",     text: "text-amber-300",        label: "In Progress" },
  complete:    { bg: "bg-emerald-500/15",     border: "border-emerald-500/40",   text: "text-emerald-400",      label: "Done" },
  n_a:         { bg: "bg-muted/20",          border: "border-muted/40",         text: "text-muted-foreground/50", label: "N/A" },
  blocked:     { bg: "bg-red-500/15",        border: "border-red-500/40",       text: "text-red-400",          label: "Blocked" },
};

// ── Org type → default icon color ────────────────────────────────────────────

const ORG_TYPE_COLORS: Record<string, string> = {
  hospital:    "bg-blue-500/20 text-blue-400 border-blue-500/30",
  ehr_vendor:  "bg-cyan-500/20 text-cyan-400 border-cyan-500/30",
  ris_vendor:  "bg-teal-500/20 text-teal-400 border-teal-500/30",
  pacs_vendor: "bg-indigo-500/20 text-indigo-400 border-indigo-500/30",
  rad_group:   "bg-orange-500/20 text-orange-400 border-orange-500/30",
  silverback:  "bg-slate-500/20 text-slate-300 border-slate-500/30",
  scipio:      "bg-violet-500/20 text-violet-400 border-violet-500/30",
  new_lantern: "bg-purple-500/20 text-purple-400 border-purple-500/30",
  other:       "bg-zinc-500/20 text-zinc-400 border-zinc-500/30",
};

// ── Props ────────────────────────────────────────────────────────────────────

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

export function SwimlaneView({ organizationSlug, taskMap }: SwimlaneViewProps) {
  const [showOrgManager, setShowOrgManager] = useState(false);
  const [newOrgName, setNewOrgName] = useState("");
  const [newOrgType, setNewOrgType] = useState("other");

  // ── Data fetching ──────────────────────────────────────────────────────────

  const utils = trpc.useUtils();

  const { data: implOrgs = [], isLoading: orgsLoading } =
    trpc.swimlane.getOrgs.useQuery({ organizationSlug });

  const { data: assignments = {}, isLoading: assignmentsLoading } =
    trpc.swimlane.getAssignments.useQuery({ organizationSlug });

  const assignTask = trpc.swimlane.assignTask.useMutation({
    onSuccess: () => {
      utils.swimlane.getAssignments.invalidate({ organizationSlug });
    },
    onError: () => toast.error("Failed to assign task"),
  });

  const unassignTask = trpc.swimlane.unassignTask.useMutation({
    onSuccess: () => {
      utils.swimlane.getAssignments.invalidate({ organizationSlug });
    },
    onError: () => toast.error("Failed to unassign task"),
  });

  const addOrg = trpc.swimlane.addOrg.useMutation({
    onSuccess: () => {
      utils.swimlane.getOrgs.invalidate({ organizationSlug });
      setNewOrgName("");
      setNewOrgType("other");
      toast.success("Organization added");
    },
    onError: () => toast.error("Failed to add organization"),
  });

  const removeOrg = trpc.swimlane.removeOrg.useMutation({
    onSuccess: () => {
      utils.swimlane.getOrgs.invalidate({ organizationSlug });
      toast.success("Organization removed");
    },
    onError: () => toast.error("Failed to remove organization"),
  });

  // ── Derived data ───────────────────────────────────────────────────────────

  function getTaskStatus(taskId: string): TaskStatus {
    const t = taskMap[taskId];
    if (!t) return "open";
    if (t.completed) return "complete";
    if (t.notApplicable) return "n_a";
    if (t.blocked) return "blocked";
    if (t.inProgress) return "in_progress";
    return "open";
  }

  // Build a lookup: implOrgId → list of tasks assigned to it, grouped by section
  const orgTaskMap = useMemo(() => {
    const map: Record<number, Record<string, string[]>> = {};
    for (const org of implOrgs) {
      map[org.id] = {};
      for (const section of SECTION_DEFS) {
        map[org.id][section.id] = [];
      }
    }
    // Place assigned tasks
    for (const [taskId, implOrgId] of Object.entries(assignments)) {
      if (map[implOrgId]) {
        const section = SECTION_DEFS.find(s => s.tasks.some(t => t.id === taskId));
        if (section && map[implOrgId][section.id]) {
          map[implOrgId][section.id].push(taskId);
        }
      }
    }
    return map;
  }, [implOrgs, assignments]);

  // Unassigned tasks per section
  const unassignedBySection = useMemo(() => {
    const map: Record<string, string[]> = {};
    for (const section of SECTION_DEFS) {
      map[section.id] = section.tasks
        .filter(t => !assignments[t.id])
        .map(t => t.id);
    }
    return map;
  }, [assignments]);

  const hasUnassigned = Object.values(unassignedBySection).some(arr => arr.length > 0);

  // ── Task block component ───────────────────────────────────────────────────

  function TaskBlock({ taskId }: { taskId: string }) {
    const status = getTaskStatus(taskId);
    const style = STATUS_STYLES[status];
    const taskDef = SECTION_DEFS.flatMap(s => s.tasks).find(t => t.id === taskId);
    if (!taskDef) return null;

    const shortLabel = taskDef.title.length > 22
      ? taskDef.title.slice(0, 20) + "…"
      : taskDef.title;

    return (
      <Tooltip>
        <TooltipTrigger asChild>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                className={cn(
                  "block w-full text-left px-2 py-1.5 rounded-md border text-xs font-medium transition-all cursor-pointer",
                  "hover:ring-1 hover:ring-primary/30",
                  style.bg, style.border, style.text,
                  status === "n_a" && "opacity-50 line-through"
                )}
              >
                {shortLabel}
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="w-52">
              <div className="px-2 py-1.5 text-xs font-semibold text-foreground">{taskDef.title}</div>
              {taskDef.description && (
                <div className="px-2 pb-1.5 text-xs text-muted-foreground">{taskDef.description}</div>
              )}
              <DropdownMenuSeparator />
              <div className="px-2 py-1 text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">
                Assign to
              </div>
              {implOrgs.map(org => (
                <DropdownMenuItem
                  key={org.id}
                  onClick={() => assignTask.mutate({ organizationSlug, taskId, implOrgId: org.id })}
                  className={cn(
                    "gap-2 cursor-pointer text-xs",
                    assignments[taskId] === org.id && "bg-primary/10 text-primary"
                  )}
                >
                  <Building2 className="w-3 h-3" />
                  {org.name}
                  {assignments[taskId] === org.id && (
                    <span className="ml-auto text-[10px] text-primary">✓</span>
                  )}
                </DropdownMenuItem>
              ))}
              {assignments[taskId] && (
                <>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    onClick={() => unassignTask.mutate({ organizationSlug, taskId })}
                    className="gap-2 cursor-pointer text-xs text-destructive"
                  >
                    <X className="w-3 h-3" />
                    Unassign
                  </DropdownMenuItem>
                </>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        </TooltipTrigger>
        <TooltipContent side="top" className="max-w-xs">
          <p className="font-semibold text-xs">{taskDef.title}</p>
          {taskDef.description && <p className="text-xs text-muted-foreground mt-0.5">{taskDef.description}</p>}
          <p className="text-[10px] mt-1">
            Status: <span className={style.text}>{style.label}</span>
          </p>
        </TooltipContent>
      </Tooltip>
    );
  }

  // ── Loading state ──────────────────────────────────────────────────────────

  if (orgsLoading || assignmentsLoading) {
    return (
      <div className="flex items-center justify-center py-16 text-sm text-muted-foreground">
        Loading swimlane view…
      </div>
    );
  }

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          {/* Status legend */}
          <div className="flex items-center gap-3 text-xs">
            {Object.entries(STATUS_STYLES).map(([key, s]) => (
              <div key={key} className="flex items-center gap-1.5">
                <div className={cn("w-3 h-3 rounded-sm border", s.bg, s.border)} />
                <span className="text-muted-foreground">{s.label}</span>
              </div>
            ))}
          </div>
        </div>

        <button
          onClick={() => setShowOrgManager(!showOrgManager)}
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-foreground bg-muted/40 border border-border/40 rounded-md hover:bg-muted/60 hover:border-primary/30 transition-all"
        >
          <Settings2 className="w-3.5 h-3.5" />
          Manage Orgs
        </button>
      </div>

      {/* Org Manager Panel */}
      {showOrgManager && (
        <div className="rounded-lg border border-border/60 bg-card/50 p-4 space-y-3">
          <h4 className="text-sm font-semibold text-foreground">Implementation Organizations</h4>
          <p className="text-xs text-muted-foreground">
            Add or remove the organizations involved in this implementation. Each org becomes a swimlane row.
          </p>
          <div className="space-y-2">
            {implOrgs.map(org => (
              <div key={org.id} className="flex items-center justify-between px-3 py-2 rounded-md bg-muted/20 border border-border/30">
                <div className="flex items-center gap-2">
                  <GripVertical className="w-3.5 h-3.5 text-muted-foreground/40" />
                  <Badge variant="outline" className={cn("text-[10px]", ORG_TYPE_COLORS[org.orgType] || ORG_TYPE_COLORS.other)}>
                    {org.orgType.replace(/_/g, " ")}
                  </Badge>
                  <span className="text-sm font-medium text-foreground">{org.name}</span>
                </div>
                <button
                  onClick={() => removeOrg.mutate({ id: org.id })}
                  className="text-muted-foreground/40 hover:text-destructive transition-colors"
                  title="Remove org"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            ))}
          </div>

          {/* Add new org */}
          <div className="flex items-center gap-2 pt-2">
            <input
              value={newOrgName}
              onChange={e => setNewOrgName(e.target.value)}
              placeholder="Organization name…"
              className="flex-1 bg-background border border-border/60 rounded-md px-3 py-1.5 text-sm text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-1 focus:ring-primary/40"
            />
            <select
              value={newOrgType}
              onChange={e => setNewOrgType(e.target.value)}
              className="bg-background border border-border/60 rounded-md px-2 py-1.5 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary/40"
            >
              <option value="hospital">Hospital IT</option>
              <option value="ehr_vendor">EHR Vendor</option>
              <option value="ris_vendor">RIS Vendor</option>
              <option value="pacs_vendor">PACS/VNA Vendor</option>
              <option value="rad_group">Rad Group</option>
              <option value="silverback">Silverback</option>
              <option value="scipio">Scipio</option>
              <option value="new_lantern">New Lantern</option>
              <option value="other">Other</option>
            </select>
            <button
              onClick={() => {
                if (!newOrgName.trim()) return;
                addOrg.mutate({ organizationSlug, name: newOrgName.trim(), orgType: newOrgType });
              }}
              disabled={!newOrgName.trim() || addOrg.isPending}
              className="flex items-center gap-1 px-3 py-1.5 text-xs font-medium bg-primary text-primary-foreground rounded-md hover:bg-primary/90 disabled:opacity-50 transition-all"
            >
              <Plus className="w-3.5 h-3.5" />
              Add
            </button>
          </div>
        </div>
      )}

      {/* Swimlane Grid */}
      <div className="overflow-x-auto">
        <div className="min-w-[900px]">
          {/* Phase column headers */}
          <div className="grid gap-px" style={{ gridTemplateColumns: `180px repeat(${SECTION_DEFS.length}, 1fr)` }}>
            <div className="px-3 py-2 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              Organization
            </div>
            {SECTION_DEFS.map((section, idx) => (
              <div key={section.id} className="px-2 py-2 text-center">
                <div className="text-[10px] text-muted-foreground uppercase tracking-wider font-semibold">
                  Phase {idx + 1}
                </div>
                <div className="text-xs font-semibold text-foreground mt-0.5 truncate" title={section.title}>
                  {section.title}
                </div>
              </div>
            ))}
          </div>

          {/* Org swimlane rows */}
          {implOrgs.map((org, orgIdx) => (
            <div
              key={org.id}
              className={cn(
                "grid gap-px border-t border-border/30",
                orgIdx % 2 === 0 ? "bg-muted/5" : "bg-transparent"
              )}
              style={{ gridTemplateColumns: `180px repeat(${SECTION_DEFS.length}, 1fr)` }}
            >
              {/* Org label */}
              <div className="px-3 py-3 flex items-start gap-2">
                <Badge
                  variant="outline"
                  className={cn(
                    "text-[10px] whitespace-nowrap",
                    ORG_TYPE_COLORS[org.orgType] || ORG_TYPE_COLORS.other
                  )}
                >
                  {org.orgType.replace(/_/g, " ")}
                </Badge>
                <span className="text-xs font-medium text-foreground leading-tight">{org.name}</span>
              </div>

              {/* Phase cells */}
              {SECTION_DEFS.map(section => {
                const taskIds = orgTaskMap[org.id]?.[section.id] ?? [];
                return (
                  <div key={section.id} className="px-1.5 py-2 space-y-1 min-h-[48px]">
                    {taskIds.map(taskId => (
                      <TaskBlock key={taskId} taskId={taskId} />
                    ))}
                    {taskIds.length === 0 && (
                      <div className="h-full min-h-[32px]" />
                    )}
                  </div>
                );
              })}
            </div>
          ))}

          {/* Unassigned row */}
          {hasUnassigned && (
            <div
              className="grid gap-px border-t-2 border-dashed border-border/50 bg-muted/10"
              style={{ gridTemplateColumns: `180px repeat(${SECTION_DEFS.length}, 1fr)` }}
            >
              <div className="px-3 py-3 flex items-start gap-2">
                <Badge variant="outline" className="text-[10px] whitespace-nowrap border-dashed text-muted-foreground">
                  unassigned
                </Badge>
                <span className="text-xs text-muted-foreground italic leading-tight">Not yet assigned</span>
              </div>

              {SECTION_DEFS.map(section => {
                const taskIds = unassignedBySection[section.id] ?? [];
                return (
                  <div key={section.id} className="px-1.5 py-2 space-y-1 min-h-[48px]">
                    {taskIds.map(taskId => (
                      <TaskBlock key={taskId} taskId={taskId} />
                    ))}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Summary stats */}
      <div className="flex items-center gap-4 text-xs text-muted-foreground pt-2 border-t border-border/30">
        <span>{implOrgs.length} organizations</span>
        <span>·</span>
        <span>{SECTION_DEFS.reduce((sum, s) => sum + s.tasks.length, 0)} total tasks</span>
        <span>·</span>
        <span>{Object.keys(assignments).length} assigned</span>
        <span>·</span>
        <span>{SECTION_DEFS.reduce((sum, s) => sum + s.tasks.length, 0) - Object.keys(assignments).length} unassigned</span>
      </div>
    </div>
  );
}

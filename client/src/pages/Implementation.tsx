/**
 * Implementation Checklist Page - Static UI with mock data
 * Grouped by phase, each task has owner badge, target date, and status
 * Right sidebar: Timeline milestones + Days to Go-Live
 */

import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { CheckCircle2, Circle, AlertTriangle, Wrench, Calendar, Clock } from "lucide-react";
import { useRoute, Link } from "wouter";

// ── Owner badge component ──────────────────────────────────────────────────────
function OwnerBadge({ owner }: { owner: "Client" | "New Lantern" | "Joint" }) {
  const styles = {
    Client: "border-blue-500/40 text-blue-300 bg-blue-500/10",
    "New Lantern": "border-primary/40 text-primary bg-primary/10",
    Joint: "border-amber-500/40 text-amber-300 bg-amber-500/10",
  };
  return (
    <Badge variant="outline" className={`text-xs font-medium ${styles[owner]}`}>
      {owner}
    </Badge>
  );
}

// ── Status badge component ─────────────────────────────────────────────────────
function StatusBadge({ status }: { status: "Complete" | "In Progress" | "Not Started" | "Blocked" }) {
  const styles = {
    Complete: "bg-green-500/20 text-green-400 border-green-500/30",
    "In Progress": "bg-amber-500/20 text-amber-400 border-amber-500/30",
    "Not Started": "bg-muted text-muted-foreground border-border",
    Blocked: "bg-red-500/20 text-red-400 border-red-500/30",
  };
  return (
    <Badge variant="outline" className={`text-xs font-medium ${styles[status]}`}>
      {status}
    </Badge>
  );
}

// ── Mock data ──────────────────────────────────────────────────────────────────
interface Task {
  title: string;
  owner: "Client" | "New Lantern" | "Joint";
  target: string;
  status: "Complete" | "In Progress" | "Not Started" | "Blocked";
}

interface Section {
  title: string;
  tasks: Task[];
}

const sections: Section[] = [
  {
    title: "Network & Connectivity",
    tasks: [
      { title: "VPN Tunnel Configuration", owner: "Client", target: "Mar 15", status: "Complete" },
      { title: "Firewall Rules & Port Openings", owner: "Client", target: "Mar 15", status: "Complete" },
      { title: "DICOM Endpoint Testing (Test Env)", owner: "New Lantern", target: "Mar 20", status: "Complete" },
      { title: "DICOM Endpoint Testing (Production)", owner: "Joint", target: "Apr 1", status: "In Progress" },
    ],
  },
  {
    title: "HL7 Interface Build",
    tasks: [
      { title: "ORM Interface Configuration", owner: "New Lantern", target: "Mar 18", status: "Complete" },
      { title: "ORU Interface Configuration", owner: "New Lantern", target: "Mar 25", status: "In Progress" },
      { title: "ADT Interface Configuration", owner: "New Lantern", target: "Apr 1", status: "Not Started" },
      { title: "HL7 Message Validation", owner: "Joint", target: "Apr 5", status: "Not Started" },
    ],
  },
  {
    title: "System Configuration",
    tasks: [
      { title: "Procedure Code Mapping", owner: "New Lantern", target: "Mar 22", status: "Complete" },
      { title: "User Account Provisioning", owner: "New Lantern", target: "Apr 3", status: "Not Started" },
      { title: "Worklist Configuration", owner: "New Lantern", target: "Apr 8", status: "Not Started" },
    ],
  },
  {
    title: "Worklist & Templates",
    tasks: [
      { title: "Worklist Filter Setup", owner: "New Lantern", target: "Apr 10", status: "Not Started" },
      { title: "Report Template Configuration", owner: "New Lantern", target: "Apr 12", status: "Not Started" },
      { title: "Macro & Auto-text Setup", owner: "Joint", target: "Apr 14", status: "Not Started" },
    ],
  },
  {
    title: "End-to-End Testing",
    tasks: [
      { title: "Full Order-to-Report Workflow Test", owner: "Joint", target: "Apr 18", status: "Not Started" },
      { title: "Edge Case Testing (STAT, Addendum, etc.)", owner: "Joint", target: "Apr 20", status: "Not Started" },
      { title: "Performance & Load Testing", owner: "New Lantern", target: "Apr 22", status: "Not Started" },
      { title: "Go-Live Readiness Sign-Off", owner: "Joint", target: "Apr 25", status: "Not Started" },
    ],
  },
];

const milestones = [
  { label: "Intake Complete", date: "Mar 10", done: true },
  { label: "Connectivity Ready", date: "Mar 20", done: true },
  { label: "HL7 Interfaces Live", date: "Apr 1", inProgress: true },
  { label: "UAT Start", date: "Apr 10", done: false },
  { label: "Go-Live", date: "Apr 25", done: false },
];

export default function Implementation() {
  const [, params] = useRoute("/org/:slug/implement");
  const orgSlug = params?.slug || "demo";

  const allTasks = sections.flatMap((s) => s.tasks);
  const completedTasks = allTasks.filter((t) => t.status === "Complete").length;
  const totalTasks = allTasks.length;
  const completionPct = Math.round((completedTasks / totalTasks) * 100);

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "Complete":
        return <CheckCircle2 className="w-5 h-5 text-green-500 flex-shrink-0" />;
      case "In Progress":
        return <Clock className="w-5 h-5 text-amber-400 flex-shrink-0" />;
      case "Blocked":
        return <AlertTriangle className="w-5 h-5 text-red-400 flex-shrink-0" />;
      default:
        return <Circle className="w-5 h-5 text-muted-foreground flex-shrink-0" />;
    }
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border/50 bg-card">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <img src="/images/flame-icon.png" alt="New Lantern" className="h-8 w-8" />
            <div>
              <h1 className="text-xl font-bold">Implementation Checklist</h1>
              <p className="text-xs text-muted-foreground">PACS Onboarding</p>
            </div>
          </div>
          <Link href={`/org/${orgSlug}`} className="text-sm text-muted-foreground hover:text-foreground transition-colors">
            Back to Dashboard
          </Link>
        </div>
      </header>

      {/* Main content */}
      <div className="max-w-7xl mx-auto px-6 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-8">
          {/* Left column — Checklist */}
          <div className="space-y-6">
            {/* Progress header */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <Wrench className="w-5 h-5 text-primary" />
                  <span className="text-sm text-muted-foreground">
                    {completedTasks} of {totalTasks} tasks complete
                  </span>
                </div>
                <span className="text-sm font-bold text-primary">{completionPct}%</span>
              </div>
              <Progress value={completionPct} className="h-2" />
            </div>

            {/* Sections */}
            {sections.map((section, sIdx) => {
              const sectionCompleted = section.tasks.filter((t) => t.status === "Complete").length;
              const sectionTotal = section.tasks.length;
              return (
                <Card key={sIdx} className="border-border/50 overflow-hidden">
                  {/* Section header */}
                  <div className="px-5 py-3 bg-muted/30 border-b border-border/40">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-xs text-muted-foreground uppercase tracking-wider font-medium">
                          Section {sIdx + 1}
                        </p>
                        <h3 className="text-base font-bold mt-0.5">{section.title}</h3>
                      </div>
                      <Badge
                        variant="outline"
                        className={`text-xs ${
                          sectionCompleted === sectionTotal
                            ? "border-green-500/40 text-green-400"
                            : "border-border text-muted-foreground"
                        }`}
                      >
                        {sectionCompleted}/{sectionTotal}
                      </Badge>
                    </div>
                  </div>

                  {/* Task rows */}
                  <CardContent className="p-0">
                    {section.tasks.map((task, tIdx) => (
                      <div
                        key={tIdx}
                        className={`flex items-center gap-4 px-5 py-3 ${
                          tIdx < section.tasks.length - 1 ? "border-b border-border/30" : ""
                        } ${task.status === "Complete" ? "opacity-70" : ""}`}
                      >
                        {getStatusIcon(task.status)}
                        <span className="flex-1 text-sm font-medium min-w-0 truncate">
                          {task.title}
                        </span>
                        <OwnerBadge owner={task.owner} />
                        <span className="text-xs text-muted-foreground w-16 text-right flex-shrink-0">
                          {task.target}
                        </span>
                        <div className="w-24 flex-shrink-0 flex justify-end">
                          <StatusBadge status={task.status} />
                        </div>
                      </div>
                    ))}
                  </CardContent>
                </Card>
              );
            })}
          </div>

          {/* Right sidebar */}
          <div className="space-y-6">
            {/* Timeline */}
            <Card className="border-border/50 sticky top-8">
              <CardContent className="p-5 space-y-6">
                <h3 className="font-bold text-base flex items-center gap-2">
                  <Calendar className="w-4 h-4 text-primary" />
                  Timeline
                </h3>
                <div className="space-y-0">
                  {milestones.map((m, i) => (
                    <div key={i} className="flex items-start gap-3">
                      {/* Vertical line + dot */}
                      <div className="flex flex-col items-center">
                        <div
                          className={`w-3 h-3 rounded-full flex-shrink-0 ${
                            m.done
                              ? "bg-green-500"
                              : m.inProgress
                              ? "bg-amber-400"
                              : "bg-muted-foreground/30"
                          }`}
                        />
                        {i < milestones.length - 1 && (
                          <div className="w-0.5 h-8 bg-border/50" />
                        )}
                      </div>
                      <div className="flex items-center justify-between w-full -mt-0.5">
                        <span className={`text-sm ${m.done ? "text-foreground" : "text-muted-foreground"}`}>
                          {m.label}
                        </span>
                        <span className="text-xs text-muted-foreground">{m.date}</span>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Days to Go-Live */}
                <div className="border-t border-border/40 pt-5">
                  <div className="text-center p-6 rounded-xl bg-gradient-to-br from-primary/10 to-primary/5 border border-primary/20">
                    <div className="text-5xl font-bold text-primary mb-1">46</div>
                    <p className="text-sm text-muted-foreground">Days to Go-Live</p>
                  </div>
                </div>

                {/* Legend */}
                <div className="border-t border-border/40 pt-4 space-y-2">
                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Owner Legend</p>
                  <div className="flex flex-wrap gap-2">
                    <OwnerBadge owner="Client" />
                    <OwnerBadge owner="New Lantern" />
                    <OwnerBadge owner="Joint" />
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}

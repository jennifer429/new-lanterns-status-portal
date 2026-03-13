/**
 * Implementation Checklist Page — dedicated checklist-only view
 * Collapsible sections, consistent font sizes, no sidebar distractions.
 * Clicking "Implementation" from the dashboard lands here.
 */

import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import {
  CheckCircle2,
  Circle,
  AlertTriangle,
  Wrench,
  Clock,
  ChevronDown,
  ChevronRight,
} from "lucide-react";
import { useRoute, Link } from "wouter";
import { cn } from "@/lib/utils";

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
    "Not Started": "bg-muted text-foreground border-border",
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

export default function Implementation() {
  const [, params] = useRoute("/org/:slug/implement");
  const orgSlug = params?.slug || "demo";

  // Collapsible sections — all expanded by default
  const [collapsedSections, setCollapsedSections] = useState<Record<number, boolean>>({});

  function toggleSection(sIdx: number) {
    setCollapsedSections(prev => ({ ...prev, [sIdx]: !prev[sIdx] }));
  }

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
        <div className="max-w-5xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <img src="/images/flame-icon.png" alt="New Lantern" className="h-8 w-8" />
            <div>
              <h1 className="text-xl font-bold text-foreground">Implementation Checklist</h1>
              <p className="text-sm text-muted-foreground">PACS Onboarding</p>
            </div>
          </div>
          <Link href={`/org/${orgSlug}`} className="text-sm text-foreground hover:text-primary transition-colors">
            Back to Dashboard
          </Link>
        </div>
      </header>

      {/* Main content — single column, checklist only */}
      <div className="max-w-5xl mx-auto px-6 py-8 space-y-6">
        {/* Progress header */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <Wrench className="w-5 h-5 text-primary" />
              <span className="text-sm text-foreground">
                {completedTasks} of {totalTasks} tasks complete
              </span>
            </div>
            <span className="text-sm font-bold text-primary">{completionPct}%</span>
          </div>
          <Progress value={completionPct} className="h-2" />
        </div>

        {/* Owner Legend */}
        <div className="flex items-center gap-3">
          <span className="text-sm text-muted-foreground">Owner:</span>
          <OwnerBadge owner="Client" />
          <OwnerBadge owner="New Lantern" />
          <OwnerBadge owner="Joint" />
        </div>

        {/* Sections — collapsible */}
        {sections.map((section, sIdx) => {
          const sectionCompleted = section.tasks.filter((t) => t.status === "Complete").length;
          const sectionTotal = section.tasks.length;
          const isCollapsed = !!collapsedSections[sIdx];

          return (
            <Card key={sIdx} className="border-border/50 overflow-hidden">
              {/* Collapsible section header */}
              <button
                onClick={() => toggleSection(sIdx)}
                className="w-full px-5 py-4 bg-muted/30 border-b border-border/40 flex items-center justify-between cursor-pointer hover:bg-muted/50 transition-colors"
              >
                <div className="flex items-center gap-3">
                  {isCollapsed ? (
                    <ChevronRight className="w-5 h-5 text-foreground" />
                  ) : (
                    <ChevronDown className="w-5 h-5 text-foreground" />
                  )}
                  <div className="text-left">
                    <p className="text-xs text-muted-foreground uppercase tracking-wider font-medium">
                      Section {sIdx + 1}
                    </p>
                    <h3 className="text-sm font-bold text-foreground mt-0.5">{section.title}</h3>
                  </div>
                </div>
                <Badge
                  variant="outline"
                  className={cn(
                    "text-xs",
                    sectionCompleted === sectionTotal
                      ? "border-green-500/40 text-green-400"
                      : "border-border text-foreground"
                  )}
                >
                  {sectionCompleted}/{sectionTotal}
                </Badge>
              </button>

              {/* Collapsible content */}
              {!isCollapsed && (
                <CardContent className="p-0">
                  {section.tasks.map((task, tIdx) => (
                    <div
                      key={tIdx}
                      className={cn(
                        "flex items-center gap-4 px-5 py-3",
                        tIdx < section.tasks.length - 1 && "border-b border-border/30"
                      )}
                    >
                      {getStatusIcon(task.status)}
                      <span className="flex-1 text-sm font-medium text-foreground min-w-0 truncate">
                        {task.title}
                      </span>
                      <OwnerBadge owner={task.owner} />
                      <span className="text-sm text-muted-foreground w-16 text-right flex-shrink-0">
                        {task.target}
                      </span>
                      <div className="w-24 flex-shrink-0 flex justify-end">
                        <StatusBadge status={task.status} />
                      </div>
                    </div>
                  ))}
                </CardContent>
              )}
            </Card>
          );
        })}
      </div>
    </div>
  );
}

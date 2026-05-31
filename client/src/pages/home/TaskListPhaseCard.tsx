import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Wrench, CheckCircle2, ArrowRight, ArrowUpRight } from "lucide-react";
import { Link } from "wouter";
import { cn } from "@/lib/utils";

interface TaskDef {
  id: string;
  title: string;
}

interface TaskListPhaseCardProps {
  clientSlug: string;
  orgSlug: string;
  iPct: number;
  implCompleted: number;
  implApplicable: number;
  implInProgressCount: number;
  implBlockedCount: number;
  implNaCount: number;
  implOpenCount: number;
  nextUpTasks: TaskDef[];
  activePhase: "questionnaire" | "testing" | "implementation";
}

export function TaskListPhaseCard({
  clientSlug,
  orgSlug,
  iPct,
  implCompleted,
  implApplicable,
  implInProgressCount,
  implBlockedCount,
  implNaCount,
  implOpenCount,
  nextUpTasks,
  activePhase,
}: TaskListPhaseCardProps) {
  const pct = Math.round(iPct);
  const isDone = pct >= 100;
  const label = isDone ? "View" : implCompleted > 0 ? "Continue" : "Start";

  return (
    <Link href={`/org/${clientSlug}/${orgSlug}/implement`}>
      <Card
        className={cn(
          "card-elevated card-clickable relative overflow-hidden cursor-pointer group",
          activePhase === "implementation" && "border-primary/50",
        )}
      >
        {/* Top accent */}
        <div
          className={cn(
            "absolute top-0 left-0 right-0 h-0.5",
            isDone
              ? "bg-emerald-500"
              : activePhase === "implementation"
                ? "bg-primary"
                : "bg-border"
          )}
        />
        <CardContent className="p-3 pt-3.5">
          <div className="flex items-start justify-between mb-3">
            <div className="flex items-center gap-3">
              <div
                className={cn(
                  "p-2.5 rounded-xl transition-colors",
                  isDone
                    ? "bg-emerald-500/15 text-emerald-400"
                    : activePhase === "implementation"
                      ? "bg-primary/15 text-primary"
                      : "bg-muted text-muted-foreground"
                )}
              >
                <Wrench className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-sm font-bold tracking-tight">Task List</h3>
                <p className="text-xs text-muted-foreground mt-0.5">Build & deploy</p>
              </div>
            </div>
            <ArrowUpRight className="w-4 h-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
          </div>

          {/* Progress bar */}
          <div className="mb-3">
            <div className="flex items-center justify-between text-xs mb-1.5">
              <span className="text-muted-foreground">{implCompleted}/{implApplicable} tasks done</span>
              <span className={cn("font-semibold", isDone ? "text-emerald-400" : "text-foreground")}>{pct}%</span>
            </div>
            <div className="h-2 bg-muted/40 rounded-full overflow-hidden">
              <div
                className={cn(
                  "h-full rounded-full transition-all duration-500",
                  isDone
                    ? "bg-gradient-to-r from-emerald-500 to-emerald-400"
                    : pct > 0
                      ? "bg-gradient-to-r from-primary to-primary/70"
                      : "bg-transparent"
                )}
                style={{ width: `${pct}%` }}
              />
            </div>
          </div>

          {/* Exceptions only — non-zero states that need attention */}
          {(implBlockedCount > 0 || implInProgressCount > 0) && (
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mb-3 text-xs">
              {implBlockedCount > 0 && (
                <span className="text-orange-500 font-medium">{implBlockedCount} blocked</span>
              )}
              {implInProgressCount > 0 && (
                <span className="text-blue-500 font-medium">{implInProgressCount} in progress</span>
              )}
            </div>
          )}

          {/* Next Up */}
          {nextUpTasks.length > 0 && (
            <div className="border-t border-border/30 pt-2 mb-3">
              <h4 className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-1.5">Next Up</h4>
              <ul className="space-y-1">
                {nextUpTasks.map(t => (
                  <li key={t.id} className="flex items-start gap-1.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-violet-400 flex-shrink-0 mt-1.5" />
                    <span className="text-xs text-foreground">{t.title}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Action button */}
          <Button
            size="sm"
            variant={isDone ? "outline" : "default"}
            className={cn(
              "w-full text-xs font-semibold",
              isDone
                ? "border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/10"
                : "badge-status-start"
            )}
          >
            {isDone ? (
              <CheckCircle2 className="w-3.5 h-3.5 mr-1.5" />
            ) : (
              <ArrowRight className="w-3.5 h-3.5 mr-1.5" />
            )}
            {label}
          </Button>
        </CardContent>
      </Card>
    </Link>
  );
}

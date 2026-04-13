import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ClipboardList, CheckCircle2, ArrowRight, ArrowUpRight } from "lucide-react";
import { Link } from "wouter";
import { cn } from "@/lib/utils";

interface QuestionnairePhaseCardProps {
  orgSlug: string;
  completedSections: number;
  totalSections: number;
  qInProgressSections: number;
  qNotStartedSections: number;
  naQuestions: number;
  nextUpSections: string[];
  activePhase: "questionnaire" | "testing" | "implementation";
}

export function QuestionnairePhaseCard({
  orgSlug,
  completedSections,
  totalSections,
  qInProgressSections,
  qNotStartedSections,
  naQuestions,
  nextUpSections,
  activePhase,
}: QuestionnairePhaseCardProps) {
  const qPctCard = totalSections > 0 ? Math.round((completedSections / totalSections) * 100) : 0;
  const qIsDone = completedSections === totalSections && totalSections > 0;
  const qLabel = qIsDone ? "View" : completedSections > 0 ? "Continue" : "Start";

  return (
    <Link href={`/org/${orgSlug}/intake`}>
      <Card
        className={cn(
          "card-elevated card-clickable relative overflow-hidden cursor-pointer group",
          activePhase === "questionnaire" && "border-primary/50",
        )}
      >
        <div
          className={cn(
            "absolute top-0 left-0 right-0 h-1 rounded-t-lg",
            qIsDone
              ? "bg-gradient-to-r from-emerald-500 to-emerald-400"
              : activePhase === "questionnaire"
                ? "bg-gradient-to-r from-primary to-primary/60"
                : "bg-gradient-to-r from-muted-foreground/20 to-muted-foreground/10"
          )}
        />
        <CardContent className="p-3 pt-3.5">
          <div className="flex items-start justify-between mb-3">
            <div className="flex items-center gap-3">
              <div
                className={cn(
                  "p-2.5 rounded-xl transition-colors",
                  qIsDone
                    ? "bg-emerald-500/15 text-emerald-400"
                    : activePhase === "questionnaire"
                      ? "bg-primary/15 text-primary"
                      : "bg-muted text-muted-foreground"
                )}
              >
                <ClipboardList className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-sm font-bold tracking-tight">Questionnaire</h3>
                <p className="text-xs text-muted-foreground mt-0.5">Start here</p>
              </div>
            </div>
            <ArrowUpRight className="w-4 h-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
          </div>

          {/* Progress bar */}
          <div className="mb-3">
            <div className="flex items-center justify-between text-xs mb-1.5">
              <span className="text-muted-foreground">{completedSections}/{totalSections} complete</span>
              <span className={cn("font-semibold", qIsDone ? "text-emerald-400" : "text-foreground")}>{qPctCard}%</span>
            </div>
            <div className="h-2 bg-muted/40 rounded-full overflow-hidden">
              <div
                className={cn(
                  "h-full rounded-full transition-all duration-500",
                  qIsDone
                    ? "bg-gradient-to-r from-emerald-500 to-emerald-400"
                    : qPctCard > 0
                      ? "bg-gradient-to-r from-primary to-primary/70"
                      : "bg-transparent"
                )}
                style={{ width: `${qPctCard}%` }}
              />
            </div>
          </div>

          {/* Status breakdown */}
          <div className="grid grid-cols-4 gap-1 mb-3">
            {([
              { label: "Done",    count: completedSections,   dotCls: "bg-green-500",           numCls: "text-green-500" },
              { label: "In Prog", count: qInProgressSections, dotCls: "bg-blue-400",            numCls: "text-blue-400" },
              { label: "N/A",     count: naQuestions,         dotCls: "bg-amber-400",            numCls: "text-amber-400" },
              { label: "Open",    count: qNotStartedSections, dotCls: "bg-muted-foreground/40", numCls: "text-foreground" },
            ] as const).map(({ label: statusLabel, count, dotCls, numCls }) => (
              <div key={statusLabel} className="text-center">
                <div className={`text-sm font-bold ${numCls}`}>{count}</div>
                <div className="flex items-center justify-center gap-1">
                  <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${dotCls}`} />
                  <span className="text-[10px] text-muted-foreground">{statusLabel}</span>
                </div>
              </div>
            ))}
          </div>

          {/* Next Up */}
          {nextUpSections.length > 0 && (
            <div className="border-t border-border/30 pt-2 mb-3">
              <h4 className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-1.5">Next Up</h4>
              <ul className="space-y-1">
                {nextUpSections.map(title => (
                  <li key={title} className="flex items-start gap-1.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-violet-400 flex-shrink-0 mt-1.5" />
                    <span className="text-xs text-foreground">{title}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Action button */}
          <Button
            size="sm"
            variant={qIsDone ? "outline" : "default"}
            className={cn(
              "w-full text-xs font-semibold",
              qIsDone
                ? "border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/10"
                : "badge-status-start"
            )}
          >
            {qIsDone ? (
              <CheckCircle2 className="w-3.5 h-3.5 mr-1.5" />
            ) : (
              <ArrowRight className="w-3.5 h-3.5 mr-1.5" />
            )}
            {qLabel}
          </Button>
        </CardContent>
      </Card>
    </Link>
  );
}

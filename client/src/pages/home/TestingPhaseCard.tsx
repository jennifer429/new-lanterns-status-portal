import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ShieldCheck, CheckCircle2, ArrowRight, ArrowUpRight } from "lucide-react";
import { Link } from "wouter";
import { cn } from "@/lib/utils";
import { VAL_TEST_NAMES } from "@/hooks/useHomeData";

interface TestingPhaseCardProps {
  clientSlug: string;
  orgSlug: string;
  valTotal: number;
  valCompleted: number;
  valNaCount: number;
  valFailedCount: number;
  valInProgressCount: number;
  valBlockedCount: number;
  valNotTestedCount: number;
  nextUpTests: string[];
  activePhase: "questionnaire" | "testing" | "implementation";
  VAL_PHASES: { title: string; count: number }[];
}

export function TestingPhaseCard({
  clientSlug,
  orgSlug,
  valTotal,
  valCompleted,
  valNaCount,
  valFailedCount,
  valInProgressCount,
  valBlockedCount,
  valNotTestedCount,
  nextUpTests,
  activePhase,
  VAL_PHASES,
}: TestingPhaseCardProps) {
  // Weighted: Pass=100%, N/A=100%, Fail=25%, InProgress=50%, Blocked=25%, Open=0%
  const vPctCard = valTotal > 0
    ? Math.round(((valCompleted * 1.0 + valNaCount * 1.0 + valFailedCount * 0.25 + valInProgressCount * 0.5 + valBlockedCount * 0.25) / valTotal) * 100)
    : 0;
  const vIsDone = vPctCard >= 100;
  const vLabel = vIsDone ? "View" : valCompleted > 0 ? "Continue" : "Start";

  const nextUpTestNames = nextUpTests.map(key => {
    const [pIdx, tIdx] = key.split(":").map(Number);
    let flatIdx = 0;
    for (let i = 0; i < pIdx; i++) flatIdx += VAL_PHASES[i].count;
    flatIdx += tIdx;
    return VAL_TEST_NAMES[flatIdx] || `Test ${key}`;
  });

  return (
    <Link href={`/org/${clientSlug}/${orgSlug}/validation`}>
      <Card
        className={cn(
          "card-elevated card-clickable relative overflow-hidden cursor-pointer group",
          activePhase === "testing" && "border-primary/50",
        )}
      >
        <div
          className={cn(
            "absolute top-0 left-0 right-0 h-0.5",
            vIsDone
              ? "bg-emerald-500"
              : activePhase === "testing"
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
                  vIsDone
                    ? "bg-emerald-500/15 text-emerald-400"
                    : activePhase === "testing"
                      ? "bg-primary/15 text-primary"
                      : "bg-muted text-muted-foreground"
                )}
              >
                <ShieldCheck className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-sm font-bold tracking-tight">Testing</h3>
                <p className="text-xs text-muted-foreground mt-0.5">Validate connectivity</p>
              </div>
            </div>
            <ArrowUpRight className="w-4 h-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
          </div>

          {/* Progress bar */}
          <div className="mb-3">
            <div className="flex items-center justify-between text-xs mb-1.5">
              <span className="text-muted-foreground">{valCompleted + valNaCount}/{valTotal} complete</span>
              <span className={cn("font-semibold", vIsDone ? "text-emerald-400" : "text-foreground")}>{vPctCard}%</span>
            </div>
            <div className="h-2 bg-muted/40 rounded-full overflow-hidden">
              <div
                className={cn(
                  "h-full rounded-full transition-all duration-500",
                  vIsDone
                    ? "bg-gradient-to-r from-emerald-500 to-emerald-400"
                    : vPctCard > 0
                      ? "bg-gradient-to-r from-primary to-primary/70"
                      : "bg-transparent"
                )}
                style={{ width: `${vPctCard}%` }}
              />
            </div>
          </div>

          {/* Exceptions only — non-zero states that need attention */}
          {(valFailedCount > 0 || valBlockedCount > 0 || valInProgressCount > 0) && (
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mb-3 text-xs">
              {valFailedCount > 0 && (
                <span className="text-red-500 font-medium">{valFailedCount} fail</span>
              )}
              {valBlockedCount > 0 && (
                <span className="text-orange-500 font-medium">{valBlockedCount} blocked</span>
              )}
              {valInProgressCount > 0 && (
                <span className="text-blue-500 font-medium">{valInProgressCount} in progress</span>
              )}
            </div>
          )}

          {/* Next Up */}
          {nextUpTestNames.length > 0 && (
            <div className="border-t border-border/30 pt-2 mb-3">
              <h4 className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-1.5">Next Up</h4>
              <ul className="space-y-1">
                {nextUpTestNames.map(name => (
                  <li key={name} className="flex items-start gap-1.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-violet-400 flex-shrink-0 mt-1.5" />
                    <span className="text-xs text-foreground">{name}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Action button */}
          <Button
            size="sm"
            variant={vIsDone ? "outline" : "default"}
            className={cn(
              "w-full text-xs font-semibold",
              vIsDone
                ? "border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/10"
                : "badge-status-start"
            )}
          >
            {vIsDone ? (
              <CheckCircle2 className="w-3.5 h-3.5 mr-1.5" />
            ) : (
              <ArrowRight className="w-3.5 h-3.5 mr-1.5" />
            )}
            {vLabel}
          </Button>
        </CardContent>
      </Card>
    </Link>
  );
}

import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { FileText, Activity, Image as ImageIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { ProgressRing } from "./ProgressRing";

interface ProgressHeroProps {
  overallPct: number;
  activePhase: "questionnaire" | "testing" | "implementation";
  completedSections: number;
  totalSections: number;
  qPct: number;
  qDone: boolean;
  valCompleted: number;
  valApplicable: number;
  vPct: number;
  implCompleted: number;
  implApplicable: number;
  iPct: number;
  allFilesCount: number;
  diagramFilesCount: number;
}

export function ProgressHero({
  overallPct,
  activePhase,
  completedSections,
  totalSections,
  qPct,
  qDone,
  valCompleted,
  valApplicable,
  vPct,
  implCompleted,
  implApplicable,
  iPct,
  allFilesCount,
  diagramFilesCount,
}: ProgressHeroProps) {
  const vDone = vPct >= 100;
  const iDone = iPct >= 100;

  return (
    <Card className="card-elevated overflow-hidden">
      {/* Top accent gradient */}
      <div className="h-1 bg-gradient-to-r from-primary via-primary/60 to-emerald-500/40" />
      <CardContent className="p-3">
        <div className="flex flex-col md:flex-row items-center gap-3">
          {/* Progress Ring */}
          <ProgressRing value={overallPct} size={72} stroke={6} />

          {/* Stats */}
          <div className="flex-1 text-center md:text-left">
            <h2 className="text-base font-bold tracking-tight mb-0.5">
              Implementation Progress
            </h2>
            <p className="text-xs text-muted-foreground mb-2">
              {overallPct === 100
                ? "All phases complete — ready for go-live."
                : overallPct > 0
                  ? `Currently in ${activePhase === "questionnaire" ? "Questionnaire" : activePhase === "testing" ? "Testing" : "Task List"} phase.`
                  : "Get started by filling out the questionnaire."}
            </p>

            <div className="grid grid-cols-3 gap-1.5">
              {[
                { label: "Questionnaire", count: `${completedSections}/${totalSections}`, pct: Math.round(qPct), done: qDone },
                { label: "Tests Passed", count: `${valCompleted}/${valApplicable}`, pct: Math.round(vPct), done: vDone },
                { label: "Tasks Done", count: `${implCompleted}/${implApplicable}`, pct: Math.round(iPct), done: iDone },
              ].map((stat) => (
                <div
                  key={stat.label}
                  className={cn(
                    "text-center p-1.5 rounded-lg border transition-colors",
                    stat.done
                      ? "bg-emerald-500/10 border-emerald-500/20"
                      : "bg-muted/20 border-border/30"
                  )}
                >
                  <div
                    className={cn(
                      "text-base font-bold tracking-tight",
                      stat.done ? "text-emerald-400" : "text-primary"
                    )}
                  >
                    {stat.pct}%
                  </div>
                  <div className="text-[10px] text-muted-foreground mt-0.5 font-medium">
                    {stat.count} {stat.label}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Quick stats sidebar */}
          <div className="flex flex-col gap-2 min-w-[130px]">
            <div className="flex items-center gap-2 text-xs">
              <FileText className="w-3.5 h-3.5 text-muted-foreground" />
              <span className="text-muted-foreground">Files:</span>
              <span className="font-semibold">{allFilesCount}</span>
            </div>
            <div className="flex items-center gap-2 text-xs">
              <Activity className="w-3.5 h-3.5 text-muted-foreground" />
              <span className="text-muted-foreground">Phase:</span>
              <Badge
                variant="outline"
                className={cn(
                  "text-[10px] font-semibold",
                  activePhase === "questionnaire"
                    ? "border-primary/40 text-primary"
                    : activePhase === "testing"
                      ? "border-amber-500/40 text-amber-400"
                      : "border-emerald-500/40 text-emerald-400"
                )}
              >
                {activePhase === "questionnaire"
                  ? "Questionnaire"
                  : activePhase === "testing"
                    ? "Testing"
                    : "Task List"}
              </Badge>
            </div>
            {diagramFilesCount > 0 && (
              <div className="flex items-center gap-2 text-xs">
                <ImageIcon className="w-3.5 h-3.5 text-muted-foreground" />
                <span className="text-muted-foreground">Diagram:</span>
                <Badge className="bg-emerald-500/20 text-emerald-400 border-emerald-500/30 text-[10px] font-semibold">
                  Uploaded
                </Badge>
              </div>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

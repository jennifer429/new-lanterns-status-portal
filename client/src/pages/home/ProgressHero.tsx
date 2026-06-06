import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { FileText, Activity, Image as ImageIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { ProgressRing } from "./ProgressRing";

interface ProgressHeroProps {
  overallPct: number;
  activePhase: "questionnaire" | "testing" | "implementation";
  questionnaireFilesCount: number;
  siteFilesCount: number;
  diagramFilesCount: number;
}

export function ProgressHero({
  overallPct,
  activePhase,
  questionnaireFilesCount,
  siteFilesCount,
  diagramFilesCount,
}: ProgressHeroProps) {
  return (
    <Card className="card-elevated overflow-hidden">
      {/* Top accent */}
      <div className="h-0.5 bg-primary" />
      <CardContent className="p-3">
        <div className="flex flex-col md:flex-row items-center gap-3">
          {/* Progress Ring */}
          <ProgressRing value={overallPct} size={72} stroke={6} />

          {/* Stats */}
          <div className="flex-1 text-center md:text-left">
            <h2 className="text-base font-bold tracking-tight mb-0.5">
              Onboarding Progress
            </h2>
            <p className="text-xs text-muted-foreground">
              {overallPct === 100
                ? "All phases complete — ready for go-live."
                : overallPct > 0
                  ? `Currently in ${activePhase === "questionnaire" ? "Questionnaire" : activePhase === "testing" ? "Testing" : "Task List"} phase.`
                  : "Get started by filling out the questionnaire."}
            </p>
          </div>

          {/* Quick stats sidebar */}
          <div className="flex flex-col gap-2 min-w-[130px]">
            <div className="flex items-center gap-2 text-xs">
              <FileText className="w-3.5 h-3.5 text-muted-foreground" />
              <span className="text-muted-foreground">Questionnaire:</span>
              <span className="font-semibold">{questionnaireFilesCount}</span>
            </div>
            <div className="flex items-center gap-2 text-xs">
              <FileText className="w-3.5 h-3.5 text-muted-foreground" />
              <span className="text-muted-foreground">Site:</span>
              <span className="font-semibold">{siteFilesCount}</span>
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

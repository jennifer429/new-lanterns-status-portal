import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { CheckCircle2, ArrowRight, ArrowUpRight } from "lucide-react";
import { Link } from "wouter";
import { cn } from "@/lib/utils";

export function WorkflowPhaseCard({
  title,
  icon,
  completed,
  total,
  href,
  isActive,
  isLocked,
  subtitle,
}: {
  title: string;
  icon: React.ReactNode;
  completed: number;
  total: number;
  href: string;
  isActive: boolean;
  isLocked: boolean;
  subtitle?: string;
}) {
  const pct = total > 0 ? Math.round((completed / total) * 100) : 0;
  const isDone = completed === total && total > 0;
  const label = isDone ? "View" : completed > 0 ? "Continue" : "Start";

  return (
    <Link href={href}>
      <Card
        className={cn(
          "card-elevated card-clickable relative overflow-hidden cursor-pointer group",
          isActive && "border-primary/50",
          isLocked && "opacity-40 pointer-events-none",
        )}
      >
        {/* Subtle gradient accent at top */}
        <div
          className={cn(
            "absolute top-0 left-0 right-0 h-1 rounded-t-lg",
            isDone
              ? "bg-gradient-to-r from-emerald-500 to-emerald-400"
              : isActive
                ? "bg-gradient-to-r from-primary to-primary/60"
                : "bg-gradient-to-r from-muted-foreground/20 to-muted-foreground/10"
          )}
        />
        <CardContent className="p-4 pt-5">
          <div className="flex items-start justify-between mb-3">
            <div className="flex items-center gap-3">
              <div
                className={cn(
                  "p-2.5 rounded-xl transition-colors",
                  isDone
                    ? "bg-emerald-500/15 text-emerald-400"
                    : isActive
                      ? "bg-primary/15 text-primary"
                      : "bg-muted text-muted-foreground"
                )}
              >
                {icon}
              </div>
              <div>
                <h3 className="text-sm font-bold tracking-tight">{title}</h3>
                {subtitle && (
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {subtitle}
                  </p>
                )}
              </div>
            </div>
            <ArrowUpRight className="w-4 h-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
          </div>

          {/* Progress bar */}
          <div className="mb-2">
            <div className="flex items-center justify-between text-xs mb-1.5">
              <span className="text-muted-foreground">
                {completed}/{total} complete
              </span>
              <span
                className={cn(
                  "font-semibold",
                  isDone ? "text-emerald-400" : "text-foreground"
                )}
              >
                {pct}%
              </span>
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

          {/* Progress dots */}
          <div className="flex items-center gap-1.5 mb-3">
            {Array.from({ length: total }, (_, i) => (
              <div
                key={i}
                className={cn(
                  "progress-dot",
                  i < completed
                    ? isDone
                      ? "progress-dot-complete"
                      : "progress-dot-filled"
                    : "progress-dot-empty"
                )}
              />
            ))}
          </div>

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

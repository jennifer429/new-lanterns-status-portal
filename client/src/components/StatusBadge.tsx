import { cn } from "@/lib/utils";
import { CheckCircle2, Circle, Ban, XCircle, Clock, AlertTriangle } from "lucide-react";

export type StatusType = "done" | "na" | "open" | "pass" | "fail" | "in_progress" | "blocked";

const STATUS_CONFIG: Record<StatusType, { label: string; icon: any; colors: string }> = {
  done: { label: "Done", icon: CheckCircle2, colors: "bg-emerald-500/15 text-emerald-400 border-emerald-500/30 hover:bg-emerald-500/25" },
  pass: { label: "Pass", icon: CheckCircle2, colors: "bg-emerald-500/15 text-emerald-400 border-emerald-500/30 hover:bg-emerald-500/25" },
  fail: { label: "Fail", icon: XCircle, colors: "bg-red-500/15 text-red-400 border-red-500/30 hover:bg-red-500/25" },
  na: { label: "N/A", icon: Ban, colors: "bg-amber-500/15 text-amber-400 border-amber-500/30 hover:bg-amber-500/25" },
  in_progress: { label: "In Progress", icon: Clock, colors: "bg-blue-500/15 text-blue-400 border-blue-500/30 hover:bg-blue-500/25" },
  blocked: { label: "Blocked", icon: AlertTriangle, colors: "bg-orange-500/15 text-orange-400 border-orange-500/30 hover:bg-orange-500/25" },
  open: { label: "Open", icon: Circle, colors: "bg-muted/30 text-muted-foreground/60 border-border/40 hover:bg-muted/50 hover:text-foreground" },
};

export function StatusBadge({
  status,
  onClick,
  size = "md",
}: {
  status: StatusType;
  onClick: () => void;
  size?: "sm" | "md";
}) {
  const sizeClasses = size === "sm" ? "px-2 py-0.5 text-[10px]" : "px-2.5 py-1 text-xs";
  const config = STATUS_CONFIG[status];
  const Icon = config.icon;

  return (
    <button
      onClick={onClick}
      className={cn(
        "inline-flex items-center gap-1.5 rounded-md font-semibold transition-all border cursor-pointer",
        config.colors,
        sizeClasses
      )}
      title="Click to change status"
    >
      <Icon className="w-3.5 h-3.5" />
      {config.label}
    </button>
  );
}

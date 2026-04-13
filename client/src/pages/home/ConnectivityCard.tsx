import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ConnectivityTable, type ConnectivityRow } from "@/components/ConnectivityTable";
import { Network, ChevronDown, ArrowRight, Loader2, ExternalLink } from "lucide-react";
import { Link } from "wouter";
import { cn } from "@/lib/utils";

interface ConnectivityCardProps {
  orgSlug: string;
  connRows: ConnectivityRow[];
  onConnChange: (rows: ConnectivityRow[]) => void;
  connSaving: boolean;
  connectivityLoading: boolean;
  open: boolean;
  onToggle: () => void;
}

export function ConnectivityCard({
  orgSlug,
  connRows,
  onConnChange,
  connSaving,
  connectivityLoading,
  open,
  onToggle,
}: ConnectivityCardProps) {
  return (
    <Card className="card-elevated overflow-hidden">
      <button
        onClick={onToggle}
        className="w-full px-3 py-2 flex items-center justify-between hover:bg-accent/30 transition-colors"
      >
        <div className="flex items-center gap-2.5">
          <div className="p-1.5 rounded-lg bg-primary/10">
            <Network className="w-4 h-4 text-primary" />
          </div>
          <span className="text-sm font-semibold">Connectivity</span>
        </div>
        <div className="flex items-center gap-2">
          {connectivityLoading ? (
            <Badge variant="outline" className="text-[10px] text-muted-foreground gap-1">
              <Loader2 className="w-3 h-3 animate-spin" /> Loading
            </Badge>
          ) : connRows.length > 0 ? (
            <Badge variant="outline" className="text-[10px] border-green-500/40 text-green-400">
              {connRows.length}
            </Badge>
          ) : (
            <Badge variant="outline" className="text-[10px] text-muted-foreground">0</Badge>
          )}
          <ChevronDown
            className={cn(
              "w-4 h-4 text-muted-foreground transition-transform duration-200",
              open && "rotate-180"
            )}
          />
        </div>
      </button>
      {open && (
        <div className="border-t border-border/40 max-h-[50vh] overflow-auto">
          <div className="p-3">
            {connectivityLoading ? (
              <div className="flex items-center justify-center py-6">
                <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
              </div>
            ) : connRows.length > 0 ? (
              <div className="overflow-x-auto">
                <ConnectivityTable rows={connRows} onChange={onConnChange} />
                {connSaving && (
                  <div className="text-xs text-muted-foreground mt-2 flex items-center gap-1">
                    <Loader2 className="w-3 h-3 animate-spin" /> Saving to Notion...
                  </div>
                )}
              </div>
            ) : (
              <div className="text-center py-4">
                <p className="text-xs text-muted-foreground mb-2">No connectivity data yet</p>
                <Link href={`/org/${orgSlug}/intake`}>
                  <Button size="sm" variant="outline" className="text-xs h-7">
                    <ArrowRight className="w-3 h-3 mr-1" /> Add in Questionnaire
                  </Button>
                </Link>
              </div>
            )}
          </div>
          {connRows.length > 0 && (
            <div className="px-3 pb-2 flex items-center justify-end gap-2">
              <Link href={`/org/${orgSlug}/intake`}>
                <Button size="sm" variant="ghost" className="text-xs h-7 text-muted-foreground">
                  <ExternalLink className="w-3 h-3 mr-1" /> Full View
                </Button>
              </Link>
            </div>
          )}
        </div>
      )}
    </Card>
  );
}

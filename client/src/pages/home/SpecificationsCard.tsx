import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { BookOpen, ChevronDown, FileText, Download, ExternalLink } from "lucide-react";
import { Link } from "wouter";
import { cn } from "@/lib/utils";

interface SpecificationsCardProps {
  clientSlug: string;
  orgSlug: string;
  specs: any[];
  specsByCategory: Map<string, any[]>;
  allFiles: any[];
  open: boolean;
  onToggle: () => void;
}

export function SpecificationsCard({
  clientSlug,
  orgSlug,
  specs,
  specsByCategory,
  allFiles,
  open,
  onToggle,
}: SpecificationsCardProps) {
  const siteUploadFiles = allFiles.filter((f: any) => f.questionId !== "ARCH.diagram");

  return (
    <Card className="card-elevated overflow-hidden">
      <button
        onClick={onToggle}
        className="w-full px-3 py-2 flex items-center justify-between hover:bg-accent/30 transition-colors"
      >
        <div className="flex items-center gap-2.5">
          <div className="p-1.5 rounded-lg bg-primary/10">
            <BookOpen className="w-4 h-4 text-primary" />
          </div>
          <span className="text-sm font-semibold">Specifications</span>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="text-[10px] text-muted-foreground font-semibold">
            {specs.length} docs
          </Badge>
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
          <div className="p-3 space-y-2">
            {/* NL Standard Docs */}
            {specs.length > 0 ? (
              <>
                {Array.from(specsByCategory.entries()).map(([category, catSpecs]) => (
                  <div key={category}>
                    <div className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-1">{category}</div>
                    {catSpecs.map((spec: any) => (
                      <div key={spec.id} className="flex items-center justify-between py-1.5 px-2 rounded hover:bg-muted/30 transition-colors group/spec">
                        <div className="flex items-center gap-2 min-w-0 flex-1">
                          <FileText className="w-3.5 h-3.5 text-muted-foreground flex-shrink-0" />
                          <span className="text-xs font-medium truncate">{spec.title}</span>
                        </div>
                        {spec.fileUrl && (
                          <a href={spec.fileUrl} target="_blank" rel="noopener noreferrer" className="flex-shrink-0">
                            <Button size="sm" variant="ghost" className="h-6 px-1.5 opacity-0 group-hover/spec:opacity-100 transition-opacity">
                              <Download className="w-3 h-3" />
                            </Button>
                          </a>
                        )}
                      </div>
                    ))}
                  </div>
                ))}
              </>
            ) : (
              <p className="text-xs text-muted-foreground text-center py-3">No specifications available</p>
            )}

            {/* Site-uploaded files */}
            {siteUploadFiles.length > 0 && (
              <div>
                <div className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-1 mt-2">Site Uploads</div>
                {siteUploadFiles.slice(0, 5).map((file: any) => (
                  <div key={file.id} className="flex items-center justify-between py-1.5 px-2 rounded hover:bg-muted/30 transition-colors group/file">
                    <div className="flex items-center gap-2 min-w-0 flex-1">
                      <FileText className="w-3.5 h-3.5 text-muted-foreground flex-shrink-0" />
                      <span className="text-xs font-medium truncate">{file.fileName}</span>
                    </div>
                    <div className="flex items-center gap-0.5 flex-shrink-0 opacity-0 group-hover/file:opacity-100 transition-opacity">
                      <a href={file.fileUrl} download={file.fileName}>
                        <Button size="sm" variant="ghost" className="h-6 px-1.5">
                          <Download className="w-3 h-3" />
                        </Button>
                      </a>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
          <div className="px-3 pb-2 flex items-center justify-end">
            <Link href={`/org/${clientSlug}/${orgSlug}/specs`}>
              <Button size="sm" variant="ghost" className="text-xs h-7 text-muted-foreground">
                <ExternalLink className="w-3 h-3 mr-1" /> View All
              </Button>
            </Link>
          </div>
        </div>
      )}
    </Card>
  );
}

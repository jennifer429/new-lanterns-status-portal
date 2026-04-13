import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { UploadedFilesList } from "@/components/UploadedFileRow";
import { Image as ImageIcon, ChevronDown, ArrowRight, Maximize2 } from "lucide-react";
import { Link } from "wouter";
import { cn } from "@/lib/utils";

interface ArchitectureCardProps {
  orgSlug: string;
  diagramFiles: any[];
  open: boolean;
  onToggle: () => void;
  onLightbox: (src: string, alt: string) => void;
  onRemoveDiagram: (fileId: number) => void;
}

export function ArchitectureCard({
  orgSlug,
  diagramFiles,
  open,
  onToggle,
  onLightbox,
  onRemoveDiagram,
}: ArchitectureCardProps) {
  const imgFiles = diagramFiles.filter((f: any) => /\.(png|jpg|jpeg|gif|webp|svg)$/i.test(f.fileName));
  const firstImg = imgFiles[0];

  return (
    <Card className="card-elevated overflow-hidden">
      <button
        onClick={onToggle}
        className="w-full px-3 py-2 flex items-center justify-between hover:bg-accent/30 transition-colors"
      >
        <div className="flex items-center gap-2.5">
          <div className="p-1.5 rounded-lg bg-primary/10">
            <ImageIcon className="w-4 h-4 text-primary" />
          </div>
          <span className="text-sm font-semibold">Architecture</span>
        </div>
        <div className="flex items-center gap-2">
          {diagramFiles.length > 0 ? (
            <Badge className="bg-emerald-500/20 text-emerald-400 border-emerald-500/30 text-[10px] font-semibold">
              {diagramFiles.length} file{diagramFiles.length > 1 ? "s" : ""}
            </Badge>
          ) : (
            <Badge variant="outline" className="text-[10px] text-muted-foreground">None</Badge>
          )}
          <ChevronDown
            className={cn(
              "w-4 h-4 text-muted-foreground transition-transform duration-200",
              open && "rotate-180"
            )}
          />
        </div>
      </button>

      {/* Thumbnail preview when collapsed */}
      {!open && firstImg && (
        <div className="px-3 pb-3">
          <button
            onClick={() => onLightbox(firstImg.fileUrl, firstImg.fileName)}
            className="relative w-full aspect-[16/9] rounded-lg overflow-hidden border border-border/40 bg-muted/20 hover:border-primary/40 hover:opacity-90 transition-all group"
          >
            <img
              src={firstImg.fileUrl}
              alt={firstImg.fileName}
              className="w-full h-full object-contain bg-black/5"
            />
            <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity bg-black/30">
              <Maximize2 className="w-6 h-6 text-white" />
            </div>
            {imgFiles.length > 1 && (
              <div className="absolute top-2 right-2 bg-black/60 text-white text-[10px] px-1.5 py-0.5 rounded font-medium">
                +{imgFiles.length - 1} more
              </div>
            )}
          </button>
        </div>
      )}

      {open && (
        <div className="border-t border-border/40">
          <div className="p-3 space-y-3">
            {diagramFiles.length > 0 ? (
              <>
                {/* Image thumbnails grid */}
                {imgFiles.length > 0 && (
                  <div className="grid grid-cols-2 gap-2">
                    {imgFiles.map((f: any) => (
                      <button
                        key={f.id}
                        onClick={() => onLightbox(f.fileUrl, f.fileName)}
                        className="relative aspect-video rounded-lg overflow-hidden border border-border/40 bg-muted/20 hover:border-primary/40 hover:opacity-90 transition-all group"
                      >
                        <img
                          src={f.fileUrl}
                          alt={f.fileName}
                          className="w-full h-full object-cover"
                        />
                        <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity bg-black/30">
                          <Maximize2 className="w-5 h-5 text-white" />
                        </div>
                        <div className="absolute bottom-0 left-0 right-0 bg-black/50 px-2 py-1">
                          <p className="text-[10px] text-white truncate">{f.fileName}</p>
                        </div>
                      </button>
                    ))}
                  </div>
                )}
                {/* Non-image files list */}
                <UploadedFilesList
                  files={diagramFiles
                    .filter((f: any) => !/\.(png|jpg|jpeg|gif|webp|svg)$/i.test(f.fileName))
                    .map((file: any) => ({
                      id: file.id,
                      fileName: file.fileName,
                      fileUrl: file.fileUrl,
                      fileSize: file.fileSize,
                      createdAt: file.createdAt,
                      uploadedBy: file.uploadedBy,
                    }))}
                  onRemove={onRemoveDiagram}
                  compact
                  emptyMessage=""
                />
              </>
            ) : (
              <div className="text-center py-4">
                <ImageIcon className="w-6 h-6 text-muted-foreground/40 mx-auto mb-2" />
                <p className="text-xs text-muted-foreground mb-2">No diagrams uploaded</p>
                <Link href={`/org/${orgSlug}/intake`}>
                  <Button size="sm" variant="outline" className="text-xs h-7">
                    <ArrowRight className="w-3 h-3 mr-1" /> Upload in Questionnaire
                  </Button>
                </Link>
              </div>
            )}
          </div>
        </div>
      )}
    </Card>
  );
}

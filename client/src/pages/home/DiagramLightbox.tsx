import { X } from "lucide-react";

export function DiagramLightbox({
  src,
  alt,
  onClose,
}: {
  src: string;
  alt: string;
  onClose: () => void;
}) {
  return (
    <div
      className="fixed inset-0 z-[100] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div className="relative max-w-[90vw] max-h-[90vh]" onClick={(e) => e.stopPropagation()}>
        <button
          onClick={onClose}
          className="absolute -top-3 -right-3 z-10 bg-background/90 border border-border rounded-full p-1.5 hover:bg-background transition-colors"
        >
          <X className="w-4 h-4" />
        </button>
        <img
          src={src}
          alt={alt}
          className="max-w-full max-h-[85vh] object-contain rounded-lg border border-border/30"
        />
        <div className="text-center mt-2 text-sm text-muted-foreground">{alt}</div>
      </div>
    </div>
  );
}

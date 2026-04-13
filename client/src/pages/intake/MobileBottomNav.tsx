import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { questionnaireSections } from "@shared/questionnaireData";

interface MobileBottomNavProps {
  currentSectionIndex: number;
  isLastSection: boolean;
  onPrev: () => void;
  onNext: () => void;
}

export function MobileBottomNav({
  currentSectionIndex,
  isLastSection,
  onPrev,
  onNext,
}: MobileBottomNavProps) {
  return (
    <div className="fixed bottom-0 left-0 right-0 z-50 bg-background/95 backdrop-blur border-t border-border px-4 py-3 flex items-center justify-between sm:hidden">
      <Button
        variant="outline"
        size="sm"
        disabled={currentSectionIndex === 0}
        onClick={onPrev}
        className="gap-1"
      >
        <ChevronLeft className="w-4 h-4" />
        Prev
      </Button>
      <span className="text-xs text-muted-foreground font-medium">
        {currentSectionIndex + 1} / {questionnaireSections.length}
      </span>
      <Button
        size="sm"
        disabled={isLastSection}
        onClick={onNext}
        className="gap-1"
      >
        Next
        <ChevronRight className="w-4 h-4" />
      </Button>
    </div>
  );
}

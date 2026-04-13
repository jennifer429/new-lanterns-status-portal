import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Star } from "lucide-react";

interface FeedbackModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  rating: number;
  onRatingChange: (rating: number) => void;
  comments: string;
  onCommentsChange: (comments: string) => void;
  onSkip: () => void;
  onSubmit: () => void;
  isSubmitting: boolean;
}

export function FeedbackModal({
  open,
  onOpenChange,
  rating,
  onRatingChange,
  comments,
  onCommentsChange,
  onSkip,
  onSubmit,
  isSubmitting,
}: FeedbackModalProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>How was your experience?</DialogTitle>
          <DialogDescription>
            Quick feedback on the onboarding questionnaire.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="flex gap-2 justify-center">
            {[1, 2, 3, 4, 5].map((star) => (
              <button
                key={star}
                type="button"
                onClick={() => onRatingChange(star)}
                className="transition-transform hover:scale-110"
              >
                <Star
                  className={`w-8 h-8 ${
                    star <= rating
                      ? "fill-yellow-400 text-yellow-400"
                      : "text-gray-300"
                  }`}
                />
              </button>
            ))}
          </div>
          <Textarea
            placeholder="Any comments? (optional)"
            value={comments}
            onChange={(e) => onCommentsChange(e.target.value)}
            rows={3}
          />
          <div className="flex gap-2 justify-end">
            <Button variant="ghost" onClick={onSkip}>
              Skip
            </Button>
            <Button
              onClick={onSubmit}
              disabled={rating === 0 || isSubmitting}
            >
              {isSubmitting ? "Submitting..." : "Submit"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

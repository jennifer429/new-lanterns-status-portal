import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Progress } from "@/components/ui/progress";
import { ChevronLeft, ChevronRight, Check } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import intakeQuestions from "../../../intake-questions.json";

interface IntakeFormProps {
  organizationSlug: string;
}

export function IntakeForm({ organizationSlug }: IntakeFormProps) {
  const sections = Object.keys(intakeQuestions);
  const [currentSectionIndex, setCurrentSectionIndex] = useState(0);
  const [responses, setResponses] = useState<Record<string, string>>({});

  const currentSection = sections[currentSectionIndex];
  const questions = intakeQuestions[currentSection as keyof typeof intakeQuestions];

  const { data: savedResponses, isLoading } = trpc.intake.getResponses.useQuery({
    organizationSlug,
  });

  const saveResponseMutation = trpc.intake.saveResponse.useMutation({
    onSuccess: () => {
      toast.success("Response saved");
    },
    onError: (error) => {
      toast.error(`Failed to save: ${error.message}`);
    },
  });

  const handleNext = () => {
    if (currentSectionIndex < sections.length - 1) {
      setCurrentSectionIndex(currentSectionIndex + 1);
    }
  };

  const handlePrevious = () => {
    if (currentSectionIndex > 0) {
      setCurrentSectionIndex(currentSectionIndex - 1);
    }
  };

  const handleSave = (questionId: string, value: string) => {
    setResponses((prev) => ({ ...prev, [questionId]: value }));
    
    saveResponseMutation.mutate({
      organizationSlug,
      questionId,
      response: value,
      userEmail: 'user@example.com', // TODO: Get from auth context
    });
  };

  const progress = ((currentSectionIndex + 1) / sections.length) * 100;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Progress Bar */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Implementation Intake</CardTitle>
              <CardDescription>
                Section {currentSectionIndex + 1} of {sections.length}: {currentSection}
              </CardDescription>
            </div>
            <div className="text-sm font-medium text-muted-foreground">
              {Math.round(progress)}% Complete
            </div>
          </div>
          <Progress value={progress} className="mt-4" />
        </CardHeader>
      </Card>

      {/* Current Section Questions */}
      <Card>
        <CardHeader>
          <CardTitle>{currentSection}</CardTitle>
          <CardDescription>
            Please provide information for the following questions
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {questions.map((question: any) => {
            const savedValue = savedResponses?.find(
              (r: any) => r.questionId === question.id
            )?.response;
            const currentValue = responses[question.id] ?? savedValue ?? "";

            return (
              <div key={question.id} className="space-y-3 pb-6 border-b last:border-0">
                <Label htmlFor={question.id} className="text-base font-medium">
                  {question.id}: {question.task}
                </Label>

                {/* Text Input */}
                {question.fieldType === "text" && (
                  <Input
                    id={question.id}
                    value={currentValue}
                    onChange={(e) => handleSave(question.id, e.target.value)}
                    placeholder="Enter your answer..."
                  />
                )}

                {/* Textarea */}
                {question.fieldType === "textarea" && (
                  <Textarea
                    id={question.id}
                    value={currentValue}
                    onChange={(e) => handleSave(question.id, e.target.value)}
                    placeholder="Enter detailed information..."
                    rows={4}
                  />
                )}

                {/* Number Input */}
                {question.fieldType === "number" && (
                  <Input
                    id={question.id}
                    type="number"
                    value={currentValue}
                    onChange={(e) => handleSave(question.id, e.target.value)}
                    placeholder="Enter number..."
                  />
                )}

                {/* Date Input */}
                {question.fieldType === "date" && (
                  <Input
                    id={question.id}
                    type="date"
                    value={currentValue}
                    onChange={(e) => handleSave(question.id, e.target.value)}
                  />
                )}

                {/* Radio Group */}
                {question.fieldType === "radio" && question.options && (
                  <RadioGroup
                    value={currentValue}
                    onValueChange={(value) => handleSave(question.id, value)}
                  >
                    {question.options.map((option: string) => (
                      <div key={option} className="flex items-center space-x-2">
                        <RadioGroupItem value={option} id={`${question.id}-${option}`} />
                        <Label htmlFor={`${question.id}-${option}`}>{option}</Label>
                      </div>
                    ))}
                  </RadioGroup>
                )}

                {/* File Upload */}
                {question.fieldType === "file" && (
                  <div className="space-y-2">
                    <Input
                      id={question.id}
                      type="file"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) {
                          // TODO: Implement file upload to Google Drive
                          toast.info("File upload coming soon");
                        }
                      }}
                    />
                    {currentValue && (
                      <p className="text-sm text-muted-foreground">
                        Current file: {currentValue}
                      </p>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </CardContent>
      </Card>

      {/* Navigation */}
      <div className="flex items-center justify-between">
        <Button
          variant="outline"
          onClick={handlePrevious}
          disabled={currentSectionIndex === 0}
        >
          <ChevronLeft className="w-4 h-4 mr-2" />
          Previous
        </Button>

        <div className="text-sm text-muted-foreground">
          Section {currentSectionIndex + 1} of {sections.length}
        </div>

        {currentSectionIndex < sections.length - 1 ? (
          <Button onClick={handleNext}>
            Next
            <ChevronRight className="w-4 h-4 ml-2" />
          </Button>
        ) : (
          <Button onClick={() => toast.success("Intake complete!")}>
            <Check className="w-4 h-4 mr-2" />
            Complete
          </Button>
        )}
      </div>
    </div>
  );
}

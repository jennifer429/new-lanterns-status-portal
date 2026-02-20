/**
 * RadOnboardingQuestionnaire
 * Partner-level rad worklist onboarding questionnaire.
 * Responses auto-save on blur / selection change.
 */

import { useState, useCallback, useRef } from "react";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { CheckCircle2, Circle, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { radOnboardingSections, RAD_TOTAL_QUESTIONS, type RadQuestion } from "@shared/radOnboardingQuestions";

interface RadOnboardingQuestionnaireProps {
  clientId: number;
  partnerName: string;
  readOnly?: boolean;
}

export function RadOnboardingQuestionnaire({
  clientId,
  partnerName,
  readOnly = false,
}: RadOnboardingQuestionnaireProps) {
  // Local draft state: questionId → current value (before save)
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  // Track which questions are currently saving
  const [saving, setSaving] = useState<Record<string, boolean>>({});
  // Debounce timers for textarea / text fields
  const debounceTimers = useRef<Record<string, ReturnType<typeof setTimeout>>>({});

  const { data: responses, isLoading, refetch } = trpc.admin.getPartnerQuestionnaire.useQuery(
    { clientId },
    { enabled: !!clientId }
  );

  const saveMutation = trpc.admin.savePartnerQuestionnaireResponse.useMutation({
    onSuccess: (_data, variables) => {
      setSaving(prev => ({ ...prev, [variables.questionId]: false }));
      refetch();
    },
    onError: (_err, variables) => {
      setSaving(prev => ({ ...prev, [variables.questionId]: false }));
      toast.error("Failed to save — please try again");
    },
  });

  const saveResponse = useCallback((questionId: string, value: string) => {
    setSaving(prev => ({ ...prev, [questionId]: true }));
    saveMutation.mutate({ clientId, questionId, response: value });
  }, [clientId, saveMutation]);

  // For text/textarea: update draft immediately, debounce actual save
  const handleTextChange = (questionId: string, value: string) => {
    setDrafts(prev => ({ ...prev, [questionId]: value }));
    if (debounceTimers.current[questionId]) {
      clearTimeout(debounceTimers.current[questionId]);
    }
    debounceTimers.current[questionId] = setTimeout(() => {
      saveResponse(questionId, value);
    }, 800);
  };

  // For dropdowns: save immediately on change
  const handleDropdownChange = (questionId: string, value: string) => {
    setDrafts(prev => ({ ...prev, [questionId]: value }));
    saveResponse(questionId, value);
  };

  // For multi-select checkboxes: toggle a value and save
  const handleMultiSelectChange = (questionId: string, option: string, checked: boolean) => {
    const current = getDisplayValue(questionId);
    const currentValues: string[] = current ? current.split("||") : [];
    const updated = checked
      ? [...currentValues.filter(v => v !== option), option]
      : currentValues.filter(v => v !== option);
    const newValue = updated.join("||");
    setDrafts(prev => ({ ...prev, [questionId]: newValue }));
    saveResponse(questionId, newValue);
  };

  // Returns the current display value for a question (draft takes priority over saved)
  const getDisplayValue = (questionId: string): string => {
    if (questionId in drafts) return drafts[questionId];
    return responses?.[questionId] || "";
  };

  const isAnswered = (questionId: string): boolean => {
    const val = getDisplayValue(questionId);
    return val.trim().length > 0;
  };

  const answeredCount = radOnboardingSections
    .flatMap(s => s.questions)
    .filter(q => isAnswered(q.id)).length;

  const completionPct = Math.round((answeredCount / RAD_TOTAL_QUESTIONS) * 100);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
        <span className="ml-2 text-muted-foreground">Loading questionnaire…</span>
      </div>
    );
  }

  const renderQuestion = (question: RadQuestion) => {
    const value = getDisplayValue(question.id);
    const isSaving = saving[question.id] || false;
    const answered = isAnswered(question.id);

    return (
      <div key={question.id} className="space-y-2">
        {/* Question header row */}
        <div className="flex items-start gap-2">
          <div className="mt-0.5 flex-shrink-0">
            {answered
              ? <CheckCircle2 className="w-4 h-4 text-primary" />
              : <Circle className="w-4 h-4 text-muted-foreground" />
            }
          </div>
          <div className="flex-1">
            <Label className="text-sm font-medium leading-snug">
              <span className="text-muted-foreground mr-1.5">{question.id}</span>
              {question.text}
            </Label>
            {question.notes && (
              <p className="text-xs text-muted-foreground mt-0.5">{question.notes}</p>
            )}
          </div>
          {isSaving && (
            <Loader2 className="w-3.5 h-3.5 animate-spin text-muted-foreground flex-shrink-0 mt-1" />
          )}
        </div>

        {/* Input */}
        <div className="ml-6">
          {question.type === 'text' && (
            <Input
              value={value}
              onChange={e => handleTextChange(question.id, e.target.value)}
              placeholder={question.placeholder}
              disabled={readOnly}
              className="border-2 focus:border-primary"
            />
          )}

          {question.type === 'textarea' && (
            <Textarea
              value={value}
              onChange={e => handleTextChange(question.id, e.target.value)}
              placeholder={question.placeholder}
              disabled={readOnly}
              rows={3}
              className="border-2 focus:border-primary resize-y"
            />
          )}

          {question.type === 'dropdown' && (
            <Select
              value={value || undefined}
              onValueChange={val => handleDropdownChange(question.id, val)}
              disabled={readOnly}
            >
              <SelectTrigger className="border-2 focus:border-primary">
                <SelectValue placeholder="Select an option…" />
              </SelectTrigger>
              <SelectContent>
                {question.options?.map(opt => (
                  <SelectItem key={opt} value={opt}>{opt}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}

          {question.type === 'multi-select' && (
            <div className="space-y-2">
              {question.options?.map(opt => {
                const selected = value ? value.split("||").includes(opt) : false;
                return (
                  <div key={opt} className="flex items-center gap-2">
                    <Checkbox
                      id={`${question.id}-${opt}`}
                      checked={selected}
                      disabled={readOnly}
                      onCheckedChange={checked =>
                        handleMultiSelectChange(question.id, opt, checked as boolean)
                      }
                      className="data-[state=checked]:bg-primary data-[state=checked]:border-primary"
                    />
                    <Label
                      htmlFor={`${question.id}-${opt}`}
                      className="text-sm font-normal cursor-pointer"
                    >
                      {opt}
                    </Label>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-6">
      {/* Progress header */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-lg">Rad Onboarding Worklist — {partnerName}</CardTitle>
              <CardDescription>
                Partner-level configuration for radiologist workflows, worklist setup, and QA
              </CardDescription>
            </div>
            <Badge variant={completionPct === 100 ? "default" : "secondary"} className="text-sm px-3 py-1">
              {answeredCount} / {RAD_TOTAL_QUESTIONS} answered
            </Badge>
          </div>
          <Progress value={completionPct} className="mt-3 h-2" />
        </CardHeader>
      </Card>

      {/* Sections */}
      {radOnboardingSections.map(section => {
        const sectionAnswered = section.questions.filter(q => isAnswered(q.id)).length;
        const sectionComplete = sectionAnswered === section.questions.length;

        return (
          <Card key={section.id}>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-base flex items-center gap-2">
                    {sectionComplete
                      ? <CheckCircle2 className="w-4 h-4 text-primary flex-shrink-0" />
                      : <Circle className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                    }
                    {section.title}
                  </CardTitle>
                  {section.description && (
                    <CardDescription className="mt-1">{section.description}</CardDescription>
                  )}
                </div>
                <Badge variant="outline" className="text-xs">
                  {sectionAnswered}/{section.questions.length}
                </Badge>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-6">
                {section.questions.map(q => renderQuestion(q))}
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}

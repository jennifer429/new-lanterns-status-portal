/**
 * RadOnboardingQuestionnaire
 * Partner-level rad worklist onboarding questionnaire.
 * Text/dropdown/multi-select responses auto-save.
 * Upload questions use file upload + optional description textarea.
 */

import { useState, useCallback, useRef } from "react";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { CheckCircle2, Circle, Loader2, Upload, FileText, Download, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { radOnboardingSections, RAD_TOTAL_QUESTIONS, type RadQuestion } from "@shared/radOnboardingQuestions";

interface RadOnboardingQuestionnaireProps {
  clientId: number;
  partnerName: string;
  readOnly?: boolean;
}

// ─── File upload field ────────────────────────────────────────────────────────

function PartnerFileUploadField({
  clientId,
  questionId,
  readOnly,
  onHasFiles,
}: {
  clientId: number;
  questionId: string;
  readOnly: boolean;
  onHasFiles: (qId: string, hasFiles: boolean) => void;
}) {
  const utils = trpc.useUtils();
  const [isUploading, setIsUploading] = useState(false);

  const { data: files = [], isLoading } = trpc.admin.getPartnerQuestionnaireFiles.useQuery(
    { clientId, questionId },
    {
      enabled: !!clientId,
      onSuccess: (data) => onHasFiles(questionId, data.length > 0),
    }
  );

  const uploadMutation = trpc.admin.uploadPartnerQuestionnaireFile.useMutation({
    onSuccess: () => {
      setIsUploading(false);
      toast.success("File uploaded");
      utils.admin.getPartnerQuestionnaireFiles.invalidate({ clientId, questionId });
    },
    onError: (err) => {
      setIsUploading(false);
      toast.error(`Upload failed: ${err.message}`);
    },
  });

  const deleteMutation = trpc.admin.deletePartnerQuestionnaireFile.useMutation({
    onSuccess: () => {
      utils.admin.getPartnerQuestionnaireFiles.invalidate({ clientId, questionId });
    },
    onError: (err) => toast.error(`Delete failed: ${err.message}`),
  });

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setIsUploading(true);
    const reader = new FileReader();
    reader.onload = () => {
      const base64 = (reader.result as string).split(",")[1];
      uploadMutation.mutate({
        clientId,
        questionId,
        fileName: file.name,
        fileData: base64,
        mimeType: file.type || "application/octet-stream",
      });
    };
    reader.readAsDataURL(file);
    // Reset so same file can be re-uploaded
    e.target.value = "";
  };

  return (
    <div className="space-y-3">
      {/* PHI warning */}
      <div className="flex items-center gap-2 px-3 py-2 bg-yellow-400/10 border border-yellow-400/40 rounded-md">
        <span className="text-yellow-400 text-sm">⚠</span>
        <span className="text-xs text-yellow-400 font-medium">Do not upload files containing PHI or patient data</span>
      </div>

      {/* Upload button */}
      {!readOnly && (
        <label className="flex items-center gap-2 cursor-pointer w-fit">
          <div className="flex items-center gap-2 px-4 py-2 rounded-md border-2 border-dashed border-primary/50 hover:border-primary bg-primary/5 hover:bg-primary/10 transition-colors text-sm font-medium text-primary">
            {isUploading
              ? <><Loader2 className="w-4 h-4 animate-spin" /> Uploading…</>
              : <><Upload className="w-4 h-4" /> Choose file</>
            }
          </div>
          <input
            type="file"
            className="hidden"
            onChange={handleFileChange}
            disabled={isUploading || readOnly}
          />
        </label>
      )}

      {/* Uploaded files list */}
      {isLoading ? (
        <div className="text-xs text-muted-foreground">Loading files…</div>
      ) : files.length > 0 ? (
        <div className="space-y-1.5">
          {files.map(file => (
            <div key={file.id} className="flex items-center justify-between p-2 bg-muted/30 rounded border border-border">
              <div className="flex items-center gap-2 flex-1 min-w-0">
                <FileText className="w-4 h-4 text-primary flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <a
                    href={file.fileUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-sm font-medium text-primary hover:underline truncate block"
                  >
                    {file.fileName}
                  </a>
                  <div className="text-xs text-muted-foreground">
                    {file.fileSize ? `${(file.fileSize / 1024).toFixed(1)} KB · ` : ""}
                    {new Date(file.createdAt).toLocaleDateString()}
                    {file.uploadedBy ? ` · ${file.uploadedBy}` : ""}
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-1 flex-shrink-0">
                <Button variant="ghost" size="sm" className="h-7 w-7 p-0"
                  onClick={() => window.open(file.fileUrl, "_blank")}>
                  <Download className="w-3.5 h-3.5" />
                </Button>
                {!readOnly && (
                  <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-destructive hover:text-destructive"
                    onClick={() => deleteMutation.mutate({ fileId: file.id, clientId })}>
                    <Trash2 className="w-3.5 h-3.5" />
                  </Button>
                )}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <p className="text-xs text-muted-foreground italic">No files uploaded yet</p>
      )}
    </div>
  );
}

// ─── Main questionnaire ───────────────────────────────────────────────────────

export function RadOnboardingQuestionnaire({
  clientId,
  partnerName,
  readOnly = false,
}: RadOnboardingQuestionnaireProps) {
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState<Record<string, boolean>>({});
  const [uploadQuestionHasFiles, setUploadQuestionHasFiles] = useState<Record<string, boolean>>({});
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

  const handleTextChange = (questionId: string, value: string) => {
    setDrafts(prev => ({ ...prev, [questionId]: value }));
    if (debounceTimers.current[questionId]) clearTimeout(debounceTimers.current[questionId]);
    debounceTimers.current[questionId] = setTimeout(() => saveResponse(questionId, value), 800);
  };

  const handleDropdownChange = (questionId: string, value: string) => {
    setDrafts(prev => ({ ...prev, [questionId]: value }));
    saveResponse(questionId, value);
  };

  const handleMultiSelectChange = (questionId: string, option: string, checked: boolean) => {
    const current = getDisplayValue(questionId);
    const currentValues = current ? current.split("||") : [];
    const updated = checked
      ? [...currentValues.filter(v => v !== option), option]
      : currentValues.filter(v => v !== option);
    const newValue = updated.join("||");
    setDrafts(prev => ({ ...prev, [questionId]: newValue }));
    saveResponse(questionId, newValue);
  };

  const getDisplayValue = (questionId: string): string => {
    if (questionId in drafts) return drafts[questionId];
    return responses?.[questionId] || "";
  };

  const isAnswered = (question: RadQuestion): boolean => {
    if (question.type === 'upload') return uploadQuestionHasFiles[question.id] === true;
    return getDisplayValue(question.id).trim().length > 0;
  };

  const answeredCount = radOnboardingSections
    .flatMap(s => s.questions)
    .filter(q => isAnswered(q)).length;

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
    const answered = isAnswered(question);

    return (
      <div key={question.id} className="space-y-2">
        {/* Question header */}
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

        {/* Input area */}
        <div className="ml-6 space-y-2">
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

          {question.type === 'upload' && (
            <>
              <PartnerFileUploadField
                clientId={clientId}
                questionId={question.id}
                readOnly={readOnly}
                onHasFiles={(qId, hasFiles) =>
                  setUploadQuestionHasFiles(prev => ({ ...prev, [qId]: hasFiles }))
                }
              />
              {/* Description textarea below the uploader */}
              <Textarea
                value={value}
                onChange={e => handleTextChange(question.id, e.target.value)}
                placeholder="Add a description or notes about this file (optional)…"
                disabled={readOnly}
                rows={2}
                className="border-2 focus:border-primary resize-y text-sm"
              />
            </>
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
        const sectionAnswered = section.questions.filter(q => isAnswered(q)).length;
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

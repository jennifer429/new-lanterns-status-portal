import { useState, useEffect, useCallback } from "react";
import { useParams } from "wouter";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Loader2, FileText, CheckCircle2, Send } from "lucide-react";
import { questionnaireData, type Question, type Section } from "@shared/questionnaireData";

export default function IntakeNew() {
  const { slug } = useParams();
  const [responses, setResponses] = useState<Record<string, any>>({});
  const [saveStatus, setSaveStatus] = useState<"idle" | "saving" | "saved">("idle");
  const [activeTab, setActiveTab] = useState(questionnaireData[0]?.id || "");
  const [isSubmitted, setIsSubmitted] = useState(false);

  // Fetch organization and existing responses
  const { data: existingResponses, isLoading: orgLoading } = trpc.intake.getResponses.useQuery(
    { organizationSlug: slug || "" },
    { enabled: !!slug }
  );

  // Load existing responses
  useEffect(() => {
    if (existingResponses) {
      const loadedResponses: Record<string, any> = {};
      existingResponses.forEach((resp) => {
        try {
          const value = typeof resp.response === 'string' ? JSON.parse(resp.response) : resp.response;
          loadedResponses[resp.questionId] = value;
        } catch {
          loadedResponses[resp.questionId] = resp.response;
        }
      });
      setResponses(loadedResponses);
    }
  }, [existingResponses]);

  // Auto-save mutation
  const saveMutation = trpc.intake.saveResponses.useMutation();

  // Debounced auto-save
  useEffect(() => {
    if (!slug || isSubmitted) return;
    
    const timer = setTimeout(() => {
      if (Object.keys(responses).length > 0) {
        setSaveStatus("saving");

        saveMutation.mutate(
          { organizationSlug: slug, responses },
          {
            onSuccess: () => setSaveStatus("saved"),
            onError: () => setSaveStatus("idle")
          }
        );
      }
    }, 1000);

    return () => clearTimeout(timer);
  }, [responses, slug, isSubmitted]);

  // File upload mutation
  const uploadFileMutation = trpc.intake.uploadFile.useMutation();

  const handleFileUpload = useCallback(async (questionId: string, file: File) => {
    if (!slug) return;

    const reader = new FileReader();
    reader.onload = async (e) => {
      const base64 = e.target?.result as string;
      const base64Data = base64.split(',')[1];

      try {
        const result = await uploadFileMutation.mutateAsync({
          organizationSlug: slug,
          questionId,
          fileName: file.name,
          fileData: base64Data,
          mimeType: file.type
        });

        // Store file info in responses
        const currentFiles = responses[questionId] || [];
        setResponses(prev => ({
          ...prev,
          [questionId]: [...currentFiles, { fileName: file.name, url: result.fileUrl }]
        }));
      } catch (error: any) {
        alert(`Failed to upload file: ${error.message}`);
      }
    };
    reader.readAsDataURL(file);
  }, [slug, responses, uploadFileMutation]);

  // Calculate progress per section
  const calculateSectionProgress = (section: Section) => {
    const requiredQuestions = section.questions.filter(q => q.required);
    if (requiredQuestions.length === 0) return 100;

    const answeredCount = requiredQuestions.filter(q => {
      const value = responses[q.id];
      if (Array.isArray(value)) return value.length > 0;
      if (typeof value === 'string') return value.trim().length > 0;
      return value !== undefined && value !== null && value !== '';
    }).length;

    return Math.round((answeredCount / requiredQuestions.length) * 100);
  };

  // Calculate overall progress
  const calculateOverallProgress = () => {
    const sectionProgresses = questionnaireData.map(calculateSectionProgress);
    return Math.round(sectionProgresses.reduce((a, b) => a + b, 0) / questionnaireData.length);
  };

  // Handle submit
  const handleSubmit = () => {
    const overallProgress = calculateOverallProgress();
    if (overallProgress < 100) {
      const confirmed = window.confirm(
        `Your questionnaire is ${overallProgress}% complete. Some required fields may be missing. Do you want to submit anyway?`
      );
      if (!confirmed) return;
    }

    setIsSubmitted(true);
    alert("Thank you! Your questionnaire has been submitted successfully. The New Lantern team will review your responses and contact you soon.");
  };

  // Render question based on type
  const renderQuestion = (question: Question) => {
    const value = responses[question.id];

    switch (question.type) {
      case 'text':
        return (
          <Input
            value={value || ''}
            onChange={(e) => setResponses(prev => ({ ...prev, [question.id]: e.target.value }))}
            placeholder={question.placeholder}
            required={question.required}
            disabled={isSubmitted}
          />
        );

      case 'textarea':
        return (
          <Textarea
            value={value || ''}
            onChange={(e) => setResponses(prev => ({ ...prev, [question.id]: e.target.value }))}
            placeholder={question.placeholder}
            required={question.required}
            rows={4}
            disabled={isSubmitted}
          />
        );

      case 'dropdown':
        return (
          <Select
            value={value || ''}
            onValueChange={(val) => setResponses(prev => ({ ...prev, [question.id]: val }))}
            disabled={isSubmitted}
          >
            <SelectTrigger>
              <SelectValue placeholder="Select an option" />
            </SelectTrigger>
            <SelectContent>
              {question.options?.map((option) => (
                <SelectItem key={option} value={option}>
                  {option}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        );

      case 'multi-select':
        const selectedValues = value || [];
        return (
          <div className="space-y-2">
            {question.options?.map((option) => (
              <div key={option} className="flex items-center space-x-2">
                <Checkbox
                  checked={selectedValues.includes(option)}
                  onCheckedChange={(checked) => {
                    if (isSubmitted) return;
                    const newValues = checked
                      ? [...selectedValues, option]
                      : selectedValues.filter((v: string) => v !== option);
                    setResponses(prev => ({ ...prev, [question.id]: newValues }));
                  }}
                  disabled={isSubmitted}
                />
                <label className="text-sm">{option}</label>
              </div>
            ))}
          </div>
        );

      case 'yes-no':
        return (
          <RadioGroup
            value={value || ''}
            onValueChange={(val) => setResponses(prev => ({ ...prev, [question.id]: val }))}
            disabled={isSubmitted}
          >
            <div className="flex items-center space-x-2">
              <RadioGroupItem value="yes" id={`${question.id}-yes`} />
              <Label htmlFor={`${question.id}-yes`}>Yes</Label>
            </div>
            <div className="flex items-center space-x-2">
              <RadioGroupItem value="no" id={`${question.id}-no`} />
              <Label htmlFor={`${question.id}-no`}>No</Label>
            </div>
          </RadioGroup>
        );

      case 'date':
        return (
          <Input
            type="date"
            value={value || ''}
            onChange={(e) => setResponses(prev => ({ ...prev, [question.id]: e.target.value }))}
            required={question.required}
            disabled={isSubmitted}
          />
        );

      case 'table':
        const tableData = value || [];
        return (
          <div className="space-y-2">
            <div className="border rounded-lg overflow-hidden">
              <table className="w-full">
                <thead className="bg-muted">
                  <tr>
                    {question.tableColumns?.map((col, idx) => (
                      <th key={idx} className="p-2 text-left text-sm font-medium">
                        {col}
                      </th>
                    ))}
                    {!isSubmitted && <th className="p-2 w-20"></th>}
                  </tr>
                </thead>
                <tbody>
                  {tableData.map((row: any, rowIdx: number) => (
                    <tr key={rowIdx} className="border-t">
                      {question.tableColumns?.map((col, colIdx) => (
                        <td key={colIdx} className="p-2">
                          <Input
                            value={row[col] || ''}
                            onChange={(e) => {
                              const newTableData = [...tableData];
                              newTableData[rowIdx] = { ...newTableData[rowIdx], [col]: e.target.value };
                              setResponses(prev => ({ ...prev, [question.id]: newTableData }));
                            }}
                            placeholder={col}
                            className="w-full"
                            disabled={isSubmitted}
                          />
                        </td>
                      ))}
                      {!isSubmitted && (
                        <td className="p-2">
                          <button
                            onClick={() => {
                              const newTableData = tableData.filter((_: any, idx: number) => idx !== rowIdx);
                              setResponses(prev => ({ ...prev, [question.id]: newTableData }));
                            }}
                            className="text-red-500 text-sm hover:underline"
                          >
                            Remove
                          </button>
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {!isSubmitted && (
              <button
                onClick={() => {
                  const newRow: any = {};
                  question.tableColumns?.forEach(col => newRow[col] = '');
                  setResponses(prev => ({ ...prev, [question.id]: [...tableData, newRow] }));
                }}
                className="text-sm text-primary hover:underline"
              >
                + Add Row
              </button>
            )}
          </div>
        );

      case 'file':
        const files = value || [];
        return (
          <div className="space-y-2">
            {!isSubmitted && (
              <div className="border-2 border-dashed rounded-lg p-4">
                <input
                  type="file"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) handleFileUpload(question.id, file);
                  }}
                  className="w-full"
                />
              </div>
            )}
            {files.length > 0 && (
              <div className="space-y-1">
                {files.map((file: any, idx: number) => (
                  <div key={idx} className="flex items-center gap-2 text-sm">
                    <FileText className="w-4 h-4" />
                    <a href={file.url} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">
                      {file.fileName}
                    </a>
                  </div>
                ))}
              </div>
            )}
          </div>
        );

      default:
        return null;
    }
  };

  if (orgLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin" />
      </div>
    );
  }

  const overallProgress = calculateOverallProgress();

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b bg-card/50 backdrop-blur-sm sticky top-0 z-10">
        <div className="container py-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold">Radiology One New Site Onboarding</h1>
              <p className="text-sm text-muted-foreground mt-1">{slug}</p>
            </div>
            <div className="flex items-center gap-4">
              <div className="text-right">
                <p className="text-sm font-medium">Overall Progress</p>
                <p className="text-2xl font-bold text-primary">{overallProgress}%</p>
              </div>
              <div className="flex items-center gap-2">
                {isSubmitted ? (
                  <>
                    <CheckCircle2 className="w-4 h-4 text-green-500" />
                    <span className="text-sm text-green-500">Submitted</span>
                  </>
                ) : saveStatus === "saving" ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
                    <span className="text-sm text-muted-foreground">Saving...</span>
                  </>
                ) : saveStatus === "saved" ? (
                  <>
                    <CheckCircle2 className="w-4 h-4 text-green-500" />
                    <span className="text-sm text-green-500">Saved</span>
                  </>
                ) : (
                  <span className="text-sm text-muted-foreground">Ready</span>
                )}
              </div>
            </div>
          </div>
          <Progress value={overallProgress} className="mt-4 h-2" />
        </div>
      </header>

      {/* Main Content */}
      <div className="container py-8">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
          <TabsList className="grid grid-cols-3 lg:grid-cols-6 xl:grid-cols-11 gap-2 h-auto p-2">
            {questionnaireData.map((section, idx) => {
              const progress = calculateSectionProgress(section);
              return (
                <TabsTrigger
                  key={section.id}
                  value={section.id}
                  className="flex flex-col items-start p-3 h-auto data-[state=active]:bg-primary data-[state=active]:text-primary-foreground"
                >
                  <span className="text-xs font-medium">Section {idx + 1}</span>
                  <span className="text-xs mt-1 line-clamp-2">{section.title}</span>
                  <Badge variant={progress === 100 ? "default" : "outline"} className="mt-2">
                    {progress}%
                  </Badge>
                </TabsTrigger>
              );
            })}
          </TabsList>

          {questionnaireData.map((section) => (
            <TabsContent key={section.id} value={section.id} className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle>{section.title}</CardTitle>
                  {section.description && (
                    <CardDescription>{section.description}</CardDescription>
                  )}
                </CardHeader>
                <CardContent className="space-y-6">
                  {section.questions.map((question) => (
                    <div key={question.id} className="space-y-2">
                      <Label className="text-base">
                        {question.question}
                        {question.required && <span className="text-red-500 ml-1">*</span>}
                      </Label>
                      {question.helpText && (
                        <p className="text-sm text-muted-foreground">{question.helpText}</p>
                      )}
                      {renderQuestion(question)}
                    </div>
                  ))}
                </CardContent>
              </Card>
            </TabsContent>
          ))}
        </Tabs>

        {/* Submit Button */}
        {!isSubmitted && (
          <div className="mt-8 flex justify-center">
            <Button
              size="lg"
              onClick={handleSubmit}
              className="min-w-[200px]"
            >
              <Send className="w-4 h-4 mr-2" />
              Submit Questionnaire
            </Button>
          </div>
        )}

        {isSubmitted && (
          <div className="mt-8 p-6 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg">
            <div className="flex items-center gap-3">
              <CheckCircle2 className="w-6 h-6 text-green-600 dark:text-green-400" />
              <div>
                <h3 className="font-semibold text-green-900 dark:text-green-100">Questionnaire Submitted</h3>
                <p className="text-sm text-green-700 dark:text-green-300 mt-1">
                  Thank you for completing the Radiology One onboarding questionnaire. Our team will review your responses and contact you soon to discuss next steps.
                </p>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

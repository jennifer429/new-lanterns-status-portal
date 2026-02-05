import { useState, useEffect, useCallback, useRef } from "react";
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
import { Loader2, FileText, CheckCircle2, Send, Download, Upload } from "lucide-react";
import { questionnaireData, type Question, type Section } from "@shared/questionnaireData";

export default function IntakeNew() {
  const { slug } = useParams();
  const [responses, setResponses] = useState<Record<string, any>>({});
  const [saveStatus, setSaveStatus] = useState<"idle" | "saving" | "saved">("idle");
  const [activeTab, setActiveTab] = useState(questionnaireData[0]?.id || "");
  const [isSubmitted, setIsSubmitted] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

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
    const totalQuestions = section.questions.length;
    if (totalQuestions === 0) return 100;

    const answeredCount = section.questions.filter(q => {
      const value = responses[q.id];
      if (Array.isArray(value)) return value.length > 0;
      if (typeof value === 'string') return value.trim().length > 0;
      return value !== undefined && value !== null && value !== '';
    }).length;

    return Math.round((answeredCount / totalQuestions) * 100);
  };

  // Calculate overall progress
  const calculateOverallProgress = () => {
    const sectionProgresses = questionnaireData.map(calculateSectionProgress);
    return Math.round(sectionProgresses.reduce((a, b) => a + b, 0) / questionnaireData.length);
  };

  // Handle CSV import
  const handleImportCSV = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result as string;
      const lines = content.split('\n');
      
      // Skip header lines (first 2 lines)
      const dataLines = lines.slice(2);
      
      const importedResponses: Record<string, any> = {};
      
      dataLines.forEach(line => {
        if (!line.trim()) return;
        
        const parts = line.split('|');
        if (parts.length < 4) return;
        
        const questionId = parts[1]?.trim();
        const answer = parts[3]?.trim();
        
        if (questionId && answer) {
          // Try to parse as JSON for arrays/objects
          try {
            importedResponses[questionId] = JSON.parse(answer);
          } catch {
            importedResponses[questionId] = answer;
          }
        }
      });
      
      setResponses(prev => ({ ...prev, ...importedResponses }));
      alert(`Successfully imported ${Object.keys(importedResponses).length} responses!`);
    };
    
    reader.readAsText(file);
    
    // Reset input so same file can be selected again
    e.target.value = '';
  };

  // Handle CSV export
  const handleExportCSV = () => {
    const today = new Date().toISOString().split('T')[0];
    const filename = `${slug}_questionnaire_${today}.txt`;
    
    // Build CSV content
    let csvContent = `Organization: ${slug} | Export Date: ${today} | Completion: ${calculateOverallProgress()}%\n`;
    csvContent += `Section|Question ID|Question Text|Answer|Completed\n`;
    
    questionnaireData.forEach(section => {
      section.questions.forEach(question => {
        const answer = responses[question.id];
        let answerStr = '';
        
        if (Array.isArray(answer)) {
          answerStr = answer.join('; ');
        } else if (typeof answer === 'object' && answer !== null) {
          answerStr = JSON.stringify(answer);
        } else {
          answerStr = answer || '';
        }
        
        const completed = answer && (Array.isArray(answer) ? answer.length > 0 : String(answer).trim().length > 0) ? 'Yes' : 'No';
        
        csvContent += `${section.title}|${question.id}|${question.text}|${answerStr}|${completed}\n`;
      });
    });
    
    // Download file
    const blob = new Blob([csvContent], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    link.click();
    URL.revokeObjectURL(url);
  };

  // Handle submit
  const handleSubmit = () => {
    const overallProgress = calculateOverallProgress();
    
    if (overallProgress < 100) {
      // Find incomplete sections
      const incompleteSections = questionnaireData
        .map(section => ({
          title: section.title,
          progress: calculateSectionProgress(section)
        }))
        .filter(s => s.progress < 100)
        .map(s => `• ${s.title} (${s.progress}% complete)`)
        .join('\n');

      alert(
        `Cannot submit: Questionnaire is only ${overallProgress}% complete.\n\n` +
        `Please complete the following sections:\n\n${incompleteSections}`
      );
      return;
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
            disabled={isSubmitted}
          />
        );

      case 'textarea':
        return (
          <Textarea
            value={value || ''}
            onChange={(e) => setResponses(prev => ({ ...prev, [question.id]: e.target.value }))}
            placeholder={question.placeholder}
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



      case 'date':
        return (
          <Input
            type="date"
            value={value || ''}
            onChange={(e) => setResponses(prev => ({ ...prev, [question.id]: e.target.value }))}
            disabled={isSubmitted}
            placeholder={question.placeholder}
          />
        );



      case 'upload':
      case 'upload-download':
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
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleImportCSV}
                  className="gap-2"
                  disabled={isSubmitted}
                >
                  <Upload className="w-4 h-4" />
                  Import
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleExportCSV}
                  className="gap-2"
                >
                  <Download className="w-4 h-4" />
                  Export
                </Button>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".txt,.csv"
                  onChange={handleFileChange}
                  className="hidden"
                />
              </div>
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
                        {question.text}
                      </Label>
                      {question.notes && (
                        <p className="text-sm text-muted-foreground">{question.notes}</p>
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

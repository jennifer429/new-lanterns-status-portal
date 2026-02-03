import { useState, useEffect } from "react";
import { useParams, useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Progress } from "@/components/ui/progress";
import { Upload, FileText, CheckCircle2, Circle, Loader2 } from "lucide-react";
import { intakeSections, type Question } from "@shared/intake-questions";

export default function IntakeNew() {
  const { slug: orgSlug } = useParams();
  const [, navigate] = useLocation();
  
  const [responses, setResponses] = useState<Record<string, any>>({});
  const [files, setFiles] = useState<Record<string, File[]>>({});
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved'>('idle');
  const [activeTab, setActiveTab] = useState(intakeSections[0].id);

  // Load existing responses
  const { data: existingData, isLoading } = trpc.intake.getResponses.useQuery({ organizationSlug: orgSlug! });
  
  // Auto-save mutation
  const saveMutation = trpc.intake.saveResponses.useMutation();
  
  // File upload mutation
  const uploadFileMutation = trpc.intake.uploadFile.useMutation();

  // Load existing responses into state
  useEffect(() => {
    if (existingData) {
      // Transform array of responses into object keyed by questionId
      const responsesObj: Record<string, any> = {};
      existingData.forEach(item => {
        if (item.response) {
          try {
            // Try to parse JSON responses (for contact fields, etc.)
            responsesObj[item.questionId] = JSON.parse(item.response);
          } catch {
            // If not JSON, use as-is
            responsesObj[item.questionId] = item.response;
          }
        }
      });
      setResponses(responsesObj);
    }
  }, [existingData]);

  // Auto-save debounced
  useEffect(() => {
    if (Object.keys(responses).length === 0) return;
    
    setSaveStatus('saving');
    const timer = setTimeout(() => {
      saveMutation.mutate(
        { organizationSlug: orgSlug!, responses },
        {
          onSuccess: () => setSaveStatus('saved'),
          onError: () => setSaveStatus('idle')
        }
      );
    }, 1000);

    return () => clearTimeout(timer);
  }, [responses, orgSlug, saveMutation]);

  const handleResponseChange = (questionId: string, value: any) => {
    setResponses(prev => ({ ...prev, [questionId]: value }));
  };

  const handleFileSelect = async (questionId: string, fileList: FileList | null) => {
    if (!fileList || !orgSlug) return;
    
    const newFiles = Array.from(fileList);
    setFiles(prev => ({
      ...prev,
      [questionId]: [...(prev[questionId] || []), ...newFiles]
    }));

    // Upload each file
    for (const file of newFiles) {
      try {
        // Convert file to base64
        const reader = new FileReader();
        const base64Promise = new Promise<string>((resolve, reject) => {
          reader.onload = () => {
            const base64 = reader.result as string;
            // Remove data URL prefix (e.g., "data:image/png;base64,")
            const base64Data = base64.split(',')[1];
            resolve(base64Data);
          };
          reader.onerror = reject;
        });
        reader.readAsDataURL(file);
        const fileData = await base64Promise;

        // Upload to backend
        await uploadFileMutation.mutateAsync({
          organizationSlug: orgSlug,
          questionId,
          fileName: file.name,
          fileData,
          mimeType: file.type,
        });
      } catch (error) {
        console.error('Failed to upload file:', error);
      }
    }
  };

  const calculateSectionProgress = (sectionId: string) => {
    const section = intakeSections.find(s => s.id === sectionId);
    if (!section) return 0;
    
    const answeredCount = section.questions.filter(q => {
      const answer = responses[q.id];
      return answer !== undefined && answer !== '' && answer !== null;
    }).length;
    
    return Math.round((answeredCount / section.questions.length) * 100);
  };

  const calculateOverallProgress = () => {
    const totalQuestions = intakeSections.reduce((sum, section) => sum + section.questions.length, 0);
    const answeredQuestions = Object.values(responses).filter(v => v !== undefined && v !== '' && v !== null).length;
    return Math.round((answeredQuestions / totalQuestions) * 100);
  };

  const shouldShowQuestion = (question: Question): boolean => {
    if (!question.conditionalOn) return true;
    const dependentAnswer = responses[question.conditionalOn.questionId];
    return dependentAnswer?.toLowerCase() === question.conditionalOn.answer.toLowerCase();
  };

  const renderQuestion = (question: Question) => {
    if (!shouldShowQuestion(question)) return null;

    const value = responses[question.id] || '';

    return (
      <div key={question.id} className="space-y-3 p-4 rounded-lg border border-border bg-card/50">
        <div className="space-y-2">
          <Label htmlFor={question.id} className="text-base font-medium">
            {question.question}
            {question.required && <span className="text-destructive ml-1">*</span>}
          </Label>
          {question.helpText && (
            <p className="text-sm text-muted-foreground">{question.helpText}</p>
          )}
        </div>

        {question.type === 'text' && (
          <Input
            id={question.id}
            value={value}
            onChange={(e) => handleResponseChange(question.id, e.target.value)}
            placeholder="Enter your answer"
            className="text-base"
          />
        )}

        {question.type === 'multiline' && (
          <Textarea
            id={question.id}
            value={value}
            onChange={(e) => handleResponseChange(question.id, e.target.value)}
            placeholder="Enter your answer"
            rows={4}
            className="text-base"
          />
        )}

        {question.type === 'yesno' && (
          <RadioGroup
            value={value}
            onValueChange={(val) => handleResponseChange(question.id, val)}
          >
            <div className="flex items-center space-x-2">
              <RadioGroupItem value="yes" id={`${question.id}-yes`} />
              <Label htmlFor={`${question.id}-yes`} className="font-normal cursor-pointer">Yes</Label>
            </div>
            <div className="flex items-center space-x-2">
              <RadioGroupItem value="no" id={`${question.id}-no`} />
              <Label htmlFor={`${question.id}-no`} className="font-normal cursor-pointer">No</Label>
            </div>
          </RadioGroup>
        )}

        {question.type === 'select' && question.options && (
          <Select value={value} onValueChange={(val) => handleResponseChange(question.id, val)}>
            <SelectTrigger className="text-base">
              <SelectValue placeholder="Select an option" />
            </SelectTrigger>
            <SelectContent>
              {question.options.map((option) => (
                <SelectItem key={option} value={option}>{option}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}

        {question.type === 'date' && (
          <Input
            id={question.id}
            type="date"
            value={value}
            onChange={(e) => handleResponseChange(question.id, e.target.value)}
            className="text-base"
          />
        )}

        {question.type === 'contact' && (
          <div className="space-y-3">
            <Input
              placeholder="Name"
              value={value?.name || ''}
              onChange={(e) => handleResponseChange(question.id, { ...value, name: e.target.value })}
              className="text-base"
            />
            <Input
              placeholder="Email"
              type="email"
              value={value?.email || ''}
              onChange={(e) => handleResponseChange(question.id, { ...value, email: e.target.value })}
              className="text-base"
            />
            <Input
              placeholder="Phone"
              type="tel"
              value={value?.phone || ''}
              onChange={(e) => handleResponseChange(question.id, { ...value, phone: e.target.value })}
              className="text-base"
            />
          </div>
        )}

        {question.acceptsFiles && (
          <div className="mt-3 space-y-2">
            <Label htmlFor={`${question.id}-file`} className="text-sm font-medium">
              Upload Supporting Documents
            </Label>
            <div className="flex items-center gap-2">
              <Input
                id={`${question.id}-file`}
                type="file"
                multiple
                onChange={(e) => handleFileSelect(question.id, e.target.files)}
                className="text-sm"
              />
              <Upload className="w-4 h-4 text-muted-foreground" />
            </div>
            {files[question.id] && files[question.id].length > 0 && (
              <div className="space-y-1">
                {files[question.id].map((file, idx) => (
                  <div key={idx} className="flex items-center gap-2 text-sm text-muted-foreground">
                    <FileText className="w-4 h-4" />
                    <span>{file.name}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    );
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  const overallProgress = calculateOverallProgress();

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border bg-card/50 backdrop-blur-sm sticky top-0 z-10">
        <div className="container py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <img src="/images/flame-icon.png" alt="New Lantern" className="h-8" />
              <div>
                <h1 className="text-xl font-bold">PACS Implementation Questionnaire</h1>
                <p className="text-sm text-muted-foreground">
                  {saveStatus === 'saving' && 'Saving...'}
                  {saveStatus === 'saved' && 'All changes saved'}
                  {saveStatus === 'idle' && 'Ready'}
                </p>
              </div>
            </div>
            <Button variant="outline" onClick={() => navigate(`/org/${orgSlug}`)}>
              Back to Portal
            </Button>
          </div>
          
          {/* Overall Progress */}
          <div className="mt-4 space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span className="font-medium">Overall Progress</span>
              <span className="text-muted-foreground">{overallProgress}% Complete</span>
            </div>
            <Progress value={overallProgress} className="h-2" />
          </div>
        </div>
      </header>

      {/* Main Content */}
      <div className="container py-8">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
          <TabsList className="grid grid-cols-6 w-full">
            {intakeSections.map((section) => {
              const progress = calculateSectionProgress(section.id);
              return (
                <TabsTrigger key={section.id} value={section.id} className="flex flex-col items-start gap-1 p-3">
                  <div className="flex items-center gap-2 w-full">
                    {progress === 100 ? (
                      <CheckCircle2 className="w-4 h-4 text-primary" />
                    ) : (
                      <Circle className="w-4 h-4 text-muted-foreground" />
                    )}
                    <span className="text-sm font-medium truncate">{section.title}</span>
                  </div>
                  <span className="text-xs text-muted-foreground">{progress}%</span>
                </TabsTrigger>
              );
            })}
          </TabsList>

          {intakeSections.map((section) => (
            <TabsContent key={section.id} value={section.id} className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle>{section.title}</CardTitle>
                  {section.description && (
                    <CardDescription>{section.description}</CardDescription>
                  )}
                </CardHeader>
                <CardContent className="space-y-6">
                  {section.questions.map(renderQuestion)}
                </CardContent>
              </Card>
            </TabsContent>
          ))}
        </Tabs>
      </div>

      {/* Footer */}
      <footer className="border-t border-border bg-card/50 py-4">
        <div className="container text-center text-sm text-muted-foreground">
          New Lantern ©
        </div>
      </footer>
    </div>
  );
}

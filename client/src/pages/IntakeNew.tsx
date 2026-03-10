import { useState, useEffect, useCallback, useRef } from "react";
import { useRoute, useLocation } from "wouter";
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
import { Loader2, Download, Upload, CheckCircle2, Circle, Clock, ArrowLeft, ChevronRight, Trash2, LogOut, Home } from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { FilePreviewItem } from "@/components/FilePreviewItem";
import { IntegrationWorkflows } from "@/components/IntegrationWorkflows";
import { useAuth } from "@/_core/hooks/useAuth";
import { questionnaireData, type Question, type Section } from "@shared/questionnaireData";

// File List Component for each question
function FileListForQuestion({ questionId, organizationSlug, onDelete }: { questionId: string; organizationSlug: string; onDelete: (fileId: number) => void }) {
  const { data: files, isLoading } = trpc.intake.getUploadedFiles.useQuery(
    { organizationSlug, questionId },
    { enabled: !!organizationSlug && !!questionId }
  );

  if (isLoading) {
    return <div className="text-sm text-muted-foreground">Loading files...</div>;
  }

  if (!files || files.length === 0) {
    return null;
  }

  return (
    <div className="mt-3 space-y-2">
      <p className="text-sm font-medium text-muted-foreground">Uploaded Files:</p>
      {files.map((file) => (
        <div key={file.id} className="flex items-center justify-between p-3 bg-muted/30 rounded-lg border">
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium truncate">{file.fileName}</p>
            <p className="text-xs text-muted-foreground">
              {file.fileSize ? `${(file.fileSize / 1024).toFixed(1)} KB` : 'Unknown size'} • {new Date(file.createdAt).toLocaleDateString()}
            </p>
          </div>
          <div className="flex items-center gap-2 ml-3">
            <a
              href={file.fileUrl}
              target="_blank"
              rel="noopener noreferrer"
              download={file.fileName}
              className="p-2 hover:bg-muted rounded-md transition-colors"
              title="Download file"
            >
              <Download className="w-4 h-4 text-purple-600" />
            </a>
            <button
              onClick={() => onDelete(file.id)}
              className="p-2 hover:bg-destructive/10 rounded-md transition-colors"
            >
              <Trash2 className="w-4 h-4 text-destructive" />
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}

export default function IntakeNew() {
  const [, params] = useRoute("/org/:slug/intake");
  const slug = params?.slug;
  const [, setLocation] = useLocation();
  const [responses, setResponses] = useState<Record<string, any>>({});
  const [saveStatus, setSaveStatus] = useState<"idle" | "saving" | "saved">("idle");
  const [currentSection, setCurrentSection] = useState<string | null>(null);
  const [uploadingFiles, setUploadingFiles] = useState<Set<string>>(new Set());
  const [deleteFileId, setDeleteFileId] = useState<number | null>(null);
  const [deleteQuestionId, setDeleteQuestionId] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { user } = useAuth();
  const logoutMutation = trpc.auth.logout.useMutation();

  // Fetch organization
  const { data: org } = trpc.organizations.getBySlug.useQuery(
    { slug: slug || "" },
    { enabled: !!slug }
  );

  // Fetch existing responses
  const { data: existingResponses, isLoading: orgLoading } = trpc.intake.getResponses.useQuery(
    { organizationSlug: slug || "" },
    { enabled: !!slug }
  );

  // Load existing responses
  useEffect(() => {
    if (existingResponses) {
      const loadedResponses: Record<string, any> = {};
      existingResponses.forEach((resp) => {
        // Skip responses with null questionId (orphaned data)
        if (!resp.questionId) return;
        
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
    if (Object.keys(responses).length === 0) return;

    setSaveStatus("saving");
    const timer = setTimeout(async () => {
      try {
        await saveMutation.mutateAsync({
          organizationSlug: slug || "",
          responses: responses,
        });
        setSaveStatus("saved");
        setTimeout(() => setSaveStatus("idle"), 2000);
      } catch (error) {
        console.error("Auto-save failed:", error);
        setSaveStatus("idle");
      }
    }, 1000);

    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [responses, slug]);

  // File upload mutation
  const uploadFileMutation = trpc.files.upload.useMutation();

  // File delete mutation
  const deleteFileMutation = trpc.intake.deleteFile.useMutation();
  const utils = trpc.useUtils();

  // Handle file upload
  const handleFileUpload = useCallback(async (questionId: string, file: File) => {
    if (!org) {
      alert("Organization not found");
      return;
    }
    
    // Mark as uploading
    setUploadingFiles(prev => new Set(prev).add(questionId));
    
    const reader = new FileReader();
    reader.onload = async (e) => {
      const base64 = e.target?.result as string;
      try {
        const result = await uploadFileMutation.mutateAsync({
          organizationId: org.id,
          taskId: questionId,
          taskName: questionnaireData.filter(s => s.questions).flatMap(s => s.questions!).find(q => q.id === questionId)?.text || questionId,
          fileName: file.name,
          fileData: base64,
          mimeType: file.type,
        });
        setResponses(prev => ({ ...prev, [questionId]: result.fileUrl }));
      } catch (error) {
        console.error("File upload failed:", error);
        alert("File upload failed. Please try again.");
      } finally {
        // Remove from uploading set
        setUploadingFiles(prev => {
          const next = new Set(prev);
          next.delete(questionId);
          return next;
        });
      }
    };
    reader.readAsDataURL(file);
  }, [org, uploadFileMutation]);

  // Handle file delete
  const handleDeleteFile = useCallback(async () => {
    if (!deleteFileId || !deleteQuestionId || !slug) return;

    try {
      await deleteFileMutation.mutateAsync({
        fileId: deleteFileId,
        organizationSlug: slug,
      });
      
      // Refresh the file list for this question
      await utils.intake.getUploadedFiles.invalidate({
        organizationSlug: slug,
        questionId: deleteQuestionId,
      });
      
      // Close dialog
      setDeleteFileId(null);
      setDeleteQuestionId(null);
    } catch (error) {
      console.error("File delete failed:", error);
      alert("Failed to delete file. Please try again.");
    }
  }, [deleteFileId, deleteQuestionId, slug, deleteFileMutation, utils]);

  // Calculate progress per section
  const calculateSectionProgress = (section: Section) => {
    if (section.type === 'integration-workflows') {
      const keys = ['IW.orders_description', 'IW.images_description', 'IW.priors_description', 'IW.reports_description'];
      const filled = keys.filter(k => {
        const v = responses[k];
        return v && String(v).trim().length > 0;
      }).length;
      return Math.round((filled / 4) * 100);
    }
    if (!section.questions) return 0; // Other non-question sections
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
      if (!section.questions) return; // Skip workflow sections
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

  // Get section status
  const getSectionStatus = (section: Section) => {
    const progress = calculateSectionProgress(section);
    if (progress === 100) return "complete";
    if (progress > 0) return "in-progress";
    return "not-started";
  };

  // Get status icon
  const getStatusIcon = (status: string) => {
    switch (status) {
      case "complete":
        return <CheckCircle2 className="w-5 h-5 text-green-500" />;
      case "in-progress":
        return <Clock className="w-5 h-5 text-orange-500" />;
      default:
        return <Circle className="w-5 h-5 text-gray-400" />;
    }
  };

  // Render question input
  const renderQuestion = (question: Question) => {
    const value = responses[question.id];

    switch (question.type) {
      case 'text':
        return (
          <Input
            value={value || ''}
            onChange={(e) => setResponses(prev => ({ ...prev, [question.id]: e.target.value }))}
            placeholder={question.placeholder}
          />
        );

      case 'textarea':
        return (
          <Textarea
            value={value || ''}
            onChange={(e) => setResponses(prev => ({ ...prev, [question.id]: e.target.value }))}
            placeholder={question.placeholder}
            rows={4}
          />
        );

      case 'dropdown':
        return (
          <Select
            value={value || ''}
            onValueChange={(val) => setResponses(prev => ({ ...prev, [question.id]: val }))}
          >
            <SelectTrigger>
              <SelectValue placeholder={question.placeholder || "Select an option"} />
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
        const selectedValues = Array.isArray(value) ? value : [];
        return (
          <div className="space-y-2">
            {question.options?.map((option) => (
              <div key={option} className="flex items-center gap-2">
                <Checkbox
                  checked={selectedValues.includes(option)}
                  onCheckedChange={(checked) => {
                    if (checked) {
                      setResponses(prev => ({
                        ...prev,
                        [question.id]: [...selectedValues, option]
                      }));
                    } else {
                      setResponses(prev => ({
                        ...prev,
                        [question.id]: selectedValues.filter(v => v !== option)
                      }));
                    }
                  }}
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
          />
        );

      case 'upload':
        const isUploading = uploadingFiles.has(question.id);
        
        return (
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <Input
                type="file"
                accept=".csv,.xlsx,.xls,.txt"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) {
                    const allowedTypes = ['.csv', '.xlsx', '.xls', '.txt'];
                    const fileExt = '.' + file.name.split('.').pop()?.toLowerCase();
                    if (!allowedTypes.includes(fileExt)) {
                      alert('Only CSV, Excel (.xlsx, .xls), and TXT files are allowed.');
                      e.target.value = '';
                      return;
                    }
                    handleFileUpload(question.id, file);
                  }
                }}
                disabled={isUploading}
              />
              {isUploading && (
                <Loader2 className="w-5 h-5 animate-spin text-purple-500" />
              )}
            </div>
            {value && !isUploading && (
              <p className="text-sm text-green-600">✓ File uploaded: {value.split('/').pop()}</p>
            )}
            
            {/* File List */}
            <FileListForQuestion questionId={question.id} organizationSlug={slug || ''} onDelete={(fileId) => {
              setDeleteFileId(fileId);
              setDeleteQuestionId(question.id);
            }} />
          </div>
        );

      case 'upload-download':
        const isUploadingDownload = uploadingFiles.has(question.id);
        
        return (
          <div className="space-y-3">
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  // Download template
                  const link = document.createElement('a');
                  link.href = '/templates/vpn-form-template.pdf';
                  link.download = 'vpn-form-template.pdf';
                  link.click();
                }}
              >
                <Download className="w-4 h-4 mr-2" />
                Download Template
              </Button>
              <div className="flex items-center gap-2 flex-1">
                <Input
                  type="file"
                  accept=".csv,.xlsx,.xls,.txt"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) {
                      const allowedTypes = ['.csv', '.xlsx', '.xls', '.txt'];
                      const fileExt = '.' + file.name.split('.').pop()?.toLowerCase();
                      if (!allowedTypes.includes(fileExt)) {
                        alert('Only CSV, Excel (.xlsx, .xls), and TXT files are allowed.');
                        e.target.value = '';
                        return;
                      }
                      handleFileUpload(question.id, file);
                    }
                  }}
                  disabled={isUploadingDownload}
                  className="flex-1"
                />
                {isUploadingDownload && (
                  <Loader2 className="w-5 h-5 animate-spin text-purple-500" />
                )}
              </div>
            </div>
            {value && !isUploadingDownload && (
              <p className="text-sm text-green-600">✓ File uploaded: {value.split('/').pop()}</p>
            )}
            
            {/* File List */}
            <FileListForQuestion questionId={question.id} organizationSlug={slug || ''} onDelete={(fileId) => {
              setDeleteFileId(fileId);
              setDeleteQuestionId(question.id);
            }} />
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
  const currentSectionData = currentSection ? questionnaireData.find(s => s.id === currentSection) : null;

  // Dashboard view
  if (!currentSection) {
    return (
      <div className="min-h-screen bg-background">
        {/* Header */}
        <header className="border-b bg-card/50 backdrop-blur-sm sticky top-0 z-10">
          <div className="container py-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <img src="/images/new-lantern-logo.png" alt="New Lantern" className="h-16" />
                <div>
                  <h1 className="text-2xl font-bold">Radiology One - {slug}</h1>
                  <p className="text-sm text-muted-foreground mt-1">New Site Onboarding</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="outline" size="icon" className="rounded-full h-10 w-10">
                      <div className="text-sm font-semibold">
                        {user?.name?.split(' ').map(n => n[0]).join('').toUpperCase() || 'U'}
                      </div>
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-48">
                    <DropdownMenuItem onClick={() => setLocation('/admin')}>
                      <Home className="w-4 h-4 mr-2" />
                      Return to Dashboard
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onClick={handleImportCSV}>
                      <Upload className="w-4 h-4 mr-2" />
                      Import
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={handleExportCSV}>
                      <Download className="w-4 h-4 mr-2" />
                      Export
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onClick={() => {
                      logoutMutation.mutate();
                      setLocation('/login');
                    }}>
                      <LogOut className="w-4 h-4 mr-2" />
                      Sign Out
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".txt,.csv"
                  onChange={handleFileChange}
                  className="hidden"
                />
              </div>
            </div>
          </div>
        </header>

        {/* Main Content */}
        <div className="container py-8">
          <div className="grid grid-cols-1 lg:grid-cols-[1fr_400px] gap-8">
            {/* Left: Section Cards */}
            <div className="space-y-4">
              <div>
                <h2 className="text-xl font-semibold mb-2">Implementation Checklist</h2>
                <p className="text-sm text-muted-foreground">Complete all sections to proceed with go-live</p>
              </div>

              <div className="grid gap-4">
                {questionnaireData.map((section, idx) => {
                  const progress = calculateSectionProgress(section);
                  const status = getSectionStatus(section);

                  let progressLabel: string;
                  if (section.type === 'integration-workflows') {
                    const keys = ['IW.orders_description', 'IW.images_description', 'IW.priors_description', 'IW.reports_description'];
                    const filled = keys.filter(k => {
                      const v = responses[k];
                      return v && String(v).trim().length > 0;
                    }).length;
                    progressLabel = `${filled} of 4 workflows described`;
                  } else {
                    const answeredCount = section.questions?.filter(q => {
                      const value = responses[q.id];
                      if (Array.isArray(value)) return value.length > 0;
                      if (typeof value === 'string') return value.trim().length > 0;
                      return value !== undefined && value !== null && value !== '';
                    }).length || 0;
                    progressLabel = `${answeredCount} of ${section.questions?.length || 0} questions answered`;
                  }

                  return (
                    <Card
                      key={section.id}
                      className="cursor-pointer hover:border-primary transition-colors"
                      onClick={() => setCurrentSection(section.id)}
                    >
                      <CardHeader>
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <div className="flex items-center gap-3 mb-2">
                              {getStatusIcon(status)}
                              <CardTitle className="text-lg">
                                {idx + 1}. {section.title}
                              </CardTitle>
                            </div>
                            <CardDescription>{section.description}</CardDescription>
                          </div>
                          <ChevronRight className="w-5 h-5 text-muted-foreground" />
                        </div>
                      </CardHeader>
                      <CardContent>
                        <div className="space-y-2">
                          <div className="flex items-center justify-between text-sm">
                            <span className="text-muted-foreground">{progressLabel}</span>
                            <span className="font-semibold text-primary">{progress}%</span>
                          </div>
                          <Progress value={progress} className="h-2" />
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            </div>

            {/* Right: Progress Panel */}
            <div className="space-y-4">
              <Card className="sticky top-24">
                <CardHeader>
                  <CardTitle>Overall Progress</CardTitle>
                  <CardDescription>
                    {questionnaireData.filter(s => calculateSectionProgress(s) === 100).length} of {questionnaireData.length} sections complete
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="text-center p-6 rounded-lg bg-primary/10 border-2 border-primary/30">
                    <div className="text-5xl font-bold text-primary mb-2">{overallProgress}%</div>
                    <p className="text-sm text-muted-foreground">Complete</p>
                  </div>

                  <div className="space-y-2">
                    {questionnaireData.map((section) => {
                      const progress = calculateSectionProgress(section);
                      const status = getSectionStatus(section);
                      return (
                        <div key={section.id} className="flex items-center justify-between text-sm">
                          <div className="flex items-center gap-2">
                            {status === "complete" ? (
                              <CheckCircle2 className="w-4 h-4 text-green-500" />
                            ) : status === "in-progress" ? (
                              <Clock className="w-4 h-4 text-orange-500" />
                            ) : (
                              <Circle className="w-4 h-4 text-gray-400" />
                            )}
                            <span className="truncate">{section.title}</span>
                          </div>
                          <span className="font-medium">{progress}%</span>
                        </div>
                      );
                    })}
                  </div>

                  <div className="flex items-center gap-2 text-sm">
                    {saveStatus === "saving" ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
                        <span className="text-muted-foreground">Saving...</span>
                      </>
                    ) : saveStatus === "saved" ? (
                      <>
                        <CheckCircle2 className="w-4 h-4 text-green-500" />
                        <span className="text-green-500">All changes saved</span>
                      </>
                    ) : (
                      <span className="text-muted-foreground">Ready</span>
                    )}
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Section detail view
  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b bg-card/50 backdrop-blur-sm sticky top-0 z-10">
        <div className="container py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setCurrentSection(null)}
                className="gap-2"
              >
                <ArrowLeft className="w-4 h-4" />
                Back to Dashboard
              </Button>
              <div className="h-6 w-px bg-border" />
              <div>
                <h1 className="text-xl font-bold">{currentSectionData?.title}</h1>
                <p className="text-sm text-muted-foreground">
                  {currentSectionData?.type === 'integration-workflows' ? (() => {
                    const keys = ['IW.orders_description', 'IW.images_description', 'IW.priors_description', 'IW.reports_description'];
                    const filled = keys.filter(k => { const v = responses[k]; return v && String(v).trim().length > 0; }).length;
                    return `${filled} of 4 workflows described`;
                  })() : `${currentSectionData?.questions?.filter(q => {
                    const value = responses[q.id];
                    if (Array.isArray(value)) return value.length > 0;
                    if (typeof value === 'string') return value.trim().length > 0;
                    return value !== undefined && value !== null && value !== '';
                  }).length || 0} of ${currentSectionData?.questions?.length || 0} questions answered`}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {saveStatus === "saving" ? (
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
          {currentSectionData && (
            <Progress value={calculateSectionProgress(currentSectionData)} className="mt-4 h-2" />
          )}
        </div>
      </header>

      {/* Section Content */}
      {currentSectionData?.type === 'integration-workflows' ? (
        <div className="container py-8 max-w-6xl">
          <IntegrationWorkflows
            values={responses}
            onChange={(key, value) => setResponses(prev => ({ ...prev, [key]: value }))}
            organizationId={org?.id || 0}
            onBack={() => setCurrentSection(null)}
            onContinue={() => {
              const currentIdx = questionnaireData.findIndex(s => s.id === currentSection);
              if (currentIdx < questionnaireData.length - 1) {
                setCurrentSection(questionnaireData[currentIdx + 1].id);
              } else {
                setCurrentSection(null);
              }
            }}
          />
        </div>
      ) : (
        <div className="container py-8 max-w-4xl">
          <Card>
            <CardHeader>
              <CardTitle>{currentSectionData?.title}</CardTitle>
              {currentSectionData?.description && (
                <CardDescription>{currentSectionData.description}</CardDescription>
              )}
            </CardHeader>
            <CardContent className="space-y-6">
              {currentSectionData?.questions?.map((question) => (
                <div key={question.id} className="space-y-2">
                  <Label htmlFor={question.id} className="text-base font-medium">
                    {question.text}
                    <span className="text-red-500 ml-1">*</span>
                  </Label>
                  {question.notes && (
                    <p className="text-sm text-muted-foreground">{question.notes}</p>
                  )}
                  {renderQuestion(question)}
                </div>
              ))}
            </CardContent>
          </Card>

          <div className="flex justify-between mt-6">
            <Button
              variant="outline"
              onClick={() => setCurrentSection(null)}
            >
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back to Dashboard
            </Button>
            <Button
              onClick={() => {
                const currentIdx = questionnaireData.findIndex(s => s.id === currentSection);
                if (currentIdx < questionnaireData.length - 1) {
                  setCurrentSection(questionnaireData[currentIdx + 1].id);
                } else {
                  setCurrentSection(null);
                }
              }}
            >
              {questionnaireData.findIndex(s => s.id === currentSection) === questionnaireData.length - 1
                ? "Back to Dashboard"
                : "Save & Continue"}
              {questionnaireData.findIndex(s => s.id === currentSection) < questionnaireData.length - 1 && (
                <ChevronRight className="w-4 h-4 ml-2" />
              )}
            </Button>
          </div>
        </div>
      )}

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteFileId !== null} onOpenChange={(open) => {
        if (!open) {
          setDeleteFileId(null);
          setDeleteQuestionId(null);
        }
      }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete File</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this file? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteFile} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

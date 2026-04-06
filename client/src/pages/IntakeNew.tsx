import { useState, useEffect, useCallback, useRef } from "react";
import { useRoute, useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import { cn } from "@/lib/utils";
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
import { Loader2, Download, Upload, CheckCircle2, Circle, Clock, ArrowLeft, ChevronRight, Trash2, LogOut, Home, Ban, Sparkles, FileText, X } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
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
  const [naSections, setNaSections] = useState<Set<string>>(new Set());
  const [naQuestions, setNaQuestions] = useState<Set<string>>(new Set());
  const [deleteFileId, setDeleteFileId] = useState<number | null>(null);
  const [deleteQuestionId, setDeleteQuestionId] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const autofillInputRef = useRef<HTMLInputElement>(null);

  // AI auto-fill state
  const [autofillLoading, setAutofillLoading] = useState(false);
  const [autofillAnswers, setAutofillAnswers] = useState<Record<string, string> | null>(null);
  const [autofillSelected, setAutofillSelected] = useState<Record<string, boolean>>({});
  const [autofillFileName, setAutofillFileName] = useState<string>("");
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
      const loadedNa = new Set<string>();
      const loadedNaQ = new Set<string>();
      existingResponses.forEach((resp) => {
        // Skip responses with null questionId (orphaned data)
        if (!resp.questionId) return;
        
        // Check for section-level N/A markers
        if (resp.questionId.startsWith('__section_na:')) {
          const sectionId = resp.questionId.replace('__section_na:', '');
          loadedNa.add(sectionId);
          return;
        }
        
        // Check for question-level N/A markers
        if (resp.questionId.startsWith('__question_na:')) {
          const qId = resp.questionId.replace('__question_na:', '');
          loadedNaQ.add(qId);
          return;
        }
        
        try {
          const value = typeof resp.response === 'string' ? JSON.parse(resp.response) : resp.response;
          loadedResponses[resp.questionId] = value;
        } catch {
          loadedResponses[resp.questionId] = resp.response;
        }
      });
      setResponses(loadedResponses);
      setNaSections(loadedNa);
      setNaQuestions(loadedNaQ);
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

  // AI document autofill mutation
  const parseDocumentMutation = trpc.intake.parseDocumentForAutofill.useMutation();

  const handleAutofillUpload = useCallback(async (file: File) => {
    setAutofillLoading(true);
    setAutofillFileName(file.name);
    try {
      const base64 = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = (e) => {
          const result = e.target?.result as string;
          // Strip the data URL prefix (e.g. "data:application/pdf;base64,")
          resolve(result.split(',')[1] ?? '');
        };
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });

      const { answers } = await parseDocumentMutation.mutateAsync({
        fileData: base64,
        mimeType: file.type || 'application/octet-stream',
        fileName: file.name,
      });

      if (Object.keys(answers).length === 0) {
        alert("No questionnaire answers could be extracted from this document. Try a different file.");
        return;
      }

      // Default: all extracted answers selected
      setAutofillAnswers(answers);
      setAutofillSelected(Object.fromEntries(Object.keys(answers).map((k) => [k, true])));
    } catch (err) {
      console.error("Autofill failed:", err);
      alert("Failed to extract answers from the document. Please try again.");
    } finally {
      setAutofillLoading(false);
      // Reset file input so same file can be re-uploaded
      if (autofillInputRef.current) autofillInputRef.current.value = '';
    }
  }, [parseDocumentMutation]);

  const handleAutofillApply = useCallback(() => {
    if (!autofillAnswers) return;
    const toApply: Record<string, any> = {};
    for (const [id, val] of Object.entries(autofillAnswers)) {
      if (!autofillSelected[id]) continue;
      // Multi-select values are stored as JSON strings; parse them back to arrays
      try {
        const parsed = JSON.parse(val);
        toApply[id] = parsed;
      } catch {
        toApply[id] = val;
      }
    }
    setResponses((prev) => ({ ...prev, ...toApply }));
    setAutofillAnswers(null);
    setAutofillSelected({});
  }, [autofillAnswers, autofillSelected]);

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
      // N/A questions count as answered
      if (naQuestions.has(q.id)) return true;
      const value = responses[q.id];
      if (Array.isArray(value)) return value.length > 0;
      if (typeof value === 'string') return value.trim().length > 0;
      return value !== undefined && value !== null && value !== '';
    }).length;

    return Math.round((answeredCount / totalQuestions) * 100);
  };

  // Calculate overall progress (N/A sections count as 100%)
  const calculateOverallProgress = () => {
    const sectionProgresses = questionnaireData.map(s => 
      naSections.has(s.id) ? 100 : calculateSectionProgress(s)
    );
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

  // Toggle question N/A
  const toggleQuestionNa = (questionId: string) => {
    setNaQuestions(prev => {
      const next = new Set(prev);
      if (next.has(questionId)) {
        next.delete(questionId);
      } else {
        next.add(questionId);
      }
      return next;
    });
    // Save the N/A marker as a special response
    const key = `__question_na:${questionId}`;
    setResponses(prev => {
      if (naQuestions.has(questionId)) {
        // Removing N/A — delete the marker
        const { [key]: _, ...rest } = prev;
        return rest;
      } else {
        // Adding N/A — set the marker
        return { ...prev, [key]: 'true' };
      }
    });
  };

  // Toggle section N/A
  const toggleSectionNa = (sectionId: string) => {
    setNaSections(prev => {
      const next = new Set(prev);
      if (next.has(sectionId)) {
        next.delete(sectionId);
      } else {
        next.add(sectionId);
      }
      return next;
    });
    // Save the N/A marker as a special response
    setResponses(prev => {
      const key = `__section_na:${sectionId}`;
      if (naSections.has(sectionId)) {
        // Removing N/A — delete the marker
        const { [key]: _, ...rest } = prev;
        return rest;
      } else {
        // Adding N/A — set the marker
        return { ...prev, [key]: 'true' };
      }
    });
  };

  // Get section status
  const getSectionStatus = (section: Section) => {
    if (naSections.has(section.id)) return "na";
    const progress = calculateSectionProgress(section);
    if (progress === 100) return "complete";
    if (progress > 0) return "in-progress";
    return "not-started";
  };

  // Flat map of questionId -> question text (for autofill review dialog)
  const questionLabelMap: Record<string, string> = {};
  questionnaireData.forEach((s) => {
    s.questions?.forEach((q) => { questionLabelMap[q.id] = q.text; });
  });

  // Get status icon
  const getStatusIcon = (status: string) => {
    switch (status) {
      case "complete":
        return <CheckCircle2 className="w-5 h-5 text-green-500" />;
      case "in-progress":
        return <Clock className="w-5 h-5 text-blue-400" />;
      case "na":
        return <Ban className="w-5 h-5 text-amber-400" />;
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
          <div className="flex flex-wrap gap-2">
            {question.options?.map((option) => {
              const checked = selectedValues.includes(option);
              return (
                <button
                  key={option}
                  type="button"
                  onClick={() => {
                    const updated = checked
                      ? selectedValues.filter(v => v !== option)
                      : [...selectedValues, option];
                    setResponses(prev => ({ ...prev, [question.id]: updated }));
                  }}
                  className={`px-3 py-1.5 rounded-full text-sm font-medium border transition-colors ${
                    checked
                      ? "bg-primary border-primary text-primary-foreground"
                      : "bg-background border-border text-foreground hover:border-primary/60"
                  }`}
                >
                  {option}
                </button>
              );
            })}
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
                <h2 className="text-xl font-semibold mb-2">Task List</h2>
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

                  const isNa = naSections.has(section.id);

                  return (
                    <Card
                      key={section.id}
                      className={cn(
                        "hover:border-primary transition-colors",
                        isNa && "opacity-60"
                      )}
                    >
                      <CardHeader>
                        <div className="flex items-start justify-between">
                          <div className="flex-1 cursor-pointer" onClick={() => !isNa && setCurrentSection(section.id)}>
                            <div className="flex items-center gap-3 mb-2">
                              {getStatusIcon(status)}
                              <CardTitle className={cn("text-lg", isNa && "line-through text-muted-foreground")}>
                                {idx + 1}. {section.title}
                              </CardTitle>
                              {isNa && (
                                <Badge className="bg-amber-500/15 text-amber-400 border-amber-500/30 text-xs">N/A</Badge>
                              )}
                            </div>
                            <CardDescription>{section.description}</CardDescription>
                          </div>
                          <div className="flex items-center gap-2">
                            <button
                              onClick={(e) => { e.stopPropagation(); toggleSectionNa(section.id); }}
                              className={cn(
                                "px-2 py-1 rounded text-xs font-medium border transition-colors",
                                isNa
                                  ? "bg-amber-500/15 text-amber-400 border-amber-500/30 hover:bg-amber-500/25"
                                  : "text-muted-foreground border-border hover:bg-muted/50"
                              )}
                              title={isNa ? "Remove N/A — re-enable this section" : "Mark as N/A — skip this section"}
                            >
                              <Ban className="w-3 h-3 inline mr-1" />
                              {isNa ? "Undo N/A" : "N/A"}
                            </button>
                            {!isNa && <ChevronRight className="w-5 h-5 text-muted-foreground cursor-pointer" onClick={() => setCurrentSection(section.id)} />}
                          </div>
                        </div>
                      </CardHeader>
                      {!isNa && (
                        <CardContent className="cursor-pointer" onClick={() => setCurrentSection(section.id)}>
                          <div className="space-y-2">
                            <div className="flex items-center justify-between text-sm">
                              <span className="text-muted-foreground">{progressLabel}</span>
                              <span className="font-semibold text-primary">{progress}%</span>
                            </div>
                            <Progress value={progress} className="h-2" />
                          </div>
                        </CardContent>
                      )}
                    </Card>
                  );
                })}
              </div>
            </div>

            {/* Right: Progress Panel */}
            <div className="space-y-4">
              {/* AI Auto-fill Card */}
              <Card className="border-2 border-dashed border-purple-300 bg-purple-50/50 dark:bg-purple-950/20 dark:border-purple-800">
                <CardHeader className="pb-3">
                  <CardTitle className="flex items-center gap-2 text-base text-purple-700 dark:text-purple-300">
                    <Sparkles className="w-4 h-4" />
                    AI Auto-fill
                  </CardTitle>
                  <CardDescription>
                    Upload a document (PDF, image) and AI will pre-fill the questionnaire for you.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <input
                    ref={autofillInputRef}
                    type="file"
                    accept=".pdf,.png,.jpg,.jpeg,.webp,.gif,.tiff"
                    className="hidden"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) handleAutofillUpload(file);
                    }}
                  />
                  <Button
                    variant="outline"
                    className="w-full gap-2 border-purple-400 text-purple-700 hover:bg-purple-100 dark:text-purple-300 dark:border-purple-700 dark:hover:bg-purple-900/30"
                    disabled={autofillLoading}
                    onClick={() => autofillInputRef.current?.click()}
                  >
                    {autofillLoading ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        Analyzing…
                      </>
                    ) : (
                      <>
                        <FileText className="w-4 h-4" />
                        Upload Document
                      </>
                    )}
                  </Button>
                  {autofillLoading && autofillFileName && (
                    <p className="text-xs text-muted-foreground mt-2 truncate">
                      Reading {autofillFileName}…
                    </p>
                  )}
                </CardContent>
              </Card>

              <Card className="sticky top-24">
                <CardHeader>
                  <CardTitle>Overall Progress</CardTitle>
                  <CardDescription>
                    {questionnaireData.filter(s => naSections.has(s.id) || calculateSectionProgress(s) === 100).length} of {questionnaireData.length} sections complete
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="text-center p-6 rounded-lg bg-primary/10 border-2 border-primary/30">
                    <div className="text-5xl font-bold text-primary mb-2">{overallProgress}%</div>
                    <p className="text-sm text-muted-foreground">Complete</p>
                  </div>

                  <div className="space-y-2">
                    {questionnaireData.map((section) => {
                      const progress = naSections.has(section.id) ? 100 : calculateSectionProgress(section);
                      const status = getSectionStatus(section);
                      return (
                        <div key={section.id} className="flex items-center justify-between text-sm">
                          <div className="flex items-center gap-2">
                            {status === "na" ? (
                              <Ban className="w-4 h-4 text-amber-400" />
                            ) : status === "complete" ? (
                              <CheckCircle2 className="w-4 h-4 text-green-500" />
                            ) : status === "in-progress" ? (
                              <Clock className="w-4 h-4 text-blue-400" />
                            ) : (
                              <Circle className="w-4 h-4 text-gray-400" />
                            )}
                            <span className={cn("truncate", status === "na" && "line-through text-muted-foreground")}>{section.title}</span>
                          </div>
                          {status === "na" ? (
                            <span className="text-xs text-amber-400 font-medium">N/A</span>
                          ) : (
                            <span className="font-medium">{progress}%</span>
                          )}
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
                  })() : (() => {
                    const answered = currentSectionData?.questions?.filter(q => {
                      if (naQuestions.has(q.id)) return true;
                      const value = responses[q.id];
                      if (Array.isArray(value)) return value.length > 0;
                      if (typeof value === 'string') return value.trim().length > 0;
                      return value !== undefined && value !== null && value !== '';
                    }).length || 0;
                    const naCount = currentSectionData?.questions?.filter(q => naQuestions.has(q.id)).length || 0;
                    const total = currentSectionData?.questions?.length || 0;
                    return naCount > 0 ? `${answered} of ${total} complete (${naCount} N/A)` : `${answered} of ${total} questions answered`;
                  })()}
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
              {currentSectionData?.questions?.map((question) => {
                const isQuestionNa = naQuestions.has(question.id);
                return (
                  <div key={question.id} className={cn("space-y-2 p-4 rounded-lg border transition-colors", isQuestionNa ? "border-amber-500/30 bg-amber-500/5 opacity-60" : "border-transparent")}>
                    <div className="flex items-start justify-between gap-3">
                      <Label htmlFor={question.id} className={cn("text-base font-medium flex-1", isQuestionNa && "line-through text-muted-foreground")}>
                        {question.text}
                        {!isQuestionNa && <span className="text-red-500 ml-1">*</span>}
                        {isQuestionNa && <Badge className="ml-2 bg-amber-500/15 text-amber-400 border-amber-500/30 text-[10px] align-middle">N/A</Badge>}
                      </Label>
                      <button
                        type="button"
                        onClick={() => toggleQuestionNa(question.id)}
                        className={cn(
                          "px-2 py-1 rounded text-xs font-medium border transition-colors flex-shrink-0 mt-0.5",
                          isQuestionNa
                            ? "bg-amber-500/15 text-amber-400 border-amber-500/30 hover:bg-amber-500/25"
                            : "text-muted-foreground border-border hover:bg-muted/50"
                        )}
                        title={isQuestionNa ? "Remove N/A — re-enable this question" : "Mark as N/A — skip this question"}
                      >
                        <Ban className="w-3 h-3 inline mr-1" />
                        {isQuestionNa ? "Undo" : "N/A"}
                      </button>
                    </div>
                    {!isQuestionNa && (
                      <>
                        {question.notes && (
                          <p className="text-sm text-muted-foreground">{question.notes}</p>
                        )}
                        {renderQuestion(question)}
                      </>
                    )}
                  </div>
                );
              })}
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

      {/* AI Auto-fill Review Dialog */}
      <Dialog open={autofillAnswers !== null} onOpenChange={(open) => {
        if (!open) { setAutofillAnswers(null); setAutofillSelected({}); }
      }}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-purple-600" />
              Review Auto-filled Answers
            </DialogTitle>
            <DialogDescription>
              AI extracted the following answers from <strong>{autofillFileName}</strong>.
              Deselect any you don't want to apply, then click Apply.
            </DialogDescription>
          </DialogHeader>

          <div className="flex items-center justify-between text-sm py-1 border-b">
            <span className="text-muted-foreground">
              {Object.values(autofillSelected).filter(Boolean).length} of {Object.keys(autofillSelected).length} selected
            </span>
            <div className="flex gap-2">
              <Button size="sm" variant="ghost" onClick={() =>
                setAutofillSelected(Object.fromEntries(Object.keys(autofillSelected).map((k) => [k, true])))
              }>Select all</Button>
              <Button size="sm" variant="ghost" onClick={() =>
                setAutofillSelected(Object.fromEntries(Object.keys(autofillSelected).map((k) => [k, false])))
              }>Deselect all</Button>
            </div>
          </div>

          <ScrollArea className="max-h-[50vh] pr-3">
            <div className="space-y-3">
              {autofillAnswers && Object.entries(autofillAnswers).map(([id, val]) => {
                const label = questionLabelMap[id] ?? id;
                const displayVal = (() => {
                  try {
                    const parsed = JSON.parse(val);
                    return Array.isArray(parsed) ? parsed.join(', ') : val;
                  } catch { return val; }
                })();
                return (
                  <div
                    key={id}
                    className={`flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
                      autofillSelected[id]
                        ? 'bg-purple-50 border-purple-200 dark:bg-purple-950/30 dark:border-purple-700'
                        : 'bg-muted/30 border-transparent opacity-50'
                    }`}
                    onClick={() => setAutofillSelected((prev) => ({ ...prev, [id]: !prev[id] }))}
                  >
                    <Checkbox
                      checked={autofillSelected[id] ?? false}
                      onCheckedChange={(checked) =>
                        setAutofillSelected((prev) => ({ ...prev, [id]: !!checked }))
                      }
                      onClick={(e) => e.stopPropagation()}
                      className="mt-0.5 shrink-0"
                    />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-xs font-mono font-bold text-purple-600 dark:text-purple-400">{id}</span>
                        <span className="text-xs text-muted-foreground truncate">{label}</span>
                      </div>
                      <p className="text-sm font-medium break-words">{displayVal}</p>
                    </div>
                    {responses[id] && (
                      <span className="text-xs text-orange-500 shrink-0 mt-0.5">overwrites</span>
                    )}
                  </div>
                );
              })}
            </div>
          </ScrollArea>

          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => { setAutofillAnswers(null); setAutofillSelected({}); }}>
              Cancel
            </Button>
            <Button
              className="bg-purple-600 hover:bg-purple-700 text-white gap-2"
              disabled={!Object.values(autofillSelected).some(Boolean)}
              onClick={handleAutofillApply}
            >
              <Sparkles className="w-4 h-4" />
              Apply {Object.values(autofillSelected).filter(Boolean).length} answers
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

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

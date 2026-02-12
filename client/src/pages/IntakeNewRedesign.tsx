import { useState, useEffect, useRef, useMemo } from "react";
import { useParams, useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Progress } from "@/components/ui/progress";
import { Loader2, Download, Upload, CheckCircle2, Circle, LogOut, FileText, Shield, Database, FileUp, Network, ClipboardCheck, Star } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useAuth } from "@/_core/hooks/useAuth";
import { questionnaireSections, type Question, type Section } from "@shared/questionnaireData";
import { toast } from "sonner";
import { WorkflowDiagram } from "@/components/WorkflowDiagram";

// Section icons mapping
const sectionIcons: Record<string, any> = {
  "org-info": FileText,
  "overview-arch": Database,
  "data-integration": Database,
  "config-files": FileUp,
  "connectivity": Network,
  "dicom-validation": ClipboardCheck,
};

// File upload field component with file list display
function FileUploadField({ questionId, isUploading, organizationSlug, onFileUpload, onFileDelete }: {
  questionId: string;
  isUploading: boolean;
  organizationSlug: string;
  onFileUpload: (questionId: string, file: File) => void;
  onFileDelete: (fileId: number) => void;
}) {
  const { data: files = [], isLoading } = trpc.intake.getUploadedFiles.useQuery(
    { organizationSlug, questionId },
    { enabled: !!organizationSlug }
  );

  return (
    <div className="space-y-3">
      {/* PHI Warning Banner */}
      <div className="flex items-center gap-2 px-4 py-2 bg-yellow-400/20 border border-yellow-400/50 rounded-md">
        <span className="text-yellow-400 text-lg">⚠</span>
        <span className="text-sm font-semibold text-yellow-400">PHI Warning: Do not share Protected Health Information (PHI) or patient data in this portal</span>
      </div>
      
      <Input
        type="file"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) onFileUpload(questionId, file);
        }}
        disabled={isUploading}
        className="!bg-white !text-black"
      />
      {isUploading && (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="w-4 h-4 animate-spin" />
          Uploading...
        </div>
      )}
      
      {/* Display uploaded files */}
      {isLoading ? (
        <div className="text-sm text-muted-foreground">Loading files...</div>
      ) : files.length > 0 ? (
        <div className="space-y-2">
          <div className="text-sm font-medium text-muted-foreground">Uploaded Files:</div>
          {files.map((file) => (
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
                    {file.fileSize ? `${(file.fileSize / 1024).toFixed(1)} KB • ` : ''}{new Date(file.createdAt).toLocaleDateString()}
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-2 flex-shrink-0">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => window.open(file.fileUrl, '_blank')}
                  className="h-8 px-2"
                >
                  <Download className="w-4 h-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => onFileDelete(file.id)}
                  className="h-8 px-2 text-destructive hover:text-destructive"
                >
                  ×
                </Button>
              </div>
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}

export default function IntakeNewRedesign() {
  const { slug } = useParams();
  const [, setLocation] = useLocation();
  const [responses, setResponses] = useState<Record<string, any>>({});
  const [saveStatus, setSaveStatus] = useState<"idle" | "saving" | "saved">("idle");
  const [currentSection, setCurrentSection] = useState<string>("org-info");
  const [uploadingFiles, setUploadingFiles] = useState<Set<string>>(new Set());
  const [unansweredQuestions, setUnansweredQuestions] = useState<Set<string>>(new Set());
  const [showFeedbackModal, setShowFeedbackModal] = useState(false);
  const [feedbackRating, setFeedbackRating] = useState(0);
  const [feedbackComments, setFeedbackComments] = useState("");
  const [importDialogOpen, setImportDialogOpen] = useState(false);
  const [importFile, setImportFile] = useState<File | null>(null);
  const [isImporting, setIsImporting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const hasNavigatedRef = useRef(false); // Track if we've already auto-navigated
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

  // Fetch file count from database
  const { data: fileCount = 0 } = trpc.intake.getFileCount.useQuery(
    { organizationSlug: slug || "" },
    { enabled: !!slug }
  );

  // Fetch all uploaded files to check validation
  const { data: allUploadedFiles = [] } = trpc.intake.getAllUploadedFiles.useQuery(
    { organizationSlug: slug || "" },
    { enabled: !!slug }
  );

  // Fetch partner templates from database
  const { data: dbTemplates = [] } = trpc.intake.getTemplatesForOrg.useQuery(
    { organizationSlug: slug || "" },
    { enabled: !!slug }
  );

  // Build a map of questionId -> template(s) from database
  const dbTemplateMap = useMemo(() => {
    const map = new Map<string, Array<{ label: string; fileName: string; fileUrl: string }>>(); 
    dbTemplates.forEach(t => {
      const existing = map.get(t.questionId) || [];
      existing.push({ label: t.label, fileName: t.fileName, fileUrl: t.fileUrl });
      map.set(t.questionId, existing);
    });
    return map;
  }, [dbTemplates]);

  // Create a map of questionId -> file count for validation
  const uploadedFilesMap = useMemo(() => {
    const map = new Map<string, number>();
    allUploadedFiles.forEach(file => {
      const count = map.get(file.questionId) || 0;
      map.set(file.questionId, count + 1);
    });
    return map;
  }, [allUploadedFiles]);

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

  // Auto-navigate to first incomplete section ONLY on first load
  useEffect(() => {
    // Skip if already navigated or responses not loaded yet
    if (hasNavigatedRef.current || Object.keys(responses).length === 0) return;
    
    // Find first section that is not 100% complete
    const firstIncompleteSection = questionnaireSections.find(section => {
      const progress = calculateSectionProgress(section);
      return progress < 100;
    });
    
    if (firstIncompleteSection) {
      setCurrentSection(firstIncompleteSection.id);
    }
    
    // Mark that we've done the initial navigation
    hasNavigatedRef.current = true;
  }, [responses]); // Run when responses are loaded

  // Save mutation
  const saveMutation = trpc.intake.saveResponse.useMutation({
    onSuccess: () => {
      setSaveStatus("saved");
      setTimeout(() => setSaveStatus("idle"), 2000);
    },
  });

  // Feedback submission mutation
  const submitFeedbackMutation = trpc.intake.submitFeedback.useMutation({
    onSuccess: () => {
      setShowFeedbackModal(false);
      setFeedbackRating(0);
      setFeedbackComments("");
      setLocation(`/org/${slug}/complete`);
    },
    onError: () => {
      toast.error('Failed to submit feedback. Please try again.');
    },
  });

  // Auto-save on response change
  useEffect(() => {
    if (!slug || Object.keys(responses).length === 0) return;
    
    const timer = setTimeout(() => {
      setSaveStatus("saving");
      console.log('[VPN Debug] Auto-saving responses:', Object.keys(responses));
      Object.entries(responses).forEach(([questionId, value]) => {
        console.log(`[VPN Debug] Saving ${questionId}:`, value);
        saveMutation.mutate({
          organizationSlug: slug,
          questionId,
          response: typeof value === 'object' ? JSON.stringify(value) : String(value),
          userEmail: user?.email || '',
        });
      });
    }, 1000);

    return () => clearTimeout(timer);
  }, [responses, slug]);

  // File upload mutation
  const uploadMutation = trpc.intake.uploadFile.useMutation({
    onSuccess: (data, variables) => {
      setUploadingFiles(prev => {
        const next = new Set(prev);
        next.delete(variables.questionId);
        return next;
      });
      // Refetch files for this question
      utils.intake.getUploadedFiles.invalidate({
        organizationSlug: slug || "",
        questionId: variables.questionId,
      });
      // Refetch all uploaded files to update validation map
      utils.intake.getAllUploadedFiles.invalidate({
        organizationSlug: slug || "",
      });
      // Refetch file count
      utils.intake.getFileCount.invalidate({
        organizationSlug: slug || "",
      });
    },
    onError: (error, variables) => {
      // Clear uploading state even on error
      setUploadingFiles(prev => {
        const next = new Set(prev);
        next.delete(variables.questionId);
        return next;
      });
      // Show error toast
      console.error('File upload failed:', error);
      alert(`File upload failed: ${error.message}. Please try again.`);
    },
  });

  // Delete file mutation
  const deleteMutation = trpc.intake.deleteFile.useMutation({
    onSuccess: (_, variables) => {
      // Refetch files after deletion
      utils.intake.getUploadedFiles.invalidate();
      // Refetch all uploaded files to update validation map
      utils.intake.getAllUploadedFiles.invalidate({
        organizationSlug: slug || "",
      });
      // Refetch file count
      utils.intake.getFileCount.invalidate({
        organizationSlug: slug || "",
      });
    },
  });

  const utils = trpc.useUtils();

  // Calculate section progress (including uploaded files)
  const calculateSectionProgress = (section: Section) => {
    // Handle workflow sections differently
    if (section.type === 'workflow') {
      const configKey = section.id + '_config';
      const savedConfig = responses[configKey];
      
      if (!savedConfig) return 0;
      
      try {
        const config = typeof savedConfig === 'string' ? JSON.parse(savedConfig) : savedConfig;
        
        // Get all selected path keys
        const selectedPathKeys = Object.keys(config.paths || {}).filter(key => config.paths[key]);
        
        if (selectedPathKeys.length === 0) return 0;
        
        // Orders and Images workflows have fixed systems (no input fields)
        // Only Priors and Reports workflows require system name inputs
        const workflowsRequiringSystemNames = ['priors-workflow', 'reports-out-workflow'];
        
        if (!workflowsRequiringSystemNames.includes(section.id)) {
          // For Orders/Images: complete if at least one path is selected
          return 100;
        }
        
        // For Priors/Reports: check if all selected paths have their system names filled in
        const pathToSystemKeyMap: Record<string, string> = {
          'priorsPush': 'priorsPushSource',
          'priorsQuery': 'priorsQuerySource',
          'reportsToPortal': 'reportsPortalDestination'
        };
        
        const allSystemsFilled = selectedPathKeys.every(pathKey => {
          const systemKey = pathToSystemKeyMap[pathKey];
          if (!systemKey) return true; // Path doesn't require system name
          const systemValue = config.systems?.[systemKey];
          return systemValue && systemValue.trim() !== '';
        });
        
        // Complete only if at least one path is selected AND all selected paths have system names
        return allSystemsFilled ? 100 : Math.round((selectedPathKeys.length / (selectedPathKeys.length + 1)) * 100);
      } catch {
        return 0;
      }
    }
    
    // Standard sections with questions
    if (!section.questions) return 0;
    
    // Filter out hidden conditional questions first
    const visibleQuestions = section.questions.filter(q => {
      if (q.conditionalOn) {
        const parentResponse = responses[q.conditionalOn.questionId];
        return parentResponse === q.conditionalOn.value;
      }
      return true;
    });
    
    const answered = visibleQuestions.filter(q => {
      // Check if question has a text response
      const response = responses[q.id];
      const hasResponse = Array.isArray(response) 
        ? response.length > 0 
        : (response !== undefined && response !== '' && response !== null);
      
      // Check if question has uploaded files (for file upload questions)
      const hasUploadedFile = allUploadedFiles.some(f => f.questionId === q.id);
      
      // Question is answered if it has EITHER a response OR uploaded files
      return hasResponse || hasUploadedFile;
    }).length;
    
    return visibleQuestions.length > 0 
      ? Math.round((answered / visibleQuestions.length) * 100)
      : 100; // If no visible questions, consider section complete
  };

  // Handle file upload
  const handleFileUpload = async (questionId: string, file: File) => {
    if (!slug) return;
    
    setUploadingFiles(prev => new Set(prev).add(questionId));
    
    const reader = new FileReader();
    reader.onload = async (e) => {
      const dataUrl = e.target?.result as string;
      // Strip the data URL prefix (e.g., "data:text/csv;base64,") to get just the base64 string
      const base64 = dataUrl.split(',')[1];
      await uploadMutation.mutateAsync({
        organizationSlug: slug,
        questionId,
        fileName: file.name,
        fileData: base64,
        mimeType: file.type,
        userEmail: user?.email || '',
      });
    };
    reader.readAsDataURL(file);
  };

  // Export pipe-delimited file (excludes upload, upload-download, and workflow types)
  const handleExportCSV = () => {
    const lines = ['Section|Question ID|Question Text|Response Type|Valid Options|Response Value'];
    
    questionnaireSections.forEach(section => {
      // Skip workflow sections entirely — not text-answerable
      if (section.type === 'workflow') return;
      
      // Handle standard question sections
      if (!section.questions) return;
      
      section.questions.forEach(q => {
        // Skip file upload questions — not text-answerable
        if (q.type === 'upload' || q.type === 'upload-download') return;
        
        const response = responses[q.id] || '';
        const responseStr = Array.isArray(response) ? response.join('; ') : String(response);
        
        // Include valid options for dropdown and multi-select so AI knows what to pick
        const optionsStr = q.options ? q.options.join('; ') : '';
        
        lines.push(`${section.title}|${q.id}|${q.text}|${q.type}|${optionsStr}|${responseStr}`);
      });
    });
    
    const blob = new Blob([lines.join('\n')], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${slug}-intake-responses.txt`;
    a.click();
  };

  // Import pipe-delimited file (supports both 5-column legacy and 6-column new format)
  const handleImportFile = async () => {
    if (!importFile || !slug) return;
    
    setIsImporting(true);
    try {
      const text = await importFile.text();
      const lines = text.split('\n').filter(line => line.trim());
      
      // Detect format from header
      const header = lines[0] || '';
      const headerParts = header.split('|');
      const hasOptionsColumn = headerParts.length >= 6; // New format has Valid Options column
      
      // Skip header row
      const dataLines = lines.slice(1);
      
      const importedResponses: Record<string, any> = {};
      let importCount = 0;
      
      dataLines.forEach(line => {
        const parts = line.split('|');
        
        let questionId: string;
        let responseType: string;
        let responseValue: string;
        
        if (hasOptionsColumn) {
          // New 6-column format: Section|Question ID|Question Text|Response Type|Valid Options|Response Value
          if (parts.length < 6) return;
          questionId = parts[1]?.trim();
          responseType = parts[3]?.trim();
          responseValue = parts[5]?.trim();
        } else {
          // Legacy 5-column format: Section|Question ID|Question Text|Response Type|Response Value
          if (parts.length < 5) return;
          questionId = parts[1]?.trim();
          responseType = parts[3]?.trim();
          responseValue = parts[4]?.trim();
        }
        
        if (!questionId || !responseValue) return;
        
        // Skip workflow types (shouldn't be in export, but handle gracefully)
        if (responseType === 'workflow') return;
        
        // Convert to appropriate type based on response type
        if (responseType === 'multi-select' || responseType === 'multiple-choice') {
          importedResponses[questionId] = responseValue.split('; ').map(v => v.trim()).filter(Boolean);
        } else {
          importedResponses[questionId] = responseValue;
        }
        importCount++;
      });
      
      // Merge imported responses into existing state
      setResponses(prev => ({ ...prev, ...importedResponses }));
      
      // Save only the imported responses to database
      const savePromises = Object.entries(importedResponses).map(([questionId, value]) => {
        return saveMutation.mutateAsync({
          organizationSlug: slug,
          questionId,
          response: typeof value === 'object' ? JSON.stringify(value) : String(value),
          userEmail: user?.email || '',
        });
      });
      
      await Promise.all(savePromises);
      
      toast.success('Import successful', {
        description: `Imported ${importCount} responses`
      });
      
      setImportDialogOpen(false);
      setImportFile(null);
    } catch (error) {
      console.error('Import error:', error);
      toast.error('Import failed', {
        description: error instanceof Error ? error.message : 'Failed to parse import file'
      });
    } finally {
      setIsImporting(false);
    }
  };

  // Render question input
  const renderQuestion = (question: Question) => {
    const value = responses[question.id];
    const isUploading = uploadingFiles.has(question.id);

    switch (question.type) {
      case 'text':
        return (
          <Input
            value={value || ''}
            onChange={(e) => setResponses(prev => ({ ...prev, [question.id]: e.target.value }))}
            placeholder={question.placeholder}
            className="!bg-white !text-black"
          />
        );

      case 'textarea':
        return (
          <Textarea
            value={value || ''}
            onChange={(e) => setResponses(prev => ({ ...prev, [question.id]: e.target.value }))}
            placeholder={question.placeholder}
            className="!bg-white !text-black min-h-[100px]"
          />
        );

      case 'dropdown':
        return (
          <Select
            value={value || ''}
            onValueChange={(val) => setResponses(prev => ({ ...prev, [question.id]: val }))}
          >
            <SelectTrigger className="!bg-white !text-black">
              <SelectValue placeholder="Select an option" />
            </SelectTrigger>
            <SelectContent>
              {question.options?.map(opt => (
                <SelectItem key={opt} value={opt}>{opt}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        );

      case 'date':
        return (
          <Input
            type="date"
            value={value || ''}
            onChange={(e) => setResponses(prev => ({ ...prev, [question.id]: e.target.value }))}
            className="!bg-white !text-black"
          />
        );

      case 'multi-select':
        return (
          <div className="space-y-2">
            {question.options?.map(opt => (
              <div key={opt} className="flex items-center gap-3 p-3 bg-white rounded-lg border border-gray-200">
                <Checkbox
                  checked={Array.isArray(value) && value.includes(opt)}
                  onCheckedChange={(checked) => {
                    const current = Array.isArray(value) ? value : [];
                    const updated = checked
                      ? [...current, opt]
                      : current.filter(v => v !== opt);
                    setResponses(prev => ({ ...prev, [question.id]: updated }));
                  }}
                />
                <Label className="text-gray-900 cursor-pointer">{opt}</Label>
              </div>
            ))}
          </div>
        );

      case 'upload':
        const uploadTemplates = dbTemplateMap.get(question.id) || [];
        return (
          <div className="space-y-4">
            {/* Show DB templates if any exist for this upload question */}
            {uploadTemplates.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {uploadTemplates.map((tmpl, idx) => (
                  <Button
                    key={idx}
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      const link = document.createElement('a');
                      link.href = tmpl.fileUrl;
                      link.download = tmpl.fileName;
                      link.click();
                    }}
                    className="bg-purple-600 hover:bg-purple-700 text-white border-purple-500"
                  >
                    <Download className="w-4 h-4 mr-2" />
                    Download {tmpl.label} ({tmpl.fileName})
                  </Button>
                ))}
              </div>
            )}
            <FileUploadField
              questionId={question.id}
              isUploading={isUploading}
              organizationSlug={slug || ''}
              onFileUpload={handleFileUpload}
              onFileDelete={(fileId) => {
                deleteMutation.mutate({
                  organizationSlug: slug || '',
                  fileId,
                });
              }}
            />
          </div>
        );

      case 'upload-download':
        // Templates are managed via the Templates tab in the admin dashboard
        const templatesToShow = dbTemplateMap.get(question.id) || [];
        
        return (
          <div className="space-y-4">
            {/* Download Template Button(s) */}
            {templatesToShow.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {templatesToShow.map((tmpl, idx) => (
                  <Button
                    key={idx}
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      const link = document.createElement('a');
                      link.href = tmpl.fileUrl;
                      link.download = tmpl.fileName;
                      link.click();
                    }}
                    className="bg-purple-600 hover:bg-purple-700 text-white border-purple-500"
                  >
                    <Download className="w-4 h-4 mr-2" />
                    Download {tmpl.label} ({tmpl.fileName})
                  </Button>
                ))}
              </div>
            )}
            
            {/* File Upload Field */}
            <FileUploadField
              questionId={question.id}
              isUploading={isUploading}
              organizationSlug={slug || ''}
              onFileUpload={handleFileUpload}
              onFileDelete={(fileId) => {
                deleteMutation.mutate({
                  organizationSlug: slug || '',
                  fileId,
                });
              }}
            />
          </div>
        );

      default:
        return null;
    }
  };

  const currentSectionData = questionnaireSections.find(s => s.id === currentSection);
  const currentSectionIndex = questionnaireSections.findIndex(s => s.id === currentSection);
  const isLastSection = currentSectionIndex === questionnaireSections.length - 1;

  // Show loading until responses are loaded into state
  // This ensures calculateSectionProgress has data to work with
  if (orgLoading || existingResponses === undefined) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div 
      className="min-h-screen flex"
      style={{
        background: "linear-gradient(135deg, #1a0b2e 0%, #2d1b4e 50%, #1a0b2e 100%)"
      }}
    >
      {/* Left Sidebar */}
      <div className="w-80 bg-black border-r border-purple-500/20 flex flex-col">
        {/* Logo */}
        <div className="p-6 border-b">
          <img src="/images/new-lantern-logo.png" alt="New Lantern" className="h-10" />
        </div>

        {/* Progress Overview Card */}
        <div className="p-4 border-b border-purple-500/20">
          <div className="bg-gradient-to-br from-purple-900/40 to-purple-800/40 rounded-lg p-4 border border-purple-500/30">
            {/* Big Percentage */}
            <div className="text-center mb-4">
              <div className="text-5xl font-bold text-purple-300 mb-1">
                {(() => {
                  const totalSections = questionnaireSections.length;
                  const sectionProgressSum = questionnaireSections.reduce((sum, s) => sum + calculateSectionProgress(s), 0);
                  return Math.round(sectionProgressSum / totalSections);
                })()}%
              </div>
              <div className="text-sm text-muted-foreground">Complete</div>
            </div>
            
            {/* Overall Progress */}
            <div className="mb-3">
              <div className="text-xs text-muted-foreground mb-1">Overall Progress</div>
              <div className="text-sm font-medium">
                {questionnaireSections.filter(s => calculateSectionProgress(s) === 100).length} of {questionnaireSections.length} sections complete
              </div>
            </div>
            
            {/* Section Progress List */}
            <div className="space-y-2 mb-3">
              {questionnaireSections.map((section, index) => {
                const progress = calculateSectionProgress(section);
                const isComplete = progress === 100;
                return (
                  <div key={section.id} className="flex items-center justify-between text-xs">
                    <div className="flex items-center gap-2 flex-1 min-w-0">
                      {isComplete ? (
                        <CheckCircle2 className="w-3 h-3 text-purple-400 flex-shrink-0" />
                      ) : (
                        <Circle className="w-3 h-3 text-muted-foreground flex-shrink-0" />
                      )}
                      <span className="truncate text-muted-foreground">{section.title}</span>
                    </div>
                    <span className="font-semibold text-white ml-2">{progress}%</span>
                  </div>
                );
              })}
            </div>
            
            {/* Files Count */}
            <div className="pt-3 border-t border-purple-500/20">
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Files Uploaded</span>
                <span className="font-bold text-white">{fileCount} files</span>
              </div>
            </div>
          </div>
        </div>

        {/* Section Navigation */}
        <div className="flex-1 overflow-y-auto p-4 space-y-2">
          {questionnaireSections.map((section, index) => {
            const Icon = sectionIcons[section.id] || FileText;
            const progress = calculateSectionProgress(section);
            const isActive = currentSection === section.id;
            const isComplete = progress === 100;

            return (
              <button
                key={section.id}
                onClick={() => setCurrentSection(section.id)}
                className={`w-full text-left p-3 rounded-lg transition-colors flex items-center gap-3 ${
                  isActive
                    ? 'bg-primary text-primary-foreground'
                    : 'hover:bg-muted'
                }`}
              >
                {isComplete ? (
                  <CheckCircle2 className="w-5 h-5 text-purple-400 flex-shrink-0" />
                ) : (
                  <Icon className="w-5 h-5 flex-shrink-0" />
                )}
                <div className="flex-1 min-w-0">
                  <div className="font-medium text-sm truncate">
                    {index + 1}. {section.title}
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex flex-col bg-transparent">
        {/* Header */}
        <header className="border-b border-purple-500/20 bg-black/40 backdrop-blur-sm">
          <div className="px-8 py-4 flex items-center justify-between">
            <h1 className="text-xl font-bold">{org?.clientName || 'Loading...'} - {org?.name || 'Loading...'}</h1>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={handleExportCSV}
                className="gap-2"
              >
                <Download className="w-4 h-4" />
                Export
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setImportDialogOpen(true)}
                className="gap-2"
              >
                <Upload className="w-4 h-4" />
                Import
              </Button>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" className="h-10 px-4">
                    <div className="text-sm font-medium">
                      {user?.name || 'User'}
                    </div>
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-48">
                  {/* Show admin links for admin users */}
                  {user?.role === 'admin' && (
                    <>
                      <DropdownMenuItem onClick={() => {
                        // Navigate to appropriate admin dashboard based on user's clientId
                        if (user.clientId === null) {
                          // New Lantern staff - go to Platform Admin
                          setLocation('/org/admin');
                        } else {
                          // Partner admin - go to their partner admin page
                          setLocation('/org/admin');
                        }
                      }}>
                        <Shield className="w-4 h-4 mr-2" />
                        Admin Dashboard
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                    </>
                  )}
                  <DropdownMenuItem onClick={() => {
                    logoutMutation.mutate();
                    setLocation('/login');
                  }}>
                    <LogOut className="w-4 h-4 mr-2" />
                    Sign Out
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>
        </header>

        {/* Overall Stats Banner */}
        <div className="bg-gradient-to-r from-purple-900/20 to-purple-800/20 border-b border-purple-500/20 px-8 py-4">
          <div className="max-w-6xl mx-auto flex items-center justify-between">
            <div className="flex items-center gap-8">
              <div>
                <div className="text-sm text-muted-foreground mb-1">Overall Progress</div>
                <div className="flex items-center gap-3">
                  <Progress 
                    value={(() => {
                      const totalSections = questionnaireSections.length;
                      const sectionProgressSum = questionnaireSections.reduce((sum, s) => sum + calculateSectionProgress(s), 0);
                      return Math.round(sectionProgressSum / totalSections);
                    })()} 
                    className="w-48 h-2"
                  />
                  <span className="text-lg font-bold">
                    {questionnaireSections.filter(s => calculateSectionProgress(s) === 100).length}/{questionnaireSections.length} sections
                  </span>
                </div>
              </div>
              <div className="h-12 w-px bg-border" />
              <div>
                <div className="text-sm text-muted-foreground mb-1">Files Uploaded</div>
                <div className="text-lg font-bold">
                  {fileCount} files
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Section Content */}
        <div className="flex-1 overflow-y-auto p-8">
          <Card className="max-w-6xl mx-auto bg-black/40 backdrop-blur-sm border-purple-500/20">
            <div className="p-8">
              {/* Section Header */}
              <div className="mb-6">
                <h2 className="text-2xl font-bold mb-2">{currentSectionData?.title}</h2>
                {currentSectionData?.description && (
                  <p className={`text-sm mb-2 flex items-center gap-2 ${
                    currentSectionData.id === 'config-files' 
                      ? 'text-yellow-400 font-semibold' 
                      : 'text-muted-foreground'
                  }`}>
                    {currentSectionData.id === 'config-files' && (
                      <span className="text-yellow-400">★</span>
                    )}
                    {currentSectionData.description}
                  </p>
                )}
                {/* Only show progress for standard sections with questions */}
                {currentSectionData?.questions && (
                  <>
                    <div className="flex items-center gap-4 text-sm text-muted-foreground">
                      <span>
                        {currentSectionData.questions.filter(q => responses[q.id]).length || 0}/{currentSectionData.questions.length} questions answered ({calculateSectionProgress(currentSectionData)}%)
                      </span>
                    </div>
                    <Progress value={calculateSectionProgress(currentSectionData)} className="mt-3 h-2" />
                  </>
                )}
              </div>

              {/* Questions Grid or Workflow Diagram */}
              {currentSectionData?.type === 'workflow' ? (
                <div className="mt-6">
                  <WorkflowDiagram 
                    workflowType={currentSectionData.workflowType as any}
                    configuration={(() => {
                      const configKey = currentSectionData.id + '_config';
                      const savedConfig = responses[configKey];
                      if (!savedConfig) return { paths: {}, systems: {}, notes: {} };
                      if (typeof savedConfig === 'string') {
                        try {
                          return JSON.parse(savedConfig);
                        } catch {
                          return { paths: {}, systems: {}, notes: {} };
                        }
                      }
                      // Already an object (parsed during response load)
                      return savedConfig;
                    })()}
                    onConfigurationChange={(config) => {
                      console.log('[Workflow Debug] Configuration changed:', currentSectionData.id, config);
                      console.log('[Workflow Debug] slug:', slug, 'user.email:', user?.email);
                      
                      // Store workflow configuration in responses
                      setResponses(prev => ({ ...prev, [currentSectionData.id + '_config']: JSON.stringify(config) }));
                      
                      // Also trigger save mutation
                      if (slug && user?.email) {
                        console.log('[Workflow Debug] Calling save mutation for:', currentSectionData.id + '_config');
                        saveMutation.mutate({
                          organizationSlug: slug,
                          questionId: currentSectionData.id + '_config',
                          response: JSON.stringify(config),
                          userEmail: user.email,
                        }, {
                          onSuccess: () => {
                            console.log('[Workflow Debug] Save successful for:', currentSectionData.id + '_config');
                          },
                          onError: (error) => {
                            console.error('[Workflow Debug] Save failed:', error);
                          }
                        });
                      } else {
                        console.warn('[Workflow Debug] Cannot save - missing slug or user.email');
                      }
                    }}
                  />
                </div>
              ) : (
                <div className={`grid ${currentSection === 'data-integration' ? 'grid-cols-1' : 'grid-cols-2'} gap-x-8 gap-y-6`}>
                  {currentSectionData?.questions?.filter((question) => {
                    // Filter out hidden conditional questions for numbering
                    if (question.conditionalOn) {
                      const parentResponse = responses[question.conditionalOn.questionId];
                      if (parentResponse !== question.conditionalOn.value) {
                        return false;
                      }
                    }
                    return true;
                  }).map((question, qIndex) => {
                    const isUnanswered = unansweredQuestions.has(question.id);
                    const hasTemplate = (question.type === 'upload' || question.type === 'upload-download') && 
                      (dbTemplateMap.get(question.id) || []).length > 0;
                    
                    return (
                      <div 
                        key={question.id} 
                        data-question-id={question.id}
                        className={`${
                          currentSection === 'data-integration' ? 'col-span-1' : (question.type === 'textarea' || question.type === 'upload' || question.type === 'upload-download' ? 'col-span-2' : 'col-span-1')
                        } ${
                          isUnanswered ? 'p-4 border-2 border-red-500 rounded-lg bg-red-500/5' : ''
                        }`}
                      >
                        <Label className="mb-2 block text-base">
                          <span className="text-purple-400 font-bold mr-2">[{question.id}]</span>
                          {question.text}
                          {isUnanswered && <span className="text-red-500 ml-2 font-semibold">* Required</span>}
                        </Label>
                        {/* Show download-fill-upload instructions for file questions with templates */}
                        {hasTemplate && (
                          <div className="flex items-center gap-3 mb-3 px-4 py-2 bg-purple-500/10 border border-purple-500/30 rounded-md">
                            <span className="text-sm text-purple-300">
                              <span className="font-semibold">① Download</span> the template below → 
                              <span className="font-semibold"> ② Fill it out</span> → 
                              <span className="font-semibold"> ③ Upload</span> your completed file
                            </span>
                          </div>
                        )}
                        {renderQuestion(question)}
                        {question.notes && (
                          <p className="text-xs text-muted-foreground mt-1">{question.notes}</p>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Bottom Buttons */}
              <div className="flex items-center justify-between mt-8 pt-6 border-t">
                <Button
                  variant="outline"
                  onClick={() => setLocation(`/org/${slug}`)}
                >
                  Back to Overview
                </Button>
                <Button
                  onClick={async () => {
                    // Validate workflow sections
                    if (currentSectionData?.type === 'workflow') {
                      const configKey = currentSectionData.id + '_config';
                      const savedConfig = responses[configKey];
                      
                      let isValid = false;
                      let errorMessage = 'Please select at least one workflow path';
                      
                      if (savedConfig) {
                        try {
                          const config = typeof savedConfig === 'string' ? JSON.parse(savedConfig) : savedConfig;
                          const selectedPathKeys = Object.keys(config.paths || {}).filter(key => config.paths[key]);
                          
                          if (selectedPathKeys.length === 0) {
                            errorMessage = 'Please select at least one workflow path';
                          } else {
                            // For workflows that require system names (priors, reports), check if they're filled
                            // Orders and Images workflows have fixed systems, so they don't need system name validation
                            const workflowsRequiringSystemNames = ['priors-workflow', 'reports-out-workflow'];
                            const requiresSystemNames = workflowsRequiringSystemNames.includes(currentSectionData.id);
                            
                            if (requiresSystemNames) {
                              // Map path keys to their corresponding system keys
                              const pathToSystemKeyMap: Record<string, string> = {
                                // Priors workflow
                                'priorsPush': 'priorsPushSource',
                                'priorsQuery': 'priorsQuerySource',
                                // Reports workflow  
                                'reportsToPortal': 'reportsPortalDestination',
                              };
                              
                              const missingSystems = selectedPathKeys.filter(pathKey => {
                                // If this path doesn't need a system name input, skip it
                                const systemKey = pathToSystemKeyMap[pathKey];
                                if (!systemKey) return false;
                                
                                const systemValue = config.systems?.[systemKey];
                                return !systemValue || systemValue.trim() === '';
                              });
                              
                              if (missingSystems.length > 0) {
                                errorMessage = 'Please fill in system names for all selected workflow paths';
                              } else {
                                isValid = true;
                              }
                            } else {
                              // Orders and Images workflows are valid if at least one path is selected
                              isValid = true;
                            }
                          }
                        } catch (e) {
                          errorMessage = 'Invalid workflow configuration';
                        }
                      }
                      
                      if (!isValid) {
                        toast.error(errorMessage);
                        return;
                      }
                      
                      // Workflow is valid, proceed to next section
                      if (!isLastSection) {
                        setCurrentSection(questionnaireSections[currentSectionIndex + 1].id);
                      } else {
                        setShowFeedbackModal(true);
                      }
                      return;
                    }
                    
                    // Check for unanswered questions in current section
                    const currentQuestions = currentSectionData?.questions || [];
                    const unanswered = currentQuestions
                      .filter(q => {
                        // Skip conditional questions that aren't visible
                        if (q.conditionalOn) {
                          const parentResponse = responses[q.conditionalOn.questionId];
                          if (parentResponse !== q.conditionalOn.value) {
                            return false; // Don't validate hidden questions
                          }
                        }
                        
                        // For file upload questions (including upload-download), check if files are uploaded
                        if (q.type === 'upload' || q.type === 'upload-download') {
                          return !uploadedFilesMap.has(q.id) || uploadedFilesMap.get(q.id) === 0;
                        }
                        // For other questions, check responses
                        return !responses[q.id] || responses[q.id] === '';
                      })
                      .map(q => q.id);
                    
                    if (unanswered.length > 0) {
                      setUnansweredQuestions(new Set(unanswered));
                      // Scroll to first unanswered question
                      const firstUnanswered = document.querySelector(`[data-question-id="${unanswered[0]}"]`);
                      firstUnanswered?.scrollIntoView({ behavior: 'smooth', block: 'center' });
                      return;
                    }
                    
                    // Clear validation flags
                    setUnansweredQuestions(new Set());
                    
                    // IMPORTANT: Save all current responses to database before proceeding
                    // This ensures responses are persisted even if auto-save hasn't completed
                    try {
                      setSaveStatus('saving');
                      const savePromises = Object.entries(responses).map(([questionId, value]) => {
                        return saveMutation.mutateAsync({
                          organizationSlug: slug || '',
                          questionId,
                          response: typeof value === 'object' ? JSON.stringify(value) : String(value),
                          userEmail: user?.email || '',
                        });
                      });
                      
                      await Promise.all(savePromises);
                      setSaveStatus('saved');
                    } catch (error) {
                      console.error('Failed to save responses:', error);
                      toast.error('Failed to save responses. Please try again.');
                      return; // Don't proceed if save failed
                    }
                    
                    if (!isLastSection) {
                      setCurrentSection(questionnaireSections[currentSectionIndex + 1].id);
                    } else {
                      // Show feedback modal on completion
                      setShowFeedbackModal(true);
                    }
                  }}
                >
                  {isLastSection ? 'Complete' : 'Save & Continue'}
                </Button>
              </div>
            </div>
          </Card>
        </div>
      </div>

      {/* Feedback Modal */}
      <Dialog open={showFeedbackModal} onOpenChange={setShowFeedbackModal}>
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
                  onClick={() => setFeedbackRating(star)}
                  className="transition-transform hover:scale-110"
                >
                  <Star
                    className={`w-8 h-8 ${
                      star <= feedbackRating
                        ? "fill-yellow-400 text-yellow-400"
                        : "text-gray-300"
                    }`}
                  />
                </button>
              ))}
            </div>
            <Textarea
              placeholder="Any comments? (optional)"
              value={feedbackComments}
              onChange={(e) => setFeedbackComments(e.target.value)}
              rows={3}
            />
            <div className="flex gap-2 justify-end">
              <Button
                variant="ghost"
                onClick={() => {
                  setShowFeedbackModal(false);
                  setLocation(`/org/${slug}/complete`);
                }}
              >
                Skip
              </Button>
              <Button
                onClick={() => {
                  submitFeedbackMutation.mutate({
                    organizationSlug: slug || '',
                    rating: feedbackRating,
                    comments: feedbackComments || undefined,
                  });
                }}
                disabled={feedbackRating === 0 || submitFeedbackMutation.isPending}
              >
                {submitFeedbackMutation.isPending ? 'Submitting...' : 'Submit'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Import Dialog */}
      <Dialog open={importDialogOpen} onOpenChange={setImportDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Import Questionnaire Data</DialogTitle>
            <DialogDescription>
              Upload a pipe-delimited file to update questionnaire responses. The file must match the export format.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="import-file">Select File</Label>
              <Input
                id="import-file"
                type="file"
                accept=".txt,.csv"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  setImportFile(file || null);
                }}
                className="!bg-white !text-black"
              />
              {importFile && (
                <div className="text-sm text-muted-foreground">
                  Selected: {importFile.name}
                </div>
              )}
            </div>

            <div className="flex gap-2 justify-end">
              <Button
                variant="outline"
                onClick={() => {
                  setImportDialogOpen(false);
                  setImportFile(null);
                }}
                disabled={isImporting}
              >
                Cancel
              </Button>
              <Button
                onClick={handleImportFile}
                disabled={!importFile || isImporting}
              >
                {isImporting ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Importing...
                  </>
                ) : (
                  'Import'
                )}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

import { useState, useEffect, useRef } from "react";
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
import { Loader2, Download, Upload, CheckCircle2, Circle, LogOut, Home, FileText, Shield, Database, FileUp, Network, ClipboardCheck } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useAuth } from "@/_core/hooks/useAuth";
import { questionnaireSections, type Question, type Section } from "@shared/questionnaireData";

// Section icons mapping
const sectionIcons: Record<string, any> = {
  "org-info": FileText,
  "overview-arch": Database,
  "data-integration": Database,
  "config-files": FileUp,
  "connectivity": Network,
  "dicom-validation": ClipboardCheck,
};

export default function IntakeNewRedesign() {
  const { slug } = useParams();
  const [, setLocation] = useLocation();
  const [responses, setResponses] = useState<Record<string, any>>({});
  const [saveStatus, setSaveStatus] = useState<"idle" | "saving" | "saved">("idle");
  const [currentSection, setCurrentSection] = useState<string>("org-info");
  const [uploadingFiles, setUploadingFiles] = useState<Set<string>>(new Set());
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

  // Save mutation
  const saveMutation = trpc.intake.saveResponse.useMutation({
    onSuccess: () => {
      setSaveStatus("saved");
      setTimeout(() => setSaveStatus("idle"), 2000);
    },
  });

  // Auto-save on response change
  useEffect(() => {
    if (!slug || Object.keys(responses).length === 0) return;
    
    const timer = setTimeout(() => {
      setSaveStatus("saving");
      Object.entries(responses).forEach(([questionId, value]) => {
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
    },
  });

  // Calculate section progress
  const calculateSectionProgress = (section: Section) => {
    const answered = section.questions.filter(q => {
      const response = responses[q.id];
      if (Array.isArray(response)) return response.length > 0;
      return response !== undefined && response !== '' && response !== null;
    }).length;
    return Math.round((answered / section.questions.length) * 100);
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

  // Export CSV
  const handleExportCSV = () => {
    const lines = ['Question ID,Question Text,Response'];
    questionnaireSections.forEach(section => {
      section.questions.forEach(q => {
        const response = responses[q.id] || '';
        const responseStr = Array.isArray(response) ? response.join('; ') : String(response);
        lines.push(`"${q.id}","${q.text}","${responseStr}"`);
      });
    });
    
    const blob = new Blob([lines.join('\n')], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${slug}-intake-responses.csv`;
    a.click();
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
              <div key={opt} className="flex items-center gap-2">
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
                <Label>{opt}</Label>
              </div>
            ))}
          </div>
        );

      case 'upload':
        return (
          <div className="space-y-2">
            <Input
              type="file"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) handleFileUpload(question.id, file);
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
          </div>
        );

      default:
        return null;
    }
  };

  const currentSectionData = questionnaireSections.find(s => s.id === currentSection);
  const currentSectionIndex = questionnaireSections.findIndex(s => s.id === currentSection);
  const isLastSection = currentSectionIndex === questionnaireSections.length - 1;

  // Show loading only if we don't have data yet
  if (orgLoading && !existingResponses) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex">
      {/* Left Sidebar */}
      <div className="w-80 bg-card border-r flex flex-col">
        {/* Logo */}
        <div className="p-6 border-b">
          <img src="/images/new-lantern-logo.png" alt="New Lantern" className="h-10" />
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
                  <CheckCircle2 className="w-5 h-5 text-green-500 flex-shrink-0" />
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
      <div className="flex-1 flex flex-col">
        {/* Header */}
        <header className="border-b bg-card/50 backdrop-blur-sm">
          <div className="px-8 py-4 flex items-center justify-between">
            <h1 className="text-xl font-bold">Radiology One - {slug}</h1>
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

        {/* Section Content */}
        <div className="flex-1 overflow-y-auto p-8">
          <Card className="max-w-6xl mx-auto">
            <div className="p-8">
              {/* Section Header */}
              <div className="mb-6">
                <h2 className="text-2xl font-bold mb-2">{currentSectionData?.title}</h2>
                <div className="flex items-center gap-4 text-sm text-muted-foreground">
                  <span>
                    {currentSectionData?.questions.filter(q => responses[q.id]).length || 0}/{currentSectionData?.questions.length} questions answered ({calculateSectionProgress(currentSectionData!)}%)
                  </span>
                </div>
                <Progress value={calculateSectionProgress(currentSectionData!)} className="mt-3 h-2" />
              </div>

              {/* Questions Grid */}
              <div className="grid grid-cols-2 gap-x-8 gap-y-6">
                {currentSectionData?.questions.map((question) => (
                  <div key={question.id} className={question.type === 'textarea' || question.type === 'upload' ? 'col-span-2' : 'col-span-1'}>
                    <Label className="mb-2 block">{question.text}</Label>
                    {renderQuestion(question)}
                    {question.notes && (
                      <p className="text-xs text-muted-foreground mt-1">{question.notes}</p>
                    )}
                  </div>
                ))}
              </div>

              {/* Bottom Buttons */}
              <div className="flex items-center justify-between mt-8 pt-6 border-t">
                <Button
                  variant="outline"
                  onClick={() => setLocation(`/org/${slug}/intake`)}
                >
                  Back to Overview
                </Button>
                <Button
                  onClick={() => {
                    if (!isLastSection) {
                      setCurrentSection(questionnaireSections[currentSectionIndex + 1].id);
                    } else {
                      setLocation(`/org/${slug}/intake`);
                    }
                  }}
                >
                  {isLastSection ? 'Back to Overview' : 'Save & Continue'}
                </Button>
              </div>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}

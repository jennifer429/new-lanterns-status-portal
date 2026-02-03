/**
 * Wizard-Style Intake Questionnaire with Auto-Save
 * Step-by-step with yes/no questions, conditional logic, and automatic answer persistence
 */

import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Progress } from "@/components/ui/progress";
import { CheckCircle2, Circle, ArrowLeft, ArrowRight, FileUp, Calendar, FileText, Eye, Check, Loader2 } from "lucide-react";
import { useRoute } from "wouter";
import { wizardSteps, type Question, type ConditionalFollowUp, type Task } from "@shared/wizard-data";
import { WizardCompletion } from "@/components/WizardCompletion";
import { trpc } from "@/lib/trpc";

type SaveStatus = "idle" | "saving" | "saved" | "error";

export default function IntakeWizard() {
  const [, params] = useRoute("/org/:slug/intake");
  const orgSlug = params?.slug || "demo";
  
  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const [responses, setResponses] = useState<Record<string, string>>({});
  const [generatedTasks, setGeneratedTasks] = useState<Task[]>([]);
  const [completedSteps, setCompletedSteps] = useState<Set<number>>(new Set());
  const [saveStatus, setSaveStatus] = useState<SaveStatus>("idle");
  const [saveTimeout, setSaveTimeout] = useState<NodeJS.Timeout | null>(null);

  // Load existing responses
  const { data: existingResponses, isLoading } = trpc.intake.getResponses.useQuery({
    organizationSlug: orgSlug,
  });

  // Save response mutation
  const saveResponseMutation = trpc.intake.saveResponse.useMutation();

  // Load existing responses into state
  useEffect(() => {
    if (existingResponses) {
      const loadedResponses: Record<string, string> = {};
      existingResponses.forEach(r => {
        if (r.response) {
          loadedResponses[r.questionId] = r.response;
        }
      });
      setResponses(loadedResponses);
      
      // Regenerate tasks based on loaded responses
      wizardSteps.forEach(step => {
        step.questions.forEach(question => {
          if (question.type === 'yesno' && loadedResponses[question.id]) {
            const value = loadedResponses[question.id];
            if (value === 'yes' && question.yesTasks) {
              setGeneratedTasks(prev => [...prev, ...question.yesTasks!]);
            } else if (value === 'no' && question.noTasks) {
              setGeneratedTasks(prev => [...prev, ...question.noTasks!]);
            }
          }
        });
      });
    }
  }, [existingResponses]);

  // Auto-save with debouncing
  const autoSave = useCallback((questionId: string, value: string, section: string) => {
    // Clear existing timeout
    if (saveTimeout) {
      clearTimeout(saveTimeout);
    }

    // Set saving status
    setSaveStatus("saving");

    // Debounce save for 1 second
    const timeout = setTimeout(async () => {
      try {
        await saveResponseMutation.mutateAsync({
          organizationSlug: orgSlug,
          questionId,
          section,
          response: value,
        });
        setSaveStatus("saved");
        
        // Reset to idle after 2 seconds
        setTimeout(() => setSaveStatus("idle"), 2000);
      } catch (error) {
        console.error("Auto-save error:", error);
        setSaveStatus("error");
        setTimeout(() => setSaveStatus("idle"), 3000);
      }
    }, 1000);

    setSaveTimeout(timeout);
  }, [orgSlug, saveTimeout, saveResponseMutation]);

  const currentStep = wizardSteps[currentStepIndex];
  const totalSteps = wizardSteps.length;
  const overallProgress = Math.round(((currentStepIndex + 1) / totalSteps) * 100);
  const isComplete = currentStepIndex >= totalSteps;

  // Show loading state
  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-950 via-slate-900 to-purple-950 flex items-center justify-center">
        <div className="text-white flex items-center gap-3">
          <Loader2 className="w-6 h-6 animate-spin" />
          <span>Loading your responses...</span>
        </div>
      </div>
    );
  }

  // Show completion screen if wizard is complete
  if (isComplete) {
    return <WizardCompletion tasks={generatedTasks} orgSlug={orgSlug} />;
  }

  // Handle response change with auto-save
  const handleResponseChange = (questionId: string, value: string) => {
    setResponses(prev => ({ ...prev, [questionId]: value }));
    
    // Auto-save
    autoSave(questionId, value, currentStep.title);
    
    // Find the question to check for task generation
    const question = currentStep.questions.find(q => q.id === questionId);
    if (question && question.type === 'yesno') {
      // Remove old tasks from this question
      setGeneratedTasks(prev => prev.filter(task => 
        !task.id.startsWith(`task_${questionId}`)
      ));
      
      // Add new tasks based on answer
      if (value === 'yes' && question.yesTasks) {
        setGeneratedTasks(prev => [...prev, ...question.yesTasks!]);
      } else if (value === 'no' && question.noTasks) {
        setGeneratedTasks(prev => [...prev, ...question.noTasks!]);
      }
    }
  };

  // Navigate to next step
  const handleNext = () => {
    if (currentStepIndex < totalSteps - 1) {
      setCompletedSteps(prev => new Set(prev).add(currentStepIndex));
      setCurrentStepIndex(prev => prev + 1);
      window.scrollTo(0, 0);
    }
  };

  // Navigate to previous step
  const handleBack = () => {
    if (currentStepIndex > 0) {
      setCurrentStepIndex(prev => prev - 1);
      window.scrollTo(0, 0);
    }
  };

  // Navigate to specific step
  const goToStep = (stepIndex: number) => {
    setCurrentStepIndex(stepIndex);
    window.scrollTo(0, 0);
  };

  // Check if current step can proceed
  const canProceed = () => {
    return currentStep.questions.every(question => {
      if (!question.required) return true;
      const response = responses[question.id];
      if (!response) return false;
      
      // Check follow-up questions
      if (question.type === 'yesno') {
        const followUps = response === 'yes' ? question.yesFollowUps : question.noFollowUps;
        if (followUps) {
          return followUps.every(followUp => {
            if (!followUp.required) return true;
            return !!responses[followUp.id];
          });
        }
      }
      return true;
    });
  };

  // Render yes/no question with conditional follow-ups
  const renderYesNoQuestion = (question: Question) => {
    const response = responses[question.id];
    const followUps = response === 'yes' ? question.yesFollowUps : response === 'no' ? question.noFollowUps : null;

    return (
      <div key={question.id} className="space-y-4 p-4 rounded-lg bg-purple-950/20 border border-purple-500/20">
        <div>
          <Label className="text-white text-base font-semibold">
            {question.text}
            {question.required && <span className="text-red-400 ml-1">*</span>}
          </Label>
          {question.helpText && (
            <p className="text-sm text-gray-400 mt-1">{question.helpText}</p>
          )}
        </div>

        <div className="flex gap-3">
          <Button
            variant={response === 'yes' ? 'default' : 'outline'}
            className={response === 'yes' ? 'bg-purple-600 hover:bg-purple-500' : 'border-purple-500/30 text-gray-300'}
            onClick={() => handleResponseChange(question.id, 'yes')}
          >
            <CheckCircle2 className="w-4 h-4 mr-2" />
            Yes
          </Button>
          <Button
            variant={response === 'no' ? 'default' : 'outline'}
            className={response === 'no' ? 'bg-purple-600 hover:bg-purple-500' : 'border-purple-500/30 text-gray-300'}
            onClick={() => handleResponseChange(question.id, 'no')}
          >
            <Circle className="w-4 h-4 mr-2" />
            No
          </Button>
        </div>

        {/* Conditional follow-ups */}
        {followUps && followUps.length > 0 && (
          <div className="ml-6 space-y-4 mt-4 border-l-2 border-purple-500/30 pl-4">
            {followUps.map(followUp => renderFollowUp(followUp))}
          </div>
        )}
      </div>
    );
  };

  // Render follow-up question
  const renderFollowUp = (followUp: ConditionalFollowUp) => {
    const value = responses[followUp.id] || '';

    return (
      <div key={followUp.id} className="space-y-2">
        <Label className="text-white">
          {followUp.text}
          {followUp.required && <span className="text-red-400 ml-1">*</span>}
        </Label>
        {followUp.helpText && (
          <p className="text-sm text-gray-400">{followUp.helpText}</p>
        )}

        {followUp.type === 'text' && (
          <Input
            value={value}
            onChange={(e) => handleResponseChange(followUp.id, e.target.value)}
            placeholder={followUp.placeholder}
            className="bg-black/40 border-purple-500/30 text-white"
          />
        )}

        {followUp.type === 'textarea' && (
          <Textarea
            value={value}
            onChange={(e) => handleResponseChange(followUp.id, e.target.value)}
            placeholder={followUp.placeholder}
            rows={3}
            className="bg-black/40 border-purple-500/30 text-white"
          />
        )}

        {followUp.type === 'select' && followUp.options && (
          <Select value={value} onValueChange={(val) => handleResponseChange(followUp.id, val)}>
            <SelectTrigger className="bg-black/40 border-purple-500/30 text-white">
              <SelectValue placeholder={followUp.placeholder || "Select..."} />
            </SelectTrigger>
            <SelectContent>
              {followUp.options.map((option, idx) => {
                const optValue = typeof option === 'string' ? option : option.value;
                const optLabel = typeof option === 'string' ? option : option.label;
                return (
                  <SelectItem key={`${optValue}-${idx}`} value={optValue}>
                    {String(optLabel)}
                  </SelectItem>
                );
              })}
            </SelectContent>
          </Select>
        )}

        {followUp.type === 'date' && (
          <Input
            type="date"
            value={value}
            onChange={(e) => handleResponseChange(followUp.id, e.target.value)}
            className="bg-black/40 border-purple-500/30 text-white"
          />
        )}
      </div>
    );
  };

  // Render other question types
  const renderQuestion = (question: Question) => {
    if (question.type === 'yesno') {
      return renderYesNoQuestion(question);
    }

    const value = responses[question.id] || '';

    return (
      <div key={question.id} className="space-y-3 p-4 rounded-lg bg-purple-950/20 border border-purple-500/20">
        <div>
          <Label className="text-white text-base font-semibold">
            {question.text}
            {question.required && <span className="text-red-400 ml-1">*</span>}
          </Label>
          {question.helpText && (
            <p className="text-sm text-gray-400 mt-1">{question.helpText}</p>
          )}
        </div>

        {question.type === 'text' && (
          <Input
            value={value}
            onChange={(e) => handleResponseChange(question.id, e.target.value)}
            placeholder={question.placeholder}
            className="bg-black/40 border-purple-500/30 text-white"
          />
        )}

        {question.type === 'textarea' && (
          <Textarea
            value={value}
            onChange={(e) => handleResponseChange(question.id, e.target.value)}
            placeholder={question.placeholder}
            rows={4}
            className="bg-black/40 border-purple-500/30 text-white"
          />
        )}

        {question.type === 'select' && question.options && (
          <Select value={value} onValueChange={(val) => handleResponseChange(question.id, val)}>
            <SelectTrigger className="bg-black/40 border-purple-500/30 text-white">
              <SelectValue placeholder={question.placeholder || "Select..."} />
            </SelectTrigger>
            <SelectContent>
              {question.options.map((option, idx) => {
                const optValue = typeof option === 'string' ? option : option.value;
                const optLabel = typeof option === 'string' ? option : option.label;
                return (
                  <SelectItem key={`${optValue}-${idx}`} value={optValue}>
                    {String(optLabel)}
                  </SelectItem>
                );
              })}
            </SelectContent>
          </Select>
        )}

        {question.type === 'date' && (
          <Input
            type="date"
            value={value}
            onChange={(e) => handleResponseChange(question.id, e.target.value)}
            className="bg-black/40 border-purple-500/30 text-white"
          />
        )}
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-950 via-slate-900 to-purple-950">
      {/* Header */}
      <header className="border-b border-purple-500/20 bg-black/20 backdrop-blur-sm sticky top-0 z-10">
        <div className="container py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <img src="/images/flame-icon.png" alt="New Lantern" className="h-8 w-8" />
              <div>
                <h1 className="text-xl font-bold text-white">PACS Implementation Questionnaire</h1>
                <p className="text-sm text-purple-300">Step {currentStepIndex + 1} of {totalSteps}</p>
              </div>
            </div>
            
            {/* Save Status Indicator */}
            <div className="flex items-center gap-2">
              {saveStatus === "saving" && (
                <div className="flex items-center gap-2 text-sm text-gray-400">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Saving...</span>
                </div>
              )}
              {saveStatus === "saved" && (
                <div className="flex items-center gap-2 text-sm text-green-400">
                  <Check className="w-4 h-4" />
                  <span>Saved</span>
                </div>
              )}
              {saveStatus === "error" && (
                <div className="flex items-center gap-2 text-sm text-red-400">
                  <Circle className="w-4 h-4" />
                  <span>Save failed</span>
                </div>
              )}
            </div>
          </div>

          {/* Overall Progress */}
          <div className="mt-4">
            <Progress value={overallProgress} className="h-2" />
          </div>
        </div>
      </header>

      {/* Main Content */}
      <div className="container py-8">
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_300px] gap-8">
          {/* Left: Current Step Questions */}
          <div>
            <Card className="border-purple-500/20 bg-black/40 backdrop-blur-xl">
              <CardHeader>
                <CardTitle className="text-white text-2xl flex items-center gap-3">
                  {currentStep.title}
                </CardTitle>
                <CardDescription className="text-gray-300">
                  {currentStep.description}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                {currentStep.questions.map(question => renderQuestion(question))}

                {/* Navigation Buttons */}
                <div className="flex items-center justify-between pt-6 border-t border-purple-500/20">
                  <Button
                    variant="outline"
                    onClick={handleBack}
                    disabled={currentStepIndex === 0}
                    className="border-purple-500/30 text-gray-300"
                  >
                    <ArrowLeft className="w-4 h-4 mr-2" />
                    Back
                  </Button>

                  <Button
                    onClick={handleNext}
                    disabled={!canProceed()}
                    className="bg-gradient-to-r from-purple-600 to-purple-500 hover:from-purple-500 hover:to-purple-400 text-white"
                  >
                    {currentStepIndex === totalSteps - 1 ? "Complete" : "Next"}
                    <ArrowRight className="w-4 h-4 ml-2" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Right: Progress Sidebar */}
          <div className="space-y-6">
            {/* Step Navigation */}
            <Card className="border-purple-500/20 bg-black/40 backdrop-blur-xl sticky top-24">
              <CardHeader>
                <CardTitle className="text-white text-lg">Progress</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {wizardSteps.map((step, index) => (
                  <button
                    key={index}
                    onClick={() => goToStep(index)}
                    className={`w-full text-left p-3 rounded-lg transition-colors ${
                      index === currentStepIndex
                        ? 'bg-purple-600 text-white'
                        : completedSteps.has(index)
                        ? 'bg-purple-950/40 text-gray-300 hover:bg-purple-950/60'
                        : 'bg-black/20 text-gray-500 hover:bg-black/40'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      {completedSteps.has(index) ? (
                        <CheckCircle2 className="w-4 h-4 text-green-400" />
                      ) : (
                        <Circle className="w-4 h-4" />
                      )}
                      <span className="text-sm font-medium">{step.title}</span>
                    </div>
                  </button>
                ))}
              </CardContent>
            </Card>

            {/* Generated Tasks Preview */}
            {generatedTasks.length > 0 && (
              <Card className="border-purple-500/20 bg-black/40 backdrop-blur-xl">
                <CardHeader>
                  <CardTitle className="text-white text-lg flex items-center gap-2">
                    <FileText className="w-5 h-5" />
                    Action Items ({generatedTasks.length})
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    {generatedTasks.slice(0, 5).map(task => (
                      <div key={task.id} className="text-sm text-gray-300 flex items-start gap-2">
                        <Circle className="w-3 h-3 mt-0.5 flex-shrink-0" />
                        <span>{task.title}</span>
                      </div>
                    ))}
                    {generatedTasks.length > 5 && (
                      <p className="text-xs text-gray-500 mt-2">
                        +{generatedTasks.length - 5} more tasks
                      </p>
                    )}
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

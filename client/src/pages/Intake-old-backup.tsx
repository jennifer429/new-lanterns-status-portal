/**
 * Wizard-Style Intake Questionnaire
 * Step-by-step with yes/no questions and conditional logic
 */

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Progress } from "@/components/ui/progress";
import { CheckCircle2, Circle, ArrowLeft, ArrowRight, FileUp, Calendar, FileText, Eye } from "lucide-react";
import { useRoute } from "wouter";
import { wizardSteps, type Question, type ConditionalFollowUp, type Task } from "@shared/wizard-data";
import { WizardCompletion } from "@/components/WizardCompletion";

export default function IntakeWizard() {
  const [, params] = useRoute("/org/:slug/intake");
  const orgSlug = params?.slug || "demo";
  
  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const [responses, setResponses] = useState<Record<string, string>>({});
  const [generatedTasks, setGeneratedTasks] = useState<Task[]>([]);
  const [completedSteps, setCompletedSteps] = useState<Set<number>>(new Set());

  const currentStep = wizardSteps[currentStepIndex];
  const totalSteps = wizardSteps.length;
  const overallProgress = Math.round(((currentStepIndex + 1) / totalSteps) * 100);
  const isComplete = currentStepIndex >= totalSteps;

  // Show completion screen if wizard is complete
  if (isComplete) {
    return <WizardCompletion tasks={generatedTasks} orgSlug={orgSlug} />;
  }

  // Handle response change
  const handleResponseChange = (questionId: string, value: string) => {
    setResponses(prev => ({ ...prev, [questionId]: value }));
    
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
      <div key={question.id} className="space-y-4">
        <div className="space-y-3">
          <Label className="text-base font-semibold">
            {question.question}
            {question.required && <span className="text-destructive ml-1">*</span>}
          </Label>
          <div className="flex gap-3">
            <Button
              type="button"
              variant={response === 'yes' ? 'default' : 'outline'}
              className="flex-1 h-16 text-lg"
              onClick={() => handleResponseChange(question.id, 'yes')}
            >
              YES
            </Button>
            <Button
              type="button"
              variant={response === 'no' ? 'default' : 'outline'}
              className="flex-1 h-16 text-lg"
              onClick={() => handleResponseChange(question.id, 'no')}
            >
              NO
            </Button>
          </div>
        </div>

        {/* Conditional follow-up questions */}
        {followUps && followUps.length > 0 && (
          <div className="ml-6 pl-6 border-l-2 border-primary/30 space-y-4 mt-4">
            {followUps.map(followUp => renderFollowUpQuestion(followUp))}
          </div>
        )}
      </div>
    );
  };

  // Render follow-up question
  const renderFollowUpQuestion = (followUp: ConditionalFollowUp) => {
    const response = responses[followUp.id] || "";

    return (
      <div key={followUp.id} className="space-y-2">
        <Label htmlFor={followUp.id}>
          {followUp.question}
          {followUp.required && <span className="text-destructive ml-1">*</span>}
        </Label>

        {followUp.type === 'text' && (
          <Input
            id={followUp.id}
            value={response}
            onChange={(e) => handleResponseChange(followUp.id, e.target.value)}
            placeholder={followUp.placeholder}
          />
        )}

        {followUp.type === 'textarea' && (
          <Textarea
            id={followUp.id}
            value={response}
            onChange={(e) => handleResponseChange(followUp.id, e.target.value)}
            placeholder={followUp.placeholder}
            rows={3}
          />
        )}

        {followUp.type === 'dropdown' && followUp.options && (
          <Select value={response} onValueChange={(value) => handleResponseChange(followUp.id, value)}>
            <SelectTrigger id={followUp.id}>
              <SelectValue placeholder="Select an option" />
            </SelectTrigger>
            <SelectContent>
              {followUp.options.map(option => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}

        {followUp.type === 'date' && (
          <Input
            id={followUp.id}
            type="date"
            value={response}
            onChange={(e) => handleResponseChange(followUp.id, e.target.value)}
          />
        )}
      </div>
    );
  };

  // Render regular question
  const renderRegularQuestion = (question: Question) => {
    const response = responses[question.id] || "";

    return (
      <div key={question.id} className="space-y-2">
        <Label htmlFor={question.id}>
          {question.question}
          {question.required && <span className="text-destructive ml-1">*</span>}
        </Label>

        {question.type === 'text' && (
          <Input
            id={question.id}
            value={response}
            onChange={(e) => handleResponseChange(question.id, e.target.value)}
            placeholder={question.placeholder}
          />
        )}

        {question.type === 'textarea' && (
          <Textarea
            id={question.id}
            value={response}
            onChange={(e) => handleResponseChange(question.id, e.target.value)}
            placeholder={question.placeholder}
            rows={3}
          />
        )}

        {question.type === 'date' && (
          <Input
            id={question.id}
            type="date"
            value={response}
            onChange={(e) => handleResponseChange(question.id, e.target.value)}
          />
        )}

        {question.type === 'dropdown' && question.options && (
          <Select value={response} onValueChange={(value) => handleResponseChange(question.id, value)}>
            <SelectTrigger id={question.id}>
              <SelectValue placeholder="Select an option" />
            </SelectTrigger>
            <SelectContent>
              {question.options.map(option => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
      </div>
    );
  };

  // Get task icon
  const getTaskIcon = (type: Task['type']) => {
    switch (type) {
      case 'upload': return FileUp;
      case 'schedule': return Calendar;
      case 'form': return FileText;
      case 'review': return Eye;
      default: return FileText;
    }
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border bg-card/50 backdrop-blur-sm sticky top-0 z-10">
        <div className="container py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <img src="/images/flame-icon.png" alt="New Lantern" className="h-8 w-8" />
              <div>
                <h1 className="text-xl font-bold text-foreground">Implementation Setup</h1>
                <p className="text-xs text-muted-foreground">Step {currentStepIndex + 1} of {totalSteps}</p>
              </div>
            </div>
            <Button variant="ghost" size="sm" asChild>
              <a href={`/org/${orgSlug}`}>Exit</a>
            </Button>
          </div>
        </div>
      </header>

      {/* Step Progress */}
      <div className="border-b border-border bg-card/30">
        <div className="container py-4">
          <div className="flex items-center justify-between mb-3">
            {wizardSteps.map((step, index) => (
              <div key={step.id} className="flex items-center">
                <div className="flex flex-col items-center">
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center border-2 ${
                    index === currentStepIndex 
                      ? 'border-primary bg-primary text-primary-foreground' 
                      : completedSteps.has(index)
                      ? 'border-primary bg-primary/20 text-primary'
                      : 'border-muted bg-background text-muted-foreground'
                  }`}>
                    {completedSteps.has(index) ? (
                      <CheckCircle2 className="w-5 h-5" />
                    ) : (
                      <Circle className="w-5 h-5" />
                    )}
                  </div>
                  <span className="text-xs mt-2 font-medium">{step.title}</span>
                </div>
                {index < wizardSteps.length - 1 && (
                  <div className={`h-0.5 w-12 mx-2 ${
                    completedSteps.has(index) ? 'bg-primary' : 'bg-muted'
                  }`} />
                )}
              </div>
            ))}
          </div>
          <Progress value={overallProgress} className="h-2" />
        </div>
      </div>

      {/* Main Content */}
      <div className="container py-8">
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_300px] gap-8 max-w-6xl mx-auto">
          {/* Questions */}
          <div>
            <Card>
              <CardHeader>
                <CardTitle>{currentStep.title}</CardTitle>
                <CardDescription>{currentStep.description}</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                {currentStep.questions.map(question => 
                  question.type === 'yesno' 
                    ? renderYesNoQuestion(question)
                    : renderRegularQuestion(question)
                )}
              </CardContent>
            </Card>

            {/* Navigation */}
            <div className="flex items-center justify-between mt-6">
              <Button
                variant="outline"
                onClick={handleBack}
                disabled={currentStepIndex === 0}
              >
                <ArrowLeft className="w-4 h-4 mr-2" />
                Back
              </Button>
              {currentStepIndex === totalSteps - 1 ? (
                <Button
                  onClick={() => setCurrentStepIndex(totalSteps)}
                  disabled={!canProceed()}
                >
                  Complete Setup
                  <CheckCircle2 className="w-4 h-4 ml-2" />
                </Button>
              ) : (
                <Button
                  onClick={handleNext}
                  disabled={!canProceed()}
                >
                  Continue
                  <ArrowRight className="w-4 h-4 ml-2" />
                </Button>
              )}
            </div>
          </div>

          {/* Task Board Sidebar */}
          <div>
            <Card className="sticky top-24">
              <CardHeader>
                <CardTitle className="text-base">Your Setup Tasks</CardTitle>
                <CardDescription className="text-xs">
                  {generatedTasks.length} task{generatedTasks.length !== 1 ? 's' : ''} generated
                </CardDescription>
              </CardHeader>
              <CardContent>
                {generatedTasks.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-8">
                    Tasks will appear here based on your answers
                  </p>
                ) : (
                  <div className="space-y-3">
                    {generatedTasks.map(task => {
                      const Icon = getTaskIcon(task.type);
                      return (
                        <div key={task.id} className="p-3 rounded-lg border border-border bg-muted/30">
                          <div className="flex items-start gap-2">
                            <Icon className="w-4 h-4 text-primary mt-0.5 flex-shrink-0" />
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium">{task.title}</p>
                              {task.description && (
                                <p className="text-xs text-muted-foreground mt-1">{task.description}</p>
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </div>

      {/* Footer */}
      <footer className="border-t border-border mt-12 py-6">
        <div className="container text-center">
          <p className="text-xs text-muted-foreground">New Lantern ©</p>
        </div>
      </footer>
    </div>
  );
}

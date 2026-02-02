/**
 * Single-Page Intake Questionnaire
 * Collapsible sections with conditional logic and progress tracking
 */

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Progress } from "@/components/ui/progress";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { CheckCircle2, Circle, FileText, AlertCircle, Upload } from "lucide-react";
import { useRoute } from "wouter";
import { trpc } from "@/lib/trpc";
import { questionnaireData, type Section, type Question } from "@shared/questionnaire-data";

export default function Intake() {
  const [, params] = useRoute("/org/:slug/intake");
  const orgSlug = params?.slug || "demo";
  
  const [organizationId, setOrganizationId] = useState<number | null>(null);
  const [responses, setResponses] = useState<Record<string, string>>({});
  const [sectionCompletion, setSectionCompletion] = useState<Record<string, boolean>>({});
  
  // Fetch organization
  const { data: organization } = trpc.organizations.getBySlug.useQuery(
    { slug: orgSlug },
    { enabled: !!orgSlug }
  );
  
  useEffect(() => {
    if (organization) {
      setOrganizationId(organization.id);
    }
  }, [organization]);

  // Calculate overall completion
  const totalQuestions = questionnaireData.reduce((sum, section) => sum + section.questions.length, 0);
  const answeredQuestions = Object.keys(responses).filter(key => responses[key]?.trim()).length;
  const overallCompletion = Math.round((answeredQuestions / totalQuestions) * 100);

  // Handle response change
  const handleResponseChange = (questionId: string, value: string) => {
    setResponses(prev => ({ ...prev, [questionId]: value }));
  };

  // Toggle section completion
  const toggleSectionCompletion = (sectionId: string) => {
    setSectionCompletion(prev => ({ ...prev, [sectionId]: !prev[sectionId] }));
  };

  // Calculate section completion percentage
  const getSectionCompletion = (section: Section) => {
    const sectionQuestions = section.questions.length;
    const answeredInSection = section.questions.filter(q => responses[q.id]?.trim()).length;
    return Math.round((answeredInSection / sectionQuestions) * 100);
  };

  // Render question based on type
  const renderQuestion = (question: Question) => {
    const response = responses[question.id] || "";
    const selectedOption = question.options?.find(opt => opt.value === response);

    return (
      <div key={question.id} className="space-y-3 p-4 rounded-lg bg-muted/30 border border-border">
        <div className="space-y-2">
          <Label htmlFor={question.id} className="text-sm font-medium">
            {question.text}
            {question.required && <span className="text-destructive ml-1">*</span>}
          </Label>
          
          {question.type === "dropdown" && question.options && (
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

          {question.type === "text" && (
            <Input
              id={question.id}
              value={response}
              onChange={(e) => handleResponseChange(question.id, e.target.value)}
              placeholder="Enter your answer"
            />
          )}

          {question.type === "textarea" && (
            <Textarea
              id={question.id}
              value={response}
              onChange={(e) => handleResponseChange(question.id, e.target.value)}
              placeholder="Enter your answer"
              rows={3}
            />
          )}

          {question.type === "date" && (
            <Input
              id={question.id}
              type="date"
              value={response}
              onChange={(e) => handleResponseChange(question.id, e.target.value)}
            />
          )}
        </div>

        {/* Conditional next step message */}
        {selectedOption?.nextStep && (
          <div className="flex items-start gap-2 p-3 rounded-md bg-primary/10 border border-primary/30">
            <AlertCircle className="w-4 h-4 text-primary mt-0.5 flex-shrink-0" />
            <p className="text-xs text-primary">{selectedOption.nextStep}</p>
          </div>
        )}

        {/* Documentation link */}
        {question.documentation && (
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <FileText className="w-3 h-3" />
            <span>Reference: {question.documentation}</span>
          </div>
        )}
      </div>
    );
  };

  // Render section
  const renderSection = (section: Section) => {
    const completion = getSectionCompletion(section);
    const isComplete = sectionCompletion[section.id];

    return (
      <AccordionItem key={section.id} value={section.id}>
        <AccordionTrigger className="hover:no-underline">
          <div className="flex items-center justify-between w-full pr-4">
            <div className="flex items-center gap-3 flex-1">
              {isComplete ? (
                <CheckCircle2 className="w-5 h-5 text-primary flex-shrink-0" />
              ) : (
                <Circle className="w-5 h-5 text-muted-foreground flex-shrink-0" />
              )}
              <div className="text-left">
                <div className="font-semibold">{section.title}</div>
                {section.description && (
                  <div className="text-xs text-muted-foreground font-normal">{section.description}</div>
                )}
              </div>
            </div>
            <div className="flex items-center gap-3">
              <span className="text-sm font-bold text-primary">{completion}%</span>
            </div>
          </div>
        </AccordionTrigger>
        <AccordionContent>
          <div className="space-y-4 pt-4">
            {section.questions.map(renderQuestion)}
            
            <div className="flex items-center justify-between pt-4 border-t border-border">
              <Button
                variant={isComplete ? "outline" : "default"}
                onClick={() => toggleSectionCompletion(section.id)}
              >
                {isComplete ? "Mark as Incomplete" : "Mark as Complete"}
              </Button>
            </div>
          </div>
        </AccordionContent>
      </AccordionItem>
    );
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
                <h1 className="text-xl font-bold text-foreground">Intake Questionnaire</h1>
                <p className="text-xs text-muted-foreground">{organization?.name || "Loading..."}</p>
              </div>
            </div>
            <div className="text-right">
              <p className="text-sm font-medium text-foreground">{overallCompletion}% Complete</p>
              <p className="text-xs text-muted-foreground">{answeredQuestions} of {totalQuestions} questions</p>
            </div>
          </div>
        </div>
      </header>

      {/* Progress Bar */}
      <div className="border-b border-border bg-card/30">
        <div className="container py-4">
          <Progress value={overallCompletion} className="h-3" />
        </div>
      </div>

      {/* Main Content */}
      <div className="container py-8 max-w-4xl">
        {/* Instructions */}
        <Card className="mb-6 border-primary/20">
          <CardHeader>
            <CardTitle className="text-lg">How to Complete This Questionnaire</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm text-muted-foreground">
            <p>• Click on any section below to expand and answer questions</p>
            <p>• You can work on sections in any order</p>
            <p>• Your progress is saved automatically</p>
            <p>• Some questions will show additional guidance based on your answers</p>
            <p>• Mark sections as complete when you're done</p>
          </CardContent>
        </Card>

        {/* Questionnaire Sections */}
        <Card>
          <CardHeader>
            <CardTitle>Implementation Questionnaire</CardTitle>
            <CardDescription>
              Answer questions about your systems, workflows, and requirements
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Accordion type="multiple" className="w-full">
              {questionnaireData.map(renderSection)}
            </Accordion>
          </CardContent>
        </Card>

        {/* File Uploads Section */}
        <Card className="mt-6">
          <CardHeader>
            <div className="flex items-center gap-3">
              <Upload className="w-5 h-5 text-primary" />
              <div>
                <CardTitle>File Uploads</CardTitle>
                <CardDescription>Upload documents and configuration files</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="p-8 rounded-lg border-2 border-dashed border-border bg-muted/30 text-center">
              <Upload className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
              <p className="text-sm text-muted-foreground mb-4">
                File upload functionality coming soon
              </p>
              <Button variant="outline" disabled>
                Upload Files
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Save Button */}
        <div className="mt-8 flex items-center justify-between">
          <Button variant="outline" asChild>
            <a href={`/org/${orgSlug}`}>Back to Dashboard</a>
          </Button>
          <Button size="lg">
            Save Progress
          </Button>
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

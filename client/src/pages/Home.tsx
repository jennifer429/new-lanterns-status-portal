/**
 * Simplified Home Page - Post-Login Dashboard
 * Shows clear next steps and progress overview
 */

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { ClipboardList, FileText, CheckCircle2, Clock, Circle } from "lucide-react";
import { Link, useRoute } from "wouter";
import { trpc } from "@/lib/trpc";
import { useEffect, useState } from "react";
import { questionnaireSections } from "@shared/questionnaireData";

export default function Home() {
  const [, params] = useRoute("/org/:slug");
  const orgSlug = params?.slug || "demo";
  
  const [organizationId, setOrganizationId] = useState<number | null>(null);
  
  // Fetch organization data
  const { data: organization, isLoading: orgLoading } = trpc.organizations.getBySlug.useQuery(
    { slug: orgSlug },
    { enabled: !!orgSlug }
  );
  
  // Fetch progress data
  const { data: progressData, isLoading: progressLoading } = trpc.organizations.getProgress.useQuery(
    { organizationId: organizationId! },
    { enabled: !!organizationId }
  );
  
  // Update organizationId when organization loads
  useEffect(() => {
    if (organization) {
      setOrganizationId(organization.id);
    }
  }, [organization]);

  const orgData = {
    name: organization?.name || "Your Organization",
    goalDate: organization?.goalDate || "TBD",
  };

  // Fetch existing responses to calculate real progress
  const { data: existingResponses = [] } = trpc.intake.getResponses.useQuery(
    { organizationSlug: orgSlug },
    { enabled: !!orgSlug }
  );

  // Fetch file count from database
  const { data: filesUploaded = 0 } = trpc.intake.getFileCount.useQuery(
    { organizationSlug: orgSlug },
    { enabled: !!orgSlug }
  );

  // Calculate section progress
  const calculateSectionProgress = (section: typeof questionnaireSections[0]) => {
    const answeredQuestions = section.questions.filter(q => 
      existingResponses.some(r => r.questionId === q.id && r.response && r.response !== '')
    ).length;
    return Math.round((answeredQuestions / section.questions.length) * 100);
  };

  // Calculate overall completion
  const totalQuestions = questionnaireSections.reduce((sum, s) => sum + s.questions.length, 0);
  const answeredQuestions = existingResponses.filter(r => r.response && r.response !== '').length;
  const intakeCompletion = Math.round((answeredQuestions / totalQuestions) * 100);

  if (orgLoading || progressLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">Loading your dashboard...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border bg-card/50 backdrop-blur-sm sticky top-0 z-10">
        <div className="container py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <img src="/images/flame-icon.png" alt="New Lantern" className="h-8 w-8" />
              <div>
                <h1 className="text-xl font-bold text-foreground">Implementation Portal</h1>
                <p className="text-xs text-muted-foreground">PACS Onboarding</p>
              </div>
            </div>
            <div className="text-right">
              <p className="text-sm font-medium text-foreground">{orgData.name}</p>
              <p className="text-xs text-muted-foreground">Goal: {orgData.goalDate}</p>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <div className="container py-12 max-w-4xl">
        {/* Welcome Section */}
        <div className="mb-8">
          <h2 className="text-3xl font-bold mb-2">Welcome to your onboarding portal</h2>
          <p className="text-muted-foreground text-lg">
            Complete the intake questionnaire to help us configure your PACS system. You can save your progress and return anytime.
          </p>
        </div>

        {/* Progress Overview Card - Detailed */}
        <Card className="border-primary/20 mb-6 bg-gradient-to-br from-purple-900/20 to-purple-800/20">
          <CardHeader>
            <CardTitle>Your Progress</CardTitle>
            <CardDescription>Track your onboarding completion</CardDescription>
          </CardHeader>
          <CardContent>
            {/* Big Percentage Display */}
            <div className="text-center mb-6 p-6 rounded-lg bg-gradient-to-br from-purple-900/40 to-purple-800/40 border border-purple-500/30">
              <div className="text-6xl font-bold text-purple-300 mb-2">
                {intakeCompletion}%
              </div>
              <div className="text-sm text-muted-foreground">Complete</div>
            </div>

            {/* Overall Progress Summary */}
            <div className="mb-4 p-4 rounded-lg bg-muted/30">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <ClipboardList className="w-5 h-5 text-primary" />
                  <span className="font-medium">Intake Questionnaire</span>
                </div>
                <span className="text-sm font-bold text-primary">{intakeCompletion}%</span>
              </div>
              <Progress value={intakeCompletion} className="h-2 mb-2" />
              <p className="text-xs text-muted-foreground">
                {answeredQuestions}/{totalQuestions} questions • {questionnaireSections.filter(s => calculateSectionProgress(s) === 100).length} of {questionnaireSections.length} sections complete
              </p>
            </div>

            {/* Section-by-Section Progress */}
            <div className="space-y-2 mb-4">
              <div className="text-sm font-medium mb-2">Section Progress</div>
              {questionnaireSections.map((section) => {
                const progress = calculateSectionProgress(section);
                const isComplete = progress === 100;
                return (
                  <div key={section.id} className="flex items-center justify-between p-2 rounded-lg bg-muted/20 hover:bg-muted/30 transition-colors">
                    <div className="flex items-center gap-2 flex-1 min-w-0">
                      {isComplete ? (
                        <CheckCircle2 className="w-4 h-4 text-purple-400 flex-shrink-0" />
                      ) : (
                        <Circle className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                      )}
                      <span className="text-sm truncate">{section.title}</span>
                    </div>
                    <span className="text-sm font-semibold text-primary ml-2">{progress}%</span>
                  </div>
                );
              })}
            </div>

            {/* Files Uploaded */}
            <div className="pt-4 border-t border-border">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <FileText className="w-5 h-5 text-primary" />
                  <span className="font-medium">Files Uploaded</span>
                </div>
                <span className="text-sm font-bold text-primary">{filesUploaded} files</span>
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                Documents and configurations
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Primary Action - Intake Questionnaire */}
        <Card className="border-2 border-primary shadow-lg mb-6">
          <CardHeader>
            <div className="flex items-center gap-3">
              <ClipboardList className="w-8 h-8 text-primary" />
              <div>
                <CardTitle className="text-2xl">Complete Intake Questionnaire</CardTitle>
                <CardDescription className="text-base mt-1">
                  Answer questions about your systems and workflows
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="p-4 rounded-lg bg-muted/30">
                <p className="text-sm text-muted-foreground mb-3">
                  The questionnaire covers 7 sections including security, imaging routing, data integration, and workflows. 
                  You can complete sections in any order and save your progress.
                </p>
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Clock className="w-4 h-4" />
                  <span>Estimated time: 30-45 minutes</span>
                </div>
              </div>

              <Link href={`/org/${orgSlug}/intake`}>
                <Button size="lg" className="w-full text-lg py-6">
                  {intakeCompletion === 0 ? "Start Questionnaire" : "Continue Questionnaire"}
                  <ClipboardList className="w-5 h-5 ml-2" />
                </Button>
              </Link>
            </div>
          </CardContent>
        </Card>

        {/* Secondary Info Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Status */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Status</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  {intakeCompletion === 100 ? (
                    <CheckCircle2 className="w-5 h-5 text-primary" />
                  ) : (
                    <Clock className="w-5 h-5 text-yellow-500" />
                  )}
                  <span className="text-sm">
                    {intakeCompletion === 100 ? "Ready for review" : "In progress"}
                  </span>
                </div>
                <p className="text-xs text-muted-foreground">
                  {intakeCompletion === 100 
                    ? "Our team will review your responses and reach out with next steps." 
                    : "Complete the questionnaire to move forward with implementation."}
                </p>
              </div>
            </CardContent>
          </Card>

          {/* Support */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Need Help?</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground mb-3">
                Questions about the onboarding process? Our team is here to help.
              </p>
              <Button variant="outline" className="w-full" asChild>
                <a href="mailto:support@newlantern.ai">Contact Support</a>
              </Button>
            </CardContent>
          </Card>
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

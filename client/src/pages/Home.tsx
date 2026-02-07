/**
 * Simplified Home Page - Post-Login Dashboard
 * Compact single-screen design
 */

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { ClipboardList, Clock } from "lucide-react";
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

  // Calculate overall completion
  const totalQuestions = questionnaireSections.reduce((sum, s) => sum + s.questions.length, 0);
  const answeredQuestions = existingResponses.filter(r => r.response && r.response !== '').length;
  const intakeCompletion = Math.round((answeredQuestions / totalQuestions) * 100);
  const completedSections = questionnaireSections.filter(s => {
    const sectionAnswered = s.questions.filter(q => 
      existingResponses.some(r => r.questionId === q.id && r.response && r.response !== '')
    ).length;
    return Math.round((sectionAnswered / s.questions.length) * 100) === 100;
  }).length;

  if (orgLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Header */}
      <header className="border-b border-border bg-card/50 backdrop-blur-sm">
        <div className="container py-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <img src="/images/flame-icon.png" alt="New Lantern" className="h-7 w-7" />
              <div>
                <h1 className="text-lg font-bold text-foreground">Implementation Portal</h1>
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

      {/* Main Content - Single Screen */}
      <div className="flex-1 flex items-center justify-center p-6">
        <div className="w-full max-w-5xl">
          {/* Welcome Section */}
          <div className="mb-6 text-center">
            <h2 className="text-3xl font-bold mb-2 leading-tight">
              <span className="text-foreground">Welcome To Your</span>
              <br />
              <span className="bg-gradient-to-r from-purple-400 via-purple-300 to-purple-400 bg-clip-text text-transparent">
                Onboarding Portal
              </span>
            </h2>
            <p className="text-muted-foreground text-sm max-w-2xl mx-auto">
              Complete the intake questionnaire to help us configure your PACS system. Save your progress and return anytime.
            </p>
          </div>

          {/* Main Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            {/* Left: Progress Card */}
            <Card className="border-primary/20 bg-gradient-to-br from-purple-900/20 to-purple-800/20">
              <CardContent className="p-5">
                <h3 className="text-sm font-medium mb-3">Your Progress</h3>
                
                {/* Big Percentage */}
                <div className="text-center mb-4 p-4 rounded-lg bg-gradient-to-br from-purple-900/40 to-purple-800/40 border border-purple-500/30">
                  <div className="text-5xl font-bold text-purple-300 mb-1">
                    {intakeCompletion}%
                  </div>
                  <div className="text-xs text-muted-foreground">Complete</div>
                </div>

                {/* Progress Bar */}
                <div className="mb-3">
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-xs font-medium">Intake Questionnaire</span>
                    <span className="text-xs font-bold text-primary">{intakeCompletion}%</span>
                  </div>
                  <Progress value={intakeCompletion} className="h-1.5" />
                  <p className="text-xs text-muted-foreground mt-1">
                    {answeredQuestions}/{totalQuestions} questions • {completedSections} of {questionnaireSections.length} sections complete
                  </p>
                </div>

                {/* Files */}
                <div className="pt-3 border-t border-border/50">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-medium">Files Uploaded</span>
                    <span className="text-xs font-bold text-primary">{filesUploaded} files</span>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Center: Main CTA */}
            <Card className="lg:col-span-2 border-2 border-primary">
              <CardContent className="p-6">
                <div className="flex items-start gap-4 mb-4">
                  <ClipboardList className="w-10 h-10 text-primary flex-shrink-0" />
                  <div className="flex-1">
                    <h3 className="text-2xl font-bold mb-1">Complete Intake Questionnaire</h3>
                    <p className="text-sm text-muted-foreground">
                      Answer questions about your systems and workflows
                    </p>
                  </div>
                </div>

                <div className="p-4 rounded-lg bg-muted/30 mb-4">
                  <p className="text-sm text-muted-foreground mb-2">
                    The questionnaire covers 7 sections including security, imaging routing, data integration, and workflows. 
                    You can complete sections in any order and save your progress.
                  </p>
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <Clock className="w-3.5 h-3.5" />
                    <span>Estimated time: 30-45 minutes</span>
                  </div>
                </div>

                <Link href={`/org/${orgSlug}/intake`}>
                  <Button size="lg" className="w-full text-base py-5">
                    {intakeCompletion === 0 ? "Start Questionnaire" : "Continue Questionnaire"}
                    <ClipboardList className="w-4 h-4 ml-2" />
                  </Button>
                </Link>
              </CardContent>
            </Card>
          </div>

          {/* Bottom Info Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
            {/* Status */}
            <Card className="bg-card/50">
              <CardContent className="p-4">
                <h4 className="text-sm font-semibold mb-2">Status</h4>
                <p className="text-xs text-muted-foreground">
                  {intakeCompletion === 100 
                    ? "✓ Ready for review — Our team will reach out with next steps." 
                    : "⏱ In progress — Complete the questionnaire to move forward with implementation."}
                </p>
              </CardContent>
            </Card>

            {/* Support */}
            <Card className="bg-card/50">
              <CardContent className="p-4">
                <h4 className="text-sm font-semibold mb-2">Need Help?</h4>
                <p className="text-xs text-muted-foreground mb-2">
                  Questions about the onboarding process? Our team is here to help.
                </p>
                <Button variant="outline" size="sm" className="w-full text-xs h-8" asChild>
                  <a href="mailto:support@newlantern.ai">Contact Support</a>
                </Button>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}

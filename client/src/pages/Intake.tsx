import { useRoute } from "wouter";
import { IntakeForm } from "@/components/IntakeForm";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { CheckCircle2 } from "lucide-react";

export default function Intake() {
  const [, params] = useRoute("/org/:slug/intake");
  const orgSlug = params?.slug || "demo";

  const { data: organization, isLoading: orgLoading } = trpc.organizations.getBySlug.useQuery(
    { slug: orgSlug },
    { enabled: !!orgSlug }
  );

  const { data: progress, isLoading: progressLoading } = trpc.intake.getProgress.useQuery(
    { organizationSlug: orgSlug },
    { enabled: !!orgSlug }
  );

  if (orgLoading || progressLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (!organization) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle>Organization Not Found</CardTitle>
            <CardDescription>
              The organization you're looking for doesn't exist or has been removed.
            </CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  const completionPercentage = progress
    ? Math.round((progress.completedQuestions / progress.totalQuestions) * 100)
    : 0;

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border bg-card/50 backdrop-blur-sm sticky top-0 z-10">
        <div className="container py-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <img src="/images/new-lantern-logo.png" alt="New Lantern" className="h-8" />
              <div>
                <h1 className="text-2xl font-bold text-foreground">Implementation Intake</h1>
                <p className="text-sm text-muted-foreground mt-1">{organization.name}</p>
              </div>
            </div>
            {progress && (
              <div className="flex items-center gap-3">
                <div className="text-right">
                  <p className="text-sm font-medium text-foreground">
                    {progress.completedQuestions} of {progress.totalQuestions} questions
                  </p>
                  <p className="text-xs text-muted-foreground">{completionPercentage}% complete</p>
                </div>
                {completionPercentage === 100 && (
                  <CheckCircle2 className="w-6 h-6 text-primary" />
                )}
              </div>
            )}
          </div>
        </div>
      </header>

      {/* Main Content */}
      <div className="container py-8">
        <IntakeForm organizationSlug={orgSlug} />
      </div>
    </div>
  );
}

/**
 * Organization Landing Page - Matches Admin Dashboard Card Design
 * Single card layout with progress overview and file list
 */

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { ClipboardList, Users, FileText, TrendingUp, CheckCircle2, Circle, ExternalLink, Activity, Download } from "lucide-react";
import { Link, useRoute } from "wouter";
import { trpc } from "@/lib/trpc";
import { useEffect, useState } from "react";
import { questionnaireSections } from "@shared/questionnaireData";
import { calculateProgress } from "@shared/progressCalculation";
import { PhiDisclaimer } from "@/components/PhiDisclaimer";

export default function Home() {
  const [, params] = useRoute("/org/:clientSlug/:slug");
  const clientSlug = params?.clientSlug || "";
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

  // Fetch all uploaded files
  const { data: allFiles = [] } = trpc.intake.getAllUploadedFiles.useQuery(
    { organizationSlug: orgSlug },
    { enabled: !!orgSlug }
  );
  
  const filesUploaded = allFiles.length;

  // Flatten all questions from sections (filter out workflow sections)
  const allQuestions = questionnaireSections
    .filter(section => section.questions) // Skip workflow sections
    .flatMap(section =>
      section.questions!.map(q => ({
        id: q.id,
        sectionTitle: section.title
      }))
    );

  // Use shared progress calculation function
  const progress = calculateProgress(
    allQuestions,
    existingResponses,
    allFiles
  );

  const intakeCompletion = progress.completionPercentage;
  
  // Calculate completed sections (100% complete)
  const completedSections = Object.values(progress.sectionProgress).filter(
    section => section.completed === section.total
  ).length;

  // Convert section progress to array format for display
  const sectionProgress = Object.entries(progress.sectionProgress).map(([name, stats]) => ({
    name,
    progress: stats.total > 0 ? Math.round((stats.completed / stats.total) * 100) : 0
  }));

  // Mock user count (you can add real user count query later)
  const userCount = 5;

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
    <div className="min-h-screen bg-background">
      {/* PHI Disclaimer - At top */}
      <PhiDisclaimer />
      
      <div className="flex items-center justify-center p-6">
        <div className="w-full max-w-3xl">
        <Card className="border-2 border-primary/30 bg-gradient-to-b from-card to-card/50">
          <CardContent className="p-8">
            {/* Header with Organization Name */}
            <div className="flex items-center justify-between mb-8">
              <div className="flex items-center gap-3">
                <ClipboardList className="w-8 h-8 text-primary" />
                <h1 className="text-2xl font-bold">{orgData.name}</h1>
              </div>
              <CheckCircle2 className="w-6 h-6 text-green-500" />
            </div>

            {/* Stats Row */}
            <div className="grid grid-cols-3 gap-6 mb-8">
              <div className="flex items-center gap-3">
                <TrendingUp className="w-5 h-5 text-muted-foreground" />
                <div>
                  <div className="text-2xl font-bold">{intakeCompletion}%</div>
                  <div className="text-sm text-muted-foreground">Complete</div>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <Users className="w-5 h-5 text-muted-foreground" />
                <div>
                  <div className="text-2xl font-bold">{userCount}</div>
                  <div className="text-sm text-muted-foreground">Users</div>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <FileText className="w-5 h-5 text-muted-foreground" />
                <div>
                  <div className="text-2xl font-bold">{filesUploaded}</div>
                  <div className="text-sm text-muted-foreground">Files</div>
                </div>
              </div>
            </div>

            <div className="border-t border-border/50 pt-6 mb-6">
              {/* Overall Progress Section */}
              <div className="mb-6">
                <h2 className="text-xl font-semibold mb-2">Overall Progress</h2>
                <p className="text-sm text-muted-foreground mb-4">
                  {completedSections} of {questionnaireSections.length} sections complete
                </p>

                {/* Big Percentage Box */}
                <div className="text-center p-8 rounded-xl bg-gradient-to-br from-primary/20 to-primary/10 border-2 border-primary/30 mb-6">
                  <div className="text-7xl font-bold text-primary mb-2">
                    {intakeCompletion}%
                  </div>
                  <div className="text-lg text-muted-foreground">Complete</div>
                </div>

                {/* Section List */}
                <div className="space-y-3 mb-6">
                  {sectionProgress.map((section, index) => (
                    <div key={index} className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        {section.progress === 100 ? (
                          <CheckCircle2 className="w-5 h-5 text-primary" />
                        ) : (
                          <Circle className="w-5 h-5 text-muted-foreground" />
                        )}
                        <span className="text-sm">{section.name}</span>
                      </div>
                      <span className="text-sm font-bold">{section.progress}%</span>
                    </div>
                  ))}
                </div>

                {/* Status */}
                <div className="text-sm text-muted-foreground mb-6">
                  In Progress
                </div>
              </div>

              {/* Uploaded Files Section */}
              <div className="border-t border-border/50 pt-6 mb-6">
                <h3 className="text-base font-semibold mb-3">Uploaded Files:</h3>
                {allFiles.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No files uploaded yet</p>
                ) : (
                  <div className="space-y-2 max-h-48 overflow-y-auto">
                    {allFiles.map((file) => (
                      <a
                        key={file.id}
                        href={file.fileUrl}
                        download
                        className="flex items-center gap-2 text-sm text-primary hover:underline"
                      >
                        <Download className="w-4 h-4" />
                        <span>{file.fileName}</span>
                      </a>
                    ))}
                  </div>
                )}
              </div>

              {/* Last Login */}
              <div className="flex items-center gap-2 text-sm text-muted-foreground mb-6">
                <Activity className="w-4 h-4" />
                <span>Last login: about 5 hours ago</span>
              </div>

              {/* Open Portal Button */}
              <Link href={`/org/${clientSlug}/${orgSlug}/intake`}>
                <Button size="lg" className="w-full text-lg py-6">
                  <ExternalLink className="w-5 h-5 mr-2" />
                  Open Portal
                </Button>
              </Link>
            </div>
          </CardContent>
        </Card>
        </div>
      </div>
    </div>
  );
}

/**
 * Dark Theme with Purple Accents: Clean 2-column layout
 * Left: Stage details and progress using real Boulder/Template Client Checklist data
 * Right: Big status bar showing days to goal with intelligent shading for on-track/behind status
 */

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { 
  CheckCircle2, 
  Circle, 
  Clock, 
  PlayCircle,
  Users,
  Calendar,
  TrendingUp,
  AlertTriangle,
  Building2
} from "lucide-react";
import { useEffect, useState } from "react";

// Mock hospital data - in production this would come from backend
const hospitalData = {
  name: "Memorial General Hospital",
  contactName: "Dr. Sarah Chen",
  contactEmail: "sarah.chen@memorialgeneral.org",
  contactPhone: "(555) 123-4567",
  startDate: "January 15, 2026",
  goalDate: "March 1, 2026",
  today: "January 31, 2026",
  daysElapsed: 16,
  totalDays: 45,
  daysRemaining: 29,
};

// Stage progress - maps sections to completion status
const stageProgress: Record<string, { status: string; progress: number; daysFromStart: number; expectedEnd: string }> = {
  "Header Info": { status: "complete", progress: 100, daysFromStart: 2, expectedEnd: "January 17, 2026" },
  "Overview & Architecture": { status: "complete", progress: 100, daysFromStart: 5, expectedEnd: "January 20, 2026" },
  "Security & Permissions": { status: "in-progress", progress: 75, daysFromStart: 10, expectedEnd: "February 5, 2026" },
  "Imaging Routing & Connectivity": { status: "in-progress", progress: 60, daysFromStart: 12, expectedEnd: "February 8, 2026" },
  "Data & Integration": { status: "in-progress", progress: 40, daysFromStart: 18, expectedEnd: "February 15, 2026" },
  "Additional Workflows": { status: "pending", progress: 0, daysFromStart: 22, expectedEnd: "February 20, 2026" },
  "Rad Workflows": { status: "pending", progress: 0, daysFromStart: 25, expectedEnd: "February 24, 2026" },
  "DICOM Data Validation": { status: "pending", progress: 0, daysFromStart: 28, expectedEnd: "February 27, 2026" },
  "Institution Group Configuration": { status: "pending", progress: 0, daysFromStart: 32, expectedEnd: "March 3, 2026" },
  "User & Access Configuration": { status: "pending", progress: 0, daysFromStart: 35, expectedEnd: "March 6, 2026" },
  "Template & RVU Configuration": { status: "pending", progress: 0, daysFromStart: 38, expectedEnd: "March 10, 2026" },
  "Worklist Configuration": { status: "pending", progress: 0, daysFromStart: 40, expectedEnd: "March 12, 2026" },
  "End-to-End Validation": { status: "pending", progress: 0, daysFromStart: 43, expectedEnd: "March 15, 2026" },
};

interface ChecklistSection {
  section: string;
  tasks: Array<{
    id: string;
    task: string;
    owner: string;
  }>;
}

export default function Home() {
  const [checklistData, setChecklistData] = useState<ChecklistSection[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Load checklist data
    fetch('/checklist.json')
      .then(res => res.json())
      .then(data => {
        setChecklistData(data);
        setLoading(false);
      })
      .catch(err => {
        console.error('Failed to load checklist:', err);
        setLoading(false);
      });
  }, []);

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "complete":
        return <CheckCircle2 className="w-5 h-5 text-primary" />;
      case "in-progress":
        return <PlayCircle className="w-5 h-5 text-primary fill-primary/20" />;
      default:
        return <Circle className="w-5 h-5 text-muted-foreground" />;
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "complete":
        return <Badge className="bg-primary/20 text-primary border-primary/30">Complete</Badge>;
      case "in-progress":
        return <Badge className="bg-primary text-primary-foreground">In Progress</Badge>;
      default:
        return <Badge variant="outline" className="text-muted-foreground border-muted">Not Started</Badge>;
    }
  };

  // Calculate if on track
  const allSections = Object.values(stageProgress);
  const expectedProgress = (hospitalData.daysElapsed / hospitalData.totalDays) * 100;
  const actualProgress = allSections.reduce((sum, stage) => sum + stage.progress, 0) / allSections.length;
  const isOnTrack = actualProgress >= expectedProgress - 5;

  const activeSections = checklistData.filter(s => stageProgress[s.section]?.status === "in-progress");
  const completedSections = checklistData.filter(s => stageProgress[s.section]?.status === "complete");

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">Loading checklist...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border bg-card/50 backdrop-blur-sm">
        <div className="container py-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <img src="/images/new-lantern-logo.png" alt="New Lantern" className="h-8" />
              <div>
                <h1 className="text-2xl font-bold text-foreground">Implementation Portal</h1>
                <p className="text-sm text-muted-foreground mt-1">PACS Onboarding & Configuration</p>
              </div>
            </div>
            <div className="text-right">
              <p className="text-sm font-medium text-foreground">{hospitalData.name}</p>
              <p className="text-xs text-muted-foreground">{hospitalData.contactName}</p>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content - 2 Column Layout */}
      <div className="container py-8">
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_400px] gap-8">
          {/* Left Column - Stage Details */}
          <div className="space-y-6">
            {/* Header Card */}
            <Card className="border-primary/20">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="text-xl">Your Onboarding Journey</CardTitle>
                    <CardDescription className="mt-2">
                      Started {hospitalData.startDate} • Goal: {hospitalData.goalDate}
                    </CardDescription>
                  </div>
                  {isOnTrack ? (
                    <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-primary/10 border border-primary/30">
                      <CheckCircle2 className="w-4 h-4 text-primary" />
                      <span className="text-sm font-medium text-primary">On Track</span>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-yellow-500/10 border border-yellow-500/30">
                      <AlertTriangle className="w-4 h-4 text-yellow-400" />
                      <span className="text-sm font-medium text-yellow-400">Needs Attention</span>
                    </div>
                  )}
                </div>
              </CardHeader>
            </Card>

            {/* Sections Accordion */}
            <Card>
              <CardHeader>
                <CardTitle>Implementation Checklist</CardTitle>
                <CardDescription>
                  {completedSections.length} of {checklistData.length} sections complete • {activeSections.length} in progress
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Accordion type="multiple" className="w-full">
                  {checklistData.map((section, index) => {
                    const progress = stageProgress[section.section] || { status: "pending", progress: 0, expectedEnd: "TBD" };
                    
                    return (
                      <AccordionItem key={index} value={`section-${index}`}>
                        <AccordionTrigger className="hover:no-underline">
                          <div className="flex items-center justify-between w-full pr-4">
                            <div className="flex items-center gap-3 flex-1">
                              {getStatusIcon(progress.status)}
                              <div className="text-left">
                                <div className="font-semibold text-sm">{section.section}</div>
                                <div className="text-xs text-muted-foreground">{section.tasks.length} tasks</div>
                              </div>
                            </div>
                            <div className="flex items-center gap-3">
                              {progress.status !== "pending" && (
                                <span className="text-sm font-bold text-primary">{progress.progress}%</span>
                              )}
                              {getStatusBadge(progress.status)}
                            </div>
                          </div>
                        </AccordionTrigger>
                        <AccordionContent>
                          <div className="space-y-4 pt-4">
                            {progress.status !== "pending" && (
                              <div className="px-4">
                                <Progress value={progress.progress} className="h-2 mb-4" />
                                <div className="flex items-center gap-2 text-xs text-muted-foreground mb-4">
                                  <Calendar className="w-3 h-3" />
                                  <span>Target completion: {progress.expectedEnd}</span>
                                </div>
                              </div>
                            )}
                            
                            {/* Tasks */}
                            <div className="space-y-2 px-4">
                              {section.tasks.map((task, taskIndex) => (
                                <div key={taskIndex} className="flex items-start justify-between p-3 rounded-lg bg-muted/30 border border-border hover:bg-muted/50 transition-colors">
                                  <div className="flex items-start gap-3 flex-1">
                                    <Circle className="w-4 h-4 text-muted-foreground mt-0.5 flex-shrink-0" />
                                    <div className="flex-1 min-w-0">
                                      <p className="text-sm font-medium">{task.task}</p>
                                      <p className="text-xs text-muted-foreground mt-1">ID: {task.id}</p>
                                    </div>
                                  </div>
                                  <div className="flex items-center gap-2 ml-3 flex-shrink-0">
                                    {task.owner === "Client" ? (
                                      <Badge variant="outline" className="text-xs">
                                        <Building2 className="w-3 h-3 mr-1" />
                                        Client
                                      </Badge>
                                    ) : (
                                      <Badge className="bg-primary/20 text-primary border-primary/30 text-xs">
                                        New Lantern
                                      </Badge>
                                    )}
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        </AccordionContent>
                      </AccordionItem>
                    );
                  })}
                </Accordion>
              </CardContent>
            </Card>
          </div>

          {/* Right Column - Big Status Bar */}
          <div className="space-y-6">
            <Card className="sticky top-8 border-primary/30 bg-gradient-to-b from-card to-card/50">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <TrendingUp className="w-5 h-5 text-primary" />
                  Days to Goal
                </CardTitle>
                <CardDescription>Progress toward {hospitalData.goalDate}</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                {/* Big Status Bar */}
                <div className="space-y-4">
                  {/* Days Remaining - Big Display */}
                  <div className="text-center p-6 rounded-xl bg-gradient-to-br from-primary/10 to-primary/5 border-2 border-primary/30">
                    <div className="text-6xl font-bold text-primary mb-2">{hospitalData.daysRemaining}</div>
                    <p className="text-sm text-muted-foreground">Days Remaining</p>
                  </div>

                  {/* Visual Timeline Bar */}
                  <div className="space-y-2">
                    <div className="flex items-center justify-between text-xs text-muted-foreground">
                      <span>{hospitalData.startDate}</span>
                      <span>{hospitalData.goalDate}</span>
                    </div>
                    <div className="relative h-12 bg-muted/30 rounded-lg overflow-hidden border border-border">
                      {/* Elapsed time (filled) */}
                      <div 
                        className="absolute inset-y-0 left-0 bg-gradient-to-r from-primary to-primary/80"
                        style={{ width: `${(hospitalData.daysElapsed / hospitalData.totalDays) * 100}%` }}
                      />
                      
                      {/* Stage markers */}
                      {Object.entries(stageProgress).map(([section, data]) => {
                        const position = (data.daysFromStart / hospitalData.totalDays) * 100;
                        if (position > 100) return null;
                        
                        return (
                          <div
                            key={section}
                            className="absolute top-0 bottom-0 w-0.5 bg-card"
                            style={{ left: `${position}%` }}
                          >
                            <div className="absolute -top-1 left-1/2 -translate-x-1/2">
                              {data.status === "complete" ? (
                                <CheckCircle2 className="w-3 h-3 text-primary" />
                              ) : data.status === "in-progress" ? (
                                <PlayCircle className="w-3 h-3 text-primary fill-primary/20" />
                              ) : (
                                <Circle className="w-3 h-3 text-muted-foreground" />
                              )}
                            </div>
                          </div>
                        );
                      })}

                      {/* Today marker */}
                      <div
                        className="absolute top-0 bottom-0 w-1 bg-foreground/50"
                        style={{ left: `${(hospitalData.daysElapsed / hospitalData.totalDays) * 100}%` }}
                      >
                        <div className="absolute -top-2 left-1/2 -translate-x-1/2 text-xs font-bold text-foreground whitespace-nowrap">
                          Today
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-primary font-medium">{hospitalData.daysElapsed} days elapsed</span>
                      <span className="text-muted-foreground">{hospitalData.totalDays} total days</span>
                    </div>
                  </div>
                </div>

                <Separator />

                {/* Status Indicator */}
                <div className={`p-4 rounded-lg border-2 ${
                  isOnTrack 
                    ? "bg-primary/10 border-primary/30" 
                    : "bg-yellow-500/10 border-yellow-500/30"
                }`}>
                  <div className="flex items-center gap-3 mb-3">
                    {isOnTrack ? (
                      <>
                        <CheckCircle2 className="w-6 h-6 text-primary" />
                        <div>
                          <h4 className="font-semibold text-primary">On Track</h4>
                          <p className="text-xs text-muted-foreground">Meeting timeline expectations</p>
                        </div>
                      </>
                    ) : (
                      <>
                        <AlertTriangle className="w-6 h-6 text-yellow-400" />
                        <div>
                          <h4 className="font-semibold text-yellow-400">Behind Schedule</h4>
                          <p className="text-xs text-muted-foreground">Action needed to meet goal date</p>
                        </div>
                      </>
                    )}
                  </div>
                  <div className="space-y-2">
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">Expected progress:</span>
                      <span className="font-bold">{Math.round(expectedProgress)}%</span>
                    </div>
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">Actual progress:</span>
                      <span className="font-bold text-primary">{Math.round(actualProgress)}%</span>
                    </div>
                  </div>
                </div>

                <Separator />

                {/* Section Summary */}
                <div>
                  <h4 className="font-semibold text-sm mb-3">Section Status</h4>
                  <div className="space-y-2 max-h-64 overflow-y-auto">
                    {checklistData.slice(0, 8).map((section) => {
                      const progress = stageProgress[section.section] || { status: "pending", progress: 0 };
                      return (
                        <div key={section.section} className="flex items-center justify-between text-xs">
                          <div className="flex items-center gap-2 flex-1 min-w-0">
                            {getStatusIcon(progress.status)}
                            <span className="truncate">{section.section}</span>
                          </div>
                          <div className="ml-2 flex-shrink-0">
                            {progress.status === "complete" ? (
                              <CheckCircle2 className="w-4 h-4 text-primary" />
                            ) : progress.status === "in-progress" ? (
                              <span className="font-bold text-primary">{progress.progress}%</span>
                            ) : (
                              <Circle className="w-4 h-4 text-muted-foreground" />
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                <Separator />

                {/* Contact */}
                <div className="p-4 rounded-lg bg-muted/30">
                  <h4 className="font-semibold text-sm mb-3">Need Help?</h4>
                  <div className="space-y-2 text-sm">
                    <div className="flex items-center gap-2">
                      <Clock className="w-4 h-4 text-primary" />
                      <a href={`mailto:${hospitalData.contactEmail}`} className="text-primary hover:underline text-xs">
                        Contact Support
                      </a>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}

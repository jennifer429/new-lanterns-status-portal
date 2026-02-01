/**
 * Dark Theme with Purple Accents: Clean 2-column layout
 * Left: Stage details and progress
 * Right: Big status bar showing days to goal with intelligent shading for on-track/behind status
 */

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import { 
  CheckCircle2, 
  Circle, 
  Clock, 
  AlertCircle,
  PlayCircle,
  Users,
  Calendar,
  Timer,
  TrendingUp,
  AlertTriangle
} from "lucide-react";

// Mock data - client wants to go live by March 1, 2026
const hospitalData = {
  name: "Memorial General Hospital",
  contactName: "Dr. Sarah Chen",
  contactEmail: "sarah.chen@memorialgeneral.org",
  contactPhone: "(555) 123-4567",
  startDate: "January 15, 2026",
  goalDate: "March 1, 2026", // Client's desired go-live date
  today: "January 31, 2026",
  daysElapsed: 16,
  totalDays: 45, // Days from start to goal
  daysRemaining: 29,
  onTrack: false, // Behind schedule based on progress vs time elapsed
};

// Stages with expected completion dates relative to goal
const stages = [
  {
    id: 1,
    name: "Information Gathering",
    status: "complete",
    progress: 100,
    duration: "5 days",
    loe: "Low",
    expectedEnd: "January 20, 2026",
    actualEnd: "January 22, 2026",
    daysFromStart: 5,
    resources: [
      { name: "IT Administrator", time: "2 hours" },
      { name: "Network Documentation", time: "N/A" },
    ],
  },
  {
    id: 2,
    name: "Network Configuration",
    status: "in-progress",
    progress: 75,
    duration: "10 days",
    loe: "Medium",
    expectedEnd: "February 5, 2026",
    daysFromStart: 15,
    resources: [
      { name: "Network Administrator", time: "3 hours" },
      { name: "Security Team", time: "1 hour" },
    ],
  },
  {
    id: 3,
    name: "System Installation",
    status: "in-progress",
    progress: 25,
    duration: "12 days",
    loe: "High",
    expectedEnd: "February 17, 2026",
    daysFromStart: 27,
    resources: [
      { name: "IT Administrator", time: "6 hours" },
      { name: "Server Access", time: "N/A" },
    ],
  },
  {
    id: 4,
    name: "Testing",
    status: "pending",
    progress: 0,
    duration: "7 days",
    loe: "Medium",
    expectedEnd: "February 24, 2026",
    daysFromStart: 34,
    resources: [
      { name: "Radiology Staff", time: "4 hours" },
      { name: "IT Administrator", time: "3 hours" },
    ],
  },
  {
    id: 5,
    name: "Go-Live",
    status: "pending",
    progress: 0,
    duration: "5 days",
    loe: "Medium",
    expectedEnd: "March 1, 2026",
    daysFromStart: 39,
    resources: [
      { name: "All Staff", time: "2 hours training" },
      { name: "IT Support", time: "48 hours on-call" },
    ],
  },
];

export default function Home() {
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

  const getLOEBadge = (loe: string) => {
    const colors = {
      Low: "bg-green-500/20 text-green-400 border-green-500/30",
      Medium: "bg-yellow-500/20 text-yellow-400 border-yellow-500/30",
      High: "bg-red-500/20 text-red-400 border-red-500/30",
    };
    return <Badge className={colors[loe as keyof typeof colors] || ""}>{loe} Effort</Badge>;
  };

  const activeStages = stages.filter(s => s.status === "in-progress");
  const completedStages = stages.filter(s => s.status === "complete");

  // Calculate if on track: expected progress based on time elapsed
  const expectedProgress = (hospitalData.daysElapsed / hospitalData.totalDays) * 100;
  const actualProgress = stages.reduce((sum, stage) => sum + stage.progress, 0) / stages.length;
  const isOnTrack = actualProgress >= expectedProgress - 5; // 5% tolerance

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border bg-card/50 backdrop-blur-sm">
        <div className="container py-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-foreground">New Lanterns PACS</h1>
              <p className="text-sm text-muted-foreground mt-1">Onboarding Status Portal</p>
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

            {/* Stages */}
            <div className="space-y-4">
              {stages.map((stage) => (
                <Card 
                  key={stage.id} 
                  className={`${
                    stage.status === "in-progress" 
                      ? "border-primary/30 bg-primary/5" 
                      : stage.status === "complete"
                      ? "border-primary/20 bg-primary/5"
                      : ""
                  }`}
                >
                  <CardHeader className="pb-4">
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-3 flex-1">
                        {getStatusIcon(stage.status)}
                        <div>
                          <div className="flex items-center gap-2 flex-wrap mb-1">
                            <h3 className="text-lg font-bold">{stage.name}</h3>
                            {getStatusBadge(stage.status)}
                          </div>
                          <div className="flex items-center gap-3 text-sm text-muted-foreground flex-wrap">
                            <div className="flex items-center gap-1">
                              <Timer className="w-3 h-3" />
                              {stage.duration}
                            </div>
                            {getLOEBadge(stage.loe)}
                            {stage.expectedEnd && (
                              <div className="flex items-center gap-1">
                                <Calendar className="w-3 h-3" />
                                Target: {stage.expectedEnd}
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                      {stage.status !== "pending" && (
                        <div className="text-right ml-4">
                          <div className="text-2xl font-bold text-primary">{stage.progress}%</div>
                        </div>
                      )}
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {stage.status !== "pending" && (
                      <Progress value={stage.progress} className="h-2" />
                    )}
                    
                    {/* Resources Needed */}
                    <div>
                      <h4 className="text-sm font-semibold mb-2 flex items-center gap-2">
                        <Users className="w-4 h-4 text-primary" />
                        Resources Needed
                      </h4>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        {stage.resources.map((resource, index) => (
                          <div key={index} className="p-2 rounded-lg bg-muted/30 border border-border">
                            <p className="text-xs font-medium">{resource.name}</p>
                            <p className="text-xs text-muted-foreground">{resource.time}</p>
                          </div>
                        ))}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
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
                      {stages.map((stage) => {
                        const position = (stage.daysFromStart / hospitalData.totalDays) * 100;
                        return (
                          <div
                            key={stage.id}
                            className="absolute top-0 bottom-0 w-0.5 bg-card"
                            style={{ left: `${position}%` }}
                          >
                            <div className="absolute -top-1 left-1/2 -translate-x-1/2">
                              {stage.status === "complete" ? (
                                <CheckCircle2 className="w-3 h-3 text-primary" />
                              ) : stage.status === "in-progress" ? (
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

                {/* Stage Breakdown */}
                <div>
                  <h4 className="font-semibold text-sm mb-3">Stage Status</h4>
                  <div className="space-y-3">
                    {stages.map((stage) => (
                      <div key={stage.id} className="flex items-center justify-between">
                        <div className="flex items-center gap-2 flex-1 min-w-0">
                          {getStatusIcon(stage.status)}
                          <span className="text-sm truncate">{stage.name}</span>
                        </div>
                        <div className="ml-2">
                          {stage.status === "complete" ? (
                            <CheckCircle2 className="w-4 h-4 text-primary" />
                          ) : stage.status === "in-progress" ? (
                            <span className="text-xs font-bold text-primary">{stage.progress}%</span>
                          ) : (
                            <span className="text-xs text-muted-foreground">{stage.expectedEnd}</span>
                          )}
                        </div>
                      </div>
                    ))}
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

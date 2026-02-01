/**
 * Dark Theme with Purple Accents: Deep purple primary, dark backgrounds, parallel workflow support
 * Stages can run in parallel - multiple stages can be active simultaneously
 * Now includes: Completed/Not Started sections, Resources Needed, Time/LOE estimates
 */

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  CheckCircle2, 
  Circle, 
  Clock, 
  FileText, 
  Mail, 
  Phone, 
  ChevronRight,
  Download,
  AlertCircle,
  PlayCircle,
  Users,
  Server,
  Wifi,
  Shield,
  Calendar,
  Timer
} from "lucide-react";
import { useState } from "react";

// Mock data for demonstration - now with parallel execution support
const hospitalData = {
  name: "Memorial General Hospital",
  contactName: "Dr. Sarah Chen",
  contactEmail: "sarah.chen@memorialgeneral.org",
  contactPhone: "(555) 123-4567",
  submissionDate: "January 15, 2026",
  estimatedGoLive: "March 20, 2026",
  overallProgress: 42,
};

// Stages can now be in-progress simultaneously
const stages = [
  {
    id: 1,
    name: "Information Gathering",
    status: "complete",
    description: "Technical specifications and requirements collected",
    completedDate: "January 22, 2026",
    progress: 100,
    duration: "5 business days",
    loe: "Low",
    tasks: [
      { name: "Onboarding form submitted", status: "complete" },
      { name: "Technical specifications reviewed", status: "complete" },
      { name: "Network requirements validated", status: "complete" },
      { name: "Integration points identified", status: "complete" },
    ],
    resources: [
      { name: "IT Administrator", description: "Complete onboarding form with technical details" },
      { name: "Network Documentation", description: "Firewall rules, IP ranges, VPN requirements" },
    ],
  },
  {
    id: 2,
    name: "Network Configuration",
    status: "in-progress",
    description: "Setting up network infrastructure and connectivity",
    progress: 75,
    duration: "7-10 business days",
    loe: "Medium",
    estimatedCompletion: "February 8, 2026",
    tasks: [
      { name: "Firewall rules configured", status: "complete" },
      { name: "VPN connection established", status: "complete" },
      { name: "Bandwidth testing", status: "complete" },
      { name: "Security audit", status: "in-progress" },
    ],
    resources: [
      { name: "Network Administrator", description: "2-3 hours for firewall configuration and testing" },
      { name: "VPN Credentials", description: "Access to network infrastructure" },
      { name: "Security Team", description: "1 hour for security audit review" },
    ],
  },
  {
    id: 3,
    name: "System Installation",
    status: "in-progress",
    description: "PACS server deployment and workstation setup",
    progress: 25,
    duration: "10-15 business days",
    loe: "High",
    estimatedCompletion: "February 20, 2026",
    tasks: [
      { name: "Server deployment", status: "complete" },
      { name: "Workstation software installation", status: "in-progress" },
      { name: "User account configuration", status: "pending" },
      { name: "Integration setup", status: "pending" },
    ],
    resources: [
      { name: "IT Administrator", description: "4-6 hours for workstation setup coordination" },
      { name: "Server Access", description: "Admin credentials for server configuration" },
      { name: "Workstation List", description: "List of all workstations requiring software installation" },
      { name: "Active Directory", description: "User account information for configuration" },
    ],
  },
  {
    id: 4,
    name: "Testing",
    status: "pending",
    description: "Comprehensive system testing and validation",
    estimatedStart: "February 25, 2026",
    progress: 0,
    duration: "5-7 business days",
    loe: "Medium",
    tasks: [
      { name: "Connectivity testing", status: "pending" },
      { name: "Image transfer validation", status: "pending" },
      { name: "User acceptance testing", status: "pending" },
      { name: "Performance benchmarking", status: "pending" },
    ],
    resources: [
      { name: "Radiology Staff", description: "3-4 hours for user acceptance testing" },
      { name: "IT Administrator", description: "2-3 hours for technical validation" },
      { name: "Test Images", description: "Sample DICOM images for transfer testing" },
    ],
  },
  {
    id: 5,
    name: "Go-Live",
    status: "pending",
    description: "Final training and system launch",
    estimatedStart: "March 15, 2026",
    progress: 0,
    duration: "3-5 business days",
    loe: "Medium",
    tasks: [
      { name: "Staff training sessions", status: "pending" },
      { name: "Documentation delivery", status: "pending" },
      { name: "Go-live support", status: "pending" },
      { name: "30-day check-in scheduled", status: "pending" },
    ],
    resources: [
      { name: "All Radiology Staff", description: "2-hour training session per group" },
      { name: "IT Administrator", description: "Available for first 48 hours post-launch" },
      { name: "Conference Room", description: "Space for training sessions" },
    ],
  },
];

const documents = [
  { name: "Network Configuration Summary", date: "Jan 28, 2026", size: "2.4 MB" },
  { name: "Technical Specifications", date: "Jan 22, 2026", size: "1.8 MB" },
  { name: "Onboarding Form Submission", date: "Jan 15, 2026", size: "856 KB" },
];

const recentUpdates = [
  {
    date: "January 30, 2026",
    title: "System Installation Started in Parallel",
    description: "While network configuration continues, we've begun server deployment to accelerate your timeline.",
  },
  {
    date: "January 28, 2026",
    title: "VPN Connection Established",
    description: "Secure VPN connection has been successfully configured and tested.",
  },
  {
    date: "January 22, 2026",
    title: "Information Gathering Complete",
    description: "All technical specifications have been reviewed and validated. Multiple stages now active.",
  },
];

export default function Home() {
  const [selectedTab, setSelectedTab] = useState("overview");
  const [expandedStage, setExpandedStage] = useState<number | null>(null);

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
  const notStartedStages = stages.filter(s => s.status === "pending");

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border bg-card/50 backdrop-blur-sm sticky top-0 z-50">
        <div className="container py-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-foreground">New Lanterns PACS</h1>
              <p className="text-sm text-muted-foreground mt-1">Onboarding Status Portal</p>
            </div>
            <div className="flex items-center gap-4">
              <div className="text-right">
                <p className="text-sm font-medium text-foreground">{hospitalData.name}</p>
                <p className="text-xs text-muted-foreground">{hospitalData.contactName}</p>
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <div className="container py-8">
        {/* Overall Progress Card */}
        <Card className="mb-8 shadow-lg border-primary/20 bg-gradient-to-br from-card to-card/50">
          <CardHeader>
            <div className="flex items-start justify-between">
              <div>
                <CardTitle className="text-2xl">Onboarding Progress</CardTitle>
                <CardDescription className="mt-2">
                  Submitted on {hospitalData.submissionDate} • Estimated Go-Live: {hospitalData.estimatedGoLive}
                </CardDescription>
              </div>
              <div className="text-right">
                <div className="text-4xl font-bold text-primary">{hospitalData.overallProgress}%</div>
                <p className="text-xs text-muted-foreground mt-1">Complete</p>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <Progress value={hospitalData.overallProgress} className="h-3 mb-4" />
            <div className="flex items-center gap-6 text-sm flex-wrap">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-primary" />
                <span className="font-medium">{completedStages.length} Completed</span>
              </div>
              <div className="flex items-center gap-2">
                <PlayCircle className="w-4 h-4 text-primary fill-primary/20" />
                <span className="font-medium">{activeStages.length} Active</span>
              </div>
              <div className="flex items-center gap-2">
                <Circle className="w-4 h-4 text-muted-foreground" />
                <span className="font-medium">{notStartedStages.length} Not Started</span>
              </div>
              <div className="flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 border border-primary/30">
                <AlertCircle className="w-4 h-4 text-primary" />
                <span className="font-medium text-primary">Parallel Execution Enabled</span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Tabs for different views */}
        <Tabs value={selectedTab} onValueChange={setSelectedTab} className="space-y-6">
          <TabsList className="grid w-full grid-cols-4 lg:w-[600px]">
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="active">Active ({activeStages.length})</TabsTrigger>
            <TabsTrigger value="completed">Completed ({completedStages.length})</TabsTrigger>
            <TabsTrigger value="not-started">Not Started ({notStartedStages.length})</TabsTrigger>
          </TabsList>

          {/* Overview Tab */}
          <TabsContent value="overview" className="space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Active Stages Summary */}
              <Card className="border-primary/30">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <PlayCircle className="w-5 h-5 text-primary" />
                    Active Stages
                  </CardTitle>
                  <CardDescription>Currently in progress</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  {activeStages.map((stage) => (
                    <div key={stage.id} className="p-4 rounded-lg bg-primary/5 border border-primary/20">
                      <div className="flex items-start justify-between mb-3">
                        <div className="flex-1">
                          <h3 className="font-semibold text-foreground">{stage.name}</h3>
                          <p className="text-xs text-muted-foreground mt-1">{stage.description}</p>
                          <div className="flex items-center gap-3 mt-2 flex-wrap">
                            <div className="flex items-center gap-1 text-xs text-muted-foreground">
                              <Timer className="w-3 h-3" />
                              {stage.duration}
                            </div>
                            {getLOEBadge(stage.loe)}
                          </div>
                        </div>
                        <span className="text-sm font-bold text-primary ml-2">{stage.progress}%</span>
                      </div>
                      <Progress value={stage.progress} className="h-2" />
                    </div>
                  ))}
                </CardContent>
              </Card>

              {/* Recent Updates */}
              <Card>
                <CardHeader>
                  <CardTitle>Recent Updates</CardTitle>
                  <CardDescription>Latest activity on your onboarding</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {recentUpdates.map((update, index) => (
                      <div key={index}>
                        <div className="flex items-start gap-3">
                          <div className="w-2 h-2 rounded-full bg-primary mt-2" />
                          <div className="flex-1">
                            <p className="text-xs text-muted-foreground mb-1">{update.date}</p>
                            <h4 className="font-semibold text-sm mb-1">{update.title}</h4>
                            <p className="text-sm text-muted-foreground">{update.description}</p>
                          </div>
                        </div>
                        {index < recentUpdates.length - 1 && <Separator className="mt-4" />}
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Documents */}
            <Card>
              <CardHeader>
                <CardTitle>Documents</CardTitle>
                <CardDescription>Download configuration summaries and documentation</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  {documents.map((doc, index) => (
                    <button
                      key={index}
                      className="flex flex-col items-start p-4 rounded-lg hover:bg-primary/5 border border-border hover:border-primary/30 transition-all text-left"
                    >
                      <FileText className="w-6 h-6 text-primary mb-3" />
                      <p className="text-sm font-medium mb-1">{doc.name}</p>
                      <p className="text-xs text-muted-foreground mb-3">{doc.date} • {doc.size}</p>
                      <div className="flex items-center gap-1 text-xs text-primary">
                        <Download className="w-3 h-3" />
                        Download
                      </div>
                    </button>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* Contact Card */}
            <Card className="bg-gradient-to-br from-primary/10 to-primary/5 border-primary/30">
              <CardHeader>
                <CardTitle>Need Help?</CardTitle>
                <CardDescription>Our team is here to support you</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-primary/20">
                    <Mail className="w-4 h-4 text-primary" />
                  </div>
                  <a href={`mailto:${hospitalData.contactEmail}`} className="text-sm text-primary hover:underline">
                    {hospitalData.contactEmail}
                  </a>
                </div>
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-primary/20">
                    <Phone className="w-4 h-4 text-primary" />
                  </div>
                  <span className="text-sm text-foreground">{hospitalData.contactPhone}</span>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Active Stages Tab */}
          <TabsContent value="active" className="space-y-6">
            {activeStages.map((stage) => (
              <Card key={stage.id} className="border-primary/30">
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2 flex-wrap">
                        <h2 className="text-2xl font-bold">{stage.name}</h2>
                        {getStatusBadge(stage.status)}
                        {getLOEBadge(stage.loe)}
                      </div>
                      <p className="text-muted-foreground mb-3">{stage.description}</p>
                      <div className="flex items-center gap-4 text-sm flex-wrap">
                        <div className="flex items-center gap-2">
                          <Timer className="w-4 h-4 text-muted-foreground" />
                          <span className="text-muted-foreground">Duration: {stage.duration}</span>
                        </div>
                        {stage.estimatedCompletion && (
                          <div className="flex items-center gap-2">
                            <Calendar className="w-4 h-4 text-muted-foreground" />
                            <span className="text-muted-foreground">Est. completion: {stage.estimatedCompletion}</span>
                          </div>
                        )}
                      </div>
                    </div>
                    <div className="text-right ml-4">
                      <div className="text-3xl font-bold text-primary">{stage.progress}%</div>
                      <p className="text-xs text-muted-foreground">Progress</p>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div>
                    <Progress value={stage.progress} className="h-3" />
                  </div>

                  {/* Tasks */}
                  <div>
                    <h3 className="font-semibold mb-4">Tasks</h3>
                    <div className="space-y-3">
                      {stage.tasks.map((task, index) => (
                        <div key={index} className="flex items-center justify-between p-3 rounded-lg bg-muted/30 border border-border">
                          <div className="flex items-center gap-3">
                            {getStatusIcon(task.status)}
                            <span className="text-sm font-medium">{task.name}</span>
                          </div>
                          {getStatusBadge(task.status)}
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Resources Needed */}
                  <div>
                    <h3 className="font-semibold mb-4 flex items-center gap-2">
                      <Users className="w-5 h-5 text-primary" />
                      Resources Needed from Your Team
                    </h3>
                    <div className="space-y-3">
                      {stage.resources.map((resource, index) => (
                        <div key={index} className="p-4 rounded-lg bg-primary/5 border border-primary/20">
                          <h4 className="font-semibold text-sm mb-1">{resource.name}</h4>
                          <p className="text-xs text-muted-foreground">{resource.description}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}

            {activeStages.length === 0 && (
              <Card>
                <CardContent className="py-12 text-center">
                  <Clock className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                  <h3 className="text-lg font-semibold mb-2">No Active Stages</h3>
                  <p className="text-sm text-muted-foreground">All stages are either completed or pending.</p>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          {/* Completed Stages Tab */}
          <TabsContent value="completed" className="space-y-4">
            {completedStages.map((stage) => (
              <Card key={stage.id} className="border-primary/20 bg-primary/5">
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2 flex-wrap">
                        <CheckCircle2 className="w-6 h-6 text-primary" />
                        <h3 className="text-xl font-bold">{stage.name}</h3>
                        {getStatusBadge(stage.status)}
                      </div>
                      <p className="text-sm text-muted-foreground mb-2">{stage.description}</p>
                      <div className="flex items-center gap-4 text-sm flex-wrap">
                        <p className="text-xs text-primary">Completed {stage.completedDate}</p>
                        <div className="flex items-center gap-2">
                          <Timer className="w-3 h-3 text-muted-foreground" />
                          <span className="text-xs text-muted-foreground">Duration: {stage.duration}</span>
                        </div>
                        {getLOEBadge(stage.loe)}
                      </div>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {stage.tasks.map((task, index) => (
                      <div key={index} className="flex items-center gap-2 p-2 rounded text-sm">
                        <CheckCircle2 className="w-4 h-4 text-primary" />
                        <span className="text-muted-foreground">{task.name}</span>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            ))}

            {completedStages.length === 0 && (
              <Card>
                <CardContent className="py-12 text-center">
                  <CheckCircle2 className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                  <h3 className="text-lg font-semibold mb-2">No Completed Stages Yet</h3>
                  <p className="text-sm text-muted-foreground">Completed stages will appear here.</p>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          {/* Not Started Stages Tab */}
          <TabsContent value="not-started" className="space-y-4">
            {notStartedStages.map((stage) => (
              <Card key={stage.id}>
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2 flex-wrap">
                        <Circle className="w-6 h-6 text-muted-foreground" />
                        <h3 className="text-xl font-bold">{stage.name}</h3>
                        {getStatusBadge(stage.status)}
                        {getLOEBadge(stage.loe)}
                      </div>
                      <p className="text-sm text-muted-foreground mb-3">{stage.description}</p>
                      <div className="flex items-center gap-4 text-sm flex-wrap">
                        {stage.estimatedStart && (
                          <div className="flex items-center gap-2">
                            <Calendar className="w-4 h-4 text-muted-foreground" />
                            <span className="text-muted-foreground">Est. start: {stage.estimatedStart}</span>
                          </div>
                        )}
                        <div className="flex items-center gap-2">
                          <Timer className="w-4 h-4 text-muted-foreground" />
                          <span className="text-muted-foreground">Duration: {stage.duration}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-6">
                  {/* Planned Tasks */}
                  <div>
                    <h4 className="font-semibold mb-3 text-sm">Planned Tasks</h4>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      {stage.tasks.map((task, index) => (
                        <div key={index} className="flex items-center gap-2 p-2 rounded text-sm">
                          <Circle className="w-4 h-4 text-muted-foreground" />
                          <span className="text-muted-foreground">{task.name}</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Resources Needed */}
                  <div>
                    <h4 className="font-semibold mb-3 text-sm flex items-center gap-2">
                      <Users className="w-5 h-5 text-muted-foreground" />
                      Resources You'll Need to Provide
                    </h4>
                    <div className="space-y-2">
                      {stage.resources.map((resource, index) => (
                        <div key={index} className="p-3 rounded-lg bg-muted/30 border border-border">
                          <h5 className="font-semibold text-sm mb-1">{resource.name}</h5>
                          <p className="text-xs text-muted-foreground">{resource.description}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}

            {notStartedStages.length === 0 && (
              <Card>
                <CardContent className="py-12 text-center">
                  <CheckCircle2 className="w-12 h-12 text-primary mx-auto mb-4" />
                  <h3 className="text-lg font-semibold mb-2">All Stages Started!</h3>
                  <p className="text-sm text-muted-foreground">There are no pending stages remaining.</p>
                </CardContent>
              </Card>
            )}
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}

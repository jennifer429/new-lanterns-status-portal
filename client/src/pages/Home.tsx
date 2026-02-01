/**
 * Dark Theme with Purple Accents: Deep purple primary, dark backgrounds, parallel workflow support
 * Stages can run in parallel - multiple stages can be active simultaneously
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
  PlayCircle
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
    tasks: [
      { name: "Onboarding form submitted", status: "complete" },
      { name: "Technical specifications reviewed", status: "complete" },
      { name: "Network requirements validated", status: "complete" },
      { name: "Integration points identified", status: "complete" },
    ],
  },
  {
    id: 2,
    name: "Network Configuration",
    status: "in-progress",
    description: "Setting up network infrastructure and connectivity",
    progress: 75,
    tasks: [
      { name: "Firewall rules configured", status: "complete" },
      { name: "VPN connection established", status: "complete" },
      { name: "Bandwidth testing", status: "complete" },
      { name: "Security audit", status: "in-progress" },
    ],
  },
  {
    id: 3,
    name: "System Installation",
    status: "in-progress",
    description: "PACS server deployment and workstation setup",
    progress: 25,
    tasks: [
      { name: "Server deployment", status: "complete" },
      { name: "Workstation software installation", status: "in-progress" },
      { name: "User account configuration", status: "pending" },
      { name: "Integration setup", status: "pending" },
    ],
  },
  {
    id: 4,
    name: "Testing",
    status: "pending",
    description: "Comprehensive system testing and validation",
    estimatedStart: "February 25, 2026",
    progress: 0,
    tasks: [
      { name: "Connectivity testing", status: "pending" },
      { name: "Image transfer validation", status: "pending" },
      { name: "User acceptance testing", status: "pending" },
      { name: "Performance benchmarking", status: "pending" },
    ],
  },
  {
    id: 5,
    name: "Go-Live",
    status: "pending",
    description: "Final training and system launch",
    estimatedStart: "March 15, 2026",
    progress: 0,
    tasks: [
      { name: "Staff training sessions", status: "pending" },
      { name: "Documentation delivery", status: "pending" },
      { name: "Go-live support", status: "pending" },
      { name: "30-day check-in scheduled", status: "pending" },
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
        return <Badge variant="outline" className="text-muted-foreground border-muted">Pending</Badge>;
    }
  };

  const activeStages = stages.filter(s => s.status === "in-progress");
  const completedStages = stages.filter(s => s.status === "complete");

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
              <div className="flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 border border-primary/30">
                <AlertCircle className="w-4 h-4 text-primary" />
                <span className="font-medium text-primary">Parallel Execution Enabled</span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Tabs for different views */}
        <Tabs value={selectedTab} onValueChange={setSelectedTab} className="space-y-6">
          <TabsList className="grid w-full grid-cols-3 lg:w-[500px]">
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="active">Active Stages</TabsTrigger>
            <TabsTrigger value="all">All Stages</TabsTrigger>
          </TabsList>

          {/* Overview Tab */}
          <TabsContent value="overview" className="space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Active Stages */}
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
                        <div>
                          <h3 className="font-semibold text-foreground">{stage.name}</h3>
                          <p className="text-xs text-muted-foreground mt-1">{stage.description}</p>
                        </div>
                        <span className="text-sm font-bold text-primary">{stage.progress}%</span>
                      </div>
                      <Progress value={stage.progress} className="h-2" />
                      <div className="mt-3 space-y-1">
                        {stage.tasks.filter(t => t.status !== "pending").map((task, idx) => (
                          <div key={idx} className="flex items-center gap-2 text-xs">
                            {getStatusIcon(task.status)}
                            <span className="text-muted-foreground">{task.name}</span>
                          </div>
                        ))}
                      </div>
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
                    <div>
                      <div className="flex items-center gap-3 mb-2">
                        <h2 className="text-2xl font-bold">{stage.name}</h2>
                        {getStatusBadge(stage.status)}
                      </div>
                      <p className="text-muted-foreground">{stage.description}</p>
                    </div>
                    <div className="text-right">
                      <div className="text-3xl font-bold text-primary">{stage.progress}%</div>
                      <p className="text-xs text-muted-foreground">Progress</p>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <Progress value={stage.progress} className="h-3 mb-6" />
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

          {/* All Stages Tab */}
          <TabsContent value="all" className="space-y-4">
            {stages.map((stage) => (
              <Card key={stage.id} className={stage.status === "in-progress" ? "border-primary/30" : ""}>
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        {getStatusIcon(stage.status)}
                        <h3 className="text-xl font-bold">{stage.name}</h3>
                        {getStatusBadge(stage.status)}
                      </div>
                      <p className="text-sm text-muted-foreground">{stage.description}</p>
                      {stage.completedDate && (
                        <p className="text-xs text-primary mt-2">Completed {stage.completedDate}</p>
                      )}
                      {stage.estimatedStart && stage.status === "pending" && (
                        <p className="text-xs text-muted-foreground mt-2">Est. start {stage.estimatedStart}</p>
                      )}
                    </div>
                    {stage.status !== "pending" && (
                      <div className="text-right ml-4">
                        <div className="text-2xl font-bold text-primary">{stage.progress}%</div>
                      </div>
                    )}
                  </div>
                </CardHeader>
                <CardContent>
                  {stage.status !== "pending" && (
                    <Progress value={stage.progress} className="h-2 mb-4" />
                  )}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {stage.tasks.map((task, index) => (
                      <div key={index} className="flex items-center gap-2 p-2 rounded text-sm">
                        {getStatusIcon(task.status)}
                        <span className={task.status === "complete" ? "text-muted-foreground" : "text-foreground"}>
                          {task.name}
                        </span>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            ))}
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}

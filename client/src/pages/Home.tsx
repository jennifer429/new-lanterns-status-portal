/**
 * Clinical Modernism Design: Deep teal primary, amber accents, asymmetric 30/70 layout
 * Left timeline navigation, data-first information architecture, medical-grade precision
 */

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import { 
  CheckCircle2, 
  Circle, 
  Clock, 
  FileText, 
  Mail, 
  Phone, 
  ChevronRight,
  Download,
  AlertCircle
} from "lucide-react";
import { useState } from "react";

// Mock data for demonstration
const hospitalData = {
  name: "Memorial General Hospital",
  contactName: "Dr. Sarah Chen",
  contactEmail: "sarah.chen@memorialgeneral.org",
  contactPhone: "(555) 123-4567",
  submissionDate: "January 15, 2026",
  estimatedGoLive: "March 20, 2026",
  currentStage: "Network Configuration",
  overallProgress: 35,
};

const stages = [
  {
    id: 1,
    name: "Information Gathering",
    status: "complete",
    description: "Technical specifications and requirements collected",
    completedDate: "January 22, 2026",
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
    tasks: [
      { name: "Firewall rules configured", status: "complete" },
      { name: "VPN connection established", status: "complete" },
      { name: "Bandwidth testing", status: "in-progress" },
      { name: "Security audit", status: "pending" },
    ],
  },
  {
    id: 3,
    name: "System Installation",
    status: "pending",
    description: "PACS server deployment and workstation setup",
    estimatedStart: "February 10, 2026",
    tasks: [
      { name: "Server deployment", status: "pending" },
      { name: "Workstation software installation", status: "pending" },
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
    title: "Bandwidth Testing In Progress",
    description: "Our team is conducting bandwidth tests to ensure optimal performance for your imaging workload.",
  },
  {
    date: "January 28, 2026",
    title: "VPN Connection Established",
    description: "Secure VPN connection has been successfully configured and tested.",
  },
  {
    date: "January 22, 2026",
    title: "Information Gathering Complete",
    description: "All technical specifications have been reviewed and validated. Moving to Network Configuration stage.",
  },
];

export default function Home() {
  const [selectedStage, setSelectedStage] = useState(2);

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "complete":
        return <CheckCircle2 className="w-5 h-5 text-[oklch(0.75_0.15_65)]" />;
      case "in-progress":
        return <Clock className="w-5 h-5 text-primary" />;
      default:
        return <Circle className="w-5 h-5 text-muted-foreground" />;
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "complete":
        return <Badge className="bg-[oklch(0.75_0.15_65)] text-[oklch(0.2_0.02_65)] hover:bg-[oklch(0.75_0.15_65)]">Complete</Badge>;
      case "in-progress":
        return <Badge className="bg-primary text-primary-foreground">In Progress</Badge>;
      default:
        return <Badge variant="outline" className="text-muted-foreground">Pending</Badge>;
    }
  };

  const currentStageData = stages[selectedStage - 1];

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border bg-card">
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
        <Card className="mb-8 shadow-sm">
          <CardHeader>
            <div className="flex items-start justify-between">
              <div>
                <CardTitle className="text-2xl">Onboarding Progress</CardTitle>
                <CardDescription className="mt-2">
                  Submitted on {hospitalData.submissionDate} • Estimated Go-Live: {hospitalData.estimatedGoLive}
                </CardDescription>
              </div>
              <div className="text-right">
                <div className="text-3xl font-bold text-primary">{hospitalData.overallProgress}%</div>
                <p className="text-xs text-muted-foreground mt-1">Complete</p>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <Progress value={hospitalData.overallProgress} className="h-3" />
            <div className="mt-4 flex items-center gap-2 text-sm">
              <div className="flex items-center gap-2">
                <Clock className="w-4 h-4 text-primary" />
                <span className="font-medium">Current Stage:</span>
                <span className="text-muted-foreground">{hospitalData.currentStage}</span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Two Column Layout */}
        <div className="grid grid-cols-1 lg:grid-cols-[350px_1fr] gap-8">
          {/* Left Column: Timeline Navigation */}
          <div className="space-y-4">
            <h2 className="text-lg font-semibold mb-4">Onboarding Stages</h2>
            <div className="space-y-2 relative">
              {/* Vertical line */}
              <div className="absolute left-[11px] top-6 bottom-6 w-0.5 bg-border" />
              
              {stages.map((stage, index) => (
                <button
                  key={stage.id}
                  onClick={() => setSelectedStage(stage.id)}
                  className={`w-full text-left p-4 rounded-lg transition-all relative ${
                    selectedStage === stage.id
                      ? "bg-primary/5 border-2 border-primary"
                      : "bg-card border border-border hover:border-primary/30"
                  }`}
                >
                  <div className="flex items-start gap-3">
                    <div className="relative z-10 bg-background">
                      {getStatusIcon(stage.status)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2">
                        <h3 className="font-semibold text-sm">{stage.name}</h3>
                        {getStatusBadge(stage.status)}
                      </div>
                      {stage.completedDate && (
                        <p className="text-xs text-muted-foreground mt-1">
                          Completed {stage.completedDate}
                        </p>
                      )}
                      {stage.estimatedStart && stage.status === "pending" && (
                        <p className="text-xs text-muted-foreground mt-1">
                          Est. start {stage.estimatedStart}
                        </p>
                      )}
                    </div>
                  </div>
                </button>
              ))}
            </div>

            {/* Contact Card */}
            <Card className="mt-8">
              <CardHeader>
                <CardTitle className="text-base">Need Help?</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex items-center gap-2 text-sm">
                  <Mail className="w-4 h-4 text-muted-foreground" />
                  <a href={`mailto:${hospitalData.contactEmail}`} className="text-primary hover:underline">
                    {hospitalData.contactEmail}
                  </a>
                </div>
                <div className="flex items-center gap-2 text-sm">
                  <Phone className="w-4 h-4 text-muted-foreground" />
                  <span className="text-foreground">{hospitalData.contactPhone}</span>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Right Column: Stage Details */}
          <div className="space-y-6">
            {/* Stage Header */}
            <div>
              <div className="flex items-center gap-3 mb-2">
                <h2 className="text-3xl font-bold">{currentStageData.name}</h2>
                {getStatusBadge(currentStageData.status)}
              </div>
              <p className="text-muted-foreground">{currentStageData.description}</p>
            </div>

            {/* Tasks */}
            <Card>
              <CardHeader>
                <CardTitle>Tasks</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {currentStageData.tasks.map((task, index) => (
                    <div key={index} className="flex items-center justify-between p-3 rounded-lg bg-muted/30">
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

            {/* Next Steps */}
            {currentStageData.status === "in-progress" && (
              <Card className="border-primary/30 bg-primary/5">
                <CardHeader>
                  <div className="flex items-center gap-2">
                    <AlertCircle className="w-5 h-5 text-primary" />
                    <CardTitle>Next Steps</CardTitle>
                  </div>
                </CardHeader>
                <CardContent>
                  <p className="text-sm mb-4">
                    Our network engineer will reach out within 2 business days to complete the bandwidth testing. 
                    Please ensure your IT administrator is available for a brief call.
                  </p>
                  <Button className="w-full sm:w-auto">
                    Schedule Configuration Call
                    <ChevronRight className="w-4 h-4 ml-2" />
                  </Button>
                </CardContent>
              </Card>
            )}

            {/* Recent Updates */}
            <Card>
              <CardHeader>
                <CardTitle>Recent Updates</CardTitle>
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

            {/* Documents */}
            <Card>
              <CardHeader>
                <CardTitle>Documents</CardTitle>
                <CardDescription>Download configuration summaries and documentation</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {documents.map((doc, index) => (
                    <button
                      key={index}
                      className="w-full flex items-center justify-between p-3 rounded-lg hover:bg-muted/50 transition-colors text-left"
                    >
                      <div className="flex items-center gap-3">
                        <FileText className="w-5 h-5 text-primary" />
                        <div>
                          <p className="text-sm font-medium">{doc.name}</p>
                          <p className="text-xs text-muted-foreground">{doc.date} • {doc.size}</p>
                        </div>
                      </div>
                      <Download className="w-4 h-4 text-muted-foreground" />
                    </button>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}

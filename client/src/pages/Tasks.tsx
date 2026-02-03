/**
 * Tasks Page - Shows all generated action items from questionnaire
 */

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { CheckCircle2, Circle, FileText, Calendar, Upload, ArrowLeft } from "lucide-react";
import { Link, useRoute } from "wouter";
import { useState } from "react";

// Mock tasks - in production these would come from the database based on questionnaire responses
const mockTasks = [
  {
    id: "1",
    title: "Upload network diagram",
    description: "Provide a diagram showing your current network topology including VLANs, subnets, and firewall rules",
    type: "upload",
    status: "pending",
    section: "Security & Permissions",
  },
  {
    id: "2",
    title: "Provide PACS configuration export",
    description: "Export your current PACS system configuration file",
    type: "upload",
    status: "pending",
    section: "Systems",
  },
  {
    id: "3",
    title: "Schedule network assessment call",
    description: "Book a 30-minute call with our network team to review your infrastructure",
    type: "schedule",
    status: "pending",
    section: "Data & Integration",
  },
  {
    id: "4",
    title: "Complete HL7 interface specifications",
    description: "Fill out the HL7 interface requirements form with your EMR details",
    type: "form",
    status: "pending",
    section: "Data & Integration",
  },
  {
    id: "5",
    title: "Review user access requirements",
    description: "Provide a list of users who will need access to the PACS system",
    type: "review",
    status: "pending",
    section: "User Configuration",
  },
];

export default function Tasks() {
  const [, params] = useRoute("/org/:slug/tasks");
  const orgSlug = params?.slug || "demo";
  
  const [tasks, setTasks] = useState(mockTasks);
  
  const completedTasks = tasks.filter(t => t.status === "complete").length;
  const totalTasks = tasks.length;
  const completionPercentage = Math.round((completedTasks / totalTasks) * 100);

  const toggleTaskStatus = (taskId: string) => {
    setTasks(prev => prev.map(task => 
      task.id === taskId 
        ? { ...task, status: task.status === "complete" ? "pending" : "complete" }
        : task
    ));
  };

  const getTaskIcon = (type: string) => {
    switch (type) {
      case "upload":
        return <Upload className="w-4 h-4" />;
      case "schedule":
        return <Calendar className="w-4 h-4" />;
      case "form":
        return <FileText className="w-4 h-4" />;
      case "review":
        return <CheckCircle2 className="w-4 h-4" />;
      default:
        return <Circle className="w-4 h-4" />;
    }
  };

  const getStatusBadge = (status: string) => {
    if (status === "complete") {
      return <Badge className="bg-green-600 hover:bg-green-500">Complete</Badge>;
    }
    return <Badge variant="outline" className="border-yellow-500 text-yellow-400">Pending</Badge>;
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
                <h1 className="text-xl font-bold text-foreground">Action Items</h1>
                <p className="text-xs text-muted-foreground">Implementation Tasks</p>
              </div>
            </div>
            <Button variant="outline" size="sm" asChild>
              <Link href={`/org/${orgSlug}`}>
                <ArrowLeft className="w-4 h-4 mr-2" />
                Back to Dashboard
              </Link>
            </Button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <div className="container py-8 max-w-4xl">
        {/* Progress Overview */}
        <Card className="mb-6 border-primary/20">
          <CardHeader>
            <CardTitle>Task Completion</CardTitle>
            <CardDescription>
              {completedTasks} of {totalTasks} tasks completed
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Progress value={completionPercentage} className="h-3" />
            <p className="text-sm text-muted-foreground mt-2">
              {completionPercentage}% complete
            </p>
          </CardContent>
        </Card>

        {/* Tasks List */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-2xl font-bold">Your Tasks</h2>
            <p className="text-sm text-muted-foreground">
              Click tasks to mark as complete
            </p>
          </div>

          {tasks.map(task => (
            <Card 
              key={task.id}
              className={`cursor-pointer transition-all hover:border-primary/50 ${
                task.status === "complete" ? "opacity-60" : ""
              }`}
              onClick={() => toggleTaskStatus(task.id)}
            >
              <CardHeader>
                <div className="flex items-start justify-between gap-4">
                  <div className="flex items-start gap-3 flex-1">
                    <div className={`w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 ${
                      task.status === "complete" 
                        ? "bg-green-600/20 text-green-400" 
                        : "bg-primary/20 text-primary"
                    }`}>
                      {task.status === "complete" ? (
                        <CheckCircle2 className="w-5 h-5" />
                      ) : (
                        getTaskIcon(task.type)
                      )}
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <CardTitle className="text-lg">{task.title}</CardTitle>
                      </div>
                      <CardDescription className="text-sm">
                        {task.description}
                      </CardDescription>
                      <div className="mt-2">
                        <Badge variant="outline" className="text-xs">
                          {task.section}
                        </Badge>
                      </div>
                    </div>
                  </div>
                  <div className="flex-shrink-0">
                    {getStatusBadge(task.status)}
                  </div>
                </div>
              </CardHeader>
            </Card>
          ))}
        </div>

        {/* Help Section */}
        <Card className="mt-8 border-primary/30">
          <CardHeader>
            <CardTitle className="text-lg">Need Help?</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground mb-4">
              If you have questions about any of these tasks or need assistance, please contact our support team.
            </p>
            <Button variant="outline" asChild>
              <a href="mailto:support@newlantern.ai">
                Contact Support
              </a>
            </Button>
          </CardContent>
        </Card>
      </div>

      {/* Footer */}
      <footer className="border-t border-border py-6 mt-12">
        <div className="container text-center text-sm text-muted-foreground">
          <p>New Lantern ©</p>
        </div>
      </footer>
    </div>
  );
}

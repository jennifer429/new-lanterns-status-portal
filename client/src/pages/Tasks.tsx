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
import { PageBreadcrumb } from "@/components/PageBreadcrumb";
import { trpc } from "@/lib/trpc";

export default function Tasks() {
  const [, params] = useRoute("/org/:slug/tasks");
  const orgSlug = params?.slug || "demo";

  const { data: templateTasks, isLoading } = trpc.intake.getTaskTemplatesForOrg.useQuery(
    { organizationSlug: orgSlug },
    { enabled: !!orgSlug },
  );

  const [completedIds, setCompletedIds] = useState<Set<number>>(new Set());

  const tasks = templateTasks ?? [];
  const completedTasks = completedIds.size;
  const totalTasks = tasks.length;
  const completionPercentage = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;

  const toggleTaskStatus = (taskId: number) => {
    setCompletedIds(prev => {
      const next = new Set(prev);
      if (next.has(taskId)) next.delete(taskId); else next.add(taskId);
      return next;
    });
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

  const getStatusBadge = (isComplete: boolean) => {
    if (isComplete) {
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
                <p className="text-xs text-muted-foreground">Task List</p>
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
      <PageBreadcrumb orgSlug={orgSlug} items={[{ label: "Action Items" }]} />

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

          {isLoading && (
            <p className="text-muted-foreground text-center py-8">Loading tasks...</p>
          )}
          {!isLoading && tasks.length === 0 && (
            <Card className="border-dashed">
              <CardContent className="py-12 text-center text-muted-foreground">
                No tasks have been defined yet. Contact your partner administrator.
              </CardContent>
            </Card>
          )}
          {tasks.map(task => {
            const isComplete = completedIds.has(task.id);
            return (
              <Card
                key={task.id}
                className={`cursor-pointer transition-all hover:border-primary/50 ${isComplete ? "opacity-60" : ""}`}
                onClick={() => toggleTaskStatus(task.id)}
              >
                <CardHeader>
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex items-start gap-3 flex-1">
                      <div className={`w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 ${
                        isComplete ? "bg-green-600/20 text-green-400" : "bg-primary/20 text-primary"
                      }`}>
                        {isComplete ? <CheckCircle2 className="w-5 h-5" /> : getTaskIcon(task.type)}
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <CardTitle className="text-lg">{task.title}</CardTitle>
                        </div>
                        {task.description && (
                          <CardDescription className="text-sm">{task.description}</CardDescription>
                        )}
                        {task.section && (
                          <div className="mt-2">
                            <Badge variant="outline" className="text-xs">{task.section}</Badge>
                          </div>
                        )}
                      </div>
                    </div>
                    <div className="flex-shrink-0">
                      {getStatusBadge(isComplete)}
                    </div>
                  </div>
                </CardHeader>
              </Card>
            );
          })}
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

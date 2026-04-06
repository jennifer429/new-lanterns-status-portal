/**
 * Tasks Page - Shows partner-defined and org-specific custom action items.
 *
 * Template tasks (from partnerTaskTemplates): completion is local state for
 * the session — they're defined by the partner for all sites.
 *
 * Custom tasks (orgCustomTasks): per-org tasks added by hospital users.
 * Both completion state and the task itself persist in the DB.
 */

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Input } from "@/components/ui/input";
import { CheckCircle2, Circle, FileText, Calendar, Upload, ArrowLeft, Plus, X, Loader2 } from "lucide-react";
import { Link, useRoute } from "wouter";
import { useState } from "react";
import { PageBreadcrumb } from "@/components/PageBreadcrumb";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { toast } from "sonner";

type Section = {
  name: string;
  templateTaskIds: number[];
  customTaskIds: number[];
};

export default function Tasks() {
  const [, params] = useRoute("/org/:slug/tasks");
  const orgSlug = params?.slug || "demo";
  const { user } = useAuth();

  const utils = trpc.useUtils();

  // --- Template tasks (partner-defined, all sites) ---
  const { data: templateTasks = [], isLoading: loadingTemplates } =
    trpc.intake.getTaskTemplatesForOrg.useQuery({ organizationSlug: orgSlug });

  // Completion for template tasks is local (session-only)
  const [completedTemplateIds, setCompletedTemplateIds] = useState<Set<number>>(new Set());

  // --- Custom tasks (this org only, persisted) ---
  const { data: customTasks = [], isLoading: loadingCustom } =
    trpc.intake.getOrgCustomTasks.useQuery({ organizationSlug: orgSlug });

  const addTaskMutation = trpc.intake.addOrgCustomTask.useMutation({
    onSuccess: () => {
      utils.intake.getOrgCustomTasks.invalidate({ organizationSlug: orgSlug });
    },
    onError: () => toast.error("Failed to add task"),
  });

  const toggleTaskMutation = trpc.intake.toggleOrgCustomTask.useMutation({
    onSuccess: () => {
      utils.intake.getOrgCustomTasks.invalidate({ organizationSlug: orgSlug });
    },
    onError: () => toast.error("Failed to update task"),
  });

  const deleteTaskMutation = trpc.intake.deleteOrgCustomTask.useMutation({
    onSuccess: () => {
      utils.intake.getOrgCustomTasks.invalidate({ organizationSlug: orgSlug });
    },
    onError: () => toast.error("Failed to delete task"),
  });

  // --- Inline add-task form state per section ---
  const [addingToSection, setAddingToSection] = useState<string | null>(null);
  const [newTaskTitle, setNewTaskTitle] = useState("");

  const handleAddTask = (section: string | null) => {
    const title = newTaskTitle.trim();
    if (!title) return;
    addTaskMutation.mutate({
      organizationSlug: orgSlug,
      title,
      section: section ?? undefined,
      userEmail: user?.email ?? undefined,
    }, {
      onSuccess: () => {
        setNewTaskTitle("");
        setAddingToSection(null);
      },
    });
  };

  // --- Group tasks by section ---
  const allSectionNames = Array.from(new Set([
    ...templateTasks.map((t) => t.section ?? "General"),
    ...customTasks.map((t) => t.section ?? "General"),
  ]));

  // Sections that have at least one task + a catch-all "General" for unsectioned
  const sections: Section[] = allSectionNames.map((name) => ({
    name,
    templateTaskIds: templateTasks.filter((t) => (t.section ?? "General") === name).map((t) => t.id),
    customTaskIds: customTasks.filter((t) => (t.section ?? "General") === name).map((t) => t.id),
  }));

  // If there are no sections at all, show one "General" add-task area
  const showNoSectionFallback = sections.length === 0 && !loadingTemplates && !loadingCustom;

  // --- Progress ---
  const completedTemplate = completedTemplateIds.size;
  const completedCustom = customTasks.filter((t) => t.isComplete).length;
  const totalTasks = templateTasks.length + customTasks.length;
  const completedTasks = completedTemplate + completedCustom;
  const completionPercentage = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;

  // --- Helpers ---
  const getTaskIcon = (type: string) => {
    switch (type) {
      case "upload": return <Upload className="w-4 h-4" />;
      case "schedule": return <Calendar className="w-4 h-4" />;
      case "form": return <FileText className="w-4 h-4" />;
      default: return <Circle className="w-4 h-4" />;
    }
  };

  const toggleTemplate = (id: number) => {
    setCompletedTemplateIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const isLoading = loadingTemplates || loadingCustom;

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

      <div className="container py-8 max-w-4xl">
        {/* Progress */}
        <Card className="mb-6 border-primary/20">
          <CardHeader>
            <CardTitle>Task Completion</CardTitle>
            <CardDescription>{completedTasks} of {totalTasks} tasks completed</CardDescription>
          </CardHeader>
          <CardContent>
            <Progress value={completionPercentage} className="h-3" />
            <p className="text-sm text-muted-foreground mt-2">{completionPercentage}% complete</p>
          </CardContent>
        </Card>

        {/* Tasks by section */}
        <div className="space-y-8">
          <div className="flex items-center justify-between">
            <h2 className="text-2xl font-bold">Your Tasks</h2>
            <p className="text-sm text-muted-foreground">Click tasks to mark as complete</p>
          </div>

          {isLoading && (
            <p className="text-muted-foreground text-center py-8">Loading tasks...</p>
          )}

          {/* No tasks at all — show a single add-task area */}
          {showNoSectionFallback && (
            <div className="space-y-3">
              <Card className="border-dashed">
                <CardContent className="py-8 text-center text-muted-foreground">
                  No tasks defined yet.{" "}
                  <button
                    className="text-primary underline"
                    onClick={() => setAddingToSection("__none__")}
                  >
                    Add your first task
                  </button>
                </CardContent>
              </Card>
              {addingToSection === "__none__" && (
                <AddTaskInline
                  value={newTaskTitle}
                  onChange={setNewTaskTitle}
                  onAdd={() => handleAddTask(null)}
                  onCancel={() => { setAddingToSection(null); setNewTaskTitle(""); }}
                  loading={addTaskMutation.isPending}
                />
              )}
            </div>
          )}

          {/* Section groups */}
          {sections.map((section) => {
            const sectionTemplateTasks = templateTasks.filter(
              (t) => (t.section ?? "General") === section.name
            );
            const sectionCustomTasks = customTasks.filter(
              (t) => (t.section ?? "General") === section.name
            );

            return (
              <div key={section.name} className="space-y-3">
                <h3 className="text-lg font-semibold text-foreground border-b border-border pb-2">
                  {section.name}
                </h3>

                {/* Template tasks */}
                {sectionTemplateTasks.map((task) => {
                  const isComplete = completedTemplateIds.has(task.id);
                  return (
                    <Card
                      key={`t-${task.id}`}
                      className={`cursor-pointer transition-all hover:border-primary/50 ${isComplete ? "opacity-60" : ""}`}
                      onClick={() => toggleTemplate(task.id)}
                    >
                      <CardHeader className="py-4">
                        <div className="flex items-start gap-3">
                          <div className={`w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0 ${
                            isComplete ? "bg-green-600/20 text-green-400" : "bg-primary/20 text-primary"
                          }`}>
                            {isComplete ? <CheckCircle2 className="w-4 h-4" /> : getTaskIcon(task.type)}
                          </div>
                          <div className="flex-1 min-w-0">
                            <CardTitle className="text-base">{task.title}</CardTitle>
                            {task.description && (
                              <CardDescription className="text-sm mt-0.5">{task.description}</CardDescription>
                            )}
                          </div>
                          <Badge className={isComplete ? "bg-green-600 hover:bg-green-500" : ""} variant={isComplete ? "default" : "outline"}>
                            {isComplete ? "Complete" : "Pending"}
                          </Badge>
                        </div>
                      </CardHeader>
                    </Card>
                  );
                })}

                {/* Custom tasks */}
                {sectionCustomTasks.map((task) => {
                  const isComplete = !!task.isComplete;
                  return (
                    <Card
                      key={`c-${task.id}`}
                      className={`transition-all hover:border-primary/50 ${isComplete ? "opacity-60" : ""}`}
                    >
                      <CardHeader className="py-4">
                        <div className="flex items-start gap-3">
                          <button
                            className={`w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0 cursor-pointer ${
                              isComplete ? "bg-green-600/20 text-green-400" : "bg-primary/20 text-primary"
                            }`}
                            onClick={() => toggleTaskMutation.mutate({ taskId: task.id })}
                            disabled={toggleTaskMutation.isPending}
                            title={isComplete ? "Mark incomplete" : "Mark complete"}
                          >
                            {isComplete ? <CheckCircle2 className="w-4 h-4" /> : <Circle className="w-4 h-4" />}
                          </button>
                          <div className="flex-1 min-w-0">
                            <CardTitle className="text-base">{task.title}</CardTitle>
                            {task.description && (
                              <CardDescription className="text-sm mt-0.5">{task.description}</CardDescription>
                            )}
                            <span className="text-[11px] text-muted-foreground/60 mt-1 block">Your task</span>
                          </div>
                          <div className="flex items-center gap-2 flex-shrink-0">
                            <Badge className={isComplete ? "bg-green-600 hover:bg-green-500" : ""} variant={isComplete ? "default" : "outline"}>
                              {isComplete ? "Complete" : "Pending"}
                            </Badge>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                deleteTaskMutation.mutate({ taskId: task.id });
                              }}
                              disabled={deleteTaskMutation.isPending}
                              className="text-muted-foreground hover:text-destructive transition-colors p-1 rounded"
                              title="Remove task"
                            >
                              <X className="w-4 h-4" />
                            </button>
                          </div>
                        </div>
                      </CardHeader>
                    </Card>
                  );
                })}

                {/* Inline add-task form for this section */}
                {addingToSection === section.name ? (
                  <AddTaskInline
                    value={newTaskTitle}
                    onChange={setNewTaskTitle}
                    onAdd={() => handleAddTask(section.name === "General" ? null : section.name)}
                    onCancel={() => { setAddingToSection(null); setNewTaskTitle(""); }}
                    loading={addTaskMutation.isPending}
                  />
                ) : (
                  <button
                    className="flex items-center gap-2 text-sm text-muted-foreground hover:text-primary transition-colors py-1 px-2 rounded hover:bg-primary/5 w-full text-left"
                    onClick={() => { setAddingToSection(section.name); setNewTaskTitle(""); }}
                  >
                    <Plus className="w-4 h-4" />
                    Add task to {section.name}
                  </button>
                )}
              </div>
            );
          })}
        </div>

        {/* Help */}
        <Card className="mt-8 border-primary/30">
          <CardHeader>
            <CardTitle className="text-lg">Need Help?</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground mb-4">
              If you have questions about any of these tasks or need assistance, please contact our support team.
            </p>
            <Button variant="outline" asChild>
              <a href="mailto:support@newlantern.ai">Contact Support</a>
            </Button>
          </CardContent>
        </Card>
      </div>

      <footer className="border-t border-border py-6 mt-12">
        <div className="container text-center text-sm text-muted-foreground">
          <p>New Lantern ©</p>
        </div>
      </footer>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Inline add-task form component
// ---------------------------------------------------------------------------

function AddTaskInline({
  value,
  onChange,
  onAdd,
  onCancel,
  loading,
}: {
  value: string;
  onChange: (v: string) => void;
  onAdd: () => void;
  onCancel: () => void;
  loading: boolean;
}) {
  return (
    <div className="flex items-center gap-2 rounded-lg border border-primary/30 bg-card px-3 py-2">
      <Input
        autoFocus
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="Task title…"
        className="border-0 shadow-none focus-visible:ring-0 flex-1 h-8 p-0"
        onKeyDown={(e) => {
          if (e.key === "Enter") onAdd();
          if (e.key === "Escape") onCancel();
        }}
      />
      <Button size="sm" onClick={onAdd} disabled={!value.trim() || loading} className="h-7 px-3">
        {loading ? <Loader2 className="w-3 h-3 animate-spin" /> : "Add"}
      </Button>
      <button onClick={onCancel} className="text-muted-foreground hover:text-foreground p-1">
        <X className="w-4 h-4" />
      </button>
    </div>
  );
}

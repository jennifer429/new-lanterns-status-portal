import { useState } from "react";
import { useAuth } from "@/_core/hooks/useAuth";
import { trpc } from "@/lib/trpc";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Plus, Edit, ListChecks } from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import type { SharedAdminProps, Client } from "./types";

type TaskTemplatesTabProps = Pick<SharedAdminProps, "isPlatformAdmin" | "clients">;

export function TaskTemplatesTab({ isPlatformAdmin, clients }: TaskTemplatesTabProps) {
  const { user } = useAuth();

  // Task template management state
  const [isCreateTaskDialogOpen, setIsCreateTaskDialogOpen] = useState(false);
  const [newTaskClientId, setNewTaskClientId] = useState<number | undefined>();
  const [newTaskTitle, setNewTaskTitle] = useState("");
  const [newTaskDescription, setNewTaskDescription] = useState("");
  const [newTaskType, setNewTaskType] = useState<"upload" | "schedule" | "form" | "review">("review");
  const [newTaskSection, setNewTaskSection] = useState("");
  const [newTaskSortOrder, setNewTaskSortOrder] = useState(0);
  const [isEditTaskDialogOpen, setIsEditTaskDialogOpen] = useState(false);
  const [editTaskId, setEditTaskId] = useState<number | null>(null);
  const [editTaskTitle, setEditTaskTitle] = useState("");
  const [editTaskDescription, setEditTaskDescription] = useState("");
  const [editTaskType, setEditTaskType] = useState<"upload" | "schedule" | "form" | "review">("review");
  const [editTaskSection, setEditTaskSection] = useState("");
  const [editTaskSortOrder, setEditTaskSortOrder] = useState(0);

  const { data: taskTemplates, refetch: refetchTaskTemplates } = trpc.admin.getTaskTemplates.useQuery();
  const { data: orgCustomTasksForPartner, refetch: refetchOrgCustomTasks } =
    trpc.admin.getOrgCustomTasksForPartner.useQuery();

  const createTaskMutation = trpc.admin.createTaskTemplate.useMutation({
    onSuccess: () => {
      toast.success("Task created!");
      setIsCreateTaskDialogOpen(false);
      setNewTaskTitle(""); setNewTaskDescription(""); setNewTaskSection(""); setNewTaskSortOrder(0); setNewTaskClientId(undefined);
      refetchTaskTemplates();
    },
    onError: (error: any) => toast.error(error.message || "Failed to create task"),
  });

  const updateTaskMutation = trpc.admin.updateTaskTemplate.useMutation({
    onSuccess: () => {
      toast.success("Task updated!");
      setIsEditTaskDialogOpen(false);
      refetchTaskTemplates();
    },
    onError: (error: any) => toast.error(error.message || "Failed to update task"),
  });

  const deleteTaskMutation = trpc.admin.deleteTaskTemplate.useMutation({
    onSuccess: () => { toast.success("Task deleted!"); refetchTaskTemplates(); },
    onError: (error: any) => toast.error(error.message || "Failed to delete task"),
  });

  const promoteMutation = trpc.admin.promoteCustomTaskToTemplate.useMutation({
    onSuccess: () => {
      toast.success("Task promoted to template — it will now appear for all active sites.");
      refetchTaskTemplates();
      refetchOrgCustomTasks();
    },
    onError: (error: any) => toast.error(error.message || "Failed to promote task"),
  });

  const handleCreateTask = () => {
    const effectiveClientId = isPlatformAdmin ? newTaskClientId : user?.clientId;
    if (!newTaskTitle || !effectiveClientId) { toast.error("Title and partner are required"); return; }
    createTaskMutation.mutate({ clientId: effectiveClientId, title: newTaskTitle, description: newTaskDescription || undefined, type: newTaskType, section: newTaskSection || undefined, sortOrder: newTaskSortOrder });
  };

  const handleEditTask = (task: NonNullable<typeof taskTemplates>[0]) => {
    setEditTaskId(task.id);
    setEditTaskTitle(task.title);
    setEditTaskDescription(task.description ?? "");
    setEditTaskType(task.type as "upload" | "schedule" | "form" | "review");
    setEditTaskSection(task.section ?? "");
    setEditTaskSortOrder(task.sortOrder);
    setIsEditTaskDialogOpen(true);
  };

  const handleUpdateTask = () => {
    if (!editTaskId || !editTaskTitle) { toast.error("Title is required"); return; }
    updateTaskMutation.mutate({ id: editTaskId, title: editTaskTitle, description: editTaskDescription || undefined, type: editTaskType, section: editTaskSection || undefined, sortOrder: editTaskSortOrder });
  };

  return (
    <>
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-2xl font-bold">Task Templates ({taskTemplates?.length || 0})</h2>
              <Dialog open={isCreateTaskDialogOpen} onOpenChange={setIsCreateTaskDialogOpen}>
                <DialogTrigger asChild>
                  <Button className="gap-2"><Plus className="w-4 h-4" />Add Task</Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Add Task Template</DialogTitle>
                    <DialogDescription>Create a task that organizations under this partner must complete.</DialogDescription>
                  </DialogHeader>
                  <div className="space-y-4 mt-4">
                    {isPlatformAdmin ? (
                      <div className="space-y-2">
                        <Label>Partner <span className="text-destructive">*</span></Label>
                        <Select value={newTaskClientId?.toString() || ""} onValueChange={v => setNewTaskClientId(parseInt(v))}>
                          <SelectTrigger><SelectValue placeholder="Select partner" /></SelectTrigger>
                          <SelectContent>{clients?.map(c => <SelectItem key={c.id} value={c.id.toString()}>{c.name}</SelectItem>)}</SelectContent>
                        </Select>
                      </div>
                    ) : (
                      <div className="space-y-2">
                        <Label>Partner</Label>
                        <Input value={clients?.find(c => c.id === user?.clientId)?.name || "Your Partner"} disabled />
                      </div>
                    )}
                    <div className="space-y-2">
                      <Label>Title <span className="text-destructive">*</span></Label>
                      <Input placeholder="e.g., Upload network diagram" value={newTaskTitle} onChange={e => setNewTaskTitle(e.target.value)} />
                    </div>
                    <div className="space-y-2">
                      <Label>Description</Label>
                      <Input placeholder="Instructions for completing this task" value={newTaskDescription} onChange={e => setNewTaskDescription(e.target.value)} />
                    </div>
                    <div className="space-y-2">
                      <Label>Type</Label>
                      <Select value={newTaskType} onValueChange={v => setNewTaskType(v as typeof newTaskType)}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="upload">Upload</SelectItem>
                          <SelectItem value="form">Form</SelectItem>
                          <SelectItem value="schedule">Schedule</SelectItem>
                          <SelectItem value="review">Review</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label>Section / Category</Label>
                      <Input placeholder="e.g., Security & Permissions" value={newTaskSection} onChange={e => setNewTaskSection(e.target.value)} />
                    </div>
                    <div className="space-y-2">
                      <Label>Sort Order</Label>
                      <Input type="number" value={newTaskSortOrder} onChange={e => setNewTaskSortOrder(parseInt(e.target.value) || 0)} />
                    </div>
                    <Button onClick={handleCreateTask} disabled={createTaskMutation.isPending} className="w-full">
                      {createTaskMutation.isPending ? "Creating..." : "Create Task"}
                    </Button>
                  </div>
                </DialogContent>
              </Dialog>
            </div>

            <Dialog open={isEditTaskDialogOpen} onOpenChange={setIsEditTaskDialogOpen}>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Edit Task Template</DialogTitle>
                  <DialogDescription>Update this task's details.</DialogDescription>
                </DialogHeader>
                <div className="space-y-4 mt-4">
                  <div className="space-y-2"><Label>Title <span className="text-destructive">*</span></Label><Input value={editTaskTitle} onChange={e => setEditTaskTitle(e.target.value)} /></div>
                  <div className="space-y-2"><Label>Description</Label><Input value={editTaskDescription} onChange={e => setEditTaskDescription(e.target.value)} /></div>
                  <div className="space-y-2">
                    <Label>Type</Label>
                    <Select value={editTaskType} onValueChange={v => setEditTaskType(v as typeof editTaskType)}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="upload">Upload</SelectItem>
                        <SelectItem value="form">Form</SelectItem>
                        <SelectItem value="schedule">Schedule</SelectItem>
                        <SelectItem value="review">Review</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2"><Label>Section / Category</Label><Input value={editTaskSection} onChange={e => setEditTaskSection(e.target.value)} /></div>
                  <div className="space-y-2"><Label>Sort Order</Label><Input type="number" value={editTaskSortOrder} onChange={e => setEditTaskSortOrder(parseInt(e.target.value) || 0)} /></div>
                  <div className="flex gap-2">
                    <Button onClick={handleUpdateTask} disabled={updateTaskMutation.isPending} className="flex-1">
                      {updateTaskMutation.isPending ? "Saving..." : "Save Changes"}
                    </Button>
                    <Button variant="outline" onClick={() => setIsEditTaskDialogOpen(false)}>Cancel</Button>
                  </div>
                </div>
              </DialogContent>
            </Dialog>

            {(!taskTemplates || taskTemplates.length === 0) && (
              <Card className="border-dashed">
                <CardContent className="py-12 text-center text-muted-foreground">
                  No task templates yet. Click "Add Task" to create your first one.
                </CardContent>
              </Card>
            )}
            <div className="space-y-3">
              {taskTemplates?.map(task => (
                <Card key={task.id}>
                  <CardContent className="py-4 flex items-center justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      {isPlatformAdmin && (
                        <p className="text-xs text-muted-foreground mb-0.5">{task.clientName || `Client #${task.clientId}`}</p>
                      )}
                      <p className="font-medium truncate">{task.title}</p>
                      {task.description && <p className="text-xs text-muted-foreground truncate">{task.description}</p>}
                      <div className="flex gap-2 mt-1">
                        <Badge variant="outline" className="capitalize text-xs">{task.type}</Badge>
                        {task.section && <Badge variant="outline" className="text-xs">{task.section}</Badge>}
                        <span className="text-xs text-muted-foreground">Order: {task.sortOrder}</span>
                      </div>
                    </div>
                    <div className="flex gap-2 flex-shrink-0">
                      <Button size="sm" variant="outline" onClick={() => handleEditTask(task)}>
                        <Edit className="w-3 h-3 mr-1" />Edit
                      </Button>
                      <Button size="sm" variant="outline" className="text-destructive hover:bg-destructive/10"
                        onClick={() => { if (confirm(`Delete task "${task.title}"?`)) deleteTaskMutation.mutate({ id: task.id }); }}
                        disabled={deleteTaskMutation.isPending}>Delete</Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>

            {/* Org-added custom tasks — partner can promote any to their template */}
            {orgCustomTasksForPartner && orgCustomTasksForPartner.length > 0 && (
              <div className="mt-10">
                <div className="mb-4">
                  <h3 className="text-lg font-semibold">Site-Added Tasks</h3>
                  <p className="text-sm text-muted-foreground mt-0.5">
                    Tasks added by individual sites. Promote any to your template to push it to all active implementations.
                  </p>
                </div>
                <div className="space-y-3">
                  {orgCustomTasksForPartner.map((task) => (
                    <Card key={task.id} className="border-dashed">
                      <CardContent className="py-4 flex items-center justify-between gap-4">
                        <div className="flex-1 min-w-0">
                          <p className="text-xs text-muted-foreground mb-0.5">{task.orgName}</p>
                          <p className="font-medium truncate">{task.title}</p>
                          {task.description && (
                            <p className="text-xs text-muted-foreground truncate">{task.description}</p>
                          )}
                          <div className="flex gap-2 mt-1">
                            <Badge variant="outline" className="capitalize text-xs">{task.type}</Badge>
                            {task.section && <Badge variant="outline" className="text-xs">{task.section}</Badge>}
                            <Badge variant={task.isComplete ? "default" : "outline"} className={cn("text-xs", task.isComplete ? "bg-green-600" : "")}>
                              {task.isComplete ? "Done at site" : "Pending"}
                            </Badge>
                          </div>
                        </div>
                        <Button
                          size="sm"
                          variant="outline"
                          className="flex-shrink-0 gap-1.5"
                          disabled={promoteMutation.isPending}
                          onClick={() => {
                            if (confirm(`Promote "${task.title}" to your template? It will appear for all active sites.`)) {
                              promoteMutation.mutate({ orgCustomTaskId: task.id });
                            }
                          }}
                        >
                          <ListChecks className="w-3 h-3" />
                          Promote to all sites
                        </Button>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </div>
            )}
    </>
  );
}

/**
 * Tetris-Inspired Implementation Portal
 * Design Principles:
 * - One clear "next task" (no overwhelming lists)
 * - Bite-sized tasks (10-15 min max)
 * - Visual completion = dopamine
 * - Explicit "you're done for today" moments
 * - Supportive language (not managerial)
 */

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { 
  CheckCircle2, 
  Circle,
  Clock,
  Lock,
  ChevronRight,
  PartyPopper,
  Coffee,
  ClipboardList
} from "lucide-react";
import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";
import { ProgressLogo } from "@/components/ProgressLogo";
import { useRoute, Link } from "wouter";
import { trpc } from "@/lib/trpc";
import { FileUpload } from "@/components/FileUpload";
import { FileList } from "@/components/FileList";
import { Separator } from "@/components/ui/separator";
import { ActivityFeed } from "@/components/ActivityFeed";

// Mock hospital data
const hospitalData = {
  name: "Memorial General Hospital",
  contactName: "Dr. Sarah Chen",
  goalDate: "March 1, 2026",
};

interface Task {
  id: string;
  originalTask: string;
  friendlyTask: string;
  section: string;
  owner: string;
  estimatedMinutes: number;
  completed?: boolean;
}

interface Level {
  id: number;
  name: string;
  emoji: string;
  description: string;
  color: string;
  tasks: Task[];
}

export default function Home() {
  const [, params] = useRoute("/org/:slug");
  const orgSlug = params?.slug || "demo"; // Default to demo org if no slug
  
  const [levels, setLevels] = useState<Level[]>([]);
  const [loading, setLoading] = useState(true);
  const [completedTasks, setCompletedTasks] = useState<Set<string>>(new Set());
  const [justCompleted, setJustCompleted] = useState<string | null>(null);
  const [organizationId, setOrganizationId] = useState<number | null>(null);
  
  // Fetch organization data
  const { data: organization, isLoading: orgLoading } = trpc.organizations.getBySlug.useQuery(
    { slug: orgSlug },
    { enabled: !!orgSlug }
  );
  
  // Fetch progress data
  const { data: progressData, isLoading: progressLoading } = trpc.organizations.getProgress.useQuery(
    { organizationId: organizationId! },
    { enabled: !!organizationId }
  );
  
  // Task completion mutation
  const completeTaskMutation = trpc.organizations.completeTask.useMutation();
  
  // Update organizationId when organization loads
  useEffect(() => {
    if (organization) {
      setOrganizationId(organization.id);
    }
  }, [organization]);

  // Load completed tasks from API when progress data loads
  useEffect(() => {
    if (progressData?.tasks) {
      const completed = new Set(
        progressData.tasks
          .filter(t => t.completed === 1)
          .map(t => t.taskId)
      );
      setCompletedTasks(completed);
    }
  }, [progressData]);

  useEffect(() => {
    // Load levels data
    fetch('/levels.json')
      .then(res => res.json())
      .then(data => {
        setLevels(data);
        setLoading(false);
      })
      .catch(err => {
        console.error('Failed to load levels:', err);
        setLoading(false);
      });
  }, []);

  // Find the next task to work on
  const getNextTask = (): { task: Task; level: Level } | null => {
    for (const level of levels) {
      const nextTask = level.tasks.find(t => !completedTasks.has(t.id));
      if (nextTask) {
        return { task: nextTask, level };
      }
    }
    return null;
  };

  // Calculate progress
  // Calculate achievement tier based on progress and speed
  const getAchievementTier = () => {
    const progress = calculateProgress();
    const tasksCompleted = completedTasks.size;
    
    // Mock: assume 30 days total, calculate days elapsed based on tasks
    // In production, this would use actual dates
    const totalTasks = levels.reduce((sum, level) => sum + level.tasks.length, 0);
    const daysElapsed = Math.round((tasksCompleted / totalTasks) * 30);
    const expectedDays = Math.round((tasksCompleted / totalTasks) * 30);
    
    if (progress === 100 && daysElapsed <= 30) {
      return { tier: "Implementation Champion", icon: "⭐", color: "text-yellow-400" };
    } else if (progress >= 50 && daysElapsed < expectedDays - 7) {
      return { tier: "Implementation Hero", icon: "🔥", color: "text-orange-400" };
    } else if (progress >= 25 && daysElapsed < expectedDays - 3) {
      return { tier: "Rock Star Pace", icon: "⚡", color: "text-primary" };
    }
    return { tier: "On Track", icon: "✓", color: "text-primary" };
  };

  const calculateProgress = () => {
    const totalTasks = levels.reduce((sum, level) => sum + level.tasks.length, 0);
    const completed = completedTasks.size;
    return totalTasks > 0 ? Math.round((completed / totalTasks) * 100) : 0;
  };

  // Calculate level progress
  const getLevelProgress = (level: Level) => {
    const levelTasks = level.tasks.length;
    const levelCompleted = level.tasks.filter(t => completedTasks.has(t.id)).length;
    return levelTasks > 0 ? Math.round((levelCompleted / levelTasks) * 100) : 0;
  };

  // Check if level is unlocked
  const isLevelUnlocked = (levelId: number) => {
    if (levelId === 1) return true; // First level always unlocked
    const previousLevel = levels.find(l => l.id === levelId - 1);
    if (!previousLevel) return false;
    return getLevelProgress(previousLevel) === 100;
  };

  // Check if we're done for today (completed at least 3 tasks or 30 min of work)
  const isDoneForToday = () => {
    return completedTasks.size >= 3;
  };

  // Handle task completion
  const completeTask = async (taskId: string, sectionName: string) => {
    if (!organizationId) return;
    
    // Optimistically update UI
    setCompletedTasks(prev => new Set(Array.from(prev).concat(taskId)));
    setJustCompleted(taskId);
    
    // Save to database
    try {
      await completeTaskMutation.mutateAsync({
        organizationId,
        sectionName,
        taskId,
        completed: true,
      });
    } catch (error) {
      console.error('Failed to save task completion:', error);
      // Rollback on error
      setCompletedTasks(prev => {
        const newSet = new Set(prev);
        newSet.delete(taskId);
        return newSet;
      });
    }
    
    // Clear animation after 1 second
    setTimeout(() => setJustCompleted(null), 1000);
  };

  const nextTaskInfo = getNextTask();
  const overallProgress = calculateProgress();
  const doneForToday = isDoneForToday();
  const achievementTier = getAchievementTier();

  // Use organization data if available, otherwise use defaults
  const hospitalData = {
    name: organization?.name || "Memorial General Hospital",
    contactName: organization?.contactName || "Dr. Sarah Chen",
    goalDate: organization?.goalDate || "March 1, 2026",
  };

  if (loading || orgLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">Loading your onboarding journey...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border bg-card/50 backdrop-blur-sm sticky top-0 z-10">
        <div className="container py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <img src="/images/new-lantern-logo.png" alt="New Lantern" className="h-8" />
              <div>
                <h1 className="text-xl font-bold text-foreground">Implementation Portal</h1>
                <p className="text-xs text-muted-foreground">PACS Onboarding & Configuration</p>
              </div>
            </div>
            <div className="flex items-center gap-4">
              <Link href={`/org/${orgSlug}/intake`}>
                <Button variant="outline" className="gap-2">
                  <ClipboardList className="w-4 h-4" />
                  Complete Intake Form
                </Button>
              </Link>
              <div className="text-right">
                <p className="text-sm font-medium text-foreground">{hospitalData.name}</p>
                <p className="text-xs text-muted-foreground">Goal: {hospitalData.goalDate}</p>
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <div className="container py-8">
        {/* Overall Progress with Achievement Badge */}
        <Card className="border-primary/20">
          <CardContent className="pt-6">
            <div className="flex items-center gap-6 mb-4">
              {/* Progress Logo Badge */}
              <div className="flex-shrink-0">
                <ProgressLogo 
                  progress={overallProgress} 
                  size={80} 
                  showGlow={overallProgress === 100}
                />
              </div>
              
              <div className="flex-1">
                <div className="flex items-center justify-between mb-2">
                  <div>
                    <h2 className="text-2xl font-bold">{overallProgress}% Complete</h2>
                    <p className="text-sm text-muted-foreground">{completedTasks.size} tasks done</p>
                  </div>
                  {doneForToday && (
                    <div className="flex items-center gap-2 px-4 py-2 rounded-full bg-primary/10 border border-primary/30 animate-pulse">
                      <PartyPopper className="w-5 h-5 text-primary" />
                      <span className="text-sm font-medium text-primary">Wow! You're crushing this! 🔥</span>
                    </div>
                  )}
                </div>
                <Progress value={overallProgress} className="h-3 mb-3" />
                
                {/* Achievement Tier */}
                <div className="flex items-center gap-2">
                  <span className={cn("text-lg", achievementTier.color)}>{achievementTier.icon}</span>
                  <span className={cn("text-sm font-semibold", achievementTier.color)}>
                    {achievementTier.tier}
                  </span>
                  {achievementTier.tier !== "On Track" && (
                    <span className="text-xs text-muted-foreground ml-2">
                      • Keep this pace!
                    </span>
                  )}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="grid grid-cols-1 lg:grid-cols-[2fr_1fr] gap-8">
          {/* Left: Next Task */}
          <div className="space-y-6">
            {nextTaskInfo ? (
              <>
                {/* Next Task Card - Prominent */}
                <Card className="border-2 border-primary shadow-lg">
                  <CardHeader>
                    <div className="flex items-center gap-3 mb-2">
                      <div className="text-4xl">{nextTaskInfo.level.emoji}</div>
                      <div>
                        <CardTitle className="text-2xl">Next: {nextTaskInfo.task.friendlyTask}</CardTitle>
                        <CardDescription className="text-base mt-1">
                          Level {nextTaskInfo.level.id}: {nextTaskInfo.level.name} • {nextTaskInfo.task.estimatedMinutes} min
                        </CardDescription>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <Clock className="w-4 h-4" />
                        <span>This should take about {nextTaskInfo.task.estimatedMinutes} minutes</span>
                      </div>
                      
                      <div className="p-4 rounded-lg bg-muted/30">
                        <p className="text-sm font-medium mb-2">What you'll do:</p>
                        <p className="text-sm text-muted-foreground">{nextTaskInfo.task.originalTask}</p>
                      </div>

                      {organizationId && (
                        <>
                          <Separator className="my-4" />
                          
                          <div className="space-y-3">
                            <p className="text-sm font-medium">Attachments</p>
                            <FileList 
                              organizationId={organizationId}
                              taskId={nextTaskInfo.task.id}
                            />
                            <FileUpload
                              organizationId={organizationId}
                              taskId={nextTaskInfo.task.id}
                              taskName={nextTaskInfo.task.friendlyTask}
                              clickupListId={organization?.clickupListId || undefined}
                              linearIssueId={organization?.linearIssueId || undefined}
                              onUploadComplete={() => {
                                // Refetch files list
                              }}
                            />
                          </div>

                          <Separator className="my-4" />
                        </>
                      )}

                      <Button 
                        size="lg" 
                        className={cn(
                          "w-full transition-all",
                          justCompleted === nextTaskInfo.task.id && "animate-pulse bg-primary/80"
                        )}
                        onClick={() => completeTask(nextTaskInfo.task.id, nextTaskInfo.task.section)}
                      >
                        <CheckCircle2 className="w-5 h-5 mr-2" />
                        Mark as Complete
                      </Button>
                    </div>
                  </CardContent>
                </Card>

                {/* Done for Today Message */}
                {doneForToday && (
                  <Card className="border-primary/30 bg-gradient-to-br from-primary/10 to-primary/5">
                    <CardContent className="pt-6">
                      <div className="flex items-start gap-4">
                        <PartyPopper className="w-8 h-8 text-primary flex-shrink-0" />
                        <div>
                          <h3 className="font-semibold text-xl mb-2">🎉 You're crushing this!</h3>
                          <p className="text-sm text-muted-foreground mb-3">
                            You've completed {completedTasks.size} tasks today—you're running <strong>ahead of schedule</strong>. 
                            You're faster than 73% of other teams at this stage!
                          </p>
                          <div className="flex items-center gap-2 mb-3">
                            <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
                              <div className="h-full bg-primary w-[73%]"></div>
                            </div>
                            <span className="text-xs font-bold text-primary">73%</span>
                          </div>
                          <p className="text-xs text-muted-foreground">
                            💡 Feel free to keep going, or take a break—you've earned it. Your progress is saved.
                          </p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                )}
              </>
            ) : (
              <Card className="border-primary/30 bg-gradient-to-br from-primary/10 to-primary/5">
                <CardContent className="pt-12 pb-12 text-center">
                  <PartyPopper className="w-16 h-16 text-primary mx-auto mb-4" />
                  <h2 className="text-3xl font-bold mb-2">All Done!</h2>
                  <p className="text-muted-foreground">
                    You've completed all onboarding tasks. We'll be in touch about next steps.
                  </p>
                </CardContent>
              </Card>
            )}
          </div>

          {/* Right: Level Overview */}
          <div className="space-y-4">
            <h3 className="font-semibold text-lg">Your Journey</h3>
            {levels.map((level) => {
              const progress = getLevelProgress(level);
              const unlocked = isLevelUnlocked(level.id);
              const isComplete = progress === 100;
              const isCurrent = nextTaskInfo?.level.id === level.id;

              return (
                <Card 
                  key={level.id} 
                  className={`transition-all ${
                    isCurrent ? 'border-primary border-2 shadow-md' : ''
                  } ${!unlocked ? 'opacity-50' : ''}`}
                >
                  <CardContent className="pt-6">
                    <div className="flex items-start gap-3">
                      <div className="text-3xl flex-shrink-0">{level.emoji}</div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <h4 className="font-semibold">Level {level.id}: {level.name}</h4>
                          {!unlocked && <Lock className="w-4 h-4 text-muted-foreground" />}
                          {isComplete && <CheckCircle2 className="w-4 h-4 text-primary" />}
                        </div>
                        <p className="text-xs text-muted-foreground mb-3">{level.description}</p>
                        
                        {unlocked && (
                          <>
                            <Progress value={progress} className="h-2 mb-2" />
                            <div className="flex items-center justify-between text-xs text-muted-foreground">
                              <span>{level.tasks.filter(t => completedTasks.has(t.id)).length} of {level.tasks.length} tasks</span>
                              <span>{progress}%</span>
                            </div>
                          </>
                        )}
                        
                        {!unlocked && (
                          <p className="text-xs text-muted-foreground italic">
                            Complete Level {level.id - 1} to unlock
                          </p>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}

            {/* Activity Feed */}
            {organizationId && (
              <ActivityFeed organizationId={organizationId} />
            )}

            {/* Help Card */}
            <Card className="bg-muted/30">
              <CardContent className="pt-6">
                <h4 className="font-semibold text-sm mb-2">Need Help?</h4>
                <p className="text-xs text-muted-foreground mb-3">
                  Stuck on a task? That's totally normal. We're here to help.
                </p>
                <Button variant="outline" size="sm" className="w-full">
                  <ChevronRight className="w-4 h-4 mr-2" />
                  Contact Your PM
                </Button>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}

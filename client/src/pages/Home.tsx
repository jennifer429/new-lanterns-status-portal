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
  Coffee
} from "lucide-react";
import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";

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
  const [levels, setLevels] = useState<Level[]>([]);
  const [loading, setLoading] = useState(true);
  const [completedTasks, setCompletedTasks] = useState<Set<string>>(new Set());
  const [justCompleted, setJustCompleted] = useState<string | null>(null);

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
  const completeTask = (taskId: string) => {
    setCompletedTasks(prev => new Set(Array.from(prev).concat(taskId)));
    setJustCompleted(taskId);
    // Clear animation after 1 second
    setTimeout(() => setJustCompleted(null), 1000);
  };

  const nextTaskInfo = getNextTask();
  const overallProgress = calculateProgress();
  const doneForToday = isDoneForToday();

  if (loading) {
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
            <div className="text-right">
              <p className="text-sm font-medium text-foreground">{hospitalData.name}</p>
              <p className="text-xs text-muted-foreground">Goal: {hospitalData.goalDate}</p>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <div className="container py-8">
        {/* Overall Progress */}
        <Card className="mb-8 border-primary/30">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="text-2xl font-bold">{overallProgress}% Complete</h2>
                <p className="text-sm text-muted-foreground">{completedTasks.size} tasks done</p>
              </div>
              {doneForToday && (
                <div className="flex items-center gap-2 px-4 py-2 rounded-full bg-primary/10 border border-primary/30">
                  <Coffee className="w-5 h-5 text-primary" />
                  <span className="text-sm font-medium text-primary">You're good to stop here!</span>
                </div>
              )}
            </div>
            <Progress value={overallProgress} className="h-3" />
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

                      <Button 
                        size="lg" 
                        className={cn(
                          "w-full transition-all",
                          justCompleted === nextTaskInfo.task.id && "animate-pulse bg-primary/80"
                        )}
                        onClick={() => completeTask(nextTaskInfo.task.id)}
                      >
                        <CheckCircle2 className="w-5 h-5 mr-2" />
                        Mark as Complete
                      </Button>
                    </div>
                  </CardContent>
                </Card>

                {/* Done for Today Message */}
                {doneForToday && (
                  <Card className="border-primary/30 bg-primary/5">
                    <CardContent className="pt-6">
                      <div className="flex items-start gap-4">
                        <PartyPopper className="w-8 h-8 text-primary flex-shrink-0" />
                        <div>
                          <h3 className="font-semibold text-lg mb-2">You're good to stop here</h3>
                          <p className="text-sm text-muted-foreground mb-3">
                            You've completed {completedTasks.size} tasks today. Nothing else is blocking progress. 
                            Feel free to continue if you'd like, or come back anytime.
                          </p>
                          <p className="text-xs text-muted-foreground">
                            💡 Tip: You can always pick up right where you left off.
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

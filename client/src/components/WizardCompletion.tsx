/**
 * Wizard Completion Screen
 * Shows when all steps are completed
 */

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { CheckCircle2, FileText, Calendar, ArrowRight } from "lucide-react";
import type { Task } from "@shared/wizard-data";

interface WizardCompletionProps {
  tasks: Task[];
  orgSlug: string;
  clientSlug: string;
}

export function WizardCompletion({ tasks, orgSlug, clientSlug }: WizardCompletionProps) {
  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-8">
      <div className="max-w-2xl w-full space-y-6">
        {/* Success Message */}
        <div className="text-center space-y-4">
          <div className="flex justify-center">
            <div className="w-20 h-20 rounded-full bg-primary/20 flex items-center justify-center">
              <CheckCircle2 className="w-12 h-12 text-primary" />
            </div>
          </div>
          <div>
            <h1 className="text-3xl font-bold text-foreground mb-2">Setup Complete!</h1>
            <p className="text-muted-foreground">
              You've completed the initial questionnaire. Your responses have been saved.
            </p>
          </div>
        </div>

        {/* Generated Tasks Summary */}
        <Card>
          <CardHeader>
            <CardTitle>Your Action Items</CardTitle>
            <CardDescription>
              Based on your responses, we've identified {tasks.length} task{tasks.length !== 1 ? 's' : ''} to complete
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {tasks.map(task => (
                <div key={task.id} className="p-4 rounded-lg border border-border bg-muted/30">
                  <div className="flex items-start gap-3">
                    <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center flex-shrink-0">
                      {task.type === 'upload' && <FileText className="w-4 h-4 text-primary" />}
                      {task.type === 'schedule' && <Calendar className="w-4 h-4 text-primary" />}
                      {task.type === 'form' && <FileText className="w-4 h-4 text-primary" />}
                      {task.type === 'review' && <CheckCircle2 className="w-4 h-4 text-primary" />}
                    </div>
                    <div className="flex-1">
                      <h3 className="font-semibold text-sm">{task.title}</h3>
                      {task.description && (
                        <p className="text-xs text-muted-foreground mt-1">{task.description}</p>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Next Steps */}
        <Card className="border-primary/30">
          <CardHeader>
            <CardTitle className="text-lg">What Happens Next?</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <div className="flex items-start gap-3">
              <div className="w-6 h-6 rounded-full bg-primary/20 flex items-center justify-center flex-shrink-0 mt-0.5">
                <span className="text-xs font-bold text-primary">1</span>
              </div>
              <p className="text-muted-foreground">
                Your responses will be reviewed by our implementation team
              </p>
            </div>
            <div className="flex items-start gap-3">
              <div className="w-6 h-6 rounded-full bg-primary/20 flex items-center justify-center flex-shrink-0 mt-0.5">
                <span className="text-xs font-bold text-primary">2</span>
              </div>
              <p className="text-muted-foreground">
                We'll reach out within 2 business days to discuss next steps
              </p>
            </div>
            <div className="flex items-start gap-3">
              <div className="w-6 h-6 rounded-full bg-primary/20 flex items-center justify-center flex-shrink-0 mt-0.5">
                <span className="text-xs font-bold text-primary">3</span>
              </div>
              <p className="text-muted-foreground">
                Complete the action items listed above to keep your implementation on track
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Actions */}
        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <Button variant="outline" size="lg" asChild>
            <a href={`/org/${clientSlug}/${orgSlug}`}>
              Back to Dashboard
            </a>
          </Button>
          <Button size="lg" asChild>
            <a href={`/org/${clientSlug}/${orgSlug}/tasks`}>
              View All Tasks
              <ArrowRight className="w-4 h-4 ml-2" />
            </a>
          </Button>
        </div>

        {/* Support */}
        <div className="text-center text-sm text-muted-foreground">
          <p>
            Questions? Contact us at{" "}
            <a href="mailto:support@newlantern.ai" className="text-primary hover:underline">
              support@newlantern.ai
            </a>
          </p>
        </div>
      </div>
    </div>
  );
}

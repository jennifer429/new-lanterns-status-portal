import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { MessageSquare, Clock, Reply, Send } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { useState } from "react";

interface ActivityFeedProps {
  organizationId: number;
}

export function ActivityFeed({ organizationId }: ActivityFeedProps) {
  const [replyText, setReplyText] = useState("");
  const [isReplying, setIsReplying] = useState(false);

  const { data: activities, isLoading } = trpc.organizations.getActivityFeed.useQuery({
    organizationId,
  });

  const utils = trpc.useUtils();
  const postReplyMutation = trpc.organizations.postReply.useMutation({
    onSuccess: () => {
      // Refresh activity feed
      utils.organizations.getActivityFeed.invalidate({ organizationId });
      setReplyText("");
      setIsReplying(false);
    },
  });

  const handlePostReply = () => {
    if (!replyText.trim()) return;
    postReplyMutation.mutate({
      organizationId,
      message: replyText,
    });
  };

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <MessageSquare className="w-5 h-5" />
            Team Updates
          </CardTitle>
          <CardDescription>Messages from your New Lantern team</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8 text-muted-foreground">
            Loading updates...
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!activities || activities.length === 0) {
    return (
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <MessageSquare className="w-5 h-5" />
                Team Updates
              </CardTitle>
              <CardDescription>Messages from your New Lantern team</CardDescription>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setIsReplying(!isReplying)}
              className="flex items-center gap-2"
            >
              <Reply className="w-4 h-4" />
              Reply
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {/* Reply Form */}
          {isReplying && (
            <div className="mb-4 p-4 rounded-lg border border-primary/30 bg-primary/5">
              <h4 className="text-sm font-semibold mb-2">Send Message to Team</h4>
              <Textarea
                placeholder="Type your message here..."
                value={replyText}
                onChange={(e) => setReplyText(e.target.value)}
                className="mb-2"
                rows={3}
              />
              <div className="flex items-center gap-2">
                <Button
                  onClick={handlePostReply}
                  disabled={!replyText.trim() || postReplyMutation.isPending}
                  size="sm"
                >
                  <Send className="w-4 h-4 mr-2" />
                  {postReplyMutation.isPending ? "Sending..." : "Send Message"}
                </Button>
                <Button
                  variant="outline"
                  onClick={() => {
                    setIsReplying(false);
                    setReplyText("");
                  }}
                  size="sm"
                >
                  Cancel
                </Button>
              </div>
              {postReplyMutation.isError && (
                <p className="text-sm text-red-400 mt-2">
                  Error: {postReplyMutation.error.message}
                </p>
              )}
            </div>
          )}

          <div className="text-center py-8 text-muted-foreground">
            No updates yet. Your team will post updates here as your implementation progresses.
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <MessageSquare className="w-5 h-5" />
              Team Updates
            </CardTitle>
            <CardDescription>Messages from your New Lantern team</CardDescription>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setIsReplying(!isReplying)}
            className="flex items-center gap-2"
          >
            <Reply className="w-4 h-4" />
            Reply
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {/* Reply Form */}
        {isReplying && (
          <div className="mb-4 p-4 rounded-lg border border-primary/30 bg-primary/5">
            <h4 className="text-sm font-semibold mb-2">Send Message to Team</h4>
            <Textarea
              placeholder="Type your message here..."
              value={replyText}
              onChange={(e) => setReplyText(e.target.value)}
              className="mb-2"
              rows={3}
            />
            <div className="flex items-center gap-2">
              <Button
                onClick={handlePostReply}
                disabled={!replyText.trim() || postReplyMutation.isPending}
                size="sm"
              >
                <Send className="w-4 h-4 mr-2" />
                {postReplyMutation.isPending ? "Sending..." : "Send Message"}
              </Button>
              <Button
                variant="outline"
                onClick={() => {
                  setIsReplying(false);
                  setReplyText("");
                }}
                size="sm"
              >
                Cancel
              </Button>
            </div>
            {postReplyMutation.isError && (
              <p className="text-sm text-red-400 mt-2">
                Error: {postReplyMutation.error.message}
              </p>
            )}
          </div>
        )}

        <div className="space-y-4">
          {activities.map((activity) => {
            const date = new Date(activity.createdAt);
            const timeAgo = getTimeAgo(date);

            return (
              <div
                key={activity.id}
                className="p-4 rounded-lg border border-border bg-card/50 hover:bg-card transition-colors"
              >
                <div className="flex items-start justify-between gap-3 mb-2">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-sm">{activity.author}</span>
                    <Badge
                      variant="outline"
                      className={
                        activity.source === "linear"
                          ? "bg-blue-500/10 text-blue-400 border-blue-500/30"
                          : activity.source === "clickup"
                          ? "bg-purple-500/10 text-purple-400 border-purple-500/30"
                          : "bg-green-500/10 text-green-400 border-green-500/30"
                      }
                    >
                      {activity.source === "linear" ? "Development" : activity.source === "clickup" ? "PM Team" : "Client"}
                    </Badge>
                  </div>
                  <div className="flex items-center gap-1 text-xs text-muted-foreground">
                    <Clock className="w-3 h-3" />
                    {timeAgo}
                  </div>
                </div>
                <p className="text-sm text-foreground whitespace-pre-wrap">{activity.message}</p>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}

function getTimeAgo(date: Date): string {
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return "just now";
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  
  return date.toLocaleDateString();
}

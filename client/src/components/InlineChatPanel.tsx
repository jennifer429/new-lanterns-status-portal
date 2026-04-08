/**
 * InlineChatPanel — Always-visible AI chat panel for the top of dashboards.
 *
 * Unlike AdminChatWidget (floating overlay), this is an inline component
 * that sits in the page layout. It starts collapsed as a single-line bar
 * and expands to show the full chat when clicked or when a message is sent.
 *
 * Features:
 * - Compact bar with quick-ask input (collapsed state)
 * - Expandable full chat panel (expanded state)
 * - File upload for documents/images
 * - Role-aware suggested prompts
 * - Handles navigation actions from the server
 */

import { useState, useRef, useEffect } from "react";
import { useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import { AIChatBox, type Message } from "@/components/AIChatBox";
import { Button } from "@/components/ui/button";
import {
  Sparkles,
  ChevronDown,
  ChevronUp,
  Paperclip,
  Send,
  X,
  Loader2,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

type InlineChatPanelProps = {
  isPlatformAdmin?: boolean;
  orgSlug?: string;
};

const PLATFORM_ADMIN_PROMPTS = [
  "Show me organisations with no logins yet",
  "Generate a completion report",
  "Create a new organisation",
  "Which users haven't logged in?",
];

const PARTNER_ADMIN_PROMPTS = [
  "List all my organisations",
  "Who hasn't logged in yet?",
  "Create a new organisation for me",
  "Show my completion status",
];

const ORG_SCOPED_PROMPTS = [
  "What is the project status?",
  "Show me the questionnaire responses",
  "What tasks are still pending?",
  "Show the connectivity details",
  "What files have been uploaded?",
  "Show the validation test results",
];

export function InlineChatPanel({
  isPlatformAdmin = false,
  orgSlug,
}: InlineChatPanelProps) {
  const [, setLocation] = useLocation();
  const [isExpanded, setIsExpanded] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [quickInput, setQuickInput] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);
  const quickInputRef = useRef<HTMLInputElement>(null);
  const [pendingFile, setPendingFile] = useState<{
    name: string;
    data: string;
    type: string;
  } | null>(null);

  const chatMutation = trpc.ai.chat.useMutation({
    onSuccess: (response) => {
      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: response.message },
      ]);

      // Handle server-returned UI actions
      if (response.action) {
        if (response.action.type === "navigate") {
          setLocation(response.action.url);
        }
      }
    },
    onError: (err) => {
      toast.error(`AI error: ${err.message}`);
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: "Sorry, something went wrong. Please try again.",
        },
      ]);
    },
  });

  const handleSend = (content: string) => {
    if (!content.trim()) return;
    const userMessage: Message = { role: "user", content };
    const nextMessages = [...messages, userMessage];
    setMessages(nextMessages);

    // Auto-expand when sending a message
    if (!isExpanded) setIsExpanded(true);

    chatMutation.mutate({
      messages: nextMessages.filter((m) => m.role !== "system"),
      fileData: pendingFile?.data,
      fileType: pendingFile?.type,
      fileName: pendingFile?.name,
      orgSlug: orgSlug,
    });

    setPendingFile(null);
    setQuickInput("");
  };

  const handleQuickSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    handleSend(quickInput);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const maxSize = 5 * 1024 * 1024;
    if (file.size > maxSize) {
      toast.error("File too large (max 5MB)");
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = reader.result as string;
      const base64 = dataUrl.split(",")[1] ?? "";
      setPendingFile({ name: file.name, data: base64, type: file.type });
      toast.success(`File attached: ${file.name}`);
    };
    reader.readAsDataURL(file);
    e.target.value = "";
  };

  const suggestedPrompts = orgSlug
    ? ORG_SCOPED_PROMPTS
    : isPlatformAdmin
      ? PLATFORM_ADMIN_PROMPTS
      : PARTNER_ADMIN_PROMPTS;

  return (
    <div
      className={cn(
        "rounded-xl border border-border/60 bg-card/80 backdrop-blur-sm overflow-hidden transition-all duration-300",
        isExpanded ? "shadow-lg" : "shadow-sm"
      )}
    >
      {/* ── Collapsed bar: quick-ask input ── */}
      <div className="flex items-center gap-2 px-3 py-2">
        <div className="flex items-center gap-1.5 flex-shrink-0">
          <Sparkles className="w-4 h-4 text-primary" />
          <span className="text-xs font-semibold text-primary hidden sm:inline">
            AI Assistant
          </span>
        </div>

        {/* Quick input */}
        <form onSubmit={handleQuickSubmit} className="flex-1 flex items-center gap-1.5">
          <div className="relative flex-1">
            <input
              ref={quickInputRef}
              type="text"
              value={quickInput}
              onChange={(e) => setQuickInput(e.target.value)}
              onFocus={() => {
                if (messages.length > 0 && !isExpanded) setIsExpanded(true);
              }}
              placeholder={
                pendingFile
                  ? `Ask about ${pendingFile.name}...`
                  : "Ask anything..."
              }
              className="w-full h-7 px-2.5 text-xs rounded-md border border-border/50 bg-muted/20 focus:outline-none focus:ring-1 focus:ring-primary/50 focus:border-primary/50 placeholder:text-muted-foreground/60"
            />
            {pendingFile && (
              <div className="absolute right-1 top-1/2 -translate-y-1/2 flex items-center gap-0.5">
                <span className="text-[10px] text-primary truncate max-w-[80px]">
                  📎 {pendingFile.name}
                </span>
                <button
                  type="button"
                  onClick={() => setPendingFile(null)}
                  className="text-muted-foreground hover:text-destructive"
                >
                  <X className="w-3 h-3" />
                </button>
              </div>
            )}
          </div>

          {/* File attach */}
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-7 w-7 flex-shrink-0"
            title="Attach a file"
            onClick={() => fileInputRef.current?.click()}
          >
            <Paperclip className="w-3.5 h-3.5" />
          </Button>

          {/* Send */}
          <Button
            type="submit"
            variant="ghost"
            size="icon"
            className="h-7 w-7 flex-shrink-0"
            disabled={!quickInput.trim() && !pendingFile}
          >
            {chatMutation.isPending ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <Send className="w-3.5 h-3.5" />
            )}
          </Button>
        </form>

        {/* Expand/collapse toggle */}
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7 flex-shrink-0"
          onClick={() => setIsExpanded(!isExpanded)}
          title={isExpanded ? "Collapse chat" : "Expand chat"}
        >
          {isExpanded ? (
            <ChevronUp className="w-3.5 h-3.5" />
          ) : (
            <ChevronDown className="w-3.5 h-3.5" />
          )}
        </Button>
      </div>

      {/* ── Suggested prompts (only when collapsed and no messages) ── */}
      {!isExpanded && messages.length === 0 && (
        <div className="px-3 pb-2 flex flex-wrap gap-1.5">
          {suggestedPrompts.slice(0, 3).map((prompt) => (
            <button
              key={prompt}
              onClick={() => handleSend(prompt)}
              className="px-2 py-0.5 rounded-full text-[10px] font-medium border border-border/50 bg-muted/20 text-muted-foreground hover:border-primary/40 hover:text-primary hover:bg-primary/5 transition-colors"
            >
              {prompt}
            </button>
          ))}
        </div>
      )}

      {/* ── Expanded chat panel ── */}
      {isExpanded && (
        <div className="border-t border-border/40">
          <AIChatBox
            messages={messages}
            onSendMessage={handleSend}
            isLoading={chatMutation.isPending}
            placeholder={
              pendingFile
                ? `Ask about ${pendingFile.name}...`
                : "Ask me anything..."
            }
            height="320px"
            className="border-0 rounded-none shadow-none"
            emptyStateMessage="How can I help you today?"
            suggestedPrompts={
              messages.length === 0 ? suggestedPrompts : undefined
            }
            hideInput
          />
        </div>
      )}

      {/* Hidden file input */}
      <input
        ref={fileInputRef}
        type="file"
        className="hidden"
        accept="image/*,application/pdf,.txt,.csv,.md"
        onChange={handleFileChange}
      />
    </div>
  );
}

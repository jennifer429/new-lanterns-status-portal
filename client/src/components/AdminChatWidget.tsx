/**
 * AdminChatWidget - Floating AI chat assistant for admin/partner users.
 *
 * Features:
 * - Fixed bottom-right bubble that opens/closes a chat panel
 * - Role-aware suggested prompts (platform admin vs partner admin)
 * - File upload for documents/images (parsed by the AI)
 * - Handles navigation actions returned by the server
 */

import { useState, useRef } from "react";
import { useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import { AIChatBox, type Message } from "@/components/AIChatBox";
import { Button } from "@/components/ui/button";
import { Sparkles, X, Paperclip } from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

type AdminChatWidgetProps = {
  isPlatformAdmin?: boolean;
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

export function AdminChatWidget({ isPlatformAdmin = false }: AdminChatWidgetProps) {
  const [, setLocation] = useLocation();
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);
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
        // refresh_orgs / refresh_users: could invalidate queries here if needed
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
    const userMessage: Message = { role: "user", content };
    const nextMessages = [...messages, userMessage];
    setMessages(nextMessages);

    chatMutation.mutate({
      messages: nextMessages.filter((m) => m.role !== "system"),
      fileData: pendingFile?.data,
      fileType: pendingFile?.type,
      fileName: pendingFile?.name,
    });

    // Clear pending file after sending
    setPendingFile(null);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const maxSize = 5 * 1024 * 1024; // 5MB
    if (file.size > maxSize) {
      toast.error("File too large (max 5MB)");
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = reader.result as string;
      // Strip the data URL prefix to get raw base64
      const base64 = dataUrl.split(",")[1] ?? "";
      setPendingFile({ name: file.name, data: base64, type: file.type });
      toast.success(`File attached: ${file.name}`);
    };
    reader.readAsDataURL(file);

    // Reset input so same file can be re-selected
    e.target.value = "";
  };

  const suggestedPrompts = isPlatformAdmin
    ? PLATFORM_ADMIN_PROMPTS
    : PARTNER_ADMIN_PROMPTS;

  return (
    <>
      {/* Floating panel */}
      {isOpen && (
        <div
          className={cn(
            "fixed bottom-20 right-4 z-50 w-[420px] max-w-[calc(100vw-2rem)]",
            "flex flex-col rounded-xl border border-border shadow-2xl",
            "bg-card overflow-hidden",
          )}
          style={{ height: "520px" }}
        >
          {/* Panel header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-border bg-primary/5">
            <div className="flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-primary" />
              <span className="font-semibold text-sm">AI Assistant</span>
              {pendingFile && (
                <span className="text-xs text-muted-foreground truncate max-w-[140px]">
                  📎 {pendingFile.name}
                </span>
              )}
            </div>
            <div className="flex items-center gap-1">
              {/* File attach button */}
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7"
                title="Attach a file or image"
                onClick={() => fileInputRef.current?.click()}
              >
                <Paperclip className="w-4 h-4" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7"
                onClick={() => setIsOpen(false)}
              >
                <X className="w-4 h-4" />
              </Button>
            </div>
          </div>

          {/* Chat box fills remaining space */}
          <AIChatBox
            messages={messages}
            onSendMessage={handleSend}
            isLoading={chatMutation.isPending}
            placeholder={
              pendingFile
                ? `Ask about ${pendingFile.name}...`
                : "Ask me anything..."
            }
            height="100%"
            className="border-0 rounded-none shadow-none flex-1"
            emptyStateMessage="How can I help you today?"
            suggestedPrompts={messages.length === 0 ? suggestedPrompts : undefined}
          />
        </div>
      )}

      {/* Floating toggle button */}
      <button
        onClick={() => setIsOpen((v) => !v)}
        className={cn(
          "fixed bottom-4 right-4 z-50",
          "w-12 h-12 rounded-full shadow-lg",
          "flex items-center justify-center",
          "bg-primary text-primary-foreground",
          "hover:bg-primary/90 transition-colors",
          "focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2",
        )}
        title="Open AI assistant"
      >
        {isOpen ? (
          <X className="w-5 h-5" />
        ) : (
          <Sparkles className="w-5 h-5" />
        )}
      </button>

      {/* Hidden file input */}
      <input
        ref={fileInputRef}
        type="file"
        className="hidden"
        accept="image/*,application/pdf,.txt,.csv,.md"
        onChange={handleFileChange}
      />
    </>
  );
}

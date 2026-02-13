"use client";

import { useState } from "react";
import { MessageSquare, Send, X } from "lucide-react";
import { toast } from "sonner";

import { cn } from "@/lib/utils";

export function FeedbackWidget() {
  const [open, setOpen] = useState(false);
  const [message, setMessage] = useState("");
  const [emoji, setEmoji] = useState<string | null>(null);
  const [sent, setSent] = useState(false);

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!message.trim() && !emoji) return;
    // In a real app this would POST to an API
    toast.success("Feedback sent! Thank you.");
    setSent(true);
    setTimeout(() => {
      setOpen(false);
      setSent(false);
      setMessage("");
      setEmoji(null);
    }, 2000);
  }

  const emojis = [
    { value: "😍", label: "Love it" },
    { value: "😊", label: "Good" },
    { value: "😐", label: "Meh" },
    { value: "😕", label: "Bad" },
  ];

  return (
    <>
      {/* Trigger button */}
      <button
        onClick={() => setOpen(!open)}
        className={cn(
          "fixed bottom-6 right-6 z-50 flex h-10 items-center gap-2 rounded-full border border-[#333] bg-[#0a0a0a] px-4 text-sm text-[#888] shadow-lg shadow-black/50 transition-all hover:border-[#555] hover:text-white",
          open && "border-[#555] text-white"
        )}
      >
        {open ? (
          <X className="h-4 w-4" />
        ) : (
          <MessageSquare className="h-4 w-4" />
        )}
        <span className="hidden sm:inline">Feedback</span>
      </button>

      {/* Panel */}
      {open && (
        <div className="fixed bottom-20 right-6 z-50 w-[340px] overflow-hidden rounded-xl border border-[#333] bg-[#0a0a0a] shadow-2xl shadow-black/50">
          {sent ? (
            <div className="flex flex-col items-center justify-center px-6 py-12 text-center">
              <div className="mb-3 text-3xl">✅</div>
              <p className="text-sm font-medium text-white">Thank you!</p>
              <p className="mt-1 text-xs text-[#888]">
                Your feedback helps us improve.
              </p>
            </div>
          ) : (
            <form onSubmit={onSubmit}>
              <div className="border-b border-[#333] px-4 py-3">
                <h3 className="text-sm font-medium text-white">
                  Send Feedback
                </h3>
                <p className="text-xs text-[#666]">
                  Help us improve your experience.
                </p>
              </div>
              <div className="space-y-3 p-4">
                {/* Emoji rating */}
                <div className="flex items-center justify-center gap-2">
                  {emojis.map((e) => (
                    <button
                      key={e.value}
                      type="button"
                      onClick={() => setEmoji(e.value)}
                      className={cn(
                        "flex h-10 w-10 items-center justify-center rounded-lg border text-lg transition-all",
                        emoji === e.value
                          ? "border-white bg-[#1a1a1a] scale-110"
                          : "border-[#333] hover:bg-[#111] hover:border-[#555]"
                      )}
                      title={e.label}
                    >
                      {e.value}
                    </button>
                  ))}
                </div>

                {/* Message */}
                <textarea
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  placeholder="Your feedback..."
                  rows={3}
                  className="w-full resize-none rounded-lg border border-[#333] bg-black px-3 py-2 text-sm text-white placeholder:text-[#555] focus:border-[#555] focus:outline-none"
                />
              </div>
              <div className="flex justify-end border-t border-[#333] px-4 py-3">
                <button
                  type="submit"
                  disabled={!message.trim() && !emoji}
                  className="flex items-center gap-2 rounded-md bg-white px-4 py-1.5 text-sm font-medium text-black transition-opacity hover:opacity-90 disabled:opacity-40"
                >
                  <Send className="h-3.5 w-3.5" />
                  Send
                </button>
              </div>
            </form>
          )}
        </div>
      )}
    </>
  );
}

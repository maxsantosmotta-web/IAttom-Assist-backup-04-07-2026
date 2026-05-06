import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { MessageSquare, X, Star, CheckCircle2, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";

const CATEGORIES = [
  { value: "bug", label: "Bug Report" },
  { value: "feature", label: "Feature Request" },
  { value: "general", label: "General Feedback" },
  { value: "other", label: "Other" },
] as const;

type Category = (typeof CATEGORIES)[number]["value"];

export function FeedbackModal() {
  const [isOpen, setIsOpen] = useState(false);
  const [message, setMessage] = useState("");
  const [category, setCategory] = useState<Category>("general");
  const [rating, setRating] = useState<number | null>(null);
  const [hoverRating, setHoverRating] = useState<number | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isDone, setIsDone] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const reset = () => {
    setMessage("");
    setCategory("general");
    setRating(null);
    setHoverRating(null);
    setIsSubmitting(false);
    setIsDone(false);
    setError(null);
  };

  const handleOpen = () => {
    reset();
    setIsOpen(true);
  };

  const handleClose = () => {
    setIsOpen(false);
    setTimeout(reset, 300);
  };

  const handleSubmit = async () => {
    if (!message.trim()) return;
    setIsSubmitting(true);
    setError(null);

    try {
      const res = await fetch("/api/feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          message: message.trim(),
          category,
          rating: rating ?? undefined,
        }),
      });
      if (!res.ok) throw new Error("Failed to submit");
      setIsDone(true);
      setTimeout(() => handleClose(), 2000);
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const displayRating = hoverRating ?? rating;

  return (
    <>
      <button
        onClick={handleOpen}
        className="fixed bottom-6 right-6 z-50 flex items-center gap-2 px-3.5 py-2.5 rounded-xl bg-[#111111] border border-white/[0.10] text-zinc-400 hover:text-primary hover:border-primary/30 transition-all duration-200 shadow-lg hover:shadow-primary/10 text-[12px] font-medium"
        title="Send feedback"
      >
        <MessageSquare className="w-3.5 h-3.5" />
        <span className="hidden sm:inline">Feedback</span>
      </button>

      <AnimatePresence>
        {isOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.15 }}
              className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm"
              onClick={handleClose}
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 12 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 12 }}
              transition={{ duration: 0.2 }}
              className="fixed bottom-20 right-6 z-50 w-[340px] bg-[#111111] border border-white/[0.10] rounded-2xl shadow-2xl overflow-hidden"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between px-5 py-4 border-b border-white/[0.06]">
                <div className="flex items-center gap-2.5">
                  <MessageSquare className="w-4 h-4 text-primary" />
                  <p className="text-sm font-semibold text-white">Send Feedback</p>
                </div>
                <button
                  onClick={handleClose}
                  className="text-zinc-600 hover:text-zinc-400 transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="p-5">
                {isDone ? (
                  <div className="text-center py-6">
                    <CheckCircle2 className="w-10 h-10 text-emerald-400 mx-auto mb-3" />
                    <p className="text-sm font-semibold text-white">Thank you!</p>
                    <p className="text-xs text-muted-foreground mt-1">Your feedback has been received.</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    <div>
                      <p className="text-[11px] font-semibold text-zinc-500 mb-2 uppercase tracking-wider">Category</p>
                      <div className="grid grid-cols-2 gap-1.5">
                        {CATEGORIES.map((c) => (
                          <button
                            key={c.value}
                            onClick={() => setCategory(c.value)}
                            className={`px-3 py-2 rounded-lg text-[11px] font-medium border transition-all ${
                              category === c.value
                                ? "bg-primary/15 border-primary/30 text-primary"
                                : "bg-white/[0.03] border-white/[0.07] text-zinc-500 hover:text-zinc-300 hover:border-white/[0.12]"
                            }`}
                          >
                            {c.label}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div>
                      <p className="text-[11px] font-semibold text-zinc-500 mb-2 uppercase tracking-wider">Message</p>
                      <Textarea
                        value={message}
                        onChange={(e) => setMessage(e.target.value)}
                        placeholder="Describe the issue or idea..."
                        className="bg-[#0a0a0a] border-white/[0.08] text-sm text-zinc-200 placeholder:text-zinc-700 resize-none h-24 focus:border-primary/40 focus:ring-0"
                        maxLength={2000}
                      />
                      <p className="text-[10px] text-zinc-700 mt-1 text-right">{message.length}/2000</p>
                    </div>

                    <div>
                      <p className="text-[11px] font-semibold text-zinc-500 mb-2 uppercase tracking-wider">
                        Rating <span className="text-zinc-700 font-normal">(optional)</span>
                      </p>
                      <div className="flex gap-1.5">
                        {[1, 2, 3, 4, 5].map((star) => (
                          <button
                            key={star}
                            onClick={() => setRating(rating === star ? null : star)}
                            onMouseEnter={() => setHoverRating(star)}
                            onMouseLeave={() => setHoverRating(null)}
                            className="transition-transform hover:scale-110"
                          >
                            <Star
                              className={`w-5 h-5 transition-colors ${
                                (displayRating ?? 0) >= star
                                  ? "text-primary fill-primary"
                                  : "text-zinc-700"
                              }`}
                            />
                          </button>
                        ))}
                      </div>
                    </div>

                    {error && (
                      <p className="text-xs text-red-400">{error}</p>
                    )}

                    <Button
                      onClick={handleSubmit}
                      disabled={!message.trim() || isSubmitting}
                      className="w-full bg-primary hover:bg-primary/90 text-black font-semibold h-9 text-[13px]"
                    >
                      {isSubmitting ? (
                        <><Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />Sending...</>
                      ) : (
                        "Send Feedback"
                      )}
                    </Button>
                  </div>
                )}
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </>
  );
}

"use client";

import { useEffect, useState } from "react";
import { ThumbsUp, ThumbsDown } from "lucide-react";
import { formatInt } from "@/lib/blog/format";
import { cn } from "@/lib/utils";

interface BlogFeedbackProps {
  postId: string;
  initialUpvotes?: number;
  initialDownvotes?: number;
  className?: string;
}

type VoteType = "up" | "down" | null;

export function BlogFeedback({
  postId,
  initialUpvotes = 0,
  initialDownvotes = 0,
  className,
}: BlogFeedbackProps) {
  const [upvotes, setUpvotes] = useState(initialUpvotes);
  const [downvotes, setDownvotes] = useState(initialDownvotes);
  const [userVote, setUserVote] = useState<VoteType>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [feedbackMsg, setFeedbackMsg] = useState<string | null>(null);

  // Sinkronkan state bila props dari server berubah
  useEffect(() => {
    setUpvotes(initialUpvotes);
    setDownvotes(initialDownvotes);
  }, [initialUpvotes, initialDownvotes]);

  // Baca pilihan sebelumnya dari localStorage agar instan tanpa loading
  useEffect(() => {
    try {
      const stored = window.localStorage.getItem(`blog-vote:${postId}`);
      if (stored === "up" || stored === "down") {
        setUserVote(stored);
      }
    } catch {
      // localStorage diblokir / mode privat
    }

    // Ambil data terkini dari server
    void fetch(`/api/blog-vote?postId=${encodeURIComponent(postId)}`)
      .then((res) => (res.ok ? res.json() : null))
      .then((payload) => {
        if (payload?.success && payload?.data) {
          setUpvotes(payload.data.upvoteCount);
          setDownvotes(payload.data.downvoteCount);
          if (payload.data.userVote !== undefined) {
            setUserVote(payload.data.userVote);
            try {
              if (payload.data.userVote) {
                window.localStorage.setItem(`blog-vote:${postId}`, payload.data.userVote);
              } else {
                window.localStorage.removeItem(`blog-vote:${postId}`);
              }
            } catch {
              // Abaikan
            }
          }
        }
      })
      .catch(() => undefined);
  }, [postId]);

  const handleVote = async (target: "up" | "down") => {
    if (isSubmitting) return;
    setIsSubmitting(true);

    const prevVote = userVote;
    const prevUp = upvotes;
    const prevDown = downvotes;

    // Optimistic calculation
    let nextVote: VoteType = null;
    let nextUp = upvotes;
    let nextDown = downvotes;

    if (target === "up") {
      if (prevVote === "up") {
        // Toggle off
        nextVote = null;
        nextUp = Math.max(0, nextUp - 1);
      } else if (prevVote === "down") {
        // Switch dari down ke up
        nextVote = "up";
        nextDown = Math.max(0, nextDown - 1);
        nextUp = nextUp + 1;
      } else {
        // Vote baru
        nextVote = "up";
        nextUp = nextUp + 1;
      }
    } else {
      if (prevVote === "down") {
        // Toggle off
        nextVote = null;
        nextDown = Math.max(0, nextDown - 1);
      } else if (prevVote === "up") {
        // Switch dari up ke down
        nextVote = "down";
        nextUp = Math.max(0, nextUp - 1);
        nextDown = nextDown + 1;
      } else {
        // Vote baru
        nextVote = "down";
        nextDown = nextDown + 1;
      }
    }

    setUserVote(nextVote);
    setUpvotes(nextUp);
    setDownvotes(nextDown);

    if (nextVote) {
      setFeedbackMsg("Terima kasih atas tanggapan Anda!");
    } else {
      setFeedbackMsg(null);
    }

    try {
      if (nextVote) {
        window.localStorage.setItem(`blog-vote:${postId}`, nextVote);
      } else {
        window.localStorage.removeItem(`blog-vote:${postId}`);
      }
    } catch {
      // Abaikan
    }

    try {
      const res = await fetch("/api/blog-vote", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ postId, vote: target }),
      });

      if (!res.ok) throw new Error("Gagal mengirim tanggapan");
      const json = await res.json();
      if (json?.success && json?.data) {
        setUpvotes(json.data.upvoteCount);
        setDownvotes(json.data.downvoteCount);
        setUserVote(json.data.userVote);
      }
    } catch {
      // Revert bila error jaringan
      setUserVote(prevVote);
      setUpvotes(prevUp);
      setDownvotes(prevDown);
      setFeedbackMsg("Terjadi gangguan jaringan. Silakan coba lagi.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <section
      aria-label="Tanggapan artikel"
      className={cn(
        "my-12 rounded-2xl border border-lp-line bg-lp-paper-2 p-6 sm:p-8 transition-colors",
        className
      )}
    >
      <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h3 className="font-display text-lg font-bold text-lp-ink">
            Apakah artikel ini membantu?
          </h3>
          <p className="mt-1 text-sm text-lp-ink-soft">
            Bantu kami meningkatkan kualitas konten panduan valas ini.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={() => void handleVote("up")}
            disabled={isSubmitting}
            aria-pressed={userVote === "up"}
            className={cn(
              "group inline-flex items-center gap-2 rounded-xl border px-4 py-2 text-sm font-semibold transition-all duration-200 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-600 disabled:opacity-70",
              userVote === "up"
                ? "border-emerald-600 bg-emerald-50 text-emerald-800 shadow-xs dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-600"
                : "border-lp-line bg-lp-paper text-lp-ink hover:border-emerald-500 hover:text-emerald-700"
            )}
          >
            <ThumbsUp
              className={cn(
                "size-4 transition-transform group-hover:scale-110",
                userVote === "up" ? "fill-emerald-600 text-emerald-600" : "text-lp-ink-mute"
              )}
              aria-hidden="true"
            />
            <span>Ya</span>
            <span className="tabular-nums text-xs opacity-85">({formatInt(upvotes)})</span>
          </button>

          <button
            type="button"
            onClick={() => void handleVote("down")}
            disabled={isSubmitting}
            aria-pressed={userVote === "down"}
            className={cn(
              "group inline-flex items-center gap-2 rounded-xl border px-4 py-2 text-sm font-semibold transition-all duration-200 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-rose-600 disabled:opacity-70",
              userVote === "down"
                ? "border-rose-600 bg-rose-50 text-rose-800 shadow-xs dark:bg-rose-950/40 dark:text-rose-300 dark:border-rose-600"
                : "border-lp-line bg-lp-paper text-lp-ink hover:border-rose-500 hover:text-rose-700"
            )}
          >
            <ThumbsDown
              className={cn(
                "size-4 transition-transform group-hover:scale-110",
                userVote === "down" ? "fill-rose-600 text-rose-600" : "text-lp-ink-mute"
              )}
              aria-hidden="true"
            />
            <span>Tidak</span>
            <span className="tabular-nums text-xs opacity-85">({formatInt(downvotes)})</span>
          </button>
        </div>
      </div>

      {feedbackMsg && (
        <p className="mt-4 text-xs font-medium text-emerald-700 dark:text-emerald-400" role="status">
          {feedbackMsg}
        </p>
      )}
    </section>
  );
}

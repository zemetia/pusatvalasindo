"use client";

import { ReactNode, Children } from "react";
import { motion } from "framer-motion";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";

interface AdminFormSidebarProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  onSubmit: (e: React.FormEvent) => void;
  children: ReactNode;
  footer?: ReactNode;
  trigger?: ReactNode;
  className?: string;
  icon?: ReactNode;
}

const itemVariants = {
  hidden: { opacity: 0, y: 12 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { type: "spring" as const, stiffness: 320, damping: 28 },
  },
};

export function AdminFormSidebar({
  open,
  onOpenChange,
  title,
  description,
  onSubmit,
  children,
  footer,
  trigger,
  icon,
  className = "",
}: AdminFormSidebarProps) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      {trigger && <SheetTrigger asChild>{trigger}</SheetTrigger>}
      <SheetContent
        className={cn(
          "w-full max-w-[100vw] sm:w-[640px] sm:max-w-[85vw] lg:w-[760px] xl:w-[860px] p-0 flex flex-col overflow-hidden",
          "bg-white dark:bg-[#0f0f17]",
          "border-l-0 sm:border-l border-zinc-200 dark:border-zinc-800",
          "[&>button]:hidden",
          className
        )}
      >
        <form onSubmit={onSubmit} className="flex flex-col h-full overflow-hidden">

          {/* ── Header ─────────────────────────────────────────── */}
          <div className="relative flex-shrink-0 bg-gradient-to-br from-violet-50 to-indigo-50/40 dark:from-violet-950/30 dark:to-indigo-950/20 border-b border-zinc-200 dark:border-zinc-800">
            {/* Decorative blobs */}
            <div className="absolute inset-0 overflow-hidden pointer-events-none">
              <div className="absolute -top-6 -right-6 w-32 h-32 rounded-full bg-violet-200/50 dark:bg-violet-500/10 blur-2xl" />
              <div className="absolute -bottom-4 left-2 w-24 h-24 rounded-full bg-indigo-200/40 dark:bg-indigo-500/08 blur-xl" />
            </div>

            <div className="relative flex items-start gap-4 px-6 py-5">
              {/* Icon badge */}
              {icon && (
                <motion.div
                  initial={{ scale: 0.7, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  transition={{ type: "spring", stiffness: 280, damping: 18, delay: 0.05 }}
                  className="flex-shrink-0 w-10 h-10 rounded-xl bg-gradient-to-br from-violet-500 to-indigo-600 flex items-center justify-center text-white shadow-md shadow-violet-500/40 mt-0.5"
                >
                  {icon}
                </motion.div>
              )}

              {/* Title + description */}
              <div className="flex-1 min-w-0">
                <motion.h2
                  initial={{ opacity: 0, y: -5 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.07, duration: 0.22, ease: "easeOut" }}
                  className="text-[18px] font-bold text-zinc-900 dark:text-white leading-snug"
                >
                  {title}
                </motion.h2>
                {description && (
                  <motion.p
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: 0.13, duration: 0.2 }}
                    className="mt-1 text-[12.5px] text-zinc-500 dark:text-zinc-400 leading-relaxed"
                  >
                    {description}
                  </motion.p>
                )}
              </div>

              {/* Close button */}
              <button
                type="button"
                onClick={() => onOpenChange(false)}
                className="flex-shrink-0 w-8 h-8 rounded-lg flex items-center justify-center text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 hover:bg-zinc-200/70 dark:hover:bg-zinc-700/60 transition-colors duration-150 mt-0.5"
              >
                <X className="w-[15px] h-[15px]" />
              </button>
            </div>
          </div>

          {/* ── Scrollable Body ─────────────────────────────────── */}
          <div className="flex-1 overflow-y-auto overscroll-contain bg-white dark:bg-[#0f0f17]">
            <motion.div
              initial="hidden"
              animate="visible"
              variants={{
                hidden: {},
                visible: { transition: { staggerChildren: 0.06, delayChildren: 0.12 } },
              }}
              className="px-6 py-5 flex flex-col gap-4"
            >
              {Children.map(children, (child, i) => (
                <motion.div key={i} variants={itemVariants}>
                  {child}
                </motion.div>
              ))}
            </motion.div>
          </div>

          {/* ── Footer ──────────────────────────────────────────── */}
          {footer && (
            <div className="flex-shrink-0 px-6 py-4 border-t border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900/50">
              {footer}
            </div>
          )}
        </form>
      </SheetContent>
    </Sheet>
  );
}

/* ── Reusable Footer Buttons ──────────────────────────────────────────────── */

interface AdminFormFooterProps {
  onCancel: () => void;
  loading?: boolean;
  cancelLabel?: string;
  submitLabel?: string;
  loadingLabel?: string;
}

export function AdminFormFooter({
  onCancel,
  loading = false,
  cancelLabel = "Batal",
  submitLabel = "Simpan",
  loadingLabel = "Menyimpan...",
}: AdminFormFooterProps) {
  return (
    <div className="flex gap-3">
      <Button
        type="button"
        variant="outline"
        onClick={onCancel}
        className="flex-1"
      >
        {cancelLabel}
      </Button>
      <Button
        type="submit"
        disabled={loading}
        className="flex-[2]"
      >
        {loading ? loadingLabel : submitLabel}
      </Button>
    </div>
  );
}

"use client";

import type { ReactNode} from "react";
import { Children } from "react";
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
          "bg-background",
          "border-l-0 sm:border-l border-border",
          "[&>button]:hidden",
          className
        )}
      >
        <form onSubmit={onSubmit} className="flex flex-col h-full overflow-hidden">

          {/* ── Header ─────────────────────────────────────────── */}
          <div className="relative flex-shrink-0 bg-gradient-to-br from-primary/5 to-primary/[0.02] border-b border-border">
            {/* Decorative blobs */}
            <div className="absolute inset-0 overflow-hidden pointer-events-none">
              <div className="absolute -top-6 -right-6 w-32 h-32 rounded-full bg-primary/10 blur-2xl" />
              <div className="absolute -bottom-4 left-2 w-24 h-24 rounded-full bg-primary/[0.06] blur-xl" />
            </div>

            <div className="relative flex items-start gap-4 px-6 py-5">
              {/* Icon badge */}
              {icon && (
                <motion.div
                  initial={{ scale: 0.7, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  transition={{ type: "spring", stiffness: 280, damping: 18, delay: 0.05 }}
                  className="flex-shrink-0 w-10 h-10 rounded-xl bg-primary flex items-center justify-center text-primary-foreground shadow-md shadow-primary/30 mt-0.5"
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
                  className="text-[18px] font-bold text-foreground leading-snug"
                >
                  {title}
                </motion.h2>
                {description && (
                  <motion.p
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: 0.13, duration: 0.2 }}
                    className="mt-1 text-[12.5px] text-muted-foreground leading-relaxed"
                  >
                    {description}
                  </motion.p>
                )}
              </div>

              {/* Close button */}
              <Button
                type="button"
                variant="ghost"
                size="icon"
                onClick={() => onOpenChange(false)}
                className="flex-shrink-0 size-8 mt-0.5 text-muted-foreground hover:text-foreground"
              >
                <X className="size-[15px]" />
              </Button>
            </div>
          </div>

          {/* ── Scrollable Body ─────────────────────────────────── */}
          <div className="flex-1 overflow-y-auto overscroll-contain bg-background">
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
            <div className="flex-shrink-0 px-6 py-4 border-t border-border bg-muted/40">
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

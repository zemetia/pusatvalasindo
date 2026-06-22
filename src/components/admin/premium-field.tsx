"use client";

import * as React from "react";
import { AnimatePresence, motion } from "framer-motion";
import { cn } from "@/lib/utils";

// ─── Floating-Label Input ──────────────────────────────────────────────────────

interface PremiumFieldProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label: string;
  error?: string;
  icon?: React.ReactNode;
  suffix?: React.ReactNode;
}

export const PremiumField = React.forwardRef<HTMLInputElement, PremiumFieldProps>(
  ({ label, error, icon, suffix, className, placeholder, type, ...props }, ref) => {
    const [isFocused, setIsFocused] = React.useState(false);

    // Always float label for date/time inputs (browser renders native UI)
    const alwaysFloat = type === "date" || type === "time" || type === "datetime-local";
    const hasValue = props.value !== undefined && props.value !== "" && props.value !== null;
    const isUp = isFocused || hasValue || alwaysFloat;

    const ICON_LEFT = 40; // px
    const TEXT_LEFT = 14; // px

    return (
      <div className="w-full">
        {/* Field wrapper — explicit inline height so layout never collapses */}
        <div
          style={{ height: "58px", position: "relative" }}
          className={cn(
            "rounded-xl border transition-colors duration-150 cursor-text select-none",
            isFocused
              ? "border-red-500/70 bg-white dark:bg-white/[0.07] shadow-[0_0_0_3px_rgba(220,38,38,0.12)]"
              : "border-zinc-300 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-900/60 hover:border-zinc-400 dark:hover:border-zinc-600",
            error && "border-red-400 shadow-[0_0_0_3px_rgba(248,113,113,0.15)]",
            props.disabled && "opacity-50 cursor-not-allowed hover:border-zinc-300 dark:hover:border-zinc-700"
          )}
        >
          {/* Left icon */}
          {icon && (
            <div
              style={{ position: "absolute", left: "12px", top: "50%", transform: "translateY(-50%)" }}
              className={cn(
                "pointer-events-none transition-colors duration-150",
                isFocused ? "text-red-500" : "text-zinc-400 dark:text-zinc-500"
              )}
            >
              {icon}
            </div>
          )}

          {/* Floating label — inline styles for bulletproof animation */}
          <label
            style={{
              position: "absolute",
              left: icon ? `${ICON_LEFT}px` : `${TEXT_LEFT}px`,
              top: isUp ? "9px" : "50%",
              transform: isUp ? "translateY(0)" : "translateY(-50%)",
              fontSize: isUp ? "10px" : "14px",
              fontWeight: isUp ? 700 : 400,
              letterSpacing: isUp ? "0.1em" : "0em",
              textTransform: isUp ? "uppercase" : "none",
              pointerEvents: "none",
              userSelect: "none",
              lineHeight: 1,
              whiteSpace: "nowrap",
              transition:
                "top 0.18s ease, transform 0.18s ease, font-size 0.18s ease, letter-spacing 0.18s ease, color 0.18s ease",
            }}
            className={cn(
              isFocused
                ? "text-red-600 dark:text-red-400"
                : isUp
                ? "text-red-500/80 dark:text-red-400/70"
                : "text-zinc-400 dark:text-zinc-500"
            )}
          >
            {label}
          </label>

          {/* Input */}
          <input
            ref={ref}
            type={type}
            onFocus={() => setIsFocused(true)}
            onBlur={() => setIsFocused(false)}
            placeholder={isUp ? (placeholder ?? "") : ""}
            style={{
              position: "absolute",
              inset: 0,
              paddingTop: "24px",
              paddingBottom: "6px",
              paddingLeft: icon ? `${ICON_LEFT}px` : `${TEXT_LEFT}px`,
              paddingRight: suffix ? `${ICON_LEFT}px` : `${TEXT_LEFT}px`,
            }}
            className={cn(
              "w-full h-full bg-transparent outline-none rounded-xl",
              "text-[13.5px] font-medium text-zinc-900 dark:text-white",
              "placeholder:text-zinc-300 dark:placeholder:text-zinc-600 placeholder:font-normal",
              props.disabled && "cursor-not-allowed",
              className
            )}
            {...props}
          />

          {/* Right suffix */}
          {suffix && (
            <div
              style={{ position: "absolute", right: "12px", top: "50%", transform: "translateY(-50%)" }}
              className="pointer-events-none text-zinc-400 dark:text-zinc-500"
            >
              {suffix}
            </div>
          )}
        </div>

        {/* Error */}
        <AnimatePresence>
          {error && (
            <motion.p
              initial={{ opacity: 0, y: -4, height: 0 }}
              animate={{ opacity: 1, y: 0, height: "auto" }}
              exit={{ opacity: 0, y: -4, height: 0 }}
              transition={{ duration: 0.15 }}
              className="overflow-hidden text-[11px] font-semibold text-red-500 pt-1.5 pl-1"
            >
              {error}
            </motion.p>
          )}
        </AnimatePresence>
      </div>
    );
  }
);

PremiumField.displayName = "PremiumField";

// ─── Native Premium Select ────────────────────────────────────────────────────

export interface PremiumNativeSelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  label: string;
  error?: string;
  icon?: React.ReactNode;
}

export function PremiumNativeSelect({
  label,
  error,
  icon,
  children,
  className,
  ...props
}: PremiumNativeSelectProps) {
  const [isFocused, setIsFocused] = React.useState(false);

  return (
    <div className={cn("w-full group", className)}>
      <div
        className={cn(
          "relative rounded-xl border transition-all duration-300 overflow-hidden",
          "h-[48px] flex items-center", // Reduced height for minimalist look
          isFocused
            ? "border-red-500 bg-white dark:bg-zinc-900 shadow-sm"
            : "border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900/40",
          error && "border-red-500"
        )}
      >
        {/* Native Select Element Only */}
        <select
          onFocus={() => setIsFocused(true)}
          onBlur={() => setIsFocused(false)}
          className={cn(
            "h-full w-full appearance-none bg-transparent outline-none border-none",
            "px-4 text-[14px] font-medium text-zinc-900 dark:text-zinc-100",
            "cursor-pointer z-10",
            className
          )}
          {...props}
        >
          {children}
        </select>
      </div>

      {error && (
        <p className="text-[11px] font-bold text-red-500 mt-1 ml-1">
          {error}
        </p>
      )}
    </div>
  );
}

// ─── Form Section Divider ──────────────────────────────────────────────────────

export interface FormSectionProps {
  title: string;
  icon?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}

export function FormSection({ title, icon, children, className }: FormSectionProps) {
  return (
    <div className={cn("flex flex-col gap-3", className)}>
      {/* Section header row */}
      <div className="flex items-center gap-2">
        {icon && (
          <span className="flex-shrink-0 text-red-500/60">
            {icon}
          </span>
        )}
        <span className="text-[10px] font-black uppercase tracking-[0.16em] text-zinc-400 dark:text-zinc-500 whitespace-nowrap">
          {title}
        </span>
        <div className="flex-1 h-px bg-zinc-200 dark:bg-zinc-800" />
      </div>

      {/* Fields */}
      <div className="flex flex-col gap-3">{children}</div>
    </div>
  );
}

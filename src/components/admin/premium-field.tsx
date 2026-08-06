"use client";

import * as React from "react";
import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Combobox } from "@/components/ui/combobox";

// ─── Labeled Input ─────────────────────────────────────────────────────────

interface PremiumFieldProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label: string;
  error?: string;
  icon?: React.ReactNode;
  suffix?: React.ReactNode;
}

export const PremiumField = React.forwardRef<HTMLInputElement, PremiumFieldProps>(
  ({ label, error, icon, suffix, className, id, ...props }, ref) => {
    const generatedId = React.useId();
    const fieldId = id ?? generatedId;

    return (
      <div className="w-full space-y-1.5">
        <Label htmlFor={fieldId} className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
          {label}
        </Label>
        <div className="relative">
          {icon && (
            <div className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">
              {icon}
            </div>
          )}
          <Input
            ref={ref}
            id={fieldId}
            aria-invalid={!!error}
            className={cn(icon && "pl-9", suffix && "pr-9", className)}
            {...props}
          />
          {suffix && (
            <div className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground">
              {suffix}
            </div>
          )}
        </div>
        {error && <p className="text-xs font-medium text-destructive">{error}</p>}
      </div>
    );
  }
);

PremiumField.displayName = "PremiumField";

// ─── Labeled Select ────────────────────────────────────────────────────────

export interface PremiumSelectOption {
  value: string;
  label: string;
  /** Baris kedua di daftar — ikut dicari. */
  description?: string;
  disabled?: boolean;
}

export interface PremiumNativeSelectProps {
  label: string;
  error?: string;
  icon?: React.ReactNode;
  value?: string;
  onValueChange?: (value: string) => void;
  placeholder?: string;
  searchPlaceholder?: string;
  disabled?: boolean;
  options: PremiumSelectOption[];
  className?: string;
}

export function PremiumNativeSelect({
  label,
  error,
  icon,
  value,
  onValueChange,
  placeholder,
  searchPlaceholder,
  disabled,
  options,
  className,
}: PremiumNativeSelectProps) {
  const fieldId = React.useId();

  return (
    <div className={cn("w-full space-y-1.5", className)}>
      <Label htmlFor={fieldId} className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
        {label}
      </Label>
      <Combobox
        id={fieldId}
        value={value}
        onValueChange={onValueChange ?? (() => {})}
        disabled={disabled}
        aria-invalid={!!error}
        icon={icon}
        placeholder={placeholder}
        searchPlaceholder={searchPlaceholder ?? `Cari ${label.toLowerCase()}...`}
        options={options}
      />
      {error && <p className="text-xs font-medium text-destructive">{error}</p>}
    </div>
  );
}

// ─── Form Section Divider ──────────────────────────────────────────────────

export interface FormSectionProps {
  title: string;
  icon?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}

export function FormSection({ title, icon, children, className }: FormSectionProps) {
  return (
    <div className={cn("flex flex-col gap-3", className)}>
      <div className="flex items-center gap-2">
        {icon && <span className="flex-shrink-0 text-muted-foreground">{icon}</span>}
        <span className="text-[10px] font-bold uppercase tracking-[0.16em] text-muted-foreground whitespace-nowrap">
          {title}
        </span>
        <div className="flex-1 h-px bg-border" />
      </div>
      <div className="flex flex-col gap-3">{children}</div>
    </div>
  );
}

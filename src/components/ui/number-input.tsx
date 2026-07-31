"use client"

import * as React from "react"
import { NumericFormat, type NumericFormatProps } from "react-number-format"

import { cn } from "@/lib/utils"

type NumberInputProps = Omit<
  NumericFormatProps,
  "customInput" | "thousandSeparator" | "decimalSeparator" | "getInputRef" | "onValueChange"
> & {
  value?: number | string | null
  onValueChange?: (value: number | undefined) => void
}

/**
 * Number input that displays thousand separators ("100.000") while typing,
 * but reports/submits the raw unformatted number (100000).
 */
const NumberInput = React.forwardRef<HTMLInputElement, NumberInputProps>(
  ({ className, value, onValueChange, allowNegative, ...props }, ref) => {
    return (
      <NumericFormat
        getInputRef={ref}
        value={value ?? ""}
        thousandSeparator="."
        decimalSeparator=","
        // Dibaca dari prop yang sudah dipisahkan, BUKAN dibiarkan tertimpa
        // `{...props}` di bawah: pemanggil yang meneruskan prop opsional bernilai
        // `undefined` (mis. `allowNegative={props.allowNegative}`) dulu justru
        // menghidupkan minus, karena default react-number-format sendiri `true`.
        // Default aman di sini adalah menolak minus; yang butuh harus meminta.
        allowNegative={allowNegative ?? false}
        onValueChange={(values) => {
          onValueChange?.(values.floatValue)
        }}
        className={cn(
          "file:text-foreground placeholder:text-muted-foreground selection:bg-primary selection:text-primary-foreground dark:bg-input/30 border-input flex h-9 w-full min-w-0 rounded-md border bg-transparent px-3 py-1 text-base shadow-xs transition-[color,box-shadow] outline-none file:inline-flex file:h-7 file:border-0 file:bg-transparent file:text-sm file:font-medium disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50 md:text-sm",
          "focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]",
          "aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive",
          className
        )}
        {...props}
      />
    )
  }
)
NumberInput.displayName = "NumberInput"

export { NumberInput }

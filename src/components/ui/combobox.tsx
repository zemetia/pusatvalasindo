"use client"

import * as React from "react"
import { CheckIcon, ChevronsUpDownIcon, XIcon } from "lucide-react"

import { cn } from "@/lib/utils"
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"

export type ComboboxOption = {
  /** Nilai yang dikirim ke onValueChange. Harus unik. */
  value: string
  /** Teks yang tampil di trigger dan jadi dasar pencarian. */
  label: string
  /** Baris kedua di dalam daftar (mis. jabatan, kode cabang). Ikut dicari. */
  description?: string
  /** Kata kunci tambahan supaya lebih gampang ketemu saat diketik. */
  keywords?: string[]
  /** Ikon / badge kecil di kiri label. */
  icon?: React.ReactNode
  /** Judul grup. Opsi dengan grup sama akan dikelompokkan berurutan. */
  group?: string
  disabled?: boolean
}

/**
 * Di atas jumlah opsi ini, kolom pencarian muncul otomatis.
 * Dropdown pendek (Beli/Jual, Aktif/Nonaktif) tetap tampil polos.
 */
const SEARCH_THRESHOLD = 8

export type ComboboxProps = {
  options: ComboboxOption[]
  value?: string | null
  onValueChange: (value: string) => void
  /** Ikon tetap di kiri trigger, terlepas dari opsi yang dipilih. */
  icon?: React.ReactNode
  placeholder?: string
  searchPlaceholder?: string
  emptyText?: string
  disabled?: boolean
  size?: "sm" | "default"
  /** Paksa kolom pencarian muncul/sembunyi. Default: otomatis lewat SEARCH_THRESHOLD. */
  searchable?: boolean
  /** Tampilkan tombol silang untuk mengosongkan pilihan. */
  clearable?: boolean
  /** Nilai yang dikirim saat pilihan dikosongkan. Default string kosong. */
  clearValue?: string
  className?: string
  contentClassName?: string
  align?: "start" | "center" | "end"
  id?: string
  name?: string
  "aria-invalid"?: boolean
  "aria-label"?: string
  "aria-labelledby"?: string
}

function Combobox({
  options,
  value,
  onValueChange,
  icon,
  placeholder = "Pilih...",
  searchPlaceholder = "Cari...",
  emptyText = "Tidak ada hasil.",
  disabled,
  size = "default",
  searchable,
  clearable = false,
  clearValue = "",
  className,
  contentClassName,
  align = "start",
  id,
  name,
  "aria-invalid": ariaInvalid,
  "aria-label": ariaLabel,
  "aria-labelledby": ariaLabelledBy,
}: ComboboxProps) {
  const [open, setOpen] = React.useState(false)
  const listboxId = React.useId()

  const selected = React.useMemo(
    () => options.find((option) => option.value === value),
    [options, value]
  )

  const showSearch = searchable ?? options.length > SEARCH_THRESHOLD

  // Pertahankan urutan kemunculan grup seperti di array options.
  const groups = React.useMemo(() => {
    const byName = new Map<string, ComboboxOption[]>()
    for (const option of options) {
      const key = option.group ?? ""
      const bucket = byName.get(key)
      if (bucket) bucket.push(option)
      else byName.set(key, [option])
    }
    return Array.from(byName, ([heading, items]) => ({ heading, items }))
  }, [options])

  const handleSelect = (option: ComboboxOption) => {
    onValueChange(option.value)
    setOpen(false)
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          role="combobox"
          id={id}
          disabled={disabled}
          aria-expanded={open}
          aria-controls={listboxId}
          aria-haspopup="listbox"
          aria-invalid={ariaInvalid}
          aria-label={ariaLabel}
          aria-labelledby={ariaLabelledBy}
          data-slot="combobox-trigger"
          data-size={size}
          data-placeholder={selected ? undefined : ""}
          className={cn(
            "border-input data-placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-ring/50 aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive dark:bg-input/30 dark:hover:bg-input/50 flex w-full items-center justify-between gap-2 rounded-md border bg-transparent px-3 py-2 text-left text-sm shadow-xs transition-[color,box-shadow] outline-none focus-visible:ring-[3px] disabled:cursor-not-allowed disabled:opacity-50 data-[size=default]:h-9 data-[size=sm]:h-8 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
            className
          )}
        >
          <span className="flex min-w-0 flex-1 items-center gap-2">
            {icon ? (
              <span className="text-muted-foreground shrink-0">{icon}</span>
            ) : (
              selected?.icon
            )}
            <span className="truncate">{selected?.label ?? placeholder}</span>
          </span>
          {clearable && selected && !disabled ? (
            <span
              role="button"
              tabIndex={-1}
              aria-label="Kosongkan pilihan"
              className="text-muted-foreground hover:text-foreground -mr-1 rounded-sm p-0.5"
              onPointerDown={(event) => {
                // Cegah popover ikut terbuka saat tombol silang ditekan.
                event.preventDefault()
                event.stopPropagation()
                onValueChange(clearValue)
              }}
            >
              <XIcon className="size-3.5" />
            </span>
          ) : (
            <ChevronsUpDownIcon className="size-4 opacity-50" />
          )}
        </button>
      </PopoverTrigger>
      {name ? <input type="hidden" name={name} value={value ?? ""} /> : null}
      <PopoverContent
        align={align}
        className={cn(
          "z-[300] w-(--radix-popover-trigger-width) min-w-[12rem] p-0",
          contentClassName
        )}
      >
        <Command
          // Pencocokan sederhana: cocokkan seluruh kata kunci sebagai satu string.
          filter={(itemValue, search, keywords) => {
            const haystack = [itemValue, ...(keywords ?? [])]
              .join(" ")
              .toLowerCase()
            return haystack.includes(search.toLowerCase().trim()) ? 1 : 0
          }}
        >
          {showSearch ? <CommandInput placeholder={searchPlaceholder} /> : null}
          <CommandList id={listboxId}>
            <CommandEmpty>{emptyText}</CommandEmpty>
            {groups.map(({ heading, items }) => (
              <CommandGroup key={heading || "__ungrouped"} heading={heading || undefined}>
                {items.map((option) => (
                  <CommandItem
                    key={option.value}
                    value={option.value}
                    keywords={[option.label, option.description, ...(option.keywords ?? [])].filter(
                      Boolean
                    ) as string[]}
                    disabled={option.disabled}
                    onSelect={() => handleSelect(option)}
                  >
                    {option.icon}
                    <span className="flex min-w-0 flex-1 flex-col">
                      <span className="truncate">{option.label}</span>
                      {option.description ? (
                        <span className="text-muted-foreground truncate text-xs">
                          {option.description}
                        </span>
                      ) : null}
                    </span>
                    <CheckIcon
                      className={cn(
                        "ml-auto size-4",
                        option.value === value ? "opacity-100" : "opacity-0"
                      )}
                    />
                  </CommandItem>
                ))}
              </CommandGroup>
            ))}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  )
}

export { Combobox, SEARCH_THRESHOLD }

"use client";

import * as React from "react";
import {
  IconCalendar,
  IconChevronLeft,
  IconChevronRight,
  IconChevronDown,
} from "@tabler/icons-react";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { MONTH_NAMES } from "@/lib/kpi-utils";

const SHORT_MONTHS = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "Mei",
  "Jun",
  "Jul",
  "Agu",
  "Sep",
  "Okt",
  "Nov",
  "Des",
];

export interface MonthPickerProps {
  month: number;
  year: number;
  onSelect: (value: { month: number; year: number }) => void;
  className?: string;
  disabled?: boolean;
}

export function MonthPicker({
  month,
  year,
  onSelect,
  className,
  disabled,
}: MonthPickerProps) {
  const [open, setOpen] = React.useState(false);
  const [viewYear, setViewYear] = React.useState(year);
  const [showYearGrid, setShowYearGrid] = React.useState(false);

  // Sync viewYear when year prop changes
  React.useEffect(() => {
    setViewYear(year);
  }, [year]);

  const now = React.useMemo(() => new Date(), []);
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth() + 1; // 1-12

  // A month is disabled if it's in the future (after current year + month)
  const isMonthDisabled = (m: number, y: number) => {
    if (y > currentYear) return true;
    if (y === currentYear && m > currentMonth) return true;
    return false;
  };

  const handleSelectMonth = (m: number) => {
    if (isMonthDisabled(m, viewYear)) return;
    onSelect({ month: m, year: viewYear });
    setOpen(false);
  };

  const handlePrevYear = () => {
    setViewYear((prev) => prev - 1);
  };

  const handleNextYear = () => {
    if (viewYear < currentYear) {
      setViewYear((prev) => prev + 1);
    }
  };

  // Generate selectable years: 5 years in the past up to currentYear
  const yearOptions = React.useMemo(() => {
    const years: number[] = [];
    for (let y = currentYear - 5; y <= currentYear; y++) {
      years.push(y);
    }
    return years;
  }, [currentYear]);

  const selectedLabel = `${MONTH_NAMES[month]} ${year}`;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          disabled={disabled}
          className={`h-8 gap-2 px-3 text-xs font-medium justify-between ${className ?? ""}`}
        >
          <div className="flex items-center gap-1.5">
            <IconCalendar className="size-3.5 text-muted-foreground" />
            <span className="text-foreground">{selectedLabel}</span>
          </div>
          <IconChevronDown className="size-3.5 text-muted-foreground opacity-60" />
        </Button>
      </PopoverTrigger>

      <PopoverContent className="w-64 p-3 shadow-lg" align="end">
        {/* Header Tahun */}
        <div className="flex items-center justify-between pb-2 mb-2 border-b">
          <Button
            variant="ghost"
            size="icon"
            onClick={handlePrevYear}
            className="size-7 text-muted-foreground hover:text-foreground"
            title="Tahun Sebelumnya"
          >
            <IconChevronLeft className="size-4" />
          </Button>

          <Button
            variant="ghost"
            size="sm"
            onClick={() => setShowYearGrid((prev) => !prev)}
            className="h-7 px-2 font-bold text-sm tracking-tight hover:bg-muted"
          >
            <span>{viewYear}</span>
            <IconChevronDown
              className={`size-3.5 ml-1 transition-transform ${
                showYearGrid ? "rotate-180" : ""
              }`}
            />
          </Button>

          <Button
            variant="ghost"
            size="icon"
            onClick={handleNextYear}
            disabled={viewYear >= currentYear}
            className="size-7 text-muted-foreground hover:text-foreground disabled:opacity-30 disabled:pointer-events-none"
            title="Tahun Berikutnya"
          >
            <IconChevronRight className="size-4" />
          </Button>
        </div>

        {/* View Mode 1: Pilih Tahun Cepat */}
        {showYearGrid ? (
          <div className="grid grid-cols-3 gap-1.5 py-1">
            {yearOptions.map((y) => {
              const isSelected = y === viewYear;
              const isCurrent = y === currentYear;
              return (
                <Button
                  key={y}
                  size="sm"
                  variant={isSelected ? "default" : "outline"}
                  onClick={() => {
                    setViewYear(y);
                    setShowYearGrid(false);
                  }}
                  className={`h-8 text-xs font-medium ${
                    isSelected ? "font-bold" : ""
                  }`}
                >
                  {y}
                  {isCurrent && !isSelected && (
                    <span className="size-1 rounded-full bg-primary ml-1" />
                  )}
                </Button>
              );
            })}
          </div>
        ) : (
          /* View Mode 2: Grid 12 Bulan */
          <div className="grid grid-cols-3 gap-1.5 py-1">
            {SHORT_MONTHS.map((label, idx) => {
              const m = idx + 1;
              const isSelected = m === month && viewYear === year;
              const isCurrent = m === currentMonth && viewYear === currentYear;
              const isDisabled = isMonthDisabled(m, viewYear);

              return (
                <Button
                  key={m}
                  size="sm"
                  variant={isSelected ? "default" : "ghost"}
                  disabled={isDisabled}
                  onClick={() => handleSelectMonth(m)}
                  className={`h-8 text-xs font-medium relative transition-colors ${
                    isSelected
                      ? "bg-primary text-primary-foreground font-bold shadow-xs hover:bg-primary/90"
                      : isDisabled
                      ? "opacity-30 cursor-not-allowed text-muted-foreground hover:bg-transparent"
                      : "hover:bg-muted text-foreground"
                  }`}
                >
                  <span>{label}</span>
                  {/* Titik indikator penanda bulan saat ini */}
                  {isCurrent && !isSelected && !isDisabled && (
                    <span
                      className="absolute bottom-1 size-1 rounded-full bg-primary"
                      title="Bulan Ini"
                    />
                  )}
                </Button>
              );
            })}
          </div>
        )}

        {/* Shortcut Bawah: Cepat ke Bulan Ini & Bulan Lalu */}
        <div className="flex items-center justify-between pt-2 mt-2 border-t text-[0.7rem] text-muted-foreground">
          <button
            type="button"
            onClick={() => {
              const prevM = currentMonth === 1 ? 12 : currentMonth - 1;
              const prevY = currentMonth === 1 ? currentYear - 1 : currentYear;
              onSelect({ month: prevM, year: prevY });
              setOpen(false);
            }}
            className="hover:text-primary transition-colors hover:underline"
          >
            Bulan Lalu
          </button>

          <button
            type="button"
            onClick={() => {
              onSelect({ month: currentMonth, year: currentYear });
              setOpen(false);
            }}
            className="font-medium text-foreground hover:text-primary transition-colors hover:underline"
          >
            Bulan Ini ({SHORT_MONTHS[currentMonth - 1]})
          </button>
        </div>
      </PopoverContent>
    </Popover>
  );
}

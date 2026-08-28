"use client";

import type { Attendance, AttendanceStatus } from "@src/generated/prisma";
import { format, differenceInMinutes } from "date-fns";
import { id } from "date-fns/locale";
import {
  IconClock,
  IconCalendar,
  IconCheck,
  IconAlertTriangle,
  IconLogin,
  IconLogout,
  IconHourglass,
} from "@tabler/icons-react";
import { Badge } from "@/components/ui/badge";
import { useTranslations } from "next-intl";

type AttendanceWithCheckInBranch = Attendance & { checkInBranch?: { name: string } | null };

interface AttendanceHistoryProps {
  records: AttendanceWithCheckInBranch[];
}

function formatDuration(checkIn: Date, checkOut: Date): string {
  const mins = differenceInMinutes(checkOut, checkIn);
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  if (h === 0) return `${m}m`;
  return `${h}j ${m}m`;
}

export function AttendanceHistory({ records }: AttendanceHistoryProps) {
  const t = useTranslations("Dashboard.Attendance");

  const statusConfig: Record<AttendanceStatus, { label: string; color: string; icon: any }> = {
    PRESENT:    { label: t("status.present"),    color: "bg-success-muted text-success border-success/25", icon: IconCheck },
    LATE:       { label: t("status.late"),        color: "bg-warning-muted text-warning-foreground border-warning/25",       icon: IconClock },
    WFH:        { label: t("status.wfh"),         color: "bg-success-muted text-success border-success/25", icon: IconCheck },
    ABSENT:     { label: t("status.absent"),      color: "bg-destructive/10 text-destructive border-destructive/25",          icon: IconAlertTriangle },
    PERMISSION: { label: t("status.permission"),  color: "bg-info-muted text-info border-info/25",          icon: IconCalendar },
    SICK:       { label: t("status.sick"),         color: "bg-info-muted text-info border-info/25",    icon: IconCalendar },
    LEAVE:      { label: t("status.leave"),        color: "bg-info-muted text-info border-info/25",    icon: IconCalendar },
    HOLIDAY:    { label: t("status.holiday"),     color: "bg-muted text-foreground border-border",       icon: IconCalendar },
  };

  if (records.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center space-y-3">
        <div className="p-3 bg-muted rounded-full text-muted-foreground">
          <IconCalendar size={32} />
        </div>
        <p className="text-sm text-muted-foreground font-medium">{t("noHistory")}</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <h3 className="text-foreground text-lg font-semibold tracking-tight">{t("history")}</h3>

      <div className="border-border overflow-hidden rounded-xl border">
        {/* Header — teks kecil & muted, tanpa isian latar (lihat DATA_PRESENTATION §8) */}
        <div className="border-border grid grid-cols-[1fr_auto_auto_auto] gap-x-4 border-b px-4 py-2.5">
          <span className="text-muted-foreground text-xs font-medium tracking-wide uppercase">Tanggal</span>
          <span className="text-muted-foreground text-center text-xs font-medium tracking-wide uppercase">Masuk</span>
          <span className="text-muted-foreground text-center text-xs font-medium tracking-wide uppercase">Keluar</span>
          <span className="text-muted-foreground text-right text-xs font-medium tracking-wide uppercase">Durasi</span>
        </div>

        {/* Rows */}
        <div className="divide-y divide-border">
          {records.map((record) => {
            const config = statusConfig[record.status];
            const StatusIcon = config.icon;
            const checkInDate  = record.checkIn  ? new Date(record.checkIn)  : null;
            const checkOutDate = record.checkOut ? new Date(record.checkOut) : null;
            const duration = checkInDate && checkOutDate
              ? formatDuration(checkInDate, checkOutDate)
              : null;

            return (
              <div
                key={record.id}
                className="grid grid-cols-[1fr_auto_auto_auto] gap-x-4 items-center px-4 py-3 hover:bg-muted/70 transition-colors"
              >
                {/* Date + status */}
                <div className="flex items-center gap-3 min-w-0">
                  <div className={`flex-shrink-0 flex items-center justify-center h-8 w-8 rounded-lg ${config.color} border`}>
                    <StatusIcon size={15} />
                  </div>
                  <div className="min-w-0">
                    <p className="text-foreground truncate text-sm font-medium">
                      {format(new Date(record.date), "EEE, dd MMM", { locale: id })}
                    </p>
                    <Badge
                      variant="outline"
                      className={`mt-0.5 rounded-full px-2 py-0 text-[10px] font-medium tracking-wide uppercase ${config.color}`}
                    >
                      {config.label}
                    </Badge>
                  </div>
                </div>

                {/* Check-in */}
                <div className="flex flex-col items-center gap-1">
                  {checkInDate ? (
                    <>
                      <div className="text-success flex items-center gap-1">
                        <IconLogin size={12} />
                        <span className="tabular text-sm font-medium">
                          {format(checkInDate, "HH:mm")}
                        </span>
                      </div>
                      {record.checkInBranch && (
                        <span className="text-muted-foreground text-[10px] font-medium leading-none">
                          {record.checkInBranch.name}
                        </span>
                      )}
                      {record.checkInPhotoUrl && (
                        <a href={record.checkInPhotoUrl} target="_blank" rel="noopener noreferrer">
                          <img
                            src={record.checkInPhotoUrl}
                            alt="Foto masuk"
                            className="h-8 w-8 rounded-md object-cover border border-border hover:opacity-80 transition-opacity"
                          />
                        </a>
                      )}
                    </>
                  ) : (
                    <span className="text-xs text-muted-foreground font-medium">--:--</span>
                  )}
                </div>

                {/* Check-out */}
                <div className="flex flex-col items-center gap-1">
                  {checkOutDate ? (
                    <>
                      <div className="text-warning flex items-center gap-1">
                        <IconLogout size={12} />
                        <span className="tabular text-sm font-medium">
                          {format(checkOutDate, "HH:mm")}
                        </span>
                      </div>
                      {record.checkOutPhotoUrl && (
                        <a href={record.checkOutPhotoUrl} target="_blank" rel="noopener noreferrer">
                          <img
                            src={record.checkOutPhotoUrl}
                            alt="Foto keluar"
                            className="h-8 w-8 rounded-md object-cover border border-border hover:opacity-80 transition-opacity"
                          />
                        </a>
                      )}
                    </>
                  ) : checkInDate ? (
                    <span className="text-warning bg-warning-muted border-warning/25 rounded-full border px-1.5 py-0.5 text-[10px] font-medium whitespace-nowrap">
                      Belum
                    </span>
                  ) : (
                    <span className="text-xs text-muted-foreground font-medium">--:--</span>
                  )}
                </div>

                {/* Duration */}
                <div className="text-right">
                  {duration ? (
                    <div className="text-muted-foreground flex items-center justify-end gap-1">
                      <IconHourglass size={12} className="text-muted-foreground" />
                      <span className="tabular text-sm font-medium">{duration}</span>
                    </div>
                  ) : (
                    <span className="text-xs text-muted-foreground">—</span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

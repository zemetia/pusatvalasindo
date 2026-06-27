"use client";

import { Attendance, AttendanceStatus } from "@src/generated/prisma";
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

interface AttendanceHistoryProps {
  records: Attendance[];
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
    PRESENT:    { label: t("status.present"),    color: "bg-emerald-50 text-emerald-700 border-emerald-200", icon: IconCheck },
    LATE:       { label: t("status.late"),        color: "bg-amber-50 text-amber-700 border-amber-200",       icon: IconClock },
    ABSENT:     { label: t("status.absent"),      color: "bg-rose-50 text-rose-700 border-rose-200",          icon: IconAlertTriangle },
    PERMISSION: { label: t("status.permission"),  color: "bg-blue-50 text-blue-700 border-blue-200",          icon: IconCalendar },
    SICK:       { label: t("status.sick"),         color: "bg-indigo-50 text-indigo-700 border-indigo-200",    icon: IconCalendar },
    HOLIDAY:    { label: t("status.holiday"),     color: "bg-slate-50 text-slate-700 border-slate-200",       icon: IconCalendar },
  };

  if (records.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center space-y-3">
        <div className="p-3 bg-slate-50 rounded-full text-slate-300">
          <IconCalendar size={32} />
        </div>
        <p className="text-sm text-slate-500 font-medium">{t("noHistory")}</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <h3 className="text-lg font-bold text-slate-900 tracking-tight">{t("history")}</h3>

      <div className="rounded-2xl border border-slate-100 bg-white shadow-sm overflow-hidden">
        {/* Header */}
        <div className="grid grid-cols-[1fr_auto_auto_auto] gap-x-4 px-4 py-2.5 bg-slate-50 border-b border-slate-100">
          <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Tanggal</span>
          <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 text-center">Masuk</span>
          <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 text-center">Keluar</span>
          <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 text-right">Durasi</span>
        </div>

        {/* Rows */}
        <div className="divide-y divide-slate-50">
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
                className="grid grid-cols-[1fr_auto_auto_auto] gap-x-4 items-center px-4 py-3 hover:bg-slate-50/70 transition-colors"
              >
                {/* Date + status */}
                <div className="flex items-center gap-3 min-w-0">
                  <div className={`flex-shrink-0 flex items-center justify-center h-8 w-8 rounded-lg ${config.color} border`}>
                    <StatusIcon size={15} />
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-bold text-slate-800 truncate">
                      {format(new Date(record.date), "EEE, dd MMM", { locale: id })}
                    </p>
                    <Badge
                      variant="outline"
                      className={`mt-0.5 rounded-full px-2 py-0 text-[10px] font-bold uppercase tracking-wider ${config.color}`}
                    >
                      {config.label}
                    </Badge>
                  </div>
                </div>

                {/* Check-in */}
                <div className="flex flex-col items-center gap-1">
                  {checkInDate ? (
                    <>
                      <div className="flex items-center gap-1 text-emerald-700">
                        <IconLogin size={12} />
                        <span className="text-xs font-bold">{format(checkInDate, "HH:mm")}</span>
                      </div>
                      {record.checkInPhotoUrl && (
                        <a href={record.checkInPhotoUrl} target="_blank" rel="noopener noreferrer">
                          <img
                            src={record.checkInPhotoUrl}
                            alt="Foto masuk"
                            className="h-8 w-8 rounded-md object-cover border border-slate-200 hover:opacity-80 transition-opacity"
                          />
                        </a>
                      )}
                    </>
                  ) : (
                    <span className="text-xs text-slate-300 font-medium">--:--</span>
                  )}
                </div>

                {/* Check-out */}
                <div className="flex flex-col items-center gap-1">
                  {checkOutDate ? (
                    <>
                      <div className="flex items-center gap-1 text-amber-600">
                        <IconLogout size={12} />
                        <span className="text-xs font-bold">{format(checkOutDate, "HH:mm")}</span>
                      </div>
                      {record.checkOutPhotoUrl && (
                        <a href={record.checkOutPhotoUrl} target="_blank" rel="noopener noreferrer">
                          <img
                            src={record.checkOutPhotoUrl}
                            alt="Foto keluar"
                            className="h-8 w-8 rounded-md object-cover border border-slate-200 hover:opacity-80 transition-opacity"
                          />
                        </a>
                      )}
                    </>
                  ) : checkInDate ? (
                    <span className="text-[10px] text-amber-500 font-semibold bg-amber-50 px-1.5 py-0.5 rounded-full border border-amber-100 whitespace-nowrap">
                      Belum
                    </span>
                  ) : (
                    <span className="text-xs text-slate-300 font-medium">--:--</span>
                  )}
                </div>

                {/* Duration */}
                <div className="text-right">
                  {duration ? (
                    <div className="flex items-center justify-end gap-1 text-slate-600">
                      <IconHourglass size={12} className="text-slate-400" />
                      <span className="text-xs font-bold">{duration}</span>
                    </div>
                  ) : (
                    <span className="text-xs text-slate-300">—</span>
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

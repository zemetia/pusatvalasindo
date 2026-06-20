"use client";

import { Attendance, AttendanceStatus } from "@src/generated/prisma";
import { format } from "date-fns";
import { id } from "date-fns/locale";
import { IconClock, IconCalendar, IconCheck, IconAlertTriangle } from "@tabler/icons-react";
import { Badge } from "@/components/ui/badge";
import { useTranslations } from "next-intl";

interface AttendanceHistoryProps {
  records: Attendance[];
}

export function AttendanceHistory({ records }: AttendanceHistoryProps) {
  const t = useTranslations("Dashboard.Attendance");

  const statusConfig: Record<AttendanceStatus, { label: string; color: string; icon: any }> = {
    PRESENT: { label: t("status.present"), color: "bg-emerald-50 text-emerald-700 border-emerald-100", icon: IconCheck },
    LATE: { label: t("status.late"), color: "bg-amber-50 text-amber-700 border-amber-100", icon: IconClock },
    ABSENT: { label: t("status.absent"), color: "bg-rose-50 text-rose-700 border-rose-100", icon: IconAlertTriangle },
    PERMISSION: { label: t("status.permission"), color: "bg-blue-50 text-blue-700 border-blue-100", icon: IconCalendar },
    SICK: { label: t("status.sick"), color: "bg-indigo-50 text-indigo-700 border-indigo-100", icon: IconCalendar },
    HOLIDAY: { label: t("status.holiday"), color: "bg-slate-50 text-slate-700 border-slate-100", icon: IconCalendar },
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
      <div className="grid gap-3">
        {records.map((record) => {
          const config = statusConfig[record.status];
          const StatusIcon = config.icon;
          
          return (
            <div
              key={record.id}
              className="group flex items-center justify-between p-4 bg-white rounded-2xl border border-slate-100 shadow-sm transition-all hover:shadow-md hover:border-slate-200"
            >
              <div className="flex items-center gap-4">
                <div className={`flex items-center justify-center h-10 w-10 rounded-xl ${config.color} border`}>
                  <StatusIcon size={20} />
                </div>
                <div>
                  <p className="text-sm font-bold text-slate-900">
                    {format(new Date(record.date), "EEEE, dd MMM", { locale: id })}
                  </p>
                  <p className="text-xs text-slate-500 font-medium">
                    {record.checkIn ? format(new Date(record.checkIn), "HH:mm") : "--:--"} WIB
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <Badge variant="outline" className={`rounded-full px-3 py-0.5 text-[10px] font-bold uppercase tracking-wider ${config.color}`}>
                  {config.label}
                </Badge>
                {record.checkInPhotoUrl && (
                  <div className="h-10 w-10 rounded-lg overflow-hidden border border-slate-200">
                    <img 
                      src={record.checkInPhotoUrl} 
                      alt="Check-in photo" 
                      className="h-full w-full object-cover grayscale group-hover:grayscale-0 transition-all"
                    />
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

"use client";

import { useState, useMemo } from "react";
import { Attendance } from "@src/generated/prisma";
import { LiveClock } from "@/components/attendance/live-clock";
import { CameraCapture } from "@/components/attendance/camera-capture";
import { LocationStatus } from "@/components/attendance/location-status";
import { AttendanceHistory } from "@/components/attendance/attendance-history";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { toast } from "sonner";
import { IconFingerprint, IconLoader2 } from "@tabler/icons-react";
import { format } from "date-fns";
import { useTranslations } from "next-intl";

interface AttendanceClientProps {
  userId: string;
  initialRecords: Attendance[];
}

export function AttendanceClient({ userId, initialRecords }: AttendanceClientProps) {
  const t = useTranslations("Dashboard.Attendance");
  const [records, setRecords] = useState<Attendance[]>(initialRecords);
  const [capturedFile, setCapturedFile] = useState<File | null>(null);
  const [capturedImage, setCapturedImage] = useState<string | null>(null);
  const [location, setLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const todayRecord = useMemo(() => {
    const today = format(new Date(), "yyyy-MM-dd");
    return records.find((r) => format(new Date(r.date), "yyyy-MM-dd") === today);
  }, [records]);

  const handleCapture = (file: File) => {
    setCapturedFile(file);
  };

  const handleSubmit = async () => {
    if (!capturedFile) {
      toast.error(t("alerts.noPhoto"));
      return;
    }
    if (!location) {
      toast.error(t("alerts.noLocation"));
      return;
    }

    setIsSubmitting(true);
    try {
      // 1. Upload photo to Supabase
      const formData = new FormData();
      formData.append("photo", capturedFile);

      const uploadRes = await fetch("/api/attendance/upload", {
        method: "POST",
        body: formData,
      });

      if (!uploadRes.ok) {
        const error = await uploadRes.json();
        throw new Error(error.error || t("alerts.uploadError"));
      }

      const { url } = await uploadRes.json();

      // 2. Submit attendance
      const localDate = format(new Date(), "yyyy-MM-dd");
      const attendanceRes = await fetch("/api/attendance", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          date: localDate,
          checkIn: new Date().toISOString(),
          checkInPhotoUrl: url,
          checkInGpsLat: location.lat,
          checkInGpsLng: location.lng,
          checkInManualLat: location.lat,
          checkInManualLng: location.lng,
          notes: "Presensi mandiri",
        }),
      });

      if (!attendanceRes.ok) {
        const error = await attendanceRes.json();
        throw new Error(error.error || t("alerts.submitError"));
      }

      const newRecord = await attendanceRes.json();
      
      setRecords((prev) => [newRecord, ...prev]);
      setCapturedFile(null);
      setCapturedImage(null);
      toast.success(t("alerts.success"));
    } catch (err: any) {
      console.error(err);
      toast.error(err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
      {/* Left Column: Action */}
      <div className="lg:col-span-7 space-y-6">
        <Card className="border-none shadow-xl bg-white/50 backdrop-blur-xl ring-1 ring-slate-200">
          <CardHeader>
            <CardTitle className="text-xl font-bold flex items-center gap-2">
              <div className="p-2 bg-primary rounded-lg text-white">
                <IconFingerprint size={20} />
              </div>
              {t("checkIn")}
            </CardTitle>
            <CardDescription>
              {t("checkInDesc")}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <LiveClock />
            
            {!todayRecord ? (
              <>
                <CameraCapture 
                  onCapture={handleCapture} 
                  capturedImage={capturedImage}
                  setCapturedImage={setCapturedImage}
                />
                
                <LocationStatus onLocationChange={(lat, lng) => setLocation({ lat, lng })} />
                
                <Button 
                  onClick={handleSubmit} 
                  disabled={isSubmitting || !capturedFile || !location}
                  className="w-full h-14 text-lg font-bold rounded-2xl shadow-lg shadow-primary/20 transition-all hover:scale-[1.02] active:scale-[0.98]"
                >
                  {isSubmitting ? (
                    <>
                      <IconLoader2 className="mr-2 h-5 w-5 animate-spin" />
                      {t("processing")}
                    </>
                  ) : (
                    t("confirm")
                  )}
                </Button>
              </>
            ) : (
              <div className="flex flex-col items-center justify-center py-10 space-y-4 bg-emerald-50 rounded-3xl border border-emerald-100 animate-in zoom-in duration-500">
                <div className="h-20 w-20 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center">
                  <IconFingerprint size={48} />
                </div>
                <div className="text-center">
                  <h3 className="text-xl font-bold text-emerald-900">{t("alreadyCheckedIn")}</h3>
                  <p className="text-emerald-700/70 font-medium">
                    Pukul {format(new Date(todayRecord.checkIn!), "HH:mm")} WIB
                  </p>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Right Column: History */}
      <div className="lg:col-span-5">
        <AttendanceHistory records={records} />
      </div>
    </div>
  );
}

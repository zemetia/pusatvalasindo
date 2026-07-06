"use client";

import { useState, useMemo, useCallback } from "react";
import { Attendance } from "@src/generated/prisma";
import { LiveClock } from "@/components/attendance/live-clock";
import { CameraCapture } from "@/components/attendance/camera-capture";
import { LocationStatus } from "@/components/attendance/location-status";
import { AttendanceHistory } from "@/components/attendance/attendance-history";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { toast } from "sonner";
import { IconFingerprint, IconLoader2, IconLogout } from "@tabler/icons-react";
import { format } from "date-fns";
import { useTranslations } from "next-intl";

interface BranchGeofence {
  latitude: number;
  longitude: number;
  radiusM: number;
  name: string;
}

interface AttendanceClientProps {
  userId: string;
  initialRecords: Attendance[];
  branchGeofence?: BranchGeofence | null;
}

function haversineMeters(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371000;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

// Fresh reading taken at the moment of submit, rather than reusing the last
// background watchPosition tick — the position used for the geofence check
// should reflect where the user is right now, not a few seconds ago.
function getCurrentLocation(): Promise<{ lat: number; lng: number }> {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(new Error("Geolokasi tidak didukung oleh browser Anda."));
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (position) => resolve({ lat: position.coords.latitude, lng: position.coords.longitude }),
      () => reject(new Error("Gagal mendapatkan lokasi terkini. Pastikan GPS aktif.")),
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
    );
  });
}

export function AttendanceClient({ userId, initialRecords, branchGeofence }: AttendanceClientProps) {
  const t = useTranslations("Dashboard.Attendance");
  const [records, setRecords] = useState<Attendance[]>(initialRecords);
  const [capturedFile, setCapturedFile] = useState<File | null>(null);
  const [capturedImage, setCapturedImage] = useState<string | null>(null);
  const [location, setLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Checkout state
  const [checkoutFile, setCheckoutFile] = useState<File | null>(null);
  const [checkoutImage, setCheckoutImage] = useState<string | null>(null);
  const [isCheckingOut, setIsCheckingOut] = useState(false);

  const todayRecord = useMemo(() => {
    const today = format(new Date(), "yyyy-MM-dd");
    return records.find((r) => format(new Date(r.date), "yyyy-MM-dd") === today);
  }, [records]);

  const handleCapture = (file: File) => {
    setCapturedFile(file);
  };

  const handleLocationChange = useCallback((lat: number, lng: number) => {
    setLocation({ lat, lng });
  }, []);

  const handleCheckout = async () => {
    if (!checkoutFile) {
      toast.error("Ambil foto dulu sebelum checkout.");
      return;
    }

    setIsCheckingOut(true);
    try {
      const formData = new FormData();
      formData.append("photo", checkoutFile);

      const uploadRes = await fetch("/api/attendance/upload?type=checkout", {
        method: "POST",
        body: formData,
      });

      if (!uploadRes.ok) {
        let msg = "Gagal upload foto checkout.";
        try { const d = await uploadRes.json(); msg = d.error || msg; } catch {}
        throw new Error(msg);
      }

      const { url } = await uploadRes.json();

      const localDate = format(new Date(), "yyyy-MM-dd");
      const checkoutRes = await fetch("/api/attendance", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          date: localDate,
          checkOut: new Date().toISOString(),
          checkOutPhotoUrl: url,
        }),
      });

      if (!checkoutRes.ok) {
        let msg = "Gagal menyimpan checkout.";
        try { const d = await checkoutRes.json(); msg = d.error || msg; } catch {}
        throw new Error(msg);
      }

      const updated = await checkoutRes.json();
      setRecords((prev) =>
        prev.map((r) =>
          format(new Date(r.date), "yyyy-MM-dd") === localDate ? updated : r
        )
      );
      setCheckoutFile(null);
      setCheckoutImage(null);
      toast.success("Checkout berhasil!");
    } catch (err: any) {
      console.error(err);
      toast.error(err.message);
    } finally {
      setIsCheckingOut(false);
    }
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
      // Re-check the GPS position right now, at the moment of submit
      const currentLocation = await getCurrentLocation();
      setLocation(currentLocation);

      if (branchGeofence) {
        const distM = haversineMeters(
          currentLocation.lat,
          currentLocation.lng,
          branchGeofence.latitude,
          branchGeofence.longitude
        );
        if (distM > branchGeofence.radiusM) {
          toast.error("Tidak bisa absen karena di luar dari area kantor.");
          return;
        }
      }

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
          checkInGpsLat: currentLocation.lat,
          checkInGpsLng: currentLocation.lng,
          checkInManualLat: currentLocation.lat,
          checkInManualLng: currentLocation.lng,
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
              <div className={`p-2 rounded-lg text-white ${todayRecord && !todayRecord.checkOut ? "bg-amber-500" : "bg-primary"}`}>
                {todayRecord && !todayRecord.checkOut ? <IconLogout size={20} /> : <IconFingerprint size={20} />}
              </div>
              {todayRecord && !todayRecord.checkOut ? "Check Out" : t("checkIn")}
            </CardTitle>
            <CardDescription>
              {todayRecord && !todayRecord.checkOut
                ? "Ambil foto dan konfirmasi check out Anda."
                : t("checkInDesc")}
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

                <LocationStatus
                  onLocationChange={handleLocationChange}
                  geofence={branchGeofence}
                />

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
            ) : todayRecord.checkOut ? (
              /* Already checked in AND checked out */
              <div className="flex flex-col items-center justify-center py-10 space-y-4 bg-slate-50 rounded-3xl border border-slate-200 animate-in zoom-in duration-500">
                <div className="flex gap-6">
                  <div className="text-center">
                    <p className="text-xs font-semibold uppercase tracking-widest text-slate-400 mb-1">Check In</p>
                    <p className="text-lg font-bold text-slate-700">
                      {format(new Date(todayRecord.checkIn!), "HH:mm")} WIB
                    </p>
                  </div>
                  <div className="w-px bg-slate-200" />
                  <div className="text-center">
                    <p className="text-xs font-semibold uppercase tracking-widest text-slate-400 mb-1">Check Out</p>
                    <p className="text-lg font-bold text-slate-700">
                      {format(new Date(todayRecord.checkOut), "HH:mm")} WIB
                    </p>
                  </div>
                </div>
                <p className="text-sm text-slate-500 font-medium">Presensi hari ini selesai.</p>
              </div>
            ) : (
              /* Checked in, waiting for checkout */
              <div className="space-y-6">
                <div className="flex items-center justify-between px-4 py-3 bg-emerald-50 rounded-2xl border border-emerald-100">
                  <div className="flex items-center gap-3">
                    <div className="h-9 w-9 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center">
                      <IconFingerprint size={20} />
                    </div>
                    <div>
                      <p className="text-xs font-semibold text-emerald-700 uppercase tracking-wide">Check In</p>
                      <p className="text-sm font-bold text-emerald-900">
                        Pukul {format(new Date(todayRecord.checkIn!), "HH:mm")} WIB
                      </p>
                    </div>
                  </div>
                </div>

                <div>
                  <p className="text-sm font-semibold text-slate-600 mb-3">Foto Check Out</p>
                  <CameraCapture
                    onCapture={setCheckoutFile}
                    capturedImage={checkoutImage}
                    setCapturedImage={setCheckoutImage}
                  />
                </div>

                <Button
                  onClick={handleCheckout}
                  disabled={isCheckingOut || !checkoutFile}
                  variant="secondary"
                  className="w-full h-14 text-lg font-bold rounded-2xl transition-all hover:scale-[1.02] active:scale-[0.98] bg-amber-500 hover:bg-amber-600 text-white shadow-lg shadow-amber-200"
                >
                  {isCheckingOut ? (
                    <>
                      <IconLoader2 className="mr-2 h-5 w-5 animate-spin" />
                      Memproses...
                    </>
                  ) : (
                    <>
                      <IconLogout className="mr-2 h-5 w-5" />
                      Check Out
                    </>
                  )}
                </Button>
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

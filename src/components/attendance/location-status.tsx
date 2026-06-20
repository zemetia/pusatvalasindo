"use client";

import { useEffect, useState } from "react";
import { IconMapPin, IconAlertCircle, IconCheck } from "@tabler/icons-react";

interface LocationStatusProps {
  onLocationChange: (lat: number, lng: number) => void;
}

export function LocationStatus({ onLocationChange }: LocationStatusProps) {
  const [status, setStatus] = useState<"loading" | "success" | "error">("loading");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    if (!navigator.geolocation) {
      setStatus("error");
      setErrorMsg("Geolokasi tidak didukung oleh browser Anda.");
      return;
    }

    const watchId = navigator.geolocation.watchPosition(
      (position) => {
        setStatus("success");
        onLocationChange(position.coords.latitude, position.coords.longitude);
      },
      (error) => {
        setStatus("error");
        switch (error.code) {
          case error.PERMISSION_DENIED:
            setErrorMsg("Izin lokasi ditolak. Aktifkan lokasi di pengaturan browser.");
            break;
          case error.POSITION_UNAVAILABLE:
            setErrorMsg("Informasi lokasi tidak tersedia.");
            break;
          case error.TIMEOUT:
            setErrorMsg("Waktu permintaan lokasi habis.");
            break;
          default:
            setErrorMsg("Gagal mendapatkan lokasi.");
        }
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
    );

    return () => navigator.geolocation.clearWatch(watchId);
  }, [onLocationChange]);

  return (
    <div className="flex flex-col space-y-3 p-4 rounded-2xl bg-slate-50 border border-slate-100">
      <div className="flex items-center gap-3">
        <div className={`p-2 rounded-xl ${
          status === "success" ? "bg-emerald-100 text-emerald-600" : 
          status === "error" ? "bg-rose-100 text-rose-600" : 
          "bg-blue-100 text-blue-600 animate-pulse"
        }`}>
          <IconMapPin size={20} />
        </div>
        <div className="flex-1">
          <h4 className="text-sm font-bold text-slate-800">Status Lokasi</h4>
          <p className="text-xs text-slate-500 leading-tight">
            {status === "loading" && "Mencari koordinat GPS..."}
            {status === "success" && "Lokasi terdeteksi secara akurat"}
            {status === "error" && errorMsg}
          </p>
        </div>
        {status === "success" && (
          <div className="h-2 w-2 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.6)]" />
        )}
      </div>
    </div>
  );
}

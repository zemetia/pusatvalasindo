"use client";

import { useEffect, useState } from "react";
import { IconMapPin, IconAlertCircle, IconCheck, IconRadar } from "@tabler/icons-react";

interface Geofence {
  latitude: number;
  longitude: number;
  radiusM: number;
  name: string;
}

interface LocationStatusProps {
  onLocationChange: (lat: number, lng: number) => void;
  // Semua cabang bergeofence, lintas PT — karyawan dianggap sedang di kantor
  // kalau masuk radius SALAH SATU.
  geofences?: Geofence[];
}

function haversineM(lat1: number, lng1: number, lat2: number, lng2: number): number {
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

export function LocationStatus({ onLocationChange, geofences = [] }: LocationStatusProps) {
  const [status, setStatus] = useState<"loading" | "success" | "error">("loading");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  // Cabang terdekat dari posisi saat ini, dari semua cabang bergeofence.
  const [nearest, setNearest] = useState<{ name: string; distanceM: number; radiusM: number } | null>(null);

  useEffect(() => {
    if (!navigator.geolocation) {
      setStatus("error");
      setErrorMsg("Geolokasi tidak didukung oleh browser Anda.");
      return;
    }

    const watchId = navigator.geolocation.watchPosition(
      (position) => {
        const { latitude, longitude } = position.coords;
        setStatus("success");
        onLocationChange(latitude, longitude);
        if (geofences.length > 0) {
          const closest = geofences
            .map((g) => ({
              name: g.name,
              radiusM: g.radiusM,
              distanceM: Math.round(haversineM(latitude, longitude, g.latitude, g.longitude)),
            }))
            .sort((a, b) => a.distanceM - b.distanceM)[0];
          setNearest(closest);
        }
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
  }, [onLocationChange, geofences]);

  const isInsideRadius = nearest != null && nearest.distanceM <= nearest.radiusM;
  const showGeofence = geofences.length > 0 && status === "success" && nearest != null;

  return (
    <div className="flex flex-col space-y-3 p-4 rounded-2xl bg-muted border border-border">
      <div className="flex items-center gap-3">
        <div className={`p-2 rounded-xl ${
          status === "success" ? "bg-success-muted text-success" :
          status === "error" ? "bg-destructive/10 text-destructive" :
          "bg-info-muted text-info animate-pulse"
        }`}>
          <IconMapPin size={20} />
        </div>
        <div className="flex-1">
          <h4 className="text-sm font-bold text-foreground">Status Lokasi</h4>
          <p className="text-xs text-muted-foreground leading-tight">
            {status === "loading" && "Mencari koordinat GPS..."}
            {status === "success" && "Lokasi terdeteksi secara akurat"}
            {status === "error" && errorMsg}
          </p>
        </div>
        {status === "success" && (
          <div className="h-2 w-2 rounded-full bg-success shadow-[0_0_8px_rgba(16,185,129,0.6)]" />
        )}
      </div>

      {showGeofence && (
        <div className={`flex items-center gap-3 px-3 py-2.5 rounded-xl border ${
          isInsideRadius
            ? "bg-success-muted border-success/25 text-success"
            : "bg-destructive/10 border-destructive/25 text-destructive"
        }`}>
          <div className={`p-1.5 rounded-lg ${isInsideRadius ? "bg-success-muted" : "bg-destructive/10"}`}>
            {isInsideRadius ? <IconCheck size={16} /> : <IconAlertCircle size={16} />}
          </div>
          <div className="flex-1">
            <p className="text-xs font-bold leading-tight">
              {isInsideRadius
                ? `Dalam radius cabang ${nearest.name}`
                : `Di luar area kantor (terdekat: ${nearest.name})`}
            </p>
            <p className="text-[11px] opacity-75 mt-0.5">
              Jarak Anda: <span className="font-semibold">{nearest.distanceM} m</span>
              {" · "}Radius absensi: <span className="font-semibold">{nearest.radiusM} m</span>
            </p>
          </div>
          <IconRadar size={18} className="opacity-50 shrink-0" />
        </div>
      )}
    </div>
  );
}

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
  geofence?: Geofence | null;
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

export function LocationStatus({ onLocationChange, geofence }: LocationStatusProps) {
  const [status, setStatus] = useState<"loading" | "success" | "error">("loading");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [distanceM, setDistanceM] = useState<number | null>(null);

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
        if (geofence) {
          setDistanceM(Math.round(haversineM(latitude, longitude, geofence.latitude, geofence.longitude)));
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
  }, [onLocationChange, geofence]);

  const isInsideRadius = geofence && distanceM != null && distanceM <= geofence.radiusM;
  const showGeofence = geofence && status === "success" && distanceM != null;

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

      {showGeofence && (
        <div className={`flex items-center gap-3 px-3 py-2.5 rounded-xl border ${
          isInsideRadius
            ? "bg-emerald-50 border-emerald-200 text-emerald-700"
            : "bg-rose-50 border-rose-200 text-rose-700"
        }`}>
          <div className={`p-1.5 rounded-lg ${isInsideRadius ? "bg-emerald-100" : "bg-rose-100"}`}>
            {isInsideRadius ? <IconCheck size={16} /> : <IconAlertCircle size={16} />}
          </div>
          <div className="flex-1">
            <p className="text-xs font-bold leading-tight">
              {isInsideRadius
                ? `Dalam radius cabang ${geofence.name}`
                : `Di luar radius cabang ${geofence.name}`}
            </p>
            <p className="text-[11px] opacity-75 mt-0.5">
              Jarak Anda: <span className="font-semibold">{distanceM} m</span>
              {" · "}Radius absensi: <span className="font-semibold">{geofence.radiusM} m</span>
            </p>
          </div>
          <IconRadar size={18} className="opacity-50 shrink-0" />
        </div>
      )}
    </div>
  );
}

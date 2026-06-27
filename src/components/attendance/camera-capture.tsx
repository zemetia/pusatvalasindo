"use client";

import { useRef, useState, useCallback, useEffect } from "react";
import {
  IconCamera,
  IconRefresh,
  IconCheck,
  IconLoader2,
  IconAlertCircle,
} from "@tabler/icons-react";
import { Button } from "@/components/ui/button";
import { compressPhoto } from "@/lib/image-compress";

interface CameraCaptureProps {
  onCapture: (file: File) => void;
  capturedImage: string | null;
  setCapturedImage: (url: string | null) => void;
}

type CameraState = "idle" | "requesting" | "active" | "error";

const ERROR_MESSAGES: Record<string, string> = {
  NotAllowedError:
    "Izin kamera ditolak. Buka pengaturan situs dan izinkan akses kamera, lalu muat ulang halaman.",
  PermissionDeniedError:
    "Izin kamera ditolak. Buka pengaturan situs dan izinkan akses kamera, lalu muat ulang halaman.",
  NotFoundError: "Kamera tidak ditemukan di perangkat ini.",
  DevicesNotFoundError: "Kamera tidak ditemukan di perangkat ini.",
  NotReadableError:
    "Kamera sedang digunakan oleh aplikasi lain. Tutup aplikasi tersebut lalu coba lagi.",
  TrackStartError:
    "Kamera sedang digunakan oleh aplikasi lain. Tutup aplikasi tersebut lalu coba lagi.",
  OverconstrainedError: "Resolusi kamera tidak didukung perangkat ini.",
};

export function CameraCapture({
  onCapture,
  capturedImage,
  setCapturedImage,
}: CameraCaptureProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [cameraState, setCameraState] = useState<CameraState>("idle");
  const [errorMessage, setErrorMessage] = useState("");
  const [isCapturing, setIsCapturing] = useState(false);

  const stopStream = useCallback(() => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
  }, []);

  useEffect(() => () => stopStream(), [stopStream]);

  const startCamera = useCallback(async () => {
    setCameraState("requesting");
    setErrorMessage("");

    // Try progressively relaxed constraints — handles OverconstrainedError on some devices
    const attempts: MediaStreamConstraints[] = [
      { video: { facingMode: "user", width: { ideal: 1280 }, height: { ideal: 720 } } },
      { video: { facingMode: "user" } },
      { video: true },
    ];

    let stream: MediaStream | null = null;
    let lastError: unknown;

    for (const constraints of attempts) {
      try {
        stream = await navigator.mediaDevices.getUserMedia(constraints);
        break;
      } catch (err) {
        lastError = err;
        const name = err instanceof DOMException ? err.name : "";
        // Permission denied — no point trying relaxed constraints
        if (name === "NotAllowedError" || name === "PermissionDeniedError") break;
      }
    }

    if (!stream) {
      const name =
        lastError instanceof DOMException ? lastError.name : "UnknownError";
      setErrorMessage(
        ERROR_MESSAGES[name] ?? `Gagal membuka kamera (${name}). Coba muat ulang halaman.`
      );
      setCameraState("error");
      return;
    }

    streamRef.current = stream;

    if (videoRef.current) {
      videoRef.current.srcObject = stream;
      // iOS Safari requires play() to be called explicitly after srcObject is set
      try {
        await videoRef.current.play();
      } catch {
        // Ignore — autoPlay attribute handles most cases
      }
    }

    setCameraState("active");
  }, []);

  const capturePhoto = useCallback(async () => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas || isCapturing) return;

    setIsCapturing(true);
    try {
      const w = video.videoWidth || 640;
      const h = video.videoHeight || 480;
      canvas.width = w;
      canvas.height = h;

      const ctx = canvas.getContext("2d");
      if (!ctx) throw new Error("Canvas context unavailable");

      // Mirror horizontally so the saved photo matches what the user sees (selfie style)
      ctx.translate(w, 0);
      ctx.scale(-1, 1);
      ctx.drawImage(video, 0, 0, w, h);

      const blob = await new Promise<Blob>((resolve, reject) => {
        // toBlob is widely supported; fall back to toDataURL on very old WebViews
        if (canvas.toBlob) {
          canvas.toBlob(
            (b) => (b ? resolve(b) : reject(new Error("toBlob returned null"))),
            "image/jpeg",
            0.92
          );
        } else {
          const dataUrl = canvas.toDataURL("image/jpeg", 0.92);
          fetch(dataUrl)
            .then((r) => r.blob())
            .then(resolve)
            .catch(reject);
        }
      });

      const file = new File([blob], "capture.jpg", { type: "image/jpeg" });
      const compressed = await compressPhoto(file);

      const dataUrl = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(reader.result as string);
        reader.onerror = reject;
        reader.readAsDataURL(compressed);
      });

      stopStream();
      setCapturedImage(dataUrl);
      onCapture(compressed);
      setCameraState("idle");
    } catch (err) {
      console.error("Capture error:", err);
      setErrorMessage("Gagal mengambil foto. Silakan coba lagi.");
      setCameraState("error");
    } finally {
      setIsCapturing(false);
    }
  }, [isCapturing, onCapture, setCapturedImage, stopStream]);

  const resetCapture = () => {
    setCapturedImage(null);
    setCameraState("idle");
    setErrorMessage("");
  };

  return (
    <div className="flex flex-col items-center space-y-4 w-full max-w-md mx-auto">
      <div className="relative aspect-square w-full bg-slate-100 rounded-3xl overflow-hidden border-4 border-white shadow-2xl ring-1 ring-slate-200">
        {/* Hidden canvas — used only for capturing frames */}
        <canvas ref={canvasRef} className="hidden" />

        {capturedImage ? (
          <img
            src={capturedImage}
            alt="Captured"
            className="h-full w-full object-cover"
          />
        ) : (
          <>
            {/*
              Video is always in the DOM when camera is active so the stream
              attaches without remounting. CSS hides it while not active.
            */}
            <video
              ref={videoRef}
              autoPlay
              playsInline
              muted
              className={`h-full w-full object-cover scale-x-[-1] ${
                cameraState === "active" ? "block" : "hidden"
              }`}
            />

            {cameraState === "idle" && (
              <div className="flex flex-col items-center justify-center h-full space-y-4 p-8 text-center">
                <div className="p-4 bg-slate-200 rounded-full">
                  <IconCamera size={48} className="text-slate-400" />
                </div>
                <p className="text-sm text-slate-500 font-medium">
                  Ambil foto diri untuk memulai presensi
                </p>
                <Button onClick={startCamera} className="rounded-full px-8">
                  Buka Kamera
                </Button>
              </div>
            )}

            {cameraState === "requesting" && (
              <div className="flex flex-col items-center justify-center h-full space-y-3 text-slate-400">
                <IconLoader2 size={40} className="animate-spin" />
                <p className="text-sm font-medium">Membuka kamera...</p>
              </div>
            )}

            {cameraState === "error" && (
              <div className="flex flex-col items-center justify-center h-full space-y-4 p-8 text-center">
                <div className="p-4 bg-red-100 rounded-full">
                  <IconAlertCircle size={40} className="text-red-500" />
                </div>
                <p className="text-sm text-red-600 font-medium leading-snug">
                  {errorMessage}
                </p>
                <Button
                  onClick={startCamera}
                  variant="outline"
                  className="rounded-full px-8"
                >
                  Coba Lagi
                </Button>
              </div>
            )}
          </>
        )}

        {/* Shutter button */}
        {cameraState === "active" && !capturedImage && (
          <div className="absolute bottom-6 left-1/2 -translate-x-1/2 z-20">
            <button
              onClick={capturePhoto}
              disabled={isCapturing}
              className="group relative flex h-16 w-16 items-center justify-center rounded-full bg-white shadow-2xl ring-4 ring-white/30 transition-all hover:scale-110 active:scale-90 disabled:opacity-50 cursor-pointer pointer-events-auto"
            >
              {isCapturing ? (
                <IconLoader2 className="h-8 w-8 animate-spin text-primary" />
              ) : (
                <div className="h-12 w-12 rounded-full border-2 border-slate-900 transition-colors group-hover:bg-slate-100" />
              )}
            </button>
          </div>
        )}

        {/* Retake button */}
        {capturedImage && (
          <div className="absolute top-4 right-4">
            <Button
              size="icon"
              variant="secondary"
              onClick={resetCapture}
              className="rounded-full bg-white/90 backdrop-blur shadow-sm hover:bg-white"
            >
              <IconRefresh size={18} />
            </Button>
          </div>
        )}
      </div>

      {capturedImage && (
        <div className="flex items-center gap-2 text-emerald-600 font-semibold bg-emerald-50 px-4 py-2 rounded-full border border-emerald-100 animate-in fade-in zoom-in duration-300">
          <IconCheck size={18} />
          <span>Foto berhasil diambil</span>
        </div>
      )}
    </div>
  );
}

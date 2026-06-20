"use client";

import { useRef, useState, useCallback } from "react";
import Webcam from "react-webcam";
import { IconCamera, IconRefresh, IconCheck, IconLoader2 } from "@tabler/icons-react";
import { Button } from "@/components/ui/button";
import { compressPhoto } from "@/lib/image-compress";

interface CameraCaptureProps {
  onCapture: (file: File) => void;
  capturedImage: string | null;
  setCapturedImage: (url: string | null) => void;
}

export function CameraCapture({ onCapture, capturedImage, setCapturedImage }: CameraCaptureProps) {
  const webcamRef = useRef<Webcam>(null);
  const [isCameraReady, setIsCameraReady] = useState(false);
  const [isCapturing, setIsCapturing] = useState(false);
  const [showCamera, setShowCamera] = useState(false);

  const handleUserMedia = () => {
    setIsCameraReady(true);
  };

  const handleUserMediaError = (error: string | DOMException) => {
    console.error("Webcam error:", error);
    alert("Gagal mengakses kamera. Pastikan izin kamera telah diberikan.");
    setShowCamera(false);
  };

  const capturePhoto = useCallback(async () => {
    if (!webcamRef.current || isCapturing) return;

    setIsCapturing(true);
    try {
      const imageSrc = webcamRef.current.getScreenshot();
      if (!imageSrc) throw new Error("Failed to capture screenshot");

      // Convert base64 to File
      const res = await fetch(imageSrc);
      const blob = await res.blob();
      const file = new File([blob], "capture.jpg", { type: "image/jpeg" });
      
      const compressed = await compressPhoto(file);
      
      const reader = new FileReader();
      const dataUrl = await new Promise<string>((resolve) => {
        reader.onloadend = () => resolve(reader.result as string);
        reader.readAsDataURL(compressed);
      });

      setCapturedImage(dataUrl);
      onCapture(compressed);
      setShowCamera(false);
    } catch (err) {
      console.error("Capture error:", err);
      alert("Gagal mengambil foto. Silakan coba lagi.");
    } finally {
      setIsCapturing(false);
    }
  }, [webcamRef, isCapturing, onCapture, setCapturedImage]);

  const resetCapture = () => {
    setCapturedImage(null);
    setShowCamera(true);
    setIsCameraReady(false);
  };

  const videoConstraints = {
    width: 1024,
    height: 1024,
    facingMode: /iPhone|iPad|iPod|Android/i.test(navigator.userAgent) ? "user" : undefined,
  };

  return (
    <div className="flex flex-col items-center space-y-4 w-full max-w-md mx-auto">
      <div className="relative aspect-square w-full bg-slate-100 rounded-3xl overflow-hidden border-4 border-white shadow-2xl ring-1 ring-slate-200">
        {capturedImage ? (
          <img
            src={capturedImage}
            alt="Captured"
            className="h-full w-full object-cover"
          />
        ) : showCamera ? (
          <Webcam
            audio={false}
            ref={webcamRef}
            screenshotFormat="image/jpeg"
            videoConstraints={videoConstraints}
            onUserMedia={handleUserMedia}
            onUserMediaError={handleUserMediaError}
            mirrored={true}
            className="h-full w-full object-cover"
          />
        ) : (
          <div className="flex flex-col items-center justify-center h-full space-y-4 p-8 text-center">
            <div className="p-4 bg-slate-200 rounded-full">
              <IconCamera size={48} className="text-slate-400" />
            </div>
            <p className="text-sm text-slate-500 font-medium">
              Ambil foto diri untuk memulai presensi
            </p>
            <Button
              onClick={() => setShowCamera(true)}
              className="rounded-full px-8"
            >
              Buka Kamera
            </Button>
          </div>
        )}

        {showCamera && !capturedImage && isCameraReady && (
          <div className="absolute bottom-6 left-1/2 -translate-x-1/2 z-20">
            <button
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                capturePhoto();
              }}
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

        {capturedImage && (
          <div className="absolute top-4 right-4 flex gap-2">
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

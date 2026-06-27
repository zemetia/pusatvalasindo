import imageCompression from "browser-image-compression";

const MAX_SIZE_KB = 50;
const MAX_DIMENSION_PX = 1024;

export async function compressPhoto(file: File): Promise<File> {
  if (file.size <= MAX_SIZE_KB * 1024) return file;

  const compressed = await imageCompression(file, {
    maxSizeMB: MAX_SIZE_KB / 1024,
    maxWidthOrHeight: MAX_DIMENSION_PX,
    useWebWorker: false,
    fileType: "image/jpeg",
    initialQuality: 0.85,
  });

  return new File([compressed], file.name.replace(/\.[^.]+$/, ".jpg"), {
    type: "image/jpeg",
    lastModified: Date.now(),
  });
}

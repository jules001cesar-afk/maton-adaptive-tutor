// Shrinks a phone photo before upload: at most 1600 px on the long side, JPEG.
// Re-encoding through a canvas also drops EXIF data (GPS location, device) and
// applies the camera's rotation, so the marks line up with what the student sees.

export type PreparedPhoto = { base64: string; mime: "image/jpeg"; width: number; height: number; url: string };

const MAX_SIDE = 1600;

export async function preparePhoto(file: Blob): Promise<PreparedPhoto> {
  const bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
  const scale = Math.min(1, MAX_SIDE / Math.max(bitmap.width, bitmap.height));
  const width = Math.round(bitmap.width * scale);
  const height = Math.round(bitmap.height * scale);

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("canvas unavailable");
  ctx.drawImage(bitmap, 0, 0, width, height);
  bitmap.close();

  const blob = await new Promise<Blob>((resolve, reject) =>
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("encode failed"))), "image/jpeg", 0.85),
  );
  const base64 = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result).split(",")[1] ?? "");
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });
  return { base64, mime: "image/jpeg", width, height, url: URL.createObjectURL(blob) };
}

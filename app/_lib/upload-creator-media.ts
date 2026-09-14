// Resize camera photos before sending them. Canvas also strips camera metadata.
export async function uploadCreatorMedia(file: File, creatorId: string) {
  if (file.size > 20 * 1024 * 1024) throw new Error("Choose a file smaller than 20 MB.");
  let bodyFile: Blob = file;
  if (file.type.startsWith("image/")) {
    let bitmap: ImageBitmap;
    try { bitmap = await createImageBitmap(file); }
    catch { throw new Error("This photo could not be opened. Try a JPG, PNG, or WebP image."); }
    try {
      const scale = Math.min(1, 1800 / Math.max(bitmap.width, bitmap.height));
      const canvas = document.createElement("canvas");
      canvas.width = Math.round(bitmap.width * scale); canvas.height = Math.round(bitmap.height * scale);
      const context = canvas.getContext("2d");
      if (!context) throw new Error("This photo could not be prepared. Try another browser.");
      context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
      bodyFile = await new Promise<Blob>((resolve, reject) => canvas.toBlob((blob) => blob ? resolve(blob) : reject(new Error("Photo preparation failed.")), "image/webp", .88));
    } finally { bitmap.close(); }
  }
  const body = new FormData(); body.set("creatorId", creatorId); body.set("file", bodyFile, file.name);
  const response = await fetch("/api/creators/media", { method: "POST", body, signal: AbortSignal.timeout(60000) });
  const result = await response.json() as { source?: string; kind?: "photo" | "video"; detail?: string };
  if (!response.ok || !result.source) throw new Error(result.detail || "Upload failed. Please try again.");
  return { source: result.source, kind: result.kind ?? "photo" };
}

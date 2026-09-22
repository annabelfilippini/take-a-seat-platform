// Explicit types let Apple photo pickers transcode HEIC to a supported image.
export const PHOTO_UPLOAD_ACCEPT = "image/jpeg,image/png,image/webp";
export const MEDIA_UPLOAD_ACCEPT = `${PHOTO_UPLOAD_ACCEPT},video/mp4,video/webm`;
export const MAX_UPLOAD_BYTES = 8 * 1024 * 1024;
export const UPLOAD_TIMEOUT_MS = 60_000;

export function uploadFileType(file: File) {
  const type = file.type.toLowerCase();
  if (type && type !== "application/octet-stream") return type;
  const extension = file.name.split(".").pop()?.toLowerCase();
  return ({ jpg: "image/jpeg", jpeg: "image/jpeg", png: "image/png", webp: "image/webp", heic: "image/heic", heif: "image/heif", mp4: "video/mp4", webm: "video/webm" } as Record<string, string>)[extension ?? ""] ?? "";
}

export function isUploadPhoto(file: File) {
  return [...PHOTO_UPLOAD_ACCEPT.split(","), "image/heic", "image/heif"].includes(uploadFileType(file));
}

export function isSupportedUpload(file: File) {
  return isUploadPhoto(file) || ["video/mp4", "video/webm"].includes(uploadFileType(file));
}

export async function prepareCreatorUpload(file: File) {
  const type = uploadFileType(file);
  const heic = type === "image/heic" || type === "image/heif";
  if (!file.size) throw new Error("That file is empty. Choose another photo or video.");
  if (!isSupportedUpload(file)) throw new Error("Use a JPG, PNG, WebP photo or MP4/WebM video.");
  if (!heic && file.size <= MAX_UPLOAD_BYTES) return file;
  if (!isUploadPhoto(file)) throw new Error("Choose a video up to 8 MB. Photos can be resized automatically.");
  if (file.size > 30 * 1024 * 1024) throw new Error("Choose a photo up to 30 MB so we can resize it for you.");
  const image = new Image();
  const url = URL.createObjectURL(file);
  try {
    image.src = url;
    try { await image.decode(); }
    catch { throw new Error(heic
      ? "This browser couldn't convert that HEIC photo. Choose it from Photo Library in Safari, or export it as a JPG and try again."
      : "That photo couldn't be read. Choose another JPG, PNG or WebP photo."); }
    const canvas = document.createElement("canvas");
    const context = canvas.getContext("2d");
    if (!context) throw new Error("Your browser couldn't prepare this photo. Try a smaller JPG.");
    let edge = Math.min(2400, Math.max(image.naturalWidth, image.naturalHeight));
    for (let attempt = 0; attempt < 5; attempt += 1) {
      const scale = Math.min(1, edge / Math.max(image.naturalWidth, image.naturalHeight));
      canvas.width = Math.max(1, Math.round(image.naturalWidth * scale));
      canvas.height = Math.max(1, Math.round(image.naturalHeight * scale));
      context.fillStyle = "white";
      context.fillRect(0, 0, canvas.width, canvas.height);
      context.drawImage(image, 0, 0, canvas.width, canvas.height);
      const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", 0.9));
      if (blob && blob.size <= MAX_UPLOAD_BYTES) return new File([blob], file.name.replace(/\.[^.]+$/, "") + ".jpg", { type: "image/jpeg" });
      edge = Math.floor(edge * 0.75);
    }
    throw new Error("That photo is still too large. Choose a smaller photo and try again.");
  } finally { URL.revokeObjectURL(url); }
}

export async function uploadCreatorFile(creatorId: string, file: File) {
  const controller = new AbortController();
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      (async () => {
        const prepared = await prepareCreatorUpload(file);
        controller.signal.throwIfAborted();
        const body = new FormData(); body.set("creatorId", creatorId); body.set("file", prepared);
        const response = await fetch("/api/creators/media", { method: "POST", body, signal: controller.signal });
        const result = await response.json().catch(() => null) as { source?: string; error?: string } | null;
        if (response.status === 401 || response.status === 403) throw new Error("Your sign-in expired. Keep this tab open, sign in again in another tab, then choose the photo again.");
        if (!response.ok || !result?.source) throw new Error(result?.error || "Upload failed. Your edits are still here. Choose the file again to retry.");
        return result.source;
      })(),
      new Promise<never>((_, reject) => {
        timer = setTimeout(() => {
          reject(new Error("The upload took too long. Your edits are still here. Check your connection, then choose the file again to retry."));
          controller.abort();
        }, UPLOAD_TIMEOUT_MS);
      }),
    ]);
  } finally { clearTimeout(timer); }
}

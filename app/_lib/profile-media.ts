import { PROFILE_MEDIA_BUDGET, ProfileSizeError } from "./profile-save";

// Process only inline uploads. Existing URLs do not need downloading or rewriting.
export async function prepareProfileMedia(sources: string[]) {
  const photos = sources.filter((source) => /^data:image\//i.test(source));
  const otherBytes = sources.filter((source) => !/^data:image\//i.test(source))
    .reduce((total, source) => total + new TextEncoder().encode(source).byteLength, 0);
  const remaining = PROFILE_MEDIA_BUDGET - otherBytes;
  if (remaining < 0 || (photos.length && remaining < photos.length * 10_000)) throw new ProfileSizeError();
  const budget = Math.floor(remaining / Math.max(photos.length, 1));
  const prepared: string[] = [];
  // Sequential decoding bounds memory for galleries of large camera photos.
  for (const source of sources) {
    prepared.push(/^data:image\//i.test(source) && source.length > budget
      ? await resizePhoto(source, budget) : source);
  }
  return prepared;
}

async function resizePhoto(source: string, budget: number): Promise<string> {
  const image = new Image();
  image.src = source;
  try { await image.decode(); }
  catch { throw new Error("One photo couldn't be read. Replace it with a JPG, PNG, or WebP photo and try again."); }
  const canvas = document.createElement("canvas");
  const context = canvas.getContext("2d");
  if (!context) throw new Error("Your browser couldn't prepare the photos. Please try saving again.");
  let edge = Math.min(1600, Math.max(image.naturalWidth, image.naturalHeight));
  for (let attempt = 0; attempt < 8; attempt += 1) {
    const scale = Math.min(1, edge / Math.max(image.naturalWidth, image.naturalHeight));
    canvas.width = Math.max(1, Math.round(image.naturalWidth * scale));
    canvas.height = Math.max(1, Math.round(image.naturalHeight * scale));
    context.drawImage(image, 0, 0, canvas.width, canvas.height);
    const result = canvas.toDataURL("image/webp", 0.85);
    if (result.startsWith("data:image/") && result.length <= budget) return result;
    edge = Math.floor(edge * 0.75);
  }
  throw new ProfileSizeError();
}

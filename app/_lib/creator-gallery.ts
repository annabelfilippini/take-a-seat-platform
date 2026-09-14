import type { CreatorMediaItem } from "./creators";

export const MAX_GALLERY_ITEMS = 12;
export function mediaImageStyle(item: Pick<CreatorMediaItem, "positionX" | "positionY" | "zoom">) {
  const x = clamp(item.positionX, 0, 100, 50);
  const y = clamp(item.positionY, 0, 100, 50);
  const zoom = clamp(item.zoom, 100, 220, 100) / 100;
  return { objectPosition: `${x}% ${y}%`, transformOrigin: `${x}% ${y}%`, transform: `scale(${zoom})` };
}
function clamp(value: unknown, min: number, max: number, fallback: number) {
  return typeof value === "number" && Number.isFinite(value) ? Math.min(max, Math.max(min, value)) : fallback;
}
export function validMediaSource(source: string) {
  return /^\/(?!\/)[^\s]*$/.test(source) || /^https?:\/\//i.test(source) || /^data:(image\/(jpeg|png|webp|gif|avif)|video\/(mp4|webm|quicktime));base64,/i.test(source);
}
// Old profiles store one URL per line. New profiles retain each image's crop and order.
export function parseCreatorGallery(value: string | null | undefined): CreatorMediaItem[] {
  if (!value?.trim()) return [];
  let values: unknown[];
  if (value.trim().startsWith("[")) {
    const parsed: unknown = JSON.parse(value);
    if (!Array.isArray(parsed)) throw new Error("Invalid gallery.");
    values = parsed;
  } else values = value.split("\n").filter((line) => line.trim());
  if (values.length > MAX_GALLERY_ITEMS) throw new Error("Add up to 12 photos or videos.");
  return values.map((entry, index) => {
    const item = typeof entry === "string" ? { source: entry } : entry as Partial<CreatorMediaItem>;
    if (!item || typeof item.source !== "string" || !validMediaSource(item.source.trim())) throw new Error("A media file is invalid. Remove it and upload it again.");
    const source = item.source.trim();
    return {
      id: typeof item.id === "string" ? item.id.slice(0, 100) : `media-${index + 1}`,
      source, kind: item.kind === "video" || /(^data:video\/|\.(mp4|webm|mov)(\?|$))/i.test(source) ? "video" : "photo",
      title: typeof item.title === "string" ? item.title.slice(0, 160) : `Photo ${index + 1}`,
      positionX: clamp(item.positionX, 0, 100, 50), positionY: clamp(item.positionY, 0, 100, 50), zoom: clamp(item.zoom, 100, 220, 100),
    };
  });
}

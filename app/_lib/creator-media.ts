import { env } from "cloudflare:workers";
import { getRequestAdminEmail } from "./admin-auth";
import { getSignedInClerkUser } from "./clerk-auth";
import { canManageCreatorProfile, getCreatorApplication, type CreatorProfileSettingsInput } from "./creator-onboarding";
import { parseCreatorGallery } from "./creator-gallery";

export const MAX_MEDIA_BYTES = 20 * 1024 * 1024;
const formats: Record<string, string> = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp", "image/gif": "gif", "image/avif": "avif", "video/mp4": "mp4", "video/webm": "webm", "video/quicktime": "mov" };
export function mediaBucket() {
  const bucket = (env as unknown as { CREATOR_MEDIA?: R2Bucket }).CREATOR_MEDIA;
  if (!bucket) throw new Error("Photo storage is temporarily unavailable. Please try again shortly.");
  return bucket;
}
export async function canManageMedia(request: Request, creatorId: string) {
  if (await getRequestAdminEmail(request)) return true;
  const user = await getSignedInClerkUser(request);
  return Boolean(user && await canManageCreatorProfile(creatorId, user));
}
export function mediaKey(source: string) {
  return source.match(/^\/api\/creators\/media\/([a-f0-9-]{36}\.(?:jpg|png|webp|gif|avif|mp4|webm|mov))$/)?.[1] ?? null;
}
export async function storeCreatorMedia(creatorId: string, bytes: ArrayBuffer, mime: string) {
  if (!formats[mime]) throw new Error("Use a JPG, PNG, WebP, GIF, AVIF, MP4, MOV, or WebM file.");
  if (!bytes.byteLength || bytes.byteLength > MAX_MEDIA_BYTES) throw new Error("Choose a file smaller than 20 MB.");
  const id = `${crypto.randomUUID()}.${formats[mime]}`;
  await mediaBucket().put(id, bytes, { httpMetadata: { contentType: mime }, customMetadata: { creatorId } });
  return `/api/creators/media/${id}`;
}
export async function normalizeStoredMedia(creatorId: string, input: CreatorProfileSettingsInput) {
  const migrated = new Map<string, string>();
  async function normalize(source: string): Promise<string> {
    if (migrated.has(source)) return migrated.get(source)!;
    if (source.startsWith("data:")) {
      const match = source.match(/^data:([^;]+);base64,([a-zA-Z0-9+/=]+)$/);
      if (!match || match[2].length > MAX_MEDIA_BYTES * 1.4) throw new Error("This photo could not be saved. Please upload it again.");
      const bytes = Uint8Array.from(atob(match[2]), (char) => char.charCodeAt(0));
      const stored = await storeCreatorMedia(creatorId, bytes.buffer, match[1]);
      migrated.set(source, stored);
      return stored;
    }
    const key = mediaKey(source);
    if (source.startsWith("/api/creators/media/") && !key) throw new Error("Invalid uploaded photo.");
    if (key) {
      const object = await mediaBucket().head(key);
      if (!object || object.customMetadata?.creatorId !== creatorId) throw new Error("This upload is unavailable. Please upload it again.");
    }
    return source;
  }
  const gallery = parseCreatorGallery(input.profileGallery);
  for (const item of gallery) item.source = await normalize(item.source);
  return { ...input, profileImageUrl: await normalize(input.profileImageUrl), profileGallery: JSON.stringify(gallery) };
}
export async function isPublishedMedia(creatorId: string, source: string) {
  const profile = await getCreatorApplication(creatorId);
  return Boolean(profile?.applicationStatus === "accepted" && profile.publishedAt && profile.profileSavedAt &&
    (profile.profileImageUrl === source || parseCreatorGallery(profile.profileGallery).some((item) => item.source === source)));
}

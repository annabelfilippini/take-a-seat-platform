import { and, asc, eq, sql } from 'drizzle-orm';
import { creatorMedia, creatorMediaChunks } from '../../db/schema';
import { getCreatorApplication } from './creator-onboarding';
export const MAX_MEDIA_BYTES = 8 * 1024 * 1024;
export const MAX_GALLERY_ITEMS = 8;
const CHUNK_BYTES = 96 * 1024;

export async function saveCreatorMedia(creatorId: string, file: File) {
  if (!file.size || file.size > MAX_MEDIA_BYTES) throw new Error('Choose a file up to 8 MB.');
  const bytes = new Uint8Array(await file.arrayBuffer());
  const prefix = Array.from(bytes.slice(0, 16));
  const mime = prefix[0] === 255 && prefix[1] === 216 ? 'image/jpeg'
    : prefix.slice(0, 8).join(',') === '137,80,78,71,13,10,26,10' ? 'image/png'
    : String.fromCharCode(...prefix.slice(0, 4)) === 'RIFF' && String.fromCharCode(...prefix.slice(8, 12)) === 'WEBP' ? 'image/webp'
    : String.fromCharCode(...prefix.slice(4, 8)) === 'ftyp' ? 'video/mp4'
    : prefix.slice(0, 4).join(',') === '26,69,223,163' ? 'video/webm' : null;
  if (!mime) throw new Error('Use a JPG, PNG, WebP photo or MP4/WebM video.');
  const digest = new Uint8Array(await crypto.subtle.digest('SHA-256', bytes));
  const id = `media_${Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(creatorId + Array.from(digest).join(','))))).map((b) => b.toString(16).padStart(2, '0')).join('')}`;
  const { getDb } = await import('../../db');
  const db = getDb();
  if (!(await db.select().from(creatorMedia).where(eq(creatorMedia.id, id))).length) {
    const total = await db.get<{ bytes: number }>(sql`SELECT coalesce(sum(bytes), 0) as bytes FROM creator_media WHERE creator_id = ${creatorId}`);
    if ((total?.bytes ?? 0) + file.size > 128 * 1024 * 1024) throw new Error('Your media storage is full. Contact Take a Seat for help.');
    const chunks = [];
    for (let offset = 0; offset < bytes.length; offset += CHUNK_BYTES) {
      let binary = '';
      for (const byte of bytes.slice(offset, offset + CHUNK_BYTES)) binary += String.fromCharCode(byte);
      chunks.push(db.insert(creatorMediaChunks).values({ mediaId: id, position: offset / CHUNK_BYTES, content: btoa(binary) }).onConflictDoNothing());
    }
    await db.batch([db.insert(creatorMedia).values({ id, creatorId, mime, bytes: bytes.length, createdAt: new Date().toISOString() }).onConflictDoNothing(), ...chunks]);
  }
  return { source: `/api/creators/media/${id}${mime.startsWith("video/") ? "?video=1" : ""}`, kind: mime.startsWith('video/') ? 'video' : 'photo' };
}

export async function readCreatorMedia(id: string) {
  const { getDb } = await import('../../db');
  const db = getDb();
  const [media] = await db.select().from(creatorMedia).where(eq(creatorMedia.id, id));
  if (!media) return null;
  const profile = await getCreatorApplication(media.creatorId);
  const source = `/api/creators/media/${id}${media.mime.startsWith("video/") ? "?video=1" : ""}`;
  const published = Boolean(profile?.applicationStatus === 'accepted' && profile.publishedAt && profile.profileSavedAt &&
    (profile.profileImageUrl === source || profile.profileGallery?.split('\n').includes(source)));
  return { media, published, async bytes() {
    const chunks = await db.select().from(creatorMediaChunks).where(eq(creatorMediaChunks.mediaId, id)).orderBy(asc(creatorMediaChunks.position));
    const bytes = new Uint8Array(media.bytes);
    let offset = 0;
    for (const chunk of chunks) {
      const binary = atob(chunk.content);
      for (let i = 0; i < binary.length; i++) bytes[offset++] = binary.charCodeAt(i);
    }
    if (offset !== media.bytes) throw new Error('Media is incomplete.');
    return bytes;
  } };
}

export async function validateOwnedMedia(creatorId: string, sources: string[], profileImageSource?: string) {
  const { getDb } = await import('../../db');
  for (const source of sources) {
    if (!source.startsWith('/api/creators/media/')) continue;
    const id = source.slice('/api/creators/media/'.length).split('?')[0];
    const rows = await getDb().select().from(creatorMedia).where(and(eq(creatorMedia.id, id), eq(creatorMedia.creatorId, creatorId)));
    if (!rows.length) throw new Error('This media does not belong to your profile.');
    if (source === profileImageSource && !rows[0].mime.startsWith('image/')) throw new Error('Choose a photo for your profile image.');
  }
}

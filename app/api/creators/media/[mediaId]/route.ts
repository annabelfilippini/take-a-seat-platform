import { getCreatorIntegrationAccess } from '../../../../_lib/creator-access';
import { readCreatorMedia } from '../../../../_lib/creator-media';
export async function GET(request: Request, { params }: { params: { mediaId: string } }) {
  const stored = await readCreatorMedia(params.mediaId);
  if (!stored || (!stored.published && (await getCreatorIntegrationAccess(request, stored.media.creatorId)).status !== 'allowed')) return new Response('Not found', { status: 404 });
  const bytes = await stored.bytes();
  const headers = { 'content-type': stored.media.mime, 'cache-control': 'private, no-store', 'x-content-type-options': 'nosniff', 'accept-ranges': 'bytes' };
  const range = request.headers.get('range')?.match(/^bytes=(\d+)-(\d*)$/);
  if (range) {
    const start = Number(range[1]); const end = Math.min(Number(range[2] || bytes.length - 1), bytes.length - 1);
    if (start > end || start >= bytes.length) return new Response(null, { status: 416, headers: { 'content-range': `bytes */${bytes.length}` } });
    return new Response(bytes.slice(start, end + 1), { status: 206, headers: { ...headers, 'content-range': `bytes ${start}-${end}/${bytes.length}` } });
  }
  return new Response(bytes, { headers });
}

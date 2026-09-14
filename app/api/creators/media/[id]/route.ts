import { canManageMedia, isPublishedMedia, mediaBucket, mediaKey } from "../../../../_lib/creator-media";

export async function GET(request: Request, { params }: { params: { id: string } }) {
  const source = `/api/creators/media/${params.id}`;
  const key = mediaKey(source);
  if (!key) return new Response(null, { status: 404 });
  try {
    const bucket = mediaBucket();
    const metadata = await bucket.head(key);
    const owner = metadata?.customMetadata?.creatorId;
    if (!owner || !(await isPublishedMedia(owner, source) || await canManageMedia(request, owner))) return new Response(null, { status: 404 });
    const object = await bucket.get(key, { range: request.headers });
    if (!object || !("body" in object)) return new Response(null, { status: 404 });
    const headers = new Headers({ "cache-control": "private, no-store", "x-content-type-options": "nosniff", "content-security-policy": "default-src 'none'; sandbox", "accept-ranges": "bytes" });
    object.writeHttpMetadata(headers);
    const range = object.range;
    if (request.headers.has("range") && range && "offset" in range && "length" in range && range.offset != null && range.length != null) {
      headers.set("content-range", `bytes ${range.offset}-${range.offset + range.length - 1}/${object.size}`);
      headers.set("content-length", String(range.length));
      return new Response(object.body, { status: 206, headers });
    }
    headers.set("content-length", String(object.size));
    return new Response(object.body, { headers });
  } catch {
    return new Response(null, { status: 503, headers: { "cache-control": "no-store" } });
  }
}

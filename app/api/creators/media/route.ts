import { getCreatorIntegrationAccess } from '../../../_lib/creator-access';
import { MAX_MEDIA_BYTES, saveCreatorMedia } from '../../../_lib/creator-media';
export async function POST(request: Request) {
  if (Number(request.headers.get('content-length')) > MAX_MEDIA_BYTES + 10000) return Response.json({ error: 'Choose a file up to 8 MB.' }, { status: 413 });
  const form = await request.formData();
  const id = String(form.get('creatorId') ?? '');
  if ((await getCreatorIntegrationAccess(request, id)).status !== 'allowed') return Response.json({ error: 'Sign in again to upload.' }, { status: 403 });
  const file = form.get('file');
  if (!(file instanceof File)) return Response.json({ error: 'Choose a file.' }, { status: 400 });
  try { return Response.json(await saveCreatorMedia(id, file)); }
  catch (error) { return Response.json({ error: error instanceof Error ? error.message : 'Upload failed. Please retry.' }, { status: 400 }); }
}

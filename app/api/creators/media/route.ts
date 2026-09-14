import { canManageMedia, MAX_MEDIA_BYTES, storeCreatorMedia } from "../../../_lib/creator-media";
import { getCreatorApplication } from "../../../_lib/creator-onboarding";

export async function POST(request: Request) {
  if (Number(request.headers.get("content-length")) > MAX_MEDIA_BYTES + 10000) return Response.json({ detail: "Choose a file smaller than 20 MB." }, { status: 413 });
  try {
    const form = await request.formData();
    const creatorId = String(form.get("creatorId") ?? "");
    if (!creatorId || !(await canManageMedia(request, creatorId))) return Response.json({ detail: "Please sign in again to upload photos." }, { status: 403 });
    if (!(await getCreatorApplication(creatorId))) return Response.json({ detail: "Save your profile before adding a photo." }, { status: 400 });
    const file = form.get("file");
    if (!file || typeof file === "string") return Response.json({ detail: "Choose a photo or video." }, { status: 400 });
    const source = await storeCreatorMedia(creatorId, await file.arrayBuffer(), file.type);
    return Response.json({ source, kind: file.type.startsWith("video/") ? "video" : "photo" });
  } catch (error) {
    return Response.json({ detail: error instanceof Error ? error.message : "Upload failed. Please try again." }, { status: 400 });
  }
}

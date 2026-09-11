import { getSignedInClerkUser } from "../../../../clerk-auth";
import { claimCreatorInvite } from "../../../../creator-onboarding";

export async function POST(request: Request) {
  const user = await getSignedInClerkUser(request);

  if (!user) {
    return Response.json({ status: "signed-out" }, { status: 401 });
  }

  let token = "";

  const contentType = request.headers.get("content-type") ?? "";

  if (contentType.includes("application/json")) {
    const payload = (await request.json().catch(() => null)) as {
      invite?: unknown;
    } | null;
    token = typeof payload?.invite === "string" ? payload.invite : "";
  } else {
    const formData = await request.formData();
    const invite = formData.get("invite");
    token = typeof invite === "string" ? invite : "";
  }

  try {
    const result = await claimCreatorInvite(token, user);

    if ("profile" in result) {
      return Response.json({
        profile: {
          id: result.profile.id,
          name: result.profile.name,
        },
        status: result.status,
      });
    }

    return Response.json(result, {
      status: result.status === "invalid" || result.status === "expired" ? 400 : 409,
    });
  } catch {
    return Response.json(
      { detail: "d1", status: "setup-needed" },
      { status: 503 },
    );
  }
}

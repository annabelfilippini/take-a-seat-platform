import {
  getLocalAdminCookie,
  isLocalAdminDevEnabled,
  isLocalhostRequest,
} from "../../../admin-auth";

export function GET(request: Request) {
  if (!isLocalAdminDevEnabled() || !isLocalhostRequest(request.headers, request.url)) {
    return new Response("Not found", { status: 404 });
  }

  const url = new URL(request.url);
  const returnTo = getSafeReturnTo(url.searchParams.get("returnTo"));
  const target = new URL(returnTo, url);

  return new Response(null, {
    headers: {
      "set-cookie": getLocalAdminCookie(),
      location: target.toString(),
    },
    status: 303,
  });
}

function getSafeReturnTo(value: string | null) {
  if (!value || !value.startsWith("/") || value.startsWith("//")) {
    return "/admin/applications";
  }

  return value;
}

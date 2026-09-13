const appHosts = new Set(["takeaseatwith.com", "www.takeaseatwith.com", "take-a-seat-platform.annabelflip1.workers.dev"]);
export async function withSecureOrigin(request: Request, next: (request: Request) => Promise<Response>) {
  const url = new URL(request.url);
  if (!appHosts.has(url.hostname)) return next(request);
  if (url.protocol !== "https:") {
    url.protocol = "https:";
    return new Response(null, { status: 308, headers: { location: url.toString() } });
  }
  // Canonicalize documents and OAuth entry; existing webhook POSTs stay on their configured host.
  if (url.hostname !== "takeaseatwith.com" && (request.method === "GET" || request.method === "HEAD")) {
    url.hostname = "takeaseatwith.com";
    return new Response(null, { status: 308, headers: { location: url.toString() } });
  }
  const response = await next(request);
  const headers = new Headers(response.headers);
  headers.set("strict-transport-security", "max-age=31536000");
  return new Response(response.body, { status: response.status, statusText: response.statusText, headers });
}

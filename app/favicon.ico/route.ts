// Browsers may request the conventional icon before document metadata is ready.
export function GET(request: Request) {
  return Response.redirect(new URL('/favicon.png', request.url), 307);
}

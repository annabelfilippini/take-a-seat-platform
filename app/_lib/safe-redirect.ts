export function getSafeReturnTo(value: string | null | undefined, fallback = "/admin/applications") {
  if (!value || !value.startsWith("/") || Array.from(value).some((character) => character === "\\" || character.charCodeAt(0) <= 32)) return fallback;
  try {
    const base = "https://takeaseat.invalid";
    const target = new URL(value, base);
    return target.origin === base ? `${target.pathname}${target.search}${target.hash}` : fallback;
  } catch {
    return fallback;
  }
}

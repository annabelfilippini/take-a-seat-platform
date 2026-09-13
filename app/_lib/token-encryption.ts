const encoder = new TextEncoder();

async function getKey(secret: string) {
  if (!secret) throw new Error("Token encryption is not configured.");
  const hash = await crypto.subtle.digest("SHA-256", encoder.encode(secret));
  return crypto.subtle.importKey("raw", hash, "AES-GCM", false, ["encrypt", "decrypt"]);
}

function encode(bytes: Uint8Array) {
  return btoa(Array.from(bytes, (byte) => String.fromCharCode(byte)).join(""))
    .replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/u, "");
}

function decode(value: string) {
  const base64 = value.replace(/-/g, "+").replace(/_/g, "/");
  return Uint8Array.from(atob(base64.padEnd(Math.ceil(base64.length / 4) * 4, "=")), (char) => char.charCodeAt(0));
}

// Preserve the v1 format used by previously saved OAuth connections.
export async function encryptToken(value: string, secret: string) {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const encrypted = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, await getKey(secret), encoder.encode(value));
  return `v1.${encode(iv)}.${encode(new Uint8Array(encrypted))}`;
}

export async function decryptToken(value: string, secret: string) {
  const [version, iv, ciphertext, extra] = value.split(".");
  if (version !== "v1" || !iv || !ciphertext || extra) throw new Error("Unsupported encrypted token format.");
  return new TextDecoder().decode(await crypto.subtle.decrypt(
    { name: "AES-GCM", iv: decode(iv) }, await getKey(secret), decode(ciphertext),
  ));
}

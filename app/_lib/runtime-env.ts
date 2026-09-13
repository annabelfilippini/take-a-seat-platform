import { env } from "cloudflare:workers";

export function getRuntimeEnv(name: string): string | null {
  const value = (env as unknown as Record<string, unknown>)[name] ?? process.env[name];
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

import assert from "node:assert/strict";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { registerHooks } from "node:module";
import { DatabaseSync } from "node:sqlite";
import { fileURLToPath, pathToFileURL } from "node:url";
import test from "node:test";
import ts from "typescript";

// Execute the real domain and route code against SQLite, using D1's statement API.
const sqlite = new DatabaseSync(":memory:");
for (const file of readdirSync(new URL("../drizzle/", import.meta.url)).filter((name) => name.endsWith(".sql")).sort()) {
  sqlite.exec(readFileSync(new URL(`../drizzle/${file}`, import.meta.url), "utf8"));
}
function prepare(sql) {
  let args = [];
  const statement = {
    bind(...values) { args = values; return statement; },
    async raw() { const query = sqlite.prepare(sql); query.setReturnArrays(true); return query.all(...args); },
    async all() { return { results: sqlite.prepare(sql).all(...args), success: true }; },
    async run() { return { meta: sqlite.prepare(sql).run(...args), success: true }; },
  };
  return statement;
}
globalThis.__lifecycleEnv = { DB: {
  prepare,
  async batch(statements) {
    sqlite.exec("BEGIN");
    try { const results = []; for (const statement of statements) results.push(await statement.all()); sqlite.exec("COMMIT"); return results; }
    catch (error) { sqlite.exec("ROLLBACK"); throw error; }
  },
} };
registerHooks({
  resolve(specifier, context, next) {
    if (specifier === "cloudflare:workers") return { url: "data:text/javascript,export const env = globalThis.__lifecycleEnv", shortCircuit: true };
    if (specifier === "next/headers") return { url: "data:text/javascript,export const headers = () => new Headers()", shortCircuit: true };
    if (specifier.startsWith(".")) {
      const base = fileURLToPath(new URL(specifier, context.parentURL));
      for (const suffix of [".ts", ".tsx", "/index.ts"]) {
        if (existsSync(base + suffix)) return { url: pathToFileURL(base + suffix).href, shortCircuit: true };
      }
    }
    return next(specifier, context);
  },
  load(url, context, next) {
    if (/\.tsx?$/.test(url) && !url.includes("node_modules")) {
      return { format: "module", source: ts.transpileModule(readFileSync(new URL(url), "utf8"), { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext, jsx: ts.JsxEmit.ReactJSX } }).outputText, shortCircuit: true };
    }
    return next(url, context);
  },
});
const domain = await import("../app/_lib/creator-onboarding.ts");
const { POST: submit } = await import("../app/api/creators/profile/route.ts");
const { POST: accept } = await import("../app/api/creators/applications/accept/route.ts");
const { sendCreatorAcceptedInviteEmail } = await import("../app/_lib/creator-accepted-invite.ts");
const { getRequestAdminEmail } = await import("../app/_lib/admin-auth.ts");

function formRequest(path, values, admin = false) {
  return new Request(`http://localhost${path}`, { method: "POST", body: new URLSearchParams(values), headers: { accept: "application/json", ...(admin ? { cookie: "tas_local_admin=1" } : {}) } });
}

test("application → review email → acceptance → verified owner → saved public card", async () => {
  process.env.TAKE_A_SEAT_DEV_ADMIN_ENABLED = "true";
  process.env.RESEND_API_KEY = "test-only";
  process.env.TAKE_A_SEAT_EMAIL_FROM = "Take a Seat <applications@example.com>";
  const originalFetch = globalThis.fetch;
  const emails = [];
  globalThis.fetch = async (url, options) => {
    assert.equal(url, "https://api.resend.com/emails");
    emails.push(JSON.parse(options.body));
    return Response.json({ id: "test-email" });
  };
  try {
    const values = { name: "Lifecycle Creator", email: "creator@example.com", phone: "+15555550123", profileDetails: "Personal style advice", profileIntro: "Style advice", reviewSubmittedAt: "true" };
    const response = await submit(formRequest("/api/creators/profile", values));
    assert.equal(response.status, 200);
    assert.equal(emails.length, 2);
    let [profile] = await domain.listCreatorApplications();
    assert.equal(profile.applicationStatus, "in_review");
    assert.equal(profile.publishedAt, null);
    assert.equal(profile.profileSavedAt, null);
    assert.ok(emails[0].text.includes(`/admin/applications/${profile.id}`));
    assert.deepEqual(emails[1].to, [values.email]);

    const acceptance = await accept(formRequest("/api/creators/applications/accept", { creatorId: profile.id, publicCreatorId: "lifecycle-creator" }, true));
    assert.match(acceptance.headers.get("location"), /accept=accepted.*email=sent/);
    profile = await domain.getCreatorApplication(profile.id);
    assert.equal(profile.applicationStatus, "accepted");
    assert.equal(profile.publishedAt, null);
    assert.equal(profile.profileSavedAt, null);
    assert.equal(await domain.getPublishedCreatorBySlug(profile.publicSlug), null);
    assert.equal((await domain.listPublicMarketplaceCreators()).some((creator) => creator.id === profile.id), false);
    const acceptanceEmail = emails.at(-1);
    assert.deepEqual(acceptanceEmail.to, [values.email]);
    const setup = new URL(acceptanceEmail.text.match(/https?:\/\/\S+\?invite=\S+/)[0]);
    assert.equal(setup.pathname, "/creators/dashboard");
    const token = setup.searchParams.get("invite");
    const owner = { userId: "user_lifecycle", email: values.email, phone: null, sessionId: "session_test" };
    assert.equal((await domain.claimCreatorInvite(token, { ...owner, userId: "stranger", email: "stranger@example.com" })).status, "identity-mismatch");
    assert.equal((await domain.claimCreatorInvite(token, owner)).status, "claimed");
    assert.equal((await domain.getCreatorDashboardAccount(owner)).profile.id, profile.id);
    assert.equal(await domain.canManageCreatorProfile(profile.id, { ...owner, userId: "stranger" }), false);
    const forbidden = await submit(formRequest("/api/creators/profile", { ...values, creatorId: profile.id, reviewSubmittedAt: "false" }));
    assert.equal((await forbidden.json()).detail, "creator-access");

    const input = await domain.getCreatorProfileSettingsInput(await formRequest("/", { ...values, reviewSubmittedAt: "false" }).formData());
    await domain.saveCreatorProfileSettings(profile.id, input);
    const publicCreator = await domain.getPublishedCreatorBySlug(profile.publicSlug);
    assert.equal(publicCreator.name, values.name);
    assert.ok((await domain.listPublicMarketplaceCreators()).some((creator) => creator.id === profile.id));
    assert.equal("email" in publicCreator, false);
    assert.equal("phone" in publicCreator, false);
    // Earlier versions marked acceptance as publication; those unfinished cards stay hidden.
    sqlite.prepare("INSERT INTO creator_onboarding_profiles (id, name, email, instagram_platform, profile_details, bio, application_status, public_slug, published_at, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)").run("legacy-draft", "Unfinished Creator", "legacy@example.com", "test", "Draft", "Draft", "accepted", "legacy-draft", "2026-09-01", "2026-09-01", "2026-09-01");
    assert.equal(await domain.getPublishedCreatorBySlug("legacy-draft"), null);
    assert.equal((await domain.listPublicMarketplaceCreators()).some((creator) => creator.id === "legacy-draft"), false);
    // Repeated acceptance and later sign-ins retain the same owner and publication.
    const again = await domain.acceptCreatorApplication(profile.id, "different-slug");
    assert.equal(again.id, profile.id);
    assert.ok(again.publishedAt);
    assert.equal((await domain.getCreatorDashboardAccount(owner)).status, "linked");

    globalThis.fetch = async () => { throw new Error("email provider down"); };
    assert.equal((await sendCreatorAcceptedInviteEmail({ profile, request: new Request("http://localhost") })).status, "skipped");
    assert.equal((await domain.getCreatorApplication(profile.id)).applicationStatus, "accepted");
  } finally {
    globalThis.fetch = originalFetch;
    for (const key of ["TAKE_A_SEAT_DEV_ADMIN_ENABLED", "RESEND_API_KEY", "TAKE_A_SEAT_EMAIL_FROM"]) delete process.env[key];
  }
});

test("a forged legacy identity header cannot grant admin access", async () => {
  assert.equal(await getRequestAdminEmail(new Request("https://takeaseatwith.com/admin/applications", { headers: { "oai-authenticated-user-email": "annabelflip1@gmail.com" } })), null);
});

test("an application without a usable email is rejected before storage", async () => {
  const response = await submit(formRequest("/api/creators/profile", { name: "Missing contact", email: "invalid", reviewSubmittedAt: "true" }));
  assert.equal(response.status, 400);
  assert.equal((await domain.listCreatorApplications()).length, 2);
});


test("Clerk refresh redirects, forwards cookies, and authenticates the first returned render", async () => {
  const { withClerkSessionRefresh } = await import("../app/_lib/clerk-session-refresh.ts");
  const env = { CLERK_SECRET_KEY: "test-only", NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY: "test-only" };
  const request = new Request("https://takeaseatwith.com/creators/dashboard?invite=private-test-link");
  const redirect = await withClerkSessionRefresh(request, env, () => { throw new Error("Must refresh before rendering"); }, async () => ({
    headers: new Headers({ location: "https://clerk.example.test/v1/client/handshake" }), isAuthenticated: false, status: "handshake",
  }));
  assert.equal(redirect.status, 307);
  assert.match(redirect.headers.get("location"), /handshake$/);
  const refreshHeaders = new Headers();
  refreshHeaders.append("set-cookie", "__session=test-refreshed; HttpOnly");
  refreshHeaders.append("set-cookie", "__client_uat=test-updated");
  const response = await withClerkSessionRefresh(request, env, async (incoming) => {
    assert.equal(incoming.headers.get("authorization"), "Bearer verified-test-token");
    assert.equal(new URL(incoming.url).searchParams.get("invite"), "private-test-link");
    return new Response("Creator profile", { headers: { "set-cookie": "app-cookie=retained" } });
  }, async () => ({ headers: refreshHeaders, isAuthenticated: true, status: "signed-in", token: "verified-test-token" }));
  assert.equal(await response.text(), "Creator profile");
  assert.equal(response.headers.getSetCookie().length, 3);
  assert.equal(response.headers.has("authorization"), false);
  await withClerkSessionRefresh(new Request(request, { method: "POST", body: "profile=data" }), env, async (incoming) => {
    assert.equal(await incoming.text(), "profile=data");
    return new Response("Saved");
  }, async () => { throw new Error("Never redirect a submitted form"); });
});

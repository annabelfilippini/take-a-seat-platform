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
const { getEditableCreatorProfile } = await import("../app/admin/creator-profile-editor-preview/creator-profile-editor-data.ts");

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

test("duplicate acceptance links return the matching creator to their existing profile", async () => {
  const { getCreatorDashboardAccountFromInvite } = await import("../app/_lib/creator-dashboard.ts");
  const insert = sqlite.prepare("INSERT INTO creator_onboarding_profiles (id, name, email, instagram_platform, bio, application_status, public_slug) VALUES (?, ?, ?, ?, ?, 'accepted', ?)");
  insert.run("invite-original", "Existing Creator", "duplicate@example.com", "test", "Saved original", "invite-original");
  insert.run("invite-duplicate", "Duplicate Creator", "duplicate@example.com", "test", "Unfinished duplicate", "invite-duplicate");
  insert.run("invite-stranger", "Other Creator", "other@example.com", "test", "Other profile", "invite-stranger");
  const owner = { userId: "user_duplicate", email: "duplicate@example.com", phone: null, sessionId: "session_duplicate" };
  const stranger = { userId: "user_other", email: "other@example.com", phone: null, sessionId: "session_other" };
  const originalInvite = await domain.createCreatorInvite(await domain.getCreatorApplication("invite-original"));
  assert.equal((await domain.claimCreatorInvite(originalInvite.token, owner)).status, "claimed");
  const otherInvite = await domain.createCreatorInvite(await domain.getCreatorApplication("invite-stranger"));
  assert.equal((await domain.claimCreatorInvite(otherInvite.token, stranger)).status, "claimed");
  const duplicate = await domain.createCreatorInvite(await domain.getCreatorApplication("invite-duplicate"));
  assert.equal((await domain.claimCreatorInvite(duplicate.token, owner)).status, "account-mismatch");
  const before = sqlite.prepare("SELECT * FROM creator_accounts WHERE clerk_user_id = ?").get(owner.userId);
  const duplicateBefore = await domain.getCreatorApplication("invite-duplicate");
  for (let visit = 0; visit < 2; visit++) {
    const account = await getCreatorDashboardAccountFromInvite(owner, duplicate.token);
    assert.equal(account.profile.id, "invite-original");
    assert.equal(account.profile.bio, "Saved original");
    assert.equal(await domain.canManageCreatorProfile("invite-duplicate", owner), false);
  }
  assert.deepEqual(sqlite.prepare("SELECT * FROM creator_accounts WHERE clerk_user_id = ?").get(owner.userId), before);
  assert.deepEqual(await domain.getCreatorApplication("invite-duplicate"), duplicateBefore);
  assert.equal((await domain.getCreatorInvitePreview(duplicate.token)).usedAt, null);
  // An unrelated creator must still be asked to switch identities, even with an account.
  assert.match((await getCreatorDashboardAccountFromInvite(stranger, duplicate.token)).accessError, /does not match/);
  assert.match((await getCreatorDashboardAccountFromInvite({ ...owner, email: null }, duplicate.token)).accessError, /does not match/);
  assert.equal((await getCreatorDashboardAccountFromInvite(owner, originalInvite.token)).profile.id, "invite-original");
  assert.equal((await getCreatorDashboardAccountFromInvite(owner)).profile.id, "invite-original");
});

test("profile edits, prices, and cleared social links survive save and reload", async () => {
  const { getEditableCreatorProfile } = await import("../app/admin/creator-profile-editor-preview/creator-profile-editor-data.ts");
  const creatorId = "onboard_profile_save_regression";
  const edits = {
    creatorId,
    email: "profile-save@example.com",
    name: "Edited Creator",
    about: "Updated about paragraph",
    profileIntro: "Updated introduction",
    helpItems: "Wardrobe planning\nEvent styling",
    oneToOneReason: "Personal advice for your next event",
    category: "Style & Beauty",
    location: "New York",
    instagramHandle: "updatedcreator",
    tiktokHandle: "updatedcreator2",
    profileImageUrl: "/ella-profile.jpg",
    profileImagePositionX: "27",
    profileImagePositionY: "62",
    profileImageZoom: "160",
    profileGallery: "/ella-profile.jpg\n/ella-reference-sundress.jpg",
    seat15Enabled: "on",
    seat15PriceAmount: "75",
    seat15DurationMinutes: "15",
    seat15Description: "Updated short call",
    seat30Enabled: "on",
    seat30PriceAmount: "150",
    seat30DurationMinutes: "30",
    seat30Description: "Updated long call",
    timezone: "America/New_York",
  };
  const input = await domain.getCreatorProfileSettingsInput(await formRequest("/", edits).formData());
  await domain.saveCreatorProfileSettings(creatorId, input);
  const accepted = await domain.acceptCreatorApplication(creatorId, "profile-save-regression");
  edits.creatorId = accepted.id;
  const invite = await domain.createCreatorInvite(accepted);
  const owner = { userId: "user_profile_save", email: edits.email, phone: null, sessionId: "session_profile_save" };
  assert.equal((await domain.claimCreatorInvite(invite.token, owner)).status, "claimed");

  process.env.TAKE_A_SEAT_DEV_ADMIN_ENABLED = "true";
  try {
    const response = await submit(formRequest("/api/creators/profile", edits, true));
    const result = await response.json();
    assert.equal(response.status, 200, JSON.stringify(result));
    assert.equal(result.status, "saved");
    const stored = (await domain.getCreatorDashboardAccount(owner)).profile;
    for (const key of ["name", "about", "profileIntro", "oneToOneReason", "category", "location", "instagramHandle", "tiktokHandle", "profileImageUrl", "profileGallery", "seat15Description", "seat30Description", "timezone"]) {
      assert.equal(stored[key], edits[key], key);
    }
    assert.equal(stored.profileImagePositionX, 27);
    assert.equal(stored.profileImagePositionY, 62);
    assert.equal(stored.profileImageZoom, 160);
    assert.equal(stored.seat15PriceAmount, 7500);
    assert.equal(stored.seat30PriceAmount, 15000);
    const restored = getEditableCreatorProfile(stored);
    assert.equal(restored.seat15PriceAmount, 75);
    assert.equal(restored.seat30PriceAmount, 150);
    assert.equal(restored.mediaItems.length, 2);
    const publicCreator = await domain.getPublishedCreatorBySlug(stored.publicSlug);
    assert.equal(publicCreator.name, edits.name);
    assert.equal(publicCreator.profile.intro, edits.profileIntro);
    assert.deepEqual(publicCreator.seats.map(seat => seat.unitAmount), [7500, 15000]);

    // Saving a different field after reopening must not change either price.
    const resave = await submit(formRequest("/api/creators/profile", {
      ...edits,
      name: "Updated again",
      seat15PriceAmount: String(restored.seat15PriceAmount),
      seat30PriceAmount: String(restored.seat30PriceAmount),
      instagramHandle: "",
      tiktokHandle: "",
    }, true));
    assert.equal(resave.status, 200);
    const reloaded = (await domain.getCreatorDashboardAccount(owner)).profile;
    assert.equal(reloaded.seat30PriceAmount, 15000);
    const editor = getEditableCreatorProfile(reloaded);
    assert.equal(editor.instagramUrl, "");
    assert.equal(editor.tiktokUrl, "");
    const published = await domain.getPublishedCreatorBySlug(reloaded.publicSlug);
    assert.equal(published.name, "Updated again");
    assert.equal(published.instagramUrl, undefined);
    assert.equal(published.tiktokUrl, undefined);

    for (const amount of [0, 99.99, 100, 100.01, 150, 250.75, 1000]) {
      const priceSave = await submit(formRequest("/api/creators/profile", {
        ...edits, seat30PriceAmount: String(amount),
      }, true));
      assert.equal(priceSave.status, 200);
      const saved = (await domain.getCreatorDashboardAccount(owner)).profile;
      assert.equal(saved.seat30PriceAmount, Math.round(amount * 100));
      assert.equal(getEditableCreatorProfile(saved).seat30PriceAmount, amount);
    }
  } finally {
    delete process.env.TAKE_A_SEAT_DEV_ADMIN_ENABLED;
  }
});

test("first-time creators receive a blank editor and cleared fields stay blank after saving", async () => {
  const { createElement } = await import("react");
  const { renderToStaticMarkup } = await import("react-dom/server");
  const { CreatorOnboardingForm } = await import("../app/creators/onboard/CreatorOnboardingForm.tsx");
  const html = renderToStaticMarkup(createElement(CreatorOnboardingForm));
  for (const field of ["about", "bio", "profileIntro", "helpItems", "offer", "seat15Description", "seat30Description", "seat15PriceAmount", "seat30PriceAmount", "seat15Enabled", "seat30Enabled"]) {
    assert.equal(html.includes(`name="${field}"`), false, `application must not generate ${field}`);
  }
  const application = { name: "New Creator", email: "blank-profile@example.com", phone: "+15555550999", instagramHandle: "newcreator", profileDetails: "Private application answer", reviewSubmittedAt: "true" };
  const response = await submit(formRequest("/api/creators/profile", application));
  assert.equal(response.status, 200);
  let profile = (await domain.listCreatorApplications()).find(item => item.email === application.email);
  assert.equal(profile.about, "");
  assert.equal(profile.bio, "");
  assert.equal(profile.seat15Description, "");
  assert.equal(profile.seat15Enabled, false);

  // An application submitted before this release may still contain prototype defaults.
  sqlite.prepare("UPDATE creator_onboarding_profiles SET about = 'Generated about', bio = 'Generated bio', profile_intro = 'Generated intro', help_items = 'Generated help', seat_15_description = 'Sample call', seat_15_price_amount = 4500, seat_15_enabled = 1 WHERE id = ?").run(profile.id);
  profile = await domain.acceptCreatorApplication(profile.id, "blank-profile-test");
  const invite = await domain.createCreatorInvite(profile);
  const owner = { userId: "user_blank_profile", email: application.email, phone: null, sessionId: "session_blank_profile" };
  assert.equal((await domain.claimCreatorInvite(invite.token, owner)).status, "claimed");
  const editor = getEditableCreatorProfile((await domain.getCreatorDashboardAccount(owner)).profile);
  assert.equal(editor.name, application.name);
  assert.equal(editor.email, application.email);
  assert.equal(editor.phone, application.phone);
  assert.match(editor.instagramUrl, /newcreator$/);
  for (const key of ["about", "bio", "profileIntro", "helpItems", "oneToOneReason", "offer", "location", "image", "seat15Description", "seat30Description", "seat15PriceAmount", "seat30PriceAmount"]) {
    assert.equal(editor[key], "", key);
  }
  assert.deepEqual(editor.mediaItems, []);
  assert.equal(editor.seat15Enabled, false);
  assert.equal(editor.seat30Enabled, false);
  assert.equal(await domain.getPublishedCreatorBySlug(profile.publicSlug), null);

  process.env.TAKE_A_SEAT_DEV_ADMIN_ENABLED = "true";
  try {
    const values = { ...application, creatorId: profile.id, reviewSubmittedAt: "false", about: "My own profile copy", profileIntro: "My own introduction", seat15Enabled: "on", seat15PriceAmount: "75", seat15DurationMinutes: "15", seat15Description: "My own session description" };
    assert.equal((await submit(formRequest("/api/creators/profile", values, true))).status, 200);
    let restored = getEditableCreatorProfile((await domain.getCreatorDashboardAccount(owner)).profile);
    assert.equal(restored.about, values.about);
    assert.equal(restored.profileIntro, values.profileIntro);
    assert.equal(restored.seat15PriceAmount, 75);
    assert.equal(restored.seat15Description, values.seat15Description);
    assert.equal(restored.image, "");
    assert.deepEqual(restored.mediaItems, []);

    // Clearing real content must not restore application text, stock photos or generic descriptions.
    assert.equal((await submit(formRequest("/api/creators/profile", { ...values, about: "", profileIntro: "", seat15Description: "" }, true))).status, 200);
    const stored = (await domain.getCreatorDashboardAccount(owner)).profile;
    restored = getEditableCreatorProfile(stored);
    assert.equal(restored.about, "");
    assert.equal(restored.profileIntro, "");
    assert.equal(restored.bio, "");
    assert.equal(restored.seat15Description, "");
    assert.equal(restored.image, "");
    assert.equal(stored.profileDetails, application.profileDetails);
    const published = await domain.getPublishedCreatorBySlug(stored.publicSlug);
    assert.deepEqual(published.profile.about, []);
    assert.equal(published.profile.intro, "");
    assert.equal(published.image, null);
  } finally {
    delete process.env.TAKE_A_SEAT_DEV_ADMIN_ENABLED;
  }
});

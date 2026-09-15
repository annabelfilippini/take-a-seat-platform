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
const nativeFetch = globalThis.fetch;
const readinessFetch = async (url, options) => String(url).includes("api.stripe.com/v2/core/accounts/") ? Response.json({ configuration: { recipient: { capabilities: { stripe_balance: { stripe_transfers: { status: "active" } } } } } }) : nativeFetch(url, options);
globalThis.fetch = readinessFetch;
const domain = await import("../app/_lib/creator-onboarding.ts");
const availability = await import("../app/_lib/availability.ts");
const availabilityWeeks = await import("../app/_lib/availability-weeks.ts");
const { POST: submit } = await import("../app/api/creators/profile/route.ts");
const { POST: accept } = await import("../app/api/creators/applications/accept/route.ts");
const { sendCreatorAcceptedInviteEmail } = await import("../app/_lib/creator-accepted-invite.ts");
const { getRequestAdminEmail } = await import("../app/_lib/admin-auth.ts");
const { getEditableCreatorProfile } = await import("../app/admin/creator-profile-editor-preview/creator-profile-editor-data.ts");

function formRequest(path, values, admin = false) {
  if (path === "/api/creators/profile" && values.creatorId && values.expectedDraftSavedAt === undefined) {
    const stored = sqlite.prepare("SELECT draft_saved_at FROM creator_onboarding_profiles WHERE id=?").get(values.creatorId);
    values = { ...values, expectedDraftSavedAt: stored?.draft_saved_at ?? "" };
  }
  return new Request(`http://localhost${path}`, { method: "POST", body: new URLSearchParams(values), headers: { accept: "application/json", ...(admin ? { cookie: "tas_local_admin=1" } : {}) } });
}

function readyConnections(creatorId) {
  process.env.STRIPE_SECRET_KEY = "sk_test_fixture";
  sqlite.prepare("INSERT OR IGNORE INTO creator_stripe_connections (creator_id,stripe_account_id,account_country) VALUES (?, ?, ?)").run(creatorId, `acct_${creatorId}`, "US");
  sqlite.prepare("UPDATE creator_onboarding_profiles SET calendar_connected_at = '2026-09-13', stripe_connected_at = '2026-09-13' WHERE id = ?").run(creatorId);
  sqlite.prepare("INSERT INTO creator_availability_rules (creator_id, timezone, day_of_week, start_time, end_time) VALUES (?, 'America/Los_Angeles', 1, '09:00', '17:00')").run(creatorId);
}

test("application → review email → acceptance → verified owner → saved public card", async () => {
  process.env.TAKE_A_SEAT_DEV_ADMIN_ENABLED = "true";
  process.env.RESEND_API_KEY = "test-only";
  process.env.TAKE_A_SEAT_EMAIL_FROM = "Take a Seat <applications@example.com>";
  const originalFetch = globalThis.fetch;
  const emails = [];
  globalThis.fetch = async (url, options) => {
    if (String(url).includes("api.stripe.com/")) return readinessFetch(url, options);
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
    assert.equal(setup.pathname, "/creator/profile");
    const token = setup.searchParams.get("invite");
    const owner = { userId: "user_lifecycle", email: values.email, phone: null, sessionId: "session_test" };
    assert.equal((await domain.claimCreatorInvite(token, { ...owner, userId: "stranger", email: "stranger@example.com" })).status, "identity-mismatch");
    assert.equal((await domain.claimCreatorInvite(token, owner)).status, "claimed");
    assert.equal((await domain.getCreatorDashboardAccount(owner)).profile.id, profile.id);
    assert.equal(await domain.canManageCreatorProfile(profile.id, { ...owner, userId: "stranger" }), false);
    const forbidden = await submit(formRequest("/api/creators/profile", { ...values, creatorId: profile.id, reviewSubmittedAt: "false" }));
    assert.equal((await forbidden.json()).detail, "creator-access");

    const input = await domain.getCreatorProfileSettingsInput(await formRequest("/", { ...values, reviewSubmittedAt: "false", about: "My profile", helpItems: "Styling", profileImageUrl: "/ella-profile.jpg", seat15Enabled: "on", seat15PriceAmount: "75" }).formData());
    await domain.saveCreatorProfileSettings(profile.id, input);
    assert.equal(await domain.getPublishedCreatorBySlug(profile.publicSlug), null);
    readyConnections(profile.id);
    assert.equal((await domain.publishCreatorProfile(profile.id)).status, "saved");
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
    const draft = JSON.parse(stored.profileDraft);
    for (const key of ["name", "about", "profileIntro", "oneToOneReason", "category", "location", "instagramHandle", "tiktokHandle", "profileImageUrl", "profileGallery", "seat15Description", "seat30Description"]) {
      assert.equal(draft[key], edits[key], key);
    }
    assert.equal(draft.profileImagePositionX, 27);
    assert.equal(draft.profileImagePositionY, 62);
    assert.equal(draft.profileImageZoom, 160);
    assert.equal(draft.seat15PriceAmount, 7500);
    assert.equal(draft.seat30PriceAmount, 15000);
    const restored = getEditableCreatorProfile(stored);
    assert.equal(restored.seat15PriceAmount, 75);
    assert.equal(restored.seat30PriceAmount, 150);
    assert.equal(restored.mediaItems.length, 2);
    assert.equal(await domain.getPublishedCreatorBySlug(stored.publicSlug), null);
    readyConnections(stored.id);
    assert.equal((await domain.publishCreatorProfile(stored.id)).status, "saved");
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
    const stillPublished = await domain.getPublishedCreatorBySlug(reloaded.publicSlug);
    assert.equal(stillPublished.name, edits.name);
    assert.ok(stillPublished.instagramUrl);
    assert.equal((await domain.publishCreatorProfile(reloaded.id)).status, "saved");
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
      assert.equal(JSON.parse(saved.profileDraft).seat30PriceAmount, Math.round(amount * 100));
      assert.equal(saved.seat30PriceAmount, 15000, "Live price stays unchanged while drafts are saved");
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

  const { EditableCreatorProfilePreview } = await import("../app/admin/creator-profile-editor-preview/EditableCreatorProfilePreview.tsx");
  const blankEditorHtml = renderToStaticMarkup(createElement(EditableCreatorProfilePreview, { initialProfile: editor }));
  assert.match(blankEditorHtml, /Photo or video/);
  assert.doesNotMatch(blankEditorHtml, /Show next media|Show previous media|amber-reference|Private application answer/);
  assert.match(blankEditorHtml, /aria-label="(?:Public profile intro|One-to-one reason|15 minutes description|30 minutes description)"/);
  assert.match(blankEditorHtml, /aria-label="What people can ask"[^>]*><\/textarea>/);
  assert.match(blankEditorHtml, /aria-label="About section"[^>]*><\/textarea>/);
  assert.match(blankEditorHtml, /Why a 1:1 call\?/);
  assert.ok(blankEditorHtml.indexOf("Photo or video") < blankEditorHtml.indexOf('id="reserve"'));
  assert.ok(blankEditorHtml.indexOf('aria-label="One-to-one reason"') < blankEditorHtml.indexOf('id="reserve"'));

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
    assert.equal(published, null);
    assert.deepEqual(getEditableCreatorProfile({ ...stored, profileImageUrl: "/ella-profile.jpg" }).mediaItems, []);
    assert.deepEqual(domain.createPublishedCreator({ ...stored, profileIntro: "Intro", bio: "Intro", about: "" }).profile.about, []);
    assert.equal(domain.createPublishedCreator({ ...stored, profileIntro: "", bio: "About", about: "About" }).profile.intro, "");
    assert.equal(domain.createPublishedCreator(stored).profile.whyBody, "");
    assert.equal((await domain.publishCreatorProfile(stored.id)).status, "error");
  } finally {
    delete process.env.TAKE_A_SEAT_DEV_ADMIN_ENABLED;
  }
});


test("email sign-in provisions a fresh identity and reuses an exact existing email", async () => {
  const { createCreatorEmailSignIn } = await import("../app/_lib/creator-email-sign-in.ts");
  const users = [];
  const tokens = [];
  const client = {
    users: {
      async getUserList({ emailAddress }) { return { data: users.filter(user => user.emailAddresses.some(address => address.emailAddress === emailAddress[0])) }; },
      async createUser({ emailAddress }) {
        const address = { emailAddress: emailAddress[0], verification: { status: "verified" } };
        const user = { id: "user_email_link", primaryEmailAddress: address, emailAddresses: [address] };
        users.push(user);
        return user;
      },
    },
    signInTokens: { async createSignInToken(params) { tokens.push(params); return { token: "synthetic-ticket" }; } },
  };
  assert.equal((await createCreatorEmailSignIn(" New@Example.com ", client)).token, "synthetic-ticket");
  await createCreatorEmailSignIn("new@example.com", client);
  assert.equal(users.length, 1);
  assert.deepEqual(tokens, Array(2).fill({ userId: "user_email_link", expiresInSeconds: 86400 }));
  users[0].banned = true;
  await assert.rejects(createCreatorEmailSignIn("new@example.com", client));
  users[0].banned = false;
  users[0].primaryEmailAddress.verification.status = "unverified";
  await assert.rejects(createCreatorEmailSignIn("new@example.com", client));
  users[0].primaryEmailAddress = { emailAddress: "different@example.com", verification: { status: "verified" } };
  await assert.rejects(createCreatorEmailSignIn("new@example.com", client));
  assert.equal(tokens.length, 2);
  await assert.rejects(createCreatorEmailSignIn("new@example.com", null));
});

test("email sign-in recovers concurrent creation without creating duplicate accounts", async () => {
  const { createCreatorEmailSignIn } = await import("../app/_lib/creator-email-sign-in.ts");
  const address = { emailAddress: "race@example.com", verification: { status: "verified" } };
  const user = { id: "race-owner", primaryEmailAddress: address, emailAddresses: [address] };
  let reads = 0;
  const client = {
    users: {
      async getUserList() { return { data: reads++ ? [user] : [] }; },
      async createUser() { throw new Error("Concurrent user already exists"); },
    },
    signInTokens: { async createSignInToken(params) { assert.equal(params.userId, "race-owner"); return { token: "race-ticket" }; } },
  };
  assert.equal((await createCreatorEmailSignIn(address.emailAddress, client)).token, "race-ticket");
});

test("acceptance email keeps the one-use credential in the fragment and preserves the invite", async () => {
  const { sendCreatorAcceptedEmail } = await import("../app/_lib/email.ts");
  const originalFetch = globalThis.fetch;
  process.env.RESEND_API_KEY = "test-only";
  process.env.TAKE_A_SEAT_EMAIL_FROM = "Take a Seat <applications@example.com>";
  let payload;
  globalThis.fetch = async (url, options) => { payload = JSON.parse(options.body); return Response.json({ id: "test-email" }); };
  try {
    await sendCreatorAcceptedEmail({ creatorId: "synthetic", email: "fresh@example.com", emailNonce: "test", expiresAt: "2026-09-14", inviteToken: "synthetic-invite", signInToken: "synthetic-ticket", name: "Fresh Creator", request: new Request("https://takeaseatwith.com") });
    const link = new URL(payload.text.match(/https?:\/\/\S+/)[0]);
    assert.equal(link.pathname, "/creators/email-sign-in");
    assert.equal(link.searchParams.get("invite"), "synthetic-invite");
    assert.equal(link.searchParams.has("ticket"), false);
    assert.equal(new URLSearchParams(link.hash.slice(1)).get("ticket"), "synthetic-ticket");
    assert.deepEqual(payload.to, ["fresh@example.com"]);
    assert.match(payload.text, /^Hi!\n/);
    assert.match(payload.text, /We can’t wait for you to begin inspiring!!!/);
    assert.match(payload.html, /#ticket=synthetic-ticket&amp;email=/);
    assert.match(payload.text, /Save your draft.*Preview & Publish/);
    assert.match(payload.html, /Save your draft.*Preview &amp; Publish/);
  } finally { globalThis.fetch = originalFetch; delete process.env.RESEND_API_KEY; delete process.env.TAKE_A_SEAT_EMAIL_FROM; }
});

test("unaccepted applications cannot generate a setup email or provision an identity", async () => {
  assert.deepEqual(await sendCreatorAcceptedInviteEmail({ profile: { applicationStatus: "in_review", email: "test@example.com" }, request: new Request("http://localhost") }), { status: "skipped", reason: "setup-link-failed" });
});

const { POST: saveAvailabilityRoute } = await import("../app/api/creators/availability/route.ts");
const availabilitySeat = { id: "qa-seat", name: "15 minutes", unitAmount: 1000 };

function availabilityForm(weekStart, slots = [], extra = {}) {
  return new URLSearchParams({
    creatorId: "onboard_week_test",
    timezone: "America/Los_Angeles",
    weekStart,
    availabilitySlots: JSON.stringify(slots),
    minNoticeMinutes: "0",
    bufferMinutes: "0",
    ...extra,
  });
}

async function availabilityInput(weekStart, slots, extra) {
  return domain.getCreatorAvailabilityInput(
    await new Request("http://localhost", {
      body: availabilityForm(weekStart, slots, extra),
      method: "POST",
    }).formData(),
  );
}

function viewerDays(rules) {
  return availability.getViewerAvailability({
    availabilityRules: rules,
    creatorId: "onboard_week_test",
    seat: availabilitySeat,
    viewerTimezone: "America/Los_Angeles",
    windowStart: availability.getAvailabilityWindowStart(),
  });
}

test("dated availability saves and reloads independent weeks, preserves defaults, and closes an empty week", async () => {
  const currentWeek = availabilityWeeks.availabilityWeekStart(
    availabilityWeeks.availabilityDateBounds("America/Los_Angeles").today,
  );
  const firstWeek = availabilityWeeks.addCalendarDays(currentWeek, 7);
  const secondWeek = availabilityWeeks.addCalendarDays(firstWeek, 7);
  const first = await availabilityInput(firstWeek, [2, 3, 4].map((dayOfWeek) => ({ dayOfWeek, startTime: "10:00" })));
  const second = await availabilityInput(secondWeek, [0, 5, 6].map((dayOfWeek) => ({ dayOfWeek, startTime: "11:00" })));

  await domain.saveCreatorAvailability({ ...first, weekStart: null, rules: [{ dayOfWeek: 1, startTime: "09:00", endTime: "10:00" }] });
  await domain.saveCreatorAvailability(first);
  await domain.saveCreatorAvailability(second);
  let saved = await domain.listCreatorAvailabilityRules(first.creatorId);
  assert.equal(saved.filter((rule) => rule.weekStart === firstWeek).length, 3);
  assert.equal(saved.filter((rule) => rule.weekStart === secondWeek).length, 3);
  assert.equal(saved.filter((rule) => rule.weekStart === null).length, 1);

  let dates = viewerDays(saved).map((day) => day.date);
  for (const day of [2, 3, 4]) assert.ok(dates.includes(availabilityWeeks.addCalendarDays(firstWeek, day)));
  assert.ok(!dates.includes(availabilityWeeks.addCalendarDays(firstWeek, 1)), "weekly override replaces the default Monday");
  for (const day of [0, 5, 6]) assert.ok(dates.includes(availabilityWeeks.addCalendarDays(secondWeek, day)));

  await domain.saveCreatorAvailability(await availabilityInput(firstWeek, []));
  saved = await domain.listCreatorAvailabilityRules(first.creatorId);
  assert.equal(saved.find((rule) => rule.weekStart === firstWeek).enabled, false);
  dates = viewerDays(saved).map((day) => day.date);
  assert.ok(!dates.some((date) => availabilityWeeks.availabilityWeekStart(date) === firstWeek));
  assert.ok(dates.includes(availabilityWeeks.addCalendarDays(secondWeek, 5)));
  assert.ok(dates.includes(availabilityWeeks.addCalendarDays(secondWeek, 8)), "untouched week still uses legacy baseline");
});

test("availability rejects malformed payloads, missing week, invalid timezone, past weeks and dates beyond six months", async () => {
  const { today, end } = availabilityWeeks.availabilityDateBounds("America/Los_Angeles");
  const current = availabilityWeeks.availabilityWeekStart(today);
  for (const bad of ["", "2027-02-30", availabilityWeeks.addCalendarDays(current, 1), availabilityWeeks.addCalendarDays(current, -7), availabilityWeeks.addCalendarDays(availabilityWeeks.availabilityWeekStart(end), 7)]) {
    assert.equal(await availabilityInput(bad, []), null, bad);
  }
  for (const raw of ["", "{", "{}", "[null]", "[{\"dayOfWeek\":2,\"startTime\":\"25:00\"}]", "[{\"dayOfWeek\":2,\"startTime\":\"10:01\"}]"]) {
    assert.equal(await availabilityInput(current, [], { availabilitySlots: raw }), null);
  }
  assert.equal(await availabilityInput(current, [], { timezone: "Not/A_Zone" }), null);
  const afterEnd = availabilityWeeks.addCalendarDays(end, 1);
  assert.equal(
    await availabilityInput(availabilityWeeks.availabilityWeekStart(afterEnd), [{ dayOfWeek: new Date(`${afterEnd}T00:00:00Z`).getUTCDay(), startTime: "10:00" }]),
    null,
  );
  const unauthorized = await saveAvailabilityRoute(new Request("http://localhost/api/creators/availability", {
    body: availabilityForm(current),
    headers: { accept: "application/json" },
    method: "POST",
  }));
  assert.equal(unauthorized.status, 400);
  assert.equal((await unauthorized.json()).detail, "creator-access");
});

test("a failed availability insertion rolls back the deletion", async () => {
  const currentWeek = availabilityWeeks.availabilityWeekStart(
    availabilityWeeks.availabilityDateBounds("UTC").today,
  );
  const week = availabilityWeeks.addCalendarDays(currentWeek, 14);
  const input = await availabilityInput(week, [{ dayOfWeek: 2, startTime: "12:00" }]);
  await domain.saveCreatorAvailability(input);
  const before = await domain.listCreatorAvailabilityRules(input.creatorId);
  sqlite.exec("CREATE TRIGGER fail_availability_insert BEFORE INSERT ON creator_availability_rules BEGIN SELECT RAISE(ABORT, 'simulated write failure'); END");
  try {
    await assert.rejects(domain.saveCreatorAvailability({ ...input, rules: [] }));
  } finally {
    sqlite.exec("DROP TRIGGER fail_availability_insert");
  }
  assert.deepEqual(await domain.listCreatorAvailabilityRules(input.creatorId), before);
});

test("customer selection and server validation reach the one-year limit with notice, buffer and timezone intact", async () => {
  const { end } = availabilityWeeks.availabilityDateBounds("America/Los_Angeles");
  const endDayOfWeek = new Date(`${end}T00:00:00Z`).getUTCDay();
  const input = await availabilityInput(availabilityWeeks.availabilityWeekStart(end), [{ dayOfWeek: endDayOfWeek, startTime: "12:00" }]);
  await domain.saveCreatorAvailability(input);
  const saved = await domain.listCreatorAvailabilityRules(input.creatorId);
  const found = viewerDays(saved).find((day) => day.date === end);
  assert.ok(found);
  const matched = availability.getMatchedAvailabilitySlot({
    appointmentStartAt: `${end}T12:00:00`,
    availabilityRules: saved,
    creatorId: input.creatorId,
    seat: availabilitySeat,
    timezone: "America/Los_Angeles",
  });
  assert.equal(matched.creatorDate, end);
  assert.equal(matched.appointmentEndUtc - matched.appointmentStartUtc, 15 * 60_000);
  const future = availabilityWeeks.addCalendarDays(end, 1);
  assert.equal(availability.getMatchedAvailabilitySlot({
    appointmentStartAt: `${future}T12:00:00`,
    availabilityRules: saved,
    creatorId: input.creatorId,
    seat: availabilitySeat,
    timezone: "America/Los_Angeles",
  }), null);
  const repeating = [{ dayOfWeek: 2, startTime: "10:00", endTime: "11:00", timezone: "America/Los_Angeles", bufferMinutes: 15, minNoticeMinutes: 0, maxBookingsPerDay: 2, maxBookingsPerWeek: 4 }];
  const firstDay = viewerDays(repeating)[0];
  assert.deepEqual(firstDay.slots.map((slot) => slot.sourceAppointmentStartAt.slice(11, 16)), ["10:00", "10:30"]);
  const match = availability.getMatchedAvailabilitySlot({
    appointmentStartAt: firstDay.slots[0].sourceAppointmentStartAt,
    availabilityRules: repeating,
    creatorId: input.creatorId,
    seat: availabilitySeat,
    timezone: "America/Los_Angeles",
  });
  assert.equal(match.maxBookingsPerDay, 2);
  assert.equal(match.maxBookingsPerWeek, 4);
  assert.deepEqual(viewerDays([{ ...repeating[0], minNoticeMinutes: 600000 }]), []);
});

test("one-year and daylight-saving boundaries never shift selected wall times", () => {
  assert.deepEqual(availabilityWeeks.availabilityDateBounds("UTC", new Date("2028-08-31T12:00:00Z")), { today: "2028-08-31", end: "2029-08-31" });
  assert.equal(availabilityWeeks.availabilityDateBounds("America/Los_Angeles", new Date("2026-09-13T01:00:00Z")).today, "2026-09-12");
  assert.equal(availability.localDateTimeToUtc("2027-03-14T10:00:00", "America/Los_Angeles").toISOString(), "2027-03-14T17:00:00.000Z");
  assert.equal(availability.localDateTimeToUtc("2026-11-01T10:00:00", "America/Los_Angeles").toISOString(), "2026-11-01T18:00:00.000Z");
  assert.equal(availability.localDateTimeToUtc("2027-03-14T02:30:00", "America/Los_Angeles"), null);
});

test("fragmented hours save without exceeding D1 parameter limits", async () => {
  const currentWeek = availabilityWeeks.availabilityWeekStart(
    availabilityWeeks.availabilityDateBounds("UTC").today,
  );
  const week = availabilityWeeks.addCalendarDays(currentWeek, 21);
  const slots = Array.from({ length: 7 }, (_, dayOfWeek) =>
    Array.from({ length: 13 }, (_, hour) => ({ dayOfWeek, startTime: `${String(hour + 8).padStart(2, "0")}:00` })),
  ).flat();
  const input = await availabilityInput(week, slots);
  const originalPrepare = globalThis.__lifecycleEnv.DB.prepare;
  globalThis.__lifecycleEnv.DB.prepare = (sql) => {
    const statement = originalPrepare(sql);
    const originalBind = statement.bind;
    statement.bind = (...values) => {
      assert.ok(values.length <= 100, `${values.length} bound parameters`);
      return originalBind(...values);
    };
    return statement;
  };
  try {
    await domain.saveCreatorAvailability(input);
  } finally {
    globalThis.__lifecycleEnv.DB.prepare = originalPrepare;
  }
  assert.equal((await domain.listCreatorAvailabilityRules(input.creatorId)).filter((rule) => rule.weekStart === week).length, 91);
});

test("publish requires accepted ownership and complete setup; drafts never leak into live cards or prices", async () => {
  process.env.TAKE_A_SEAT_DEV_ADMIN_ENABLED = "true";
  try {
    const values = { creatorId: "onboard_private_draft", name: "Public Name", email: "private-draft@example.com", about: "Public about", helpItems: "Public topic", profileImageUrl: "/ella-profile.jpg", seat15Enabled: "on", seat15PriceAmount: "50" };
    const input = await domain.getCreatorProfileSettingsInput(await formRequest("/", values).formData());
    await domain.saveCreatorProfileSettings(values.creatorId, input);
    assert.equal((await submit(formRequest("/api/creators/profile", { ...values, intent: "publish" }, true))).status, 400);
    const accepted = await domain.acceptCreatorApplication(values.creatorId, "private-draft-test");
    values.creatorId = accepted.id;
    assert.equal((await submit(formRequest("/api/creators/profile", values, true))).status, 200);
    assert.equal((await submit(formRequest("/api/creators/profile", { ...values, intent: "publish" }))).status, 400);
    assert.equal((await submit(formRequest("/api/creators/profile", { ...values, intent: "publish" }, true))).status, 400);
    assert.equal(await domain.getPublishedCreatorBySlug(accepted.publicSlug), null);
    readyConnections(accepted.id);
    const firstPublish = await submit(formRequest("/api/creators/profile", { ...values, intent: "publish" }, true));
    assert.equal(firstPublish.status, 200);
    assert.equal((await firstPublish.json()).publicPath, "/with/private-draft-test");
    assert.equal((await domain.getPublishedCreatorBySlug(accepted.publicSlug)).name, "Public Name");
    await submit(formRequest("/api/creators/profile", { ...values, name: "Private Name", about: "Private about", seat15PriceAmount: "99", profileImageUrl: "/amber-headshot.jpg" }, true));
    let live = await domain.getPublishedCreatorBySlug(accepted.publicSlug);
    assert.equal(live.name, "Public Name");
    assert.equal(live.seats[0].unitAmount, 5000);
    assert.equal(live.image, "/ella-profile.jpg");
    assert.doesNotMatch(JSON.stringify(await domain.listPublicMarketplaceCreators()), /Private Name|Private about|profileDraft/);
    const restored = getEditableCreatorProfile(await domain.getCreatorApplication(accepted.id));
    assert.equal(restored.name, "Private Name");
    assert.equal(restored.seat15PriceAmount, 99);
    // Publish reads the saved snapshot, never unreviewed fields from the publish request.
    assert.equal((await submit(formRequest("/api/creators/profile", { ...values, intent: "publish", name: "Unsaved payload" }, true))).status, 200);
    live = await domain.getPublishedCreatorBySlug(accepted.publicSlug);
    assert.equal(live.name, "Private Name");
    assert.equal(live.seats[0].unitAmount, 9900);
    await submit(formRequest("/api/creators/profile", { ...values, seat15PriceAmount: "0" }, true));
    assert.equal((await domain.publishCreatorProfile(accepted.id)).status, "error");
    assert.equal((await domain.getPublishedCreatorBySlug(accepted.publicSlug)).seats[0].unitAmount, 9900);
  } finally { delete process.env.TAKE_A_SEAT_DEV_ADMIN_ENABLED; }
});


test("availability uses the same verified admin or creator access as the shared profile editor", async () => {
  const { POST: saveAvailability } = await import("../app/api/creators/availability/route.ts");
  const currentWeek = availabilityWeeks.availabilityWeekStart(
    availabilityWeeks.availabilityDateBounds("Europe/London").today,
  );
  const weekStart = availabilityWeeks.addCalendarDays(currentWeek, 7);
  const laterWeekStart = availabilityWeeks.addCalendarDays(weekStart, 7);
  const values = { creatorId: "onboard_private_draft", timezone: "Europe/London", weekStart, availabilitySlots: JSON.stringify([{ dayOfWeek: 2, startTime: "10:00" }]) };
  const denied = await saveAvailability(formRequest("/api/creators/availability", values));
  assert.equal(denied.status, 400);
  assert.equal((await denied.json()).detail, "creator-access");
  process.env.TAKE_A_SEAT_DEV_ADMIN_ENABLED = "true";
  try {
    const response = await saveAvailability(formRequest("/api/creators/availability", values, true));
    assert.equal(response.status, 200);
    const secondWeek = await saveAvailability(formRequest("/api/creators/availability", {
      ...values,
      weekStart: laterWeekStart,
      availabilitySlots: JSON.stringify([{ dayOfWeek: 4, startTime: "14:00" }]),
    }, true));
    assert.equal(secondWeek.status, 200);
    let rules = await domain.listCreatorAvailabilityRules(values.creatorId);
    assert.ok(rules.some((rule) => rule.weekStart === weekStart && rule.dayOfWeek === 2 && rule.startTime === "10:00"));
    assert.ok(rules.some((rule) => rule.weekStart === laterWeekStart && rule.dayOfWeek === 4 && rule.startTime === "14:00"));

    const cleared = await saveAvailability(formRequest("/api/creators/availability", {
      ...values,
      availabilitySlots: "[]",
    }, true));
    assert.equal(cleared.status, 200);
    rules = await domain.listCreatorAvailabilityRules(values.creatorId);
    const clearedWeekRules = rules.filter((rule) => rule.weekStart === weekStart);
    assert.equal(clearedWeekRules.length, 1);
    assert.equal(clearedWeekRules[0].enabled, false);
    assert.ok(rules.some((rule) => rule.weekStart === laterWeekStart && rule.enabled && rule.startTime === "14:00"));
  } finally { delete process.env.TAKE_A_SEAT_DEV_ADMIN_ENABLED; }
});

test("oversized profile uploads fail clearly without replacing saved draft or public data", async () => {
  process.env.TAKE_A_SEAT_DEV_ADMIN_ENABLED = "true";
  const id = "photo-test";
  const values = { creatorId: id, name: "Photo Test", email: "photo-test@example.com", about: "Saved text", helpItems: "Style", profileImageUrl: "/ella-profile.jpg", seat15Enabled: "on", seat15PriceAmount: "45" };
  const initial = await submit(formRequest("/api/creators/profile", values, true));
  assert.equal(initial.status, 200);
  await domain.acceptCreatorApplication(id, "photo-test");
  assert.equal((await submit(formRequest("/api/creators/profile", values, true))).status, 200);
  const before = await domain.getCreatorApplication(id);
  const failed = await submit(formRequest("/api/creators/profile", { ...values, about: "Must not replace saved text", profileGallery: `data:image/jpeg;base64,${"a".repeat(6_000_000)}` }, true));
  assert.equal(failed.status, 413);
  assert.equal((await failed.json()).detail, "profile-too-large");
  assert.deepEqual(await domain.getCreatorApplication(id), before);
  // A bounded media payload can be saved, read back, and published with both copies in the row.
  const gallery = `data:image/webp;base64,${"a".repeat(600_000)}`;
  const retry = await submit(formRequest("/api/creators/profile", { ...values, profileGallery: gallery }, true));
  assert.equal(retry.status, 200);
  const saved = await domain.getCreatorApplication(id);
  assert.equal(JSON.parse(saved.profileDraft).profileGallery, gallery);
  assert.equal(saved.profileGallery, before.profileGallery);
  readyConnections(id);
  assert.equal((await domain.publishCreatorProfile(id)).status, "saved");
  assert.equal((await domain.getCreatorApplication(id)).profileGallery, gallery);
});

test("profile byte limits count UTF-8 and reserve room for legacy published media", async () => {
  const { MAX_PROFILE_BYTES, profileByteLength, ProfileSizeError } = await import("../app/_lib/profile-save.ts");
  const id = "photo-test";
  const input = await domain.getCreatorProfileSettingsInput(await formRequest("/", { email: "photo-test@example.com", name: "Photo Test" }).formData());
  assert.ok(profileByteLength({ ...input, about: "🌸".repeat(210_000) }) > MAX_PROFILE_BYTES);
  await assert.rejects(domain.saveCreatorProfileSettings(id, { ...input, about: "🌸".repeat(210_000) }), ProfileSizeError);
  sqlite.prepare("UPDATE creator_onboarding_profiles SET profile_gallery = ? WHERE id = ?").run("a".repeat(1_400_000), id);
  const before = await domain.getCreatorApplication(id);
  await assert.rejects(domain.saveCreatorProfileSettings(id, { ...input, profileGallery: "a".repeat(600_000) }), ProfileSizeError);
  assert.deepEqual(await domain.getCreatorApplication(id), before);
});

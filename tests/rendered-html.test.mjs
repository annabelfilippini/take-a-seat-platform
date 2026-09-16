process.env.STRIPE_BOOKING_PAYMENT_METHOD_CONFIGURATION = 'pmc_test';
import { registerHooks } from "node:module";
globalThis.__tasTestEnv = {};
registerHooks({
  resolve(specifier, context, nextResolve) {
    if (specifier === "cloudflare:workers") return { url: "data:text/javascript,export const env = globalThis.__tasTestEnv", shortCircuit: true };
    return nextResolve(specifier, context);
  },
});
import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import { readFile } from "node:fs/promises";
import test from "node:test";

async function render(path = "/") {
  const workerUrl = new URL("../dist/server/index.js", import.meta.url);
  workerUrl.searchParams.set("test", `${process.pid}-${Date.now()}`);
  const { default: worker } = await import(workerUrl.href);

  return worker.fetch(
    new Request(`http://localhost${path}`, {
      headers: { accept: "text/html" },
    }),
    {
      ASSETS: {
        fetch: async () => new Response("Not found", { status: 404 }),
      },
    },
    {
      waitUntil() {},
      passThroughOnException() {},
    },
  );
}

async function dispatch(path = "/", init = {}, env = {}) {
  const workerUrl = new URL("../dist/server/index.js", import.meta.url);
  workerUrl.searchParams.set("test", `${process.pid}-${Date.now()}`);
  const { default: worker } = await import(workerUrl.href);

  return worker.fetch(
    new Request(`http://localhost${path}`, init),
    {
      ASSETS: {
        fetch: async () => new Response("Not found", { status: 404 }),
      },
      ...env,
    },
    {
      waitUntil() {},
      passThroughOnException() {},
    },
  );
}

function withEnv(values, callback) {
  const previous = {};

  for (const key of Object.keys(values)) {
    previous[key] = process.env[key];
    process.env[key] = values[key];
  }

  return Promise.resolve()
    .then(callback)
    .finally(() => {
      for (const key of Object.keys(values)) {
        if (previous[key] === undefined) {
          delete process.env[key];
        } else {
          process.env[key] = previous[key];
        }
      }
    });
}

function signStripeWebhookPayload(payload, secret, timestamp = Math.floor(Date.now() / 1000)) {
  const signature = createHmac("sha256", secret)
    .update(`${timestamp}.${payload}`)
    .digest("hex");

  return `t=${timestamp},v1=${signature}`;
}

test("server-renders the public booking homepage", async () => {
  const response = await render();
  assert.equal(response.status, 200);
  assert.match(response.headers.get("content-type") ?? "", /^text\/html\b/i);

  const html = await response.text();
  assert.match(html, /<title>Take a Seat<\/title>/i);
  assert.match(html, />Take a Seat</);
  assert.match(html, /Meet Your Personal Styling Committee/);
  assert.match(html, /home-vanity-hero\.png/);
  assert.match(html, /<button class="hero-cta" type="submit">Take a Seat<\/button>/);
  assert.match(html, /Apply to Inspire/);
  assert.match(html, /Our Mission/);
  assert.match(html, /Search creators/);
  assert.match(html, /Sign In/);
  assert.match(html, /href="\/privacy"[^>]*>Privacy<\/a>/);
  assert.match(html, /directory-results/);
  assert.match(html, /placeholder="Search creators"/);
  assert.match(html, /Ella McLane/);
  assert.match(html, /\/with\/ella\/?/);
  assert.doesNotMatch(html, /Abby Catlin/);
  assert.doesNotMatch(html, /Alex Earl/);
  assert.doesNotMatch(html, /Montecito Style/);
  assert.doesNotMatch(html, /Chlo&#x27;s in a Closet/);
  assert.doesNotMatch(html, /Maria Baldini/);
  assert.doesNotMatch(html, /Sarah Elizabeth/);
  assert.doesNotMatch(html, /Wellness Edit/);
  assert.doesNotMatch(html, /Food Edit/);
  assert.doesNotMatch(html, /Annabel Filippini/);
  assert.match(html, /category-top-experts\.png/);
  assert.match(html, /category-style\.png/);
  assert.match(html, /category-wellness\.png/);
  assert.match(html, /category-food\.png/);
  assert.match(html, /category-home-interiors\.png/);
  assert.doesNotMatch(html, /public-profile-page/);
  assert.doesNotMatch(html, /<title>Take a Seat with Annabel Filippini<\/title>/i);
  assert.doesNotMatch(html, /Now booking on Take a Seat/);
  assert.doesNotMatch(html, /Use this creator editor to tune how a Take a Seat profile/);
  assert.doesNotMatch(html, /with the ones to watch/);
  assert.doesNotMatch(html, /seat-mark\.png/);
  assert.doesNotMatch(html, /Booking Now/);
  assert.doesNotMatch(html, /<a class="topnav-signup" href="\/take-a-seat">Sign up<\/a>/);
  assert.doesNotMatch(html, /Creator login/);
  assert.doesNotMatch(html, /Choose your creator/);
  assert.doesNotMatch(html, /Filter by category, then open the seat/);
  assert.doesNotMatch(html, /For creators/);
  assert.doesNotMatch(html, /Share the advice people already ask you for/);
  assert.doesNotMatch(html, /honest second opinion in real time/);
  assert.doesNotMatch(html, /Find your seat/);
  assert.doesNotMatch(html, /Search by creator, niche, city/);
  assert.doesNotMatch(html, /That crave a stronger community/);
  assert.doesNotMatch(html, /a simple way to know them better/);
  assert.doesNotMatch(html, /Become an Inspiration/);
  assert.doesNotMatch(html, /Book<\/a>|href="#booking"|id="booking"|Request this seat|Buy It Once/);
  assert.doesNotMatch(html, /Access to the people you already trust/);
  assert.doesNotMatch(html, /seats shown|booking now,\s*<!-- -->3<!-- -->\s*opening soon/i);
  assert.doesNotMatch(
    html,
    /Fifteen minutes\s*with the person you\s*already follow/i,
  );
  assert.doesNotMatch(html, /react-loading-skeleton|codex-preview|SkeletonPreview/);
});

test("server-renders the public privacy notice required for Google OAuth", async () => {
  const response = await render("/privacy");
  assert.equal(response.status, 200);
  assert.match(response.headers.get("content-type") ?? "", /^text\/html\b/i);

  const html = await response.text();
  assert.match(html, /<title>Privacy \| Take a Seat<\/title>/i);
  assert.match(html, /Privacy at Take a Seat/);
  assert.match(html, /Google Calendar data/);
  assert.match(html, /calendar\.freebusy|free and busy times/i);
  assert.match(html, /Limited Use requirements/);
  assert.match(html, /disconnect Calendar on your creator Availability page/i);
  assert.match(html, /mailto:annabelflip1@gmail\.com/);
});

test("server-renders the Take a Seat creator directory", async () => {
  const response = await render("/take-a-seat");
  assert.equal(response.status, 200);
  assert.match(response.headers.get("content-type") ?? "", /^text\/html\b/i);

  const html = await response.text();
  assert.match(html, /<title>Take a Seat \| Creators<\/title>/i);
  assert.match(html, /<header class="about-topbar">/);
  assert.doesNotMatch(html, /Choose the creator you want in the room/);
  assert.doesNotMatch(html, /Browse the first private seats/);
  assert.match(html, /category-top-experts\.png/);
  assert.match(html, /category-food\.png/);
  assert.match(html, /Top Experts/);
  assert.match(html, /Style &amp; Beauty/);
  assert.match(html, /Home Interiors/);
  assert.match(html, /Fitness &amp; Wellness/);
  assert.match(html, /placeholder="Search creators"/);
  assert.doesNotMatch(html, /<label class="directory-search"><span>Search creators<\/span>/);
  assert.doesNotMatch(html, /Choose your creator/);
  assert.doesNotMatch(html, /Filter by category, then open the seat/);
  assert.match(html, /Ella McLane/);
  assert.match(html, /View profile/);
  assert.match(html, /\/with\/ella\/?/);
  assert.match(html, /little upgrades that feel easy to wear/);
  assert.doesNotMatch(html, /Amber May Lowe/);
  assert.doesNotMatch(html, /Nikki B\./);
  assert.doesNotMatch(html, /nikki-card\.jpg/);
  assert.match(
    html,
    /<a(?=[^>]*href="\/with\/ella")(?=[^>]*class="expert-card-link")[^>]*>/,
  );
  assert.doesNotMatch(html, /Verified creator|&#10003;|✓/);
  assert.doesNotMatch(html, /Abby Catlin/);
  assert.doesNotMatch(html, /Montecito Style/);
  assert.doesNotMatch(html, /Chlo&#x27;s in a Closet/);
  assert.doesNotMatch(html, /Maria Baldini/);
  assert.doesNotMatch(html, /Sarah Elizabeth/);
  assert.doesNotMatch(html, /\/with\/montecito-style\/?/);
  assert.doesNotMatch(html, /\/with\/chlos-in-a-closet\/?/);
  assert.doesNotMatch(html, /\/with\/maria-baldini\/?/);
  assert.doesNotMatch(html, /\/with\/sarah-elizabeth\/?/);
  assert.doesNotMatch(html, /Alex Earl/);
  assert.doesNotMatch(html, /Wellness Edit/);
  assert.doesNotMatch(html, /Food Edit/);
  assert.doesNotMatch(html, /Annabel Filippini/);
  assert.match(html, /\$50 • 15 minutes/);
  assert.doesNotMatch(html, /Find your seat/);
  assert.doesNotMatch(html, /Search by creator, niche, city/);
});

test("server-renders the account sign-in entry", async () => {
  const response = await render("/sign-in");
  assert.equal(response.status, 200);
  assert.match(response.headers.get("content-type") ?? "", /^text\/html\b/i);

  const html = await response.text();
  assert.match(html, /<title>Sign In \| Take a Seat<\/title>/i);
  assert.match(html, /Sign in with your application email/);
  assert.match(html, /account-auth-shell-minimal/);
  assert.doesNotMatch(html, /Enter your mobile number/);
  assert.match(html, /Email address/);
  assert.match(html, /you@example.com/);
  assert.match(html, /Next/);
  assert.doesNotMatch(html, /Your account starts here/);
  assert.doesNotMatch(html, /Creator dashboard/);
  assert.doesNotMatch(html, /Create account/);
  assert.match(
    html,
    /<form(?=[^>]*action="\/sign-in")(?=[^>]*class="nav-action-form")(?=[^>]*method="get")[^>]*><button(?=[^>]*class="nav-sign-in-button")(?=[^>]*type="submit")[^>]*>Sign In<\/button><\/form>/,
  );
});

test("reads Clerk and admin auth settings from Cloudflare runtime env", async () => {
  const [adminAuth, clerkAuth] = await Promise.all([
    readFile(new URL("../app/_lib/admin-auth.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/_lib/clerk-auth.ts", import.meta.url), "utf8"),
  ]);

  assert.match(adminAuth, /\(globalThis as Record<string, unknown>\)\.env/);
  assert.match(adminAuth, /getRuntimeEnv\("TAKE_A_SEAT_ADMIN_PHONES"\)/);
  assert.match(adminAuth, /getRuntimeEnv\("TAKE_A_SEAT_ADMIN_EMAILS"\)/);
  assert.match(clerkAuth, /\(globalThis as Record<string, unknown>\)\.env/);
  assert.match(clerkAuth, /getRuntimeEnv\("CLERK_SECRET_KEY"\)/);
  assert.match(clerkAuth, /getRuntimeEnv\("NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY"\)/);
});

test("phone sign-in sends codes before routing creators and customers by account", async () => {
  const [creatorDashboardPage, creatorOnboarding, signInPage, signInScreen] = await Promise.all([
    readFile(new URL("../app/creators/dashboard/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/_lib/creator-onboarding.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/sign-in/page.tsx", import.meta.url), "utf8"),
    readFile(
      new URL("../app/_components/SignInClerkScreen.tsx", import.meta.url),
      "utf8",
    ),
  ]);

  assert.match(creatorDashboardPage, /allowSignUpIfMissing/);
  assert.match(creatorDashboardPage, /routeByAccount=\{false\}/);
  assert.match(signInPage, /const allowSignUpIfMissing = true/);
  assert.match(signInPage, /isCreatorDashboardRedirect\(redirectUrl\)/);
  assert.match(signInPage, /routeByAccount=\{routeByAccount\}/);
  assert.match(signInScreen, /allowSignUpIfMissing = false/);
  assert.match(signInScreen, /routeByAccount = false/);
  assert.match(signInScreen, /isIdentifierNotFoundError\(err\) && allowSignUpIfMissing/);
  assert.match(signInScreen, /prepareFirstFactor/);
  assert.match(signInScreen, /hasExplicitRedirect && !routeByAccount/);
  assert.match(creatorOnboarding, /getAcceptedCreatorProfileForUser\(user\)/);
  assert.match(creatorOnboarding, /normalizePhoneIdentity\(profile\.phone\) === user\.phone/);
  assert.match(creatorOnboarding, /creatorAccounts/);
});

test("legacy creator auth paths redirect into current auth and creator dashboard routes", async () => {
  const signInResponse = await render("/creators/sign-in");
  assert.equal(signInResponse.status, 307);
  assert.ok(
    (signInResponse.headers.get("location") ?? "").endsWith("/sign-in"),
  );

  const signUpResponse = await render("/creators/sign-up");
  assert.equal(signUpResponse.status, 307);
  assert.ok(
    (signUpResponse.headers.get("location") ?? "").endsWith("/sign-in"),
  );

  const dashboardResponse = await render("/creators/dashboard");
  assert.equal(dashboardResponse.status, 200);
  const dashboardHtml = await dashboardResponse.text();
  assert.match(dashboardHtml, /<title>Creator Dashboard \| Take a Seat<\/title>/i);
  assert.match(dashboardHtml, /Creator dashboard/);
  assert.match(dashboardHtml, /Sign in to build your profile/);
  assert.match(dashboardHtml, /Email address/);
  assert.match(dashboardHtml, /Send verification code/);
  assert.doesNotMatch(dashboardHtml, /Sign in with phone/);
  assert.doesNotMatch(dashboardHtml, /redirect_url=%2Fcreators%2Fdashboard/);
  assert.doesNotMatch(dashboardHtml, /Creator Profile Editor Preview/);

  const stripeReturnDashboardResponse = await render(
    "/creators/dashboard?stripe=setup-needed&detail=stripe-transfers",
  );
  assert.equal(stripeReturnDashboardResponse.status, 200);
  const stripeReturnDashboardHtml = await stripeReturnDashboardResponse.text();
  assert.match(
    stripeReturnDashboardHtml,
    /You&#x27;re almost done\. Sign in to return to your creator dashboard\./,
  );
  assert.match(
    stripeReturnDashboardHtml,
    /we will email you a verification code/,
  );

  const invitedDashboardResponse = await render(
    "/creators/dashboard?invite=test_invite_token",
  );
  assert.equal(invitedDashboardResponse.status, 200);
  const invitedDashboardHtml = await invitedDashboardResponse.text();
  assert.match(invitedDashboardHtml, /Send verification code/);
  assert.doesNotMatch(invitedDashboardHtml, /Sign in with phone/);

  const retiredSetupResponse = await render(
    "/creators/onboard/accepted?creatorId=onboard_test",
  );
  assert.equal(retiredSetupResponse.status, 307);
  assert.match(
    retiredSetupResponse.headers.get("location") ?? "",
    /\/creator\/profile$/,
  );
});

test("server-renders the admin creator profile editor preview", async () => {
  const response = await withEnv({ TAKE_A_SEAT_DEV_ADMIN_ENABLED: "true" }, () => dispatch("/admin/creator-profile-editor-preview", {
    headers: { accept: "text/html", host: "localhost", cookie: "tas_local_admin=1" },
  }));

  assert.equal(response.status, 200);
  assert.match(response.headers.get("content-type") ?? "", /^text\/html\b/i);

  const html = await response.text();
  assert.match(html, /Creator Profile Editor Preview \| Take a Seat/);
  assert.match(html, /Your storefront/);
  assert.match(html, /editable-profile-photo-frame/);
  assert.match(html, /aria-label="Drag profile picture to reposition it"/);
  assert.match(html, /aria-label="Profile picture zoom controls"/);
  assert.match(html, /aria-label="Zoom profile picture out"/);
  assert.match(html, /aria-label="Zoom profile picture in"/);
  assert.doesNotMatch(html, /aria-label="Move profile picture side to side"/);
  assert.doesNotMatch(html, /aria-label="Move profile picture up and down"/);
  assert.doesNotMatch(html, />Center photo<\/button>/);
  assert.match(html, /Your storefront/);
  assert.match(html, /aria-selected="true"/);
  assert.match(html, />Profile<\/button>/);
  assert.match(html, /Availability<\/button>/);
  assert.match(html, /Payments<\/button>/);
  assert.match(
    html,
    /aria-label="Requests"[^>]*class="profile-nav-tab"/,
  );
  assert.match(html, /Notification preferences/);
  assert.doesNotMatch(html, /editable-creator-tabs-shell/);
  assert.match(html, /src="\/amber-headshot\.jpg"/);
  assert.match(html, /Upload profile picture/);
  assert.match(html, /Photos and videos/);
  assert.match(html, />Save draft<\/button>/);
  assert.match(html, /Preview your page/);
  assert.match(html, /aria-label="Save profile changes"/);
  assert.match(html, />Weekly availability<\/h2>/);
  assert.doesNotMatch(html, /choose any week up to one year ahead|Only your primary calendar|Jump to a date|Create up to 12 offerings|>Archive<\/button>/);
  assert.match(html, /aria-label="Choose availability week"/);
  assert.match(html, /aria-label="Previous availability week"/);
  assert.match(html, /aria-label="Next availability week"/);
  assert.doesNotMatch(html, /Select date|Visible month/);
  assert.match(html, /Preview &amp; Publish/);
  assert.match(html, /Checking Stripe/);
  assert.match(html, /Refresh Stripe status/);
  assert.match(
    html,
    /Past paid sessions/,
  );
  assert.match(html, /Request notifications/);
  assert.match(html, /name="booking-email-notifications"[^>]*checked/);
  assert.match(html, /name="booking-text-notifications"[^>]*checked/);
  assert.match(html, /name="booking-profile-notifications"[^>]*checked/);
  assert.match(html, /Requests and bookings/);
  assert.match(html, /No requests or bookings yet/);
  assert.match(html, /aria-label="Upload profile picture"/);
  assert.match(html, /aria-label="Instagram URL"/);
  assert.match(html, /aria-label="TikTok URL"/);
  assert.match(html, /aria-label="Upload new media file"/);
  assert.match(html, />Add media<\/button>/);
  assert.match(html, /accept="image\/\*,video\/\*"/);
  assert.doesNotMatch(html, /aria-label="New media URL"/);
  assert.doesNotMatch(html, /aria-label="TikTok video URL"/);
  assert.doesNotMatch(html, /TikTok video ID/);
  assert.doesNotMatch(html, /aria-label="New media label"/);
  assert.match(html, /aria-label="Creator hero name"/);
  assert.doesNotMatch(html, /aria-label="Short profile description"/);
  assert.match(html, /aria-label="About section"/);
  assert.match(html, /aria-label="One-to-one reason"/);
  assert.match(html, /aria-label="Public profile intro"/);
  assert.match(html, /can help with/);
  assert.match(html, /Choose a call/);
  assert.match(html, /Why a 1:1 call\?/);
  assert.match(html, /aria-label="Offering 1 duration"/);
  assert.match(html, /aria-label="Offering 2 duration"/);
  assert.match(html, /aria-label="Offering 1 description"/);
  assert.match(html, /aria-label="Offering 2 description"/);
  assert.match(html, /value="15"/);
  assert.match(html, /value="30"/);
  assert.match(html, /value="45"/);
  assert.match(html, /value="80"/);
  assert.match(html, /Find availability/);
});

test("server-renders candidate creator concept profiles", async () => {
  const profileChecks = [
    {
      path: "/with/montecito-style",
      title: "Take a Seat with Montecito Style",
      body: /Room Point of View/,
      handle: /https:\/\/www\.tiktok\.com\/@montecitostyle/,
    },
    {
      path: "/with/chlos-in-a-closet",
      title: /Take a Seat with Chlo(?:'|&#x27;)s in a Closet/,
      body: /Closet Confidence/,
      handle: /https:\/\/www\.tiktok\.com\/@chlosinacloset/,
    },
    {
      path: "/with/maria-baldini",
      title: "Take a Seat with Maria Baldini",
      body: /Old Money Outfit Edit/,
      handle: /https:\/\/www\.tiktok\.com\/@mariabaldini3/,
    },
    {
      path: "/with/sarah-elizabeth",
      title: "Take a Seat with Sarah Elizabeth",
      body: /Routine Reset/,
      handle: /https:\/\/www\.tiktok\.com\/@seisthename/,
    },
  ];

  for (const profile of profileChecks) {
    const response = await render(profile.path);
    assert.equal(response.status, 200);
    assert.match(response.headers.get("content-type") ?? "", /^text\/html\b/i);

    const html = await response.text();
    if (typeof profile.title === "string") {
      assert.match(html, new RegExp(`<title>${profile.title}<\\/title>`, "i"));
    } else {
      assert.match(html, profile.title);
    }
    assert.match(html, /Opening soon/);
    assert.match(html, /Request invite/);
    assert.match(html, /No payment is collected from concept profiles/);
    assert.match(html, profile.body);
    assert.match(html, profile.handle);
    assert.doesNotMatch(html, /Pay and reserve/);
  }
});

test("preserves creator uploaded media for dashboard and public profiles", async () => {
  const [
    creatorOnboarding,
    editor,
    editorData,
    schema,
    cropMigration,
    dynamicProfilePage,
    ellaPage,
    ellaGallery,
    creatorGallery,
    creatorsLib,
    profileImageHelper,
  ] = await Promise.all([
    readFile(new URL("../app/_lib/creator-onboarding.ts", import.meta.url), "utf8"),
    readFile(
      new URL(
        "../app/admin/creator-profile-editor-preview/EditableCreatorProfilePreview.tsx",
        import.meta.url,
      ),
      "utf8",
    ),
    readFile(
      new URL(
        "../app/admin/creator-profile-editor-preview/creator-profile-editor-data.ts",
        import.meta.url,
      ),
      "utf8",
    ),
    readFile(new URL("../db/schema.ts", import.meta.url), "utf8"),
    readFile(
      new URL("../drizzle/0014_great_omega_flight.sql", import.meta.url),
      "utf8",
    ),
    readFile(new URL("../app/with/[slug]/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/with/ella/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/with/ella/EllaGallery.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/_components/CreatorMediaGallery.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/_lib/creators.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/_lib/profile-image.ts", import.meta.url), "utf8"),
  ]);

  assert.match(creatorOnboarding, /cleanProfileImageUrl\(getString\(formData, "profileImageUrl"\)\)/);
  assert.match(creatorOnboarding, /\/\^data:image\\\/\/i\.test\(trimmed\)/);
  assert.match(creatorOnboarding, /return trimmed;/);
  assert.match(schema, /profileImagePositionX:\s*integer\("profile_image_position_x"\)/);
  assert.match(schema, /profileImagePositionY:\s*integer\("profile_image_position_y"\)/);
  assert.match(schema, /profileImageZoom:\s*integer\("profile_image_zoom"\)/);
  assert.match(cropMigration, /ADD `profile_image_position_x` integer/);
  assert.match(cropMigration, /ADD `profile_image_position_y` integer/);
  assert.match(cropMigration, /ADD `profile_image_zoom` integer/);
  assert.match(creatorOnboarding, /profileImagePositionX: cleanOptionalInteger\(/);
  assert.match(creatorOnboarding, /profileImagePositionY: cleanOptionalInteger\(/);
  assert.match(creatorOnboarding, /profileImageZoom: cleanOptionalInteger\(/);
  assert.match(creatorOnboarding, /profileImagePositionX: input\.profileImagePositionX/);
  assert.match(creatorOnboarding, /profileImagePositionY: input\.profileImagePositionY/);
  assert.match(creatorOnboarding, /profileImageZoom: input\.profileImageZoom/);
  assert.match(creatorOnboarding, /objectPosition: getProfileImageObjectPosition/);
  assert.match(creatorOnboarding, /profileImageZoom: getProfileImageZoomValue\(profile\.profileImageZoom, 100\)/);
  assert.match(editorData, /profileImagePositionX: profile\.profileImagePositionX \?\? 50/);
  assert.match(editorData, /profileImagePositionY: profile\.profileImagePositionY \?\? 50/);
  assert.match(editorData, /profileImageZoom: profile\.profileImageZoom \?\? 135/);
  assert.match(creatorOnboarding, /mediaItems: getPublishedCreatorMediaItems\(profile\)/);
  assert.match(creatorOnboarding, /function getPublishedCreatorMediaItems/);
  assert.match(editor, /function update<K extends keyof EditableProfileState>/);
  assert.match(editor, /async function saveProfileChanges/);
  assert.match(editor, /formData\.set\(\s*"profileImagePositionX"/s);
  assert.match(editor, /formData\.set\(\s*"profileImagePositionY"/s);
  assert.match(editor, /formData\.set\("profileImageZoom"/);
  assert.match(editor, /disabled=\{saveStatus === "saving"\}/);
  assert.doesNotMatch(editor, />Save media</);
  assert.match(profileImageHelper, /export function getProfileImageTransform/);
  assert.match(dynamicProfilePage, /export const dynamic = "force-dynamic"/);
  assert.match(dynamicProfilePage, /<CreatorMediaGallery items=\{creator\.mediaItems\} name=\{creator\.name\} \/>/);
  assert.match(ellaPage, /src=\{creator\.image\}/);
  assert.match(ellaPage, /export const dynamic = "force-dynamic"/);
  assert.match(ellaPage, /getProfileImageObjectPosition\(creator\)/);
  assert.match(ellaPage, /getProfileImageTransform\(creator\)/);
  assert.match(ellaPage, /publishedCreator \? creator\.mediaItems \?\? \[\]/);
  assert.match(ellaGallery, /CreatorMediaGallery/);
  assert.match(creatorGallery, /className="amber-hero-gallery"/);
  assert.match(creatorsLib, /mediaItems: \[/);
  assert.match(creatorsLib, /source: "\/ella-reference-sundress\.jpg"/);
});

test("wires accepted creators to public profile publishing", async () => {
  const [
    availabilityLib,
    schema,
    migration,
    aliasMigration,
    acceptRoute,
    adminApplicationPage,
    creatorOnboarding,
    dynamicProfilePage,
    bookingPage,
    bookingApproveRoute,
    bookingsLib,
    checkoutRoute,
    requestRoute,
    customerBookingFlow,
  ] = await Promise.all([
    readFile(new URL("../app/_lib/availability.ts", import.meta.url), "utf8"),
    readFile(new URL("../db/schema.ts", import.meta.url), "utf8"),
    readFile(
      new URL("../drizzle/0012_clammy_black_bird.sql", import.meta.url),
      "utf8",
    ),
    readFile(
      new URL("../drizzle/0013_parched_blue_marvel.sql", import.meta.url),
      "utf8",
    ),
    readFile(
      new URL("../app/api/creators/applications/accept/route.ts", import.meta.url),
      "utf8",
    ),
    readFile(
      new URL("../app/admin/applications/[creatorId]/page.tsx", import.meta.url),
      "utf8",
    ),
    readFile(new URL("../app/_lib/creator-onboarding.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/with/[slug]/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/bookings/[bookingId]/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/api/bookings/approve/route.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/_lib/bookings.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/api/stripe/checkout/route.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/api/bookings/request/route.ts", import.meta.url), "utf8"),
    readFile(
      new URL("../app/_components/CustomerBookingFlow.tsx", import.meta.url),
      "utf8",
    ),
  ]);

  assert.match(availabilityLib, /sourceAppointmentStartAt/);
  assert.match(availabilityLib, /sourceTimezone/);
  assert.match(schema, /publicSlug:\s*text\("public_slug"\)/);
  assert.match(schema, /originalApplicationId:\s*text\("original_application_id"\)/);
  assert.match(schema, /publishedAt:\s*text\("published_at"\)/);
  assert.match(migration, /ADD `public_slug` text/);
  assert.match(migration, /creator_onboarding_profiles_public_slug_idx/);
  assert.match(aliasMigration, /ADD `original_application_id` text/);
  assert.match(aliasMigration, /creator_onboarding_profiles_original_application_id_idx/);
  assert.match(adminApplicationPage, /name="publicCreatorId"/);
  assert.match(adminApplicationPage, /This application link moved/);
  assert.match(adminApplicationPage, /listCreatorApplications/);
  assert.match(adminApplicationPage, /All applications/);
  assert.match(adminApplicationPage, /<dt>Instagram<\/dt>/);
  assert.match(adminApplicationPage, /<dt>TikTok<\/dt>/);
  assert.doesNotMatch(
    adminApplicationPage,
    /Acceptance opens the creator setup link and emails them the next step/,
  );
  assert.match(adminApplicationPage, /getAvailableCreatorPublicIdSuggestion/);
  assert.match(adminApplicationPage, /that public creator ID is already taken/);
  assert.match(acceptRoute, /acceptCreatorApplication\(\s*creatorId,\s*normalizedPublicCreatorId/s);
  assert.match(acceptRoute, /sendCreatorAcceptedInviteEmail/);
  assert.match(acceptRoute, /sendCreatorAcceptedSms/);
  assert.match(acceptRoute, /createCreatorAcceptedNotification/);
  assert.match(acceptRoute, /inviteToken:\s*email\.inviteToken/);
  assert.match(adminApplicationPage, /Accept and send setup email/);
  assert.match(adminApplicationPage, /Send setup email again/);
  assert.match(adminApplicationPage, /\/api\/creators\/applications\/invite/);
  assert.match(creatorOnboarding, /originalApplicationId/);
  assert.match(
    creatorOnboarding,
    /eq\(creatorOnboardingProfiles\.originalApplicationId,\s*cleanCreatorId\)/,
  );
  assert.match(creatorOnboarding, /getAvailableCreatorPublicIdSuggestion/);
  assert.match(creatorOnboarding, /suffix = 1; suffix <= 99/);
  assert.match(creatorOnboarding, /isCreatorPublicIdTaken\(candidate, profile\.id\)/);
  assert.match(creatorOnboarding, /if \(!creatorId\) \{/);
  assert.doesNotMatch(creatorOnboarding, /!creatorId \|\| rules\.length === 0/);
  assert.match(creatorOnboarding, /slot !== addMinutes\(previousSlot, 15\)/);
  assert.match(creatorOnboarding, /function createPublishedSeats/);
  assert.match(creatorOnboarding, /STRIPE_PRICE_\$\{envSafeCreatorId\}_\$\{minutes\}/);
  assert.match(dynamicProfilePage, /getPublicCreatorBySlug/);
  assert.match(dynamicProfilePage, /<CustomerBookingFlow/);
  assert.match(dynamicProfilePage, /availabilityRules=\{creator\.availabilityRules\}/);
  assert.match(dynamicProfilePage, /won&apos;t be charged unless \{firstName\} accepts/);
  assert.match(requestRoute, /getBookableCreatorById/);
  assert.match(requestRoute, /reserveBookingRequest/);
  assert.match(requestRoute, /isBookingSlotAvailable/);
  assert.match(checkoutRoute, /export \{ POST \} from "..\/..\/bookings\/request\/route"/);
  assert.match(customerBookingFlow, /Find availability/);
  assert.match(customerBookingFlow, /action="\/api\/bookings\/request"/);
  assert.match(customerBookingFlow, /selectedSlot\?\.sourceAppointmentStartAt/);
  assert.match(customerBookingFlow, /selectedSlot\?\.sourceTimezone/);
  assert.match(customerBookingFlow, /What do you want to talk about with \{creatorName\}\?/);
  assert.match(customerBookingFlow, /You won't be charged unless \$\{creatorName\} accepts/);
  assert.match(customerBookingFlow, /Continue to payment/);
  assert.match(bookingsLib, /accepted: "accepted"/);
  assert.match(bookingsLib, /paymentAuthorized: "payment_authorized"/);
  assert.match(bookingsLib, /markBookingPaymentAuthorized/);
  assert.match(bookingApproveRoute, /await acceptBooking\(booking.id\)/);
  assert.match(requestRoute, /payment_intent_data\[capture_method\]/);
  assert.match(requestRoute, /manual_capture_destination_charge/);
  assert.match(requestRoute, /take_a_seat_hold_/);
  assert.match(requestRoute, /attachStripeCheckoutSession/);
  assert.ok(
    requestRoute.indexOf("const stripeReadiness = await getStripeCheckoutReadiness") <
      requestRoute.indexOf("const bookingId = await reserveBookingRequest"),
  );
  assert.doesNotMatch(bookingApproveRoute, /sendAcceptedBookingPaymentStep/);
  assert.doesNotMatch(bookingApproveRoute, /sendCustomerBookingAcceptedPaymentEmail/);
  assert.doesNotMatch(bookingApproveRoute, /params\.set\("payment_method_types/);
  assert.match(bookingPage, /Accept this appointment/);
  assert.match(bookingPage, /captures the customer&apos;s authorized Stripe payment/);
  assert.match(bookingPage, /canSubmitCreatorApproval\(status: string\)/);
});

test("rejects manually submitted booking times outside creator availability", async () => {
  const requestResponse = await dispatch("/api/bookings/request", {
    body: new URLSearchParams({
      appointmentStartAt: "2026-09-18T10:30",
      creatorId: "ella",
      customerEmail: "customer@example.com",
      customerName: "Customer Example",
      returnTo: "/with/ella",
      seatId: "ella-15",
      timezone: "America/New_York",
    }),
    headers: {
      "content-type": "application/x-www-form-urlencoded",
    },
    method: "POST",
  });

  assert.equal(requestResponse.status, 303);
  assert.match(
    requestResponse.headers.get("location") ?? "",
    /\/with\/ella\?booking=error&detail=availability$/,
  );

  const originalFetch = globalThis.fetch;
  let stripeFetchCalled = false;
  globalThis.fetch = async () => {
    stripeFetchCalled = true;
    return new Response("unexpected", { status: 500 });
  };

  try {
    await withEnv(
      {
        STRIPE_PRICE_ELLA_15: "price_test_ella_15",
        STRIPE_SECRET_KEY: "sk_test_take_a_seat",
        TAKE_A_SEAT_PLATFORM_FEE_BPS: "1500",
      },
      async () => {
        const checkoutResponse = await dispatch("/api/stripe/checkout", {
          body: new URLSearchParams({
            appointmentStartAt: "2026-09-18T10:30",
            creatorId: "ella",
            customerEmail: "customer@example.com",
            customerName: "Customer Example",
            returnTo: "/with/ella",
            seatId: "ella-15",
            timezone: "America/New_York",
          }),
          headers: {
            "content-type": "application/x-www-form-urlencoded",
          },
          method: "POST",
        });

        assert.equal(checkoutResponse.status, 303);
        assert.match(
          checkoutResponse.headers.get("location") ?? "",
          /\/with\/ella\?booking=error&detail=availability$/,
        );
      },
    );
  } finally {
    globalThis.fetch = originalFetch;
  }

  assert.equal(stripeFetchCalled, false);
});

test("returns a specific Stripe setup blocker before request checkout", async () => {
  const previousSecret = process.env.STRIPE_SECRET_KEY;
  const originalFetch = globalThis.fetch;
  let stripeFetchCalled = false;

  delete process.env.STRIPE_SECRET_KEY;
  globalThis.fetch = async () => {
    stripeFetchCalled = true;
    return new Response("{}", { status: 500 });
  };

  try {
    await withEnv(
      {
        STRIPE_PRICE_ELLA_15: "price_test_ella_15",
        TAKE_A_SEAT_PLATFORM_FEE_BPS: "1500",
        TAKE_A_SEAT_TEST_BOOKINGS: "true",
      },
      async () => {
        const response = await dispatch("/api/bookings/request", {
          body: new URLSearchParams({
            appointmentStartAt: "2026-09-17T09:30",
            creatorId: "ella",
            customerEmail: "customer@example.com",
            customerName: "Customer Example",
            returnTo: "/with/ella",
            seatId: "ella-15",
            timezone: "America/New_York",
          }),
          headers: {
            "content-type": "application/x-www-form-urlencoded",
          },
          method: "POST",
        });

        assert.equal(response.status, 303);
        assert.match(
          response.headers.get("location") ?? "",
          /\/with\/ella\?booking=setup-needed&detail=stripe-secret$/,
        );
      },
    );
  } finally {
    globalThis.fetch = originalFetch;

    if (previousSecret === undefined) {
      delete process.env.STRIPE_SECRET_KEY;
    } else {
      process.env.STRIPE_SECRET_KEY = previousSecret;
    }
  }

  assert.equal(stripeFetchCalled, false);
});

test("notifies accepted creators in email, text, and profile", async () => {
  const [
    acceptRoute,
    acceptedInvite,
    dashboard,
    inviteRoute,
    email,
    notifications,
    adminApplicationPage,
    editor,
  ] = await Promise.all([
    readFile(
      new URL("../app/api/creators/applications/accept/route.ts", import.meta.url),
      "utf8",
    ),
    readFile(
      new URL("../app/_lib/creator-accepted-invite.ts", import.meta.url),
      "utf8",
    ),
    readFile(new URL("../app/_lib/creator-dashboard.ts", import.meta.url), "utf8"),
    readFile(
      new URL("../app/api/creators/applications/invite/route.ts", import.meta.url),
      "utf8",
    ),
    readFile(new URL("../app/_lib/email.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/_lib/notifications.ts", import.meta.url), "utf8"),
    readFile(
      new URL("../app/admin/applications/[creatorId]/page.tsx", import.meta.url),
      "utf8",
    ),
    readFile(
      new URL(
        "../app/admin/creator-profile-editor-preview/EditableCreatorProfilePreview.tsx",
        import.meta.url,
      ),
      "utf8",
    ),
  ]);

  assert.match(acceptRoute, /sendCreatorAcceptedInviteEmail/);
  assert.match(acceptRoute, /sendCreatorAcceptedSms/);
  assert.match(acceptRoute, /createCreatorAcceptedNotification/);
  assert.match(acceptRoute, /inviteToken:\s*email\.inviteToken/);
  assert.match(acceptedInvite, /createCreatorInvite/);
  assert.match(acceptedInvite, /sendCreatorAcceptedEmail/);
  assert.match(acceptedInvite, /missing-recipient/);
  assert.match(acceptedInvite, /setup-link-failed/);
  assert.match(dashboard, /claimCreatorInvite/);
  assert.match(dashboard, /inviteToken/);
  assert.match(inviteRoute, /sendCreatorAcceptedInviteEmail/);
  assert.match(inviteRoute, /applicationStatus !== "accepted"/);
  assert.match(inviteRoute, /inviteEmail: email\.status/);
  assert.match(email, /Congratulations! You've been accepted into Take a Seat/);
  assert.match(email, /You can now create your profile, set your availability/);
  assert.match(email, /Build your profile/);
  assert.match(email, /email address from your accepted application/);
  assert.match(email, /We can’t wait for you to begin inspiring!!!/);
  assert.match(email, /globalThis/);
  assert.match(email, /workerEnv/);
  assert.match(email, /CREATOR_PROFILE_EDITOR_URL\}\?invite=/);
  assert.match(email, /inviteToken\?: string/);
  assert.match(notifications, /application_accepted/);
  assert.match(notifications, /title: "Application accepted"/);
  assert.match(adminApplicationPage, /setup link could not be created/);
  assert.match(editor, /getNotificationHref/);
  assert.match(editor, /notification\.type === "application_accepted"/);
  assert.match(editor, /CREATOR_PROFILE_EDITOR_URL/);
});

test("sends creator-facing application receipt emails", async () => {
  const [profileRoute, email, onboardingPage, onboardingForm] = await Promise.all([
    readFile(new URL("../app/api/creators/profile/route.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/_lib/email.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/creators/onboard/page.tsx", import.meta.url), "utf8"),
    readFile(
      new URL("../app/creators/onboard/CreatorOnboardingForm.tsx", import.meta.url),
      "utf8",
    ),
  ]);

  assert.match(profileRoute, /sendCreatorApplicationReceivedEmail/);
  assert.match(profileRoute, /Promise\.all/);
  assert.match(profileRoute, /creatorEmail: creatorEmail\.status/);
  assert.match(email, /We received your Take a Seat creator application/);
  assert.match(email, /Thank you for applying to Take a Seat!/);
  assert.match(email, /sign in and start building your profile!/);
  assert.match(email, /missing-recipient/);
  assert.match(onboardingPage, /creatorEmail: getStatus\(searchParams\?\.creatorEmail\)/);
  assert.match(onboardingForm, /confirmation email/i);
});

test("notifies creators when customers authorize a requested seat", async () => {
  const [completeRoute, webhookRoute, email, notifications, editor] = await Promise.all([
    readFile(
      new URL("../app/api/stripe/checkout/complete/route.ts", import.meta.url),
      "utf8",
    ),
    readFile(new URL("../app/api/stripe/webhook/route.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/_lib/email.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/_lib/notifications.ts", import.meta.url), "utf8"),
    readFile(
      new URL(
        "../app/admin/creator-profile-editor-preview/EditableCreatorProfilePreview.tsx",
        import.meta.url,
      ),
      "utf8",
    ),
  ]);

  assert.match(completeRoute, /markBookingPaymentAuthorized/);
  assert.match(completeRoute, /notifyCreatorBookingRequested/);
  assert.match(webhookRoute, /markBookingPaymentAuthorized/);
  assert.match(webhookRoute, /notifyCreatorBookingRequested/);
  assert.match(notifications, /BOOKING_REQUEST_NOTIFICATION_TYPE = "booking_requested"/);
  assert.match(notifications, /createCreatorBookingRequestNotification/);
  assert.match(notifications, /title: "New booking request"/);
  assert.match(notifications, /sendCreatorBookingRequestEmail/);
  assert.match(email, /export async function sendCreatorBookingRequestEmail/);
  assert.match(email, /requested a Take a Seat call with you/);
  assert.match(editor, /Requests and bookings/);
  assert.match(editor, /No requests or bookings yet/);
});

test("puts the admin review link before long application details in email", async () => {
  const email = await readFile(new URL("../app/_lib/email.ts", import.meta.url), "utf8");
  const topReviewLink = email.indexOf("Review application: ${reviewUrl}");
  const expertiseBlock = email.indexOf("\"Expertise:\"");
  const topHtmlLink = email.indexOf(
    '<p><a href="${escapeHtml(reviewUrl)}">Review and accept application</a></p>',
  );
  const htmlDetails = email.indexOf("<ul>");

  assert.ok(topReviewLink > -1);
  assert.ok(expertiseBlock > -1);
  assert.ok(topReviewLink < expertiseBlock);
  assert.match(email, /Open application queue: \$\{queueUrl\}/);
  assert.ok(topHtmlLink > -1);
  assert.ok(htmlDetails > -1);
  assert.ok(topHtmlLink < htmlDetails);
});

test("does not render the generic 404 for an emailed application link", async () => {
  const response = await dispatch(
    "/admin/applications/onboard_missing_after_publish",
    {
      headers: {
        accept: "text/html",
        cookie: "tas_local_admin=1",
      },
    },
  );

  assert.equal(response.status, 200);
  assert.match(response.headers.get("content-type") ?? "", /^text\/html\b/i);

  const html = await response.text();
  assert.doesNotMatch(html, /This page could not be found/);
});

test("preserves admin application status params through sign-in", async () => {
  const response = await render(
    "/admin/applications/annabel-filippini?accept=accepted&email=sent&profile=sent&sms=skipped&smsDetail=missing-account",
  );

  assert.equal(response.status, 200);
  assert.match(response.headers.get("content-type") ?? "", /^text\/html\b/i);

  const html = await response.text();
  assert.match(html, /Sign in as/);
  assert.match(
    html,
    /href="\/sign-in\?redirect_url=%2Fadmin%2Fapplications%2Fannabel-filippini%3Faccept%3Daccepted%26email%3Dsent%26profile%3Dsent%26sms%3Dskipped%26smsDetail%3Dmissing-account"/,
  );
});

test("removes starter metadata and preview dependencies", async () => {
  const [page, layout, packageJson, css] = await Promise.all([
    readFile(new URL("../app/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/layout.tsx", import.meta.url), "utf8"),
    readFile(new URL("../package.json", import.meta.url), "utf8"),
    readFile(new URL("../app/globals.css", import.meta.url), "utf8"),
  ]);

  assert.match(page, /export const metadata:\s*Metadata/);
  assert.match(page, /<BookingPlatform creators=/);
  assert.doesNotMatch(page, /PublicCreatorProfile/);
  assert.match(layout, /title:\s*"Take a Seat"/);
  assert.match(packageJson, /"name": "take-a-seat-platform"/);
  assert.doesNotMatch(packageJson, /react-loading-skeleton/);
  assert.doesNotMatch(css, /#020617|codex-preview|SkeletonPreview/i);
});

test("server-renders the mission page", async () => {
  const response = await render("/about");
  assert.equal(response.status, 200);
  assert.match(response.headers.get("content-type") ?? "", /^text\/html\b/i);

  const html = await response.text();
  assert.match(html, /<title>Our Mission \| Take a Seat<\/title>/i);
  assert.match(html, /A platform built to make you feel cute, confident, and inspired/);
  assert.match(html, /Come take a seat with us/);
  assert.doesNotMatch(html, /<span>Our mission<\/span>/i);
  assert.doesNotMatch(html, /First seats/i);
  assert.doesNotMatch(html, /Ella McLane/);
  assert.match(html, /Why we exist/);
  assert.match(html, /Influencers are at the forefront/);
  assert.match(html, /Your question deserves context/);
  assert.match(html, /fashion committee, makeup/);
  assert.match(html, /leave feeling cute/);
  assert.match(html, /Apply to Inspire/);
  assert.match(html, /Find a Seat/);
});

test("server-renders Ella's profile page", async () => {
  const response = await render("/with/ella");
  assert.equal(response.status, 200);
  assert.match(response.headers.get("content-type") ?? "", /^text\/html\b/i);

  const html = await response.text();
  assert.match(html, /<title>Take a Seat with Ella McLane<\/title>/i);
  assert.match(
    html,
    /<a(?=[^>]*class="brand-mark")(?=[^>]*href="\/")(?=[^>]*aria-label="Take a Seat home")[^>]*>Take a Seat<\/a>/,
  );
  assert.match(html, /Ella McLane/);
  assert.match(html, /@ellamclane2/);
  assert.match(html, /https:\/\/www\.instagram\.com\/ellamclane2\//);
  assert.match(
    html,
    /<form(?=[^>]*action="\/sign-in")(?=[^>]*class="nav-action-form")(?=[^>]*method="get")[^>]*><button(?=[^>]*class="profile-sign-in-link")(?=[^>]*type="submit")[^>]*>Sign In<\/button><\/form>/,
  );
  assert.match(html, /https:\/\/www\.tiktok\.com\/@ellamclane/);
  assert.doesNotMatch(html, /@ellamclane</);
  assert.match(html, /About/);
  assert.match(html, /everyday pieces feel elevated/);
  assert.match(html, /polished and old-money/);
  assert.match(html, /never feels overdone/);
  assert.match(html, /classic wardrobe staples/);
  assert.match(html, /perfect balance between classy and trendy/);
  assert.match(html, /classy and trendy/);
  assert.match(html, /clothes you already own/);
  assert.match(html, /someone with a sharp eye/);
  assert.match(html, /show you what works together/);
  assert.match(html, /productive shopping session/);
  assert.match(html, /Do you do Nuuly/);
  assert.match(html, /best pieces for your month/);
  assert.match(html, /Put together the clothes you already own/);
  assert.match(html, /what will actually look good together/);
  assert.match(html, /Style the pieces you own/);
  assert.match(html, /Pick the best Nuuly pieces/);
  assert.match(html, /productive, useful cart/);
  assert.match(html, /Why a 1:1 call/);
  assert.match(html, /making your clothes feel easier to use/);
  assert.match(html, /more intentional before you buy/);
  assert.match(html, /15 minutes/);
  assert.match(html, /30 minutes/);
  assert.match(html, /\$50/);
  assert.match(html, /\$60/);
  assert.match(html, /Private video call on Zoom/);
  assert.match(html, /ella-profile\.jpg/);
  assert.match(html, /ella-reference-sundress\.jpg/);
  assert.match(html, /ella-reference-street-style\.jpg/);
  assert.match(html, /ella-reference-coast\.jpg/);
  assert.match(html, /Sundress styling/);
  assert.match(html, /Everyday outfit polish/);
  assert.match(html, /Coastal classics/);
  assert.match(html, /https:\/\/www\.tiktok\.com\/@ellamclane\/video\/7665329691254951198/);
  assert.match(html, /https:\/\/www\.tiktok\.com\/@ellamclane\/video\/7661987130444418334/);
  assert.match(html, /https:\/\/www\.tiktok\.com\/@ellamclane\/video\/7657164268663557407/);
  assert.doesNotMatch(html, /www\.tiktok\.com\/player\/v1/);
  assert.doesNotMatch(html, /play_button=0/);
  assert.doesNotMatch(html, /description=0/);
  assert.doesNotMatch(html, /music_info=0/);
  assert.match(html, /Find availability/);
  assert.match(html, /You won&#x27;t be charged unless Ella accepts your appointment/);
  assert.doesNotMatch(html, /Choose a time and then Ella will get a short note/);
  assert.doesNotMatch(html, /Providence College/);
  assert.doesNotMatch(html, /Free cancellation/i);
  assert.doesNotMatch(html, /Ask for times/);
  assert.doesNotMatch(html, /Request and pay/);
});

test("shows Stripe setup blockers on Ella's profile page", async () => {
  const response = await render("/with/ella?booking=setup-needed&detail=stripe-secret");
  assert.equal(response.status, 200);
  assert.match(response.headers.get("content-type") ?? "", /^text\/html\b/i);

  const html = await response.text();
  assert.match(html, /Stripe is not connected yet, so payment cannot start/);
});

test("server-renders creator onboarding form", async () => {
  const response = await render("/creators/onboard");
  assert.equal(response.status, 200);
  assert.match(response.headers.get("content-type") ?? "", /^text\/html\b/i);

  const html = await response.text();
  assert.match(html, /Apply to Inspire \| Take a Seat/);
  assert.match(html, /<header class="about-topbar">/);
  assert.match(
    html,
    /<form(?=[^>]*action="\/")(?=[^>]*class="nav-action-form")(?=[^>]*method="get")[^>]*><button(?=[^>]*class="about-brand")(?=[^>]*type="submit")[^>]*>Take a Seat<\/button><\/form>/,
  );
  assert.match(
    html,
    /<form(?=[^>]*action="\/take-a-seat")(?=[^>]*class="nav-action-form")(?=[^>]*method="get")[^>]*><button(?=[^>]*class="about-nav-button")(?=[^>]*type="submit")[^>]*>Find a Seat<\/button><\/form>/,
  );
  assert.doesNotMatch(html, /home-topbar profile-topbar|topnav-signup|Search experts/);
  assert.match(html, /Apply to Inspire/);
  assert.match(html, /First name/);
  assert.match(html, /Last name/);
  assert.match(html, /Email address/);
  assert.match(html, /Phone number/);
  assert.match(html, /Instagram handle/);
  assert.match(html, /TikTok handle/);
  assert.match(html, /Expertise/);
  assert.match(html, /<textarea(?=[^>]*name="profileDetails")/);
  assert.match(html, /Submit application/);
  assert.doesNotMatch(html, /Continue/);
  assert.doesNotMatch(html, /Social handle/);
  assert.doesNotMatch(html, /Powered by Take a Seat/);
  assert.doesNotMatch(html, /Apply as a creator/);
  assert.doesNotMatch(html, /We will review every profile before it goes live/);
  assert.doesNotMatch(html, /Load Annabel test application/);
  assert.doesNotMatch(html, /nikki-card\.jpg/);
  assert.doesNotMatch(html, /Your creator backend/);
  assert.doesNotMatch(html, /Weekly calendar/);
  assert.doesNotMatch(html, /Public handle/);
  assert.doesNotMatch(html, /Short card bio/);
  assert.doesNotMatch(html, /Style advice through private Take a Seat calls/);
});

test("creator applications require contact fields and keep sparse profile defaults", async () => {
  const [creatorOnboardingForm, creatorOnboardingLib] = await Promise.all([
    readFile(new URL("../app/creators/onboard/CreatorOnboardingForm.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/_lib/creator-onboarding.ts", import.meta.url), "utf8"),
  ]);

  assert.match(creatorOnboardingForm, /name="email"[\s\S]*?required/);
  assert.match(creatorOnboardingForm, /name="phone"[\s\S]*?required/);
  assert.match(creatorOnboardingLib, /DEFAULT_CREATOR_APPLICATION_NAME/);
  assert.match(creatorOnboardingLib, /DEFAULT_CREATOR_APPLICATION_DETAILS/);
  assert.doesNotMatch(
    creatorOnboardingLib,
    /if \(!name \|\| !email \|\| !phone \|\| !profileDetails \|\| !bio\)/,
  );
});

test("server-renders Annabel's test profile page", async () => {
  const response = await render("/with/annabel");
  assert.equal(response.status, 200);
  assert.match(response.headers.get("content-type") ?? "", /^text\/html\b/i);

  const html = await response.text();
  assert.match(html, /<title>Take a Seat with Annabel Filippini<\/title>/i);
  assert.match(html, /Founder test profile/);
  assert.match(html, /Annabel Filippini/);
  assert.match(html, /Choose a test call/);
  assert.match(html, /\$15/);
  assert.match(html, /\$30/);
  assert.match(html, /Pay and reserve test/);
  assert.match(html, /name="creatorId"[^>]*value="annabel"/);
  assert.match(html, /name="seatId"[^>]*value="annabel-15"/);
  assert.match(html, /action="\/api\/stripe\/checkout"/);
});

test("an admin cannot connect their Google Calendar to a selected creator", async () => {
  await withEnv({ TAKE_A_SEAT_DEV_ADMIN_ENABLED: "true", GOOGLE_CLIENT_ID: "test-client.apps.googleusercontent.com", GOOGLE_CLIENT_SECRET: "test-client-secret" }, async () => {
    const response = await dispatch("/api/google-calendar/oauth/start?creatorId=ella&returnTo=/creators/onboard", { headers: { cookie: "tas_local_admin=1" } });
    assert.equal(response.status, 303);
    assert.match(response.headers.get("location"), /calendar=error&detail=creator-access/);
    assert.equal(response.headers.get("set-cookie"), null);
  });
});

test("requires creator access before starting Google Calendar OAuth", async () => {
  await withEnv(
    {
      GOOGLE_CLIENT_ID: "test-client.apps.googleusercontent.com",
      GOOGLE_CLIENT_SECRET: "test-client-secret",
      GOOGLE_OAUTH_REDIRECT_URI:
        "http://localhost:3000/api/google-calendar/oauth/callback",
    },
    async () => {
      const response = await dispatch(
        "/api/google-calendar/oauth/start?creatorId=ella&returnTo=/creators/dashboard",
        {
          headers: { accept: "text/html" },
        },
      );
      assert.equal(response.status, 303);
      assert.match(
        response.headers.get("location") ?? "",
        /\/creators\/dashboard\?calendar=error&detail=creator-access/,
      );
    },
  );
});

test("rejects Google OAuth callback without valid state", async () => {
  await withEnv(
    {
      GOOGLE_CLIENT_ID: "test-client.apps.googleusercontent.com",
      GOOGLE_CLIENT_SECRET: "test-client-secret",
      GOOGLE_OAUTH_REDIRECT_URI:
        "http://localhost:3000/api/google-calendar/oauth/callback",
    },
    async () => {
      const response = await render("/api/google-calendar/oauth/callback?code=fake");
      assert.equal(response.status, 303);
      assert.match(
        response.headers.get("location") ?? "",
        /\/creators\/onboard\?calendar=error&detail=invalid-state/,
      );
      assert.match(response.headers.get("set-cookie") ?? "", /Max-Age=0/);
    },
  );
});

test("asks for Stripe setup before starting Connect onboarding", async () => {
  const response = await render(
    "/api/stripe/connect/start?creatorId=onboard_test&name=Ella&instagramPlatform=%40ellamclane2&bio=Style&returnTo=/creators/onboard",
  );
  assert.equal(response.status, 303);
  assert.match(
    response.headers.get("location") ?? "",
    /\/creators\/onboard\?stripe=setup-needed&detail=stripe-secret/,
  );

  const [startRoute, returnRoute, stripeConnect] = await Promise.all([
    readFile(new URL("../app/api/stripe/connect/start/route.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/api/stripe/connect/return/route.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/_lib/stripe-connect.ts", import.meta.url), "utf8"),
  ]);

  assert.match(startRoute, /getCreatorApplication\(creatorId\)/);
  assert.match(startRoute, /getCreatorIntegrationAccess\(request, creatorId\)/);
  assert.doesNotMatch(startRoute, /createCreatorOnboardingProfile/);
  assert.match(returnRoute, /getCreatorIntegrationAccess\(request, creatorId\)/);
  assert.match(startRoute, /"creator-email-required"/);
  assert.match(startRoute, /contactEmail,/);
  assert.match(stripeConnect, /contact_email:\s*contactEmail/);
});

test("requires creator access before starting Stripe Connect onboarding", async () => {
  await withEnv(
    {
      STRIPE_SECRET_KEY: "sk_test_take_a_seat",
    },
    async () => {
      const response = await dispatch(
        "/api/stripe/connect/start?creatorId=ella&returnTo=/creators/dashboard",
        {
          headers: { accept: "text/html" },
        },
      );
      assert.equal(response.status, 303);
      assert.match(
        response.headers.get("location") ?? "",
        /\/creators\/dashboard\?stripe=setup-needed&detail=creator-auth/,
      );
    },
  );
});

test("checks Stripe transfer readiness before marking Connect returned accounts connected", async () => {
  const response = await render(
    "/api/stripe/connect/return?creatorId=onboard_test&returnTo=/creators/onboard",
  );
  assert.equal(response.status, 303);
  assert.match(
    response.headers.get("location") ?? "",
    /\/creators\/onboard\?stripe=setup-needed&detail=stripe-secret/,
  );

  const returnRoute = await readFile(
    new URL("../app/api/stripe/connect/return/route.ts", import.meta.url),
    "utf8",
  );
  assert.match(returnRoute, /getCreatorStripeConnection\(creatorId\)/);
  assert.match(returnRoute, /getConnectedAccountTransferStatus\(\{/);
  assert.match(returnRoute, /transferStatus !== "active"/);
  assert.match(returnRoute, /"setup-needed",\s*"stripe-transfers"/);
  assert.match(returnRoute, /await markStripeConnected\(creatorId\)/);
  assert.ok(
    returnRoute.indexOf("const transferStatus = await getConnectedAccountTransferStatus") <
      returnRoute.indexOf("await markStripeConnected"),
  );
});

test("creates Stripe Checkout destination charges with a platform fee", async () => {
  const originalFetch = globalThis.fetch;
  let stripeRequest;

  globalThis.fetch = async (input, init) => {
    const url = input.toString();

    if (url.startsWith("https://api.stripe.com/v2/core/accounts/acct_test_ella")) {
      return new Response(
        JSON.stringify({
          configuration: {
            recipient: {
              capabilities: {
                stripe_balance: {
                  stripe_transfers: {
                    status: "active",
                  },
                },
              },
            },
          },
          id: "acct_test_ella",
          livemode: false,
        }),
        {
          headers: { "content-type": "application/json" },
          status: 200,
        },
      );
    }

    stripeRequest = { input, init };

    return new Response(
      JSON.stringify({
        id: "cs_test_take_a_seat",
        url: "https://checkout.stripe.com/c/pay/cs_test_take_a_seat",
      }),
      {
        headers: { "content-type": "application/json" },
        status: 200,
      },
    );
  };

  try {
    await withEnv(
      {
        STRIPE_SECRET_KEY: "sk_test_take_a_seat",
        TAKE_A_SEAT_TEST_BOOKINGS: "true",
        TAKE_A_SEAT_TEST_STRIPE_CONNECTIONS: JSON.stringify([
          {
            accountCountry: "US",
            connectedAt: "2026-09-01T00:00:00.000Z",
            creatorId: "ella",
            dashboard: "express",
            id: 1,
            livemode: false,
            onboardingStartedAt: "2026-09-01T00:00:00.000Z",
            stripeAccountId: "acct_test_ella",
            updatedAt: "2026-09-01T00:00:00.000Z",
          },
        ]),
        TAKE_A_SEAT_PLATFORM_FEE_BPS: "1500",
      },
      async () => {
        const response = await dispatch("/api/stripe/checkout", {
          body: new URLSearchParams({
            appointmentStartAt: "2026-09-17T09:30",
            creatorId: "ella",
            customerEmail: "customer@example.com",
            customerName: "Customer Example",
            returnTo: "/with/ella",
            seatId: "ella-15",
            timezone: "America/New_York",
          }),
          headers: {
            "content-type": "application/x-www-form-urlencoded",
          },
          method: "POST",
        });

        assert.equal(response.status, 303);
        assert.equal(
          response.headers.get("location"),
          "https://checkout.stripe.com/c/pay/cs_test_take_a_seat",
        );
      },
    );
  } finally {
    globalThis.fetch = originalFetch;
  }

  assert.ok(stripeRequest);
  assert.equal(stripeRequest.input, "https://api.stripe.com/v1/checkout/sessions");

  const headers = new Headers(stripeRequest.init.headers);
  assert.equal(headers.get("stripe-version"), "2026-08-26.dahlia");

  const body = stripeRequest.init.body;
  assert.equal(body.get("mode"), "payment");
  assert.equal(body.get("payment_intent_data[capture_method]"), "manual");
  assert.ok(Math.abs(Number(body.get("expires_at")) - Math.floor(Date.now() / 1000) - 1800) < 10);
  assert.equal(new Headers(stripeRequest.init.headers).get("idempotency-key"), `take-a-seat-checkout-${body.get("client_reference_id")}`);
  assert.equal(body.get("customer_email"), "customer@example.com");
  assert.equal(body.get("line_items[0][price]"), null);
  assert.equal(body.get("line_items[0][price_data][currency]"), "usd");
  assert.equal(
    body.get("line_items[0][price_data][product_data][name]"),
    "15 minutes with Ella McLane",
  );
  assert.equal(body.get("line_items[0][price_data][unit_amount]"), "5000");
  assert.match(body.get("client_reference_id") ?? "", /^booking_/);
  assert.match(body.get("metadata[booking_id]") ?? "", /^booking_/);
  assert.equal(body.get("metadata[appointment_start_at]"), "2026-09-17T09:30:00");
  assert.equal(body.get("metadata[customer_email]"), "customer@example.com");
  assert.equal(body.get("metadata[customer_name]"), "Customer Example");
  assert.equal(body.get("metadata[timezone]"), "America/New_York");
  assert.equal(body.get("metadata[charge_pattern]"), "manual_capture_destination_charge");
  assert.match(body.get("payment_intent_data[metadata][booking_id]") ?? "", /^booking_/);
  assert.equal(body.get("payment_intent_data[application_fee_amount]"), "750");
  assert.equal(
    body.get("payment_intent_data[transfer_data][destination]"),
    "acct_test_ella",
  );
  assert.equal(body.get("payment_method_types[0]"), null);
  assert.match(
    body.get("integration_identifier") ?? "",
    /^take_a_seat_hold_[a-z]{8}$/,
  );
});

test("sends public booking requests to Stripe Checkout for payment authorization", async () => {
  const originalFetch = globalThis.fetch;
  let stripeRequest;

  globalThis.fetch = async (input, init) => {
    const url = input.toString();

    if (url.startsWith("https://api.stripe.com/v2/core/accounts/acct_test_ella")) {
      return new Response(
        JSON.stringify({
          configuration: {
            recipient: {
              capabilities: {
                stripe_balance: {
                  stripe_transfers: {
                    status: "active",
                  },
                },
              },
            },
          },
          id: "acct_test_ella",
          livemode: false,
        }),
        {
          headers: { "content-type": "application/json" },
          status: 200,
        },
      );
    }

    stripeRequest = { input, init };

    return new Response(
      JSON.stringify({
        id: "cs_test_authorize_take_a_seat",
        url: "https://checkout.stripe.com/c/pay/cs_test_authorize_take_a_seat",
      }),
      {
        headers: { "content-type": "application/json" },
        status: 200,
      },
    );
  };

  try {
    await withEnv(
      {
        STRIPE_PRICE_ELLA_15: "price_test_ella_15",
        STRIPE_SECRET_KEY: "sk_test_take_a_seat",
        TAKE_A_SEAT_TEST_BOOKINGS: "true",
        TAKE_A_SEAT_TEST_STRIPE_CONNECTIONS: JSON.stringify([
          {
            accountCountry: "US",
            connectedAt: "2026-09-01T00:00:00.000Z",
            creatorId: "ella",
            dashboard: "express",
            id: 1,
            livemode: false,
            onboardingStartedAt: "2026-09-01T00:00:00.000Z",
            stripeAccountId: "acct_test_ella",
            updatedAt: "2026-09-01T00:00:00.000Z",
          },
        ]),
        TAKE_A_SEAT_PLATFORM_FEE_BPS: "1500",
      },
      async () => {
        const response = await dispatch("/api/bookings/request", {
          body: new URLSearchParams({
            appointmentStartAt: "2026-09-17T09:30",
            creatorId: "ella",
            customerEmail: "customer@example.com",
            customerName: "Customer Example",
            returnTo: "/with/ella",
            seatId: "ella-15",
            timezone: "America/New_York",
          }),
          headers: {
            "content-type": "application/x-www-form-urlencoded",
          },
          method: "POST",
        });

        assert.equal(response.status, 303);
        assert.equal(
          response.headers.get("location"),
          "https://checkout.stripe.com/c/pay/cs_test_authorize_take_a_seat",
        );
      },
    );
  } finally {
    globalThis.fetch = originalFetch;
  }

  assert.ok(stripeRequest);
  assert.equal(stripeRequest.input, "https://api.stripe.com/v1/checkout/sessions");

  const body = stripeRequest.init.body;
  assert.equal(body.get("mode"), "payment");
  assert.equal(body.get("payment_intent_data[capture_method]"), "manual");
  assert.ok(Math.abs(Number(body.get("expires_at")) - Math.floor(Date.now() / 1000) - 1800) < 10);
  assert.equal(new Headers(stripeRequest.init.headers).get("idempotency-key"), `take-a-seat-checkout-${body.get("client_reference_id")}`);
  assert.equal(body.get("customer_email"), "customer@example.com");
  assert.equal(body.get("line_items[0][price]"), "price_test_ella_15");
  assert.match(body.get("client_reference_id") ?? "", /^booking_/);
  assert.equal(body.get("metadata[charge_pattern]"), "manual_capture_destination_charge");
  assert.equal(body.get("payment_intent_data[capture_method]"), "manual");
  assert.equal(body.get("payment_intent_data[application_fee_amount]"), "750");
  assert.equal(
    body.get("payment_intent_data[transfer_data][destination]"),
    "acct_test_ella",
  );
  assert.equal(body.get("payment_method_types[0]"), null);
  assert.match(
    body.get("integration_identifier") ?? "",
    /^take_a_seat_hold_[a-z]{8}$/,
  );
});

test("requires a configured Stripe webhook secret", async () => {
  const response = await dispatch("/api/stripe/webhook", {
    body: JSON.stringify({ id: "evt_test", type: "ping" }),
    headers: {
      "content-type": "application/json",
    },
    method: "POST",
  });

  assert.equal(response.status, 500);
  assert.deepEqual(await response.json(), {
    detail: "stripe-webhook-secret",
    status: "setup-needed",
  });
});

test("rejects Stripe webhooks with an invalid signature", async () => {
  await withEnv(
    {
      STRIPE_WEBHOOK_SECRET: "whsec_test_take_a_seat",
    },
    async () => {
      const response = await dispatch("/api/stripe/webhook", {
        body: JSON.stringify({ id: "evt_test", type: "ping" }),
        headers: {
          "content-type": "application/json",
          "stripe-signature": "t=1789098782,v1=not-a-real-signature",
        },
        method: "POST",
      });

      assert.equal(response.status, 400);
      assert.deepEqual(await response.json(), {
        detail: "signature",
        status: "invalid",
      });
    },
  );
});

test("accepts signed Stripe webhook events", async () => {
  await withEnv(
    {
      STRIPE_WEBHOOK_SECRET: "whsec_test_take_a_seat",
    },
    async () => {
      const payload = JSON.stringify({
        data: {
          object: {
            id: "evt_test",
          },
        },
        id: "evt_test",
        type: "ping",
      });
      const response = await dispatch("/api/stripe/webhook", {
        body: payload,
        headers: {
          "content-type": "application/json",
          "stripe-signature": signStripeWebhookPayload(
            payload,
            "whsec_test_take_a_seat",
          ),
        },
        method: "POST",
      });

      assert.equal(response.status, 200);
      assert.deepEqual(await response.json(), { received: true });
    },
  );
});


test("email sign-in page is private, has a referrer policy, and exposes no token in server HTML", async () => {
  const response = await render("/creators/email-sign-in?invite=synthetic-invite");
  assert.equal(response.status, 200);
  const html = await response.text();
  assert.match(html, /Let’s open your profile/);
  assert.match(html, /noindex/);
  assert.match(html, /no-referrer/);
  assert.doesNotMatch(html, /strategy.*ticket/);
});

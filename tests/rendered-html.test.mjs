import assert from "node:assert/strict";
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
  assert.match(html, /directory-results/);
  assert.match(html, /placeholder="Search creators"/);
  assert.match(html, /Ella McLane/);
  assert.match(html, /\/with\/ella\/?/);
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
  assert.match(html, /Abby Catlin/);
  assert.match(html, /Montecito Style/);
  assert.match(html, /Chlo&#x27;s in a Closet/);
  assert.match(html, /Maria Baldini/);
  assert.match(html, /Sarah Elizabeth/);
  assert.match(html, /\/with\/montecito-style\/?/);
  assert.match(html, /\/with\/chlos-in-a-closet\/?/);
  assert.match(html, /\/with\/maria-baldini\/?/);
  assert.match(html, /\/with\/sarah-elizabeth\/?/);
  assert.match(html, /Alex Earl/);
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
  assert.match(html, /Sign in with your phone/);
  assert.match(html, /Enter your mobile number/);
  assert.match(html, /Mobile phone/);
  assert.match(html, /\+1 555 000 0000/);
  assert.match(html, /Next/);
  assert.doesNotMatch(html, /Your account starts here/);
  assert.doesNotMatch(html, /Creator dashboard/);
  assert.doesNotMatch(html, /Create account/);
  assert.match(
    html,
    /<form(?=[^>]*action="\/sign-in")(?=[^>]*class="nav-action-form")(?=[^>]*method="get")[^>]*><button(?=[^>]*class="nav-sign-in-button")(?=[^>]*type="submit")[^>]*>Sign In<\/button><\/form>/,
  );
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
  assert.match(dashboardHtml, /Sign in with your creator phone/);
  assert.match(dashboardHtml, /redirect_url=%2Fcreators%2Fdashboard/);
  assert.doesNotMatch(dashboardHtml, /Creator Profile Editor Preview/);

  const retiredSetupResponse = await render(
    "/creators/onboard/accepted?creatorId=onboard_test",
  );
  assert.equal(retiredSetupResponse.status, 307);
  assert.match(
    retiredSetupResponse.headers.get("location") ?? "",
    /\/creators\/dashboard$/,
  );
});

test("server-renders the admin creator profile editor preview", async () => {
  const response = await dispatch("/admin/creator-profile-editor-preview", {
    headers: {
      accept: "text/html",
      "oai-authenticated-user-email": "annabelflip1@gmail.com",
    },
  });

  assert.equal(response.status, 200);
  assert.match(response.headers.get("content-type") ?? "", /^text\/html\b/i);

  const html = await response.text();
  assert.match(html, /Creator Profile Editor Preview \| Take a Seat/);
  assert.match(html, /Editable creator profile preview/);
  assert.match(html, /editable-profile-photo-frame/);
  assert.match(html, /aria-label="Drag profile picture to reposition it"/);
  assert.match(html, /aria-label="Profile picture zoom controls"/);
  assert.match(html, /aria-label="Zoom profile picture out"/);
  assert.match(html, /aria-label="Zoom profile picture in"/);
  assert.doesNotMatch(html, /aria-label="Move profile picture side to side"/);
  assert.doesNotMatch(html, /aria-label="Move profile picture up and down"/);
  assert.doesNotMatch(html, />Center photo<\/button>/);
  assert.match(html, /Editable profile preview tabs/);
  assert.match(html, /aria-selected="true"[^>]*>Profile<\/button>/);
  assert.match(html, />Availability<\/button>/);
  assert.match(html, />Payments<\/button>/);
  assert.match(
    html,
    /aria-label="Settings"[^>]*class="profile-nav-tab settings-tab-button"/,
  );
  assert.match(html, /class="settings-tab-icon"/);
  assert.doesNotMatch(html, /editable-creator-tabs-shell/);
  assert.match(html, /src="\/amber-headshot\.jpg"/);
  assert.match(html, /Upload profile picture/);
  assert.match(html, /Photos and videos/);
  assert.match(html, />Save media<\/button>/);
  assert.match(html, />Availability<\/h2>/);
  assert.match(html, /Stripe payouts/);
  assert.match(html, /Connect Stripe/);
  assert.match(html, /Booking notifications/);
  assert.match(html, /name="booking-email-notifications"[^>]*checked/);
  assert.match(html, /name="booking-text-notifications"[^>]*checked/);
  assert.match(html, /name="booking-profile-notifications"[^>]*checked/);
  assert.match(html, /No bookings yet/);
  assert.match(html, /aria-label="Upload profile picture"/);
  assert.match(html, /aria-label="Instagram URL"/);
  assert.match(html, /aria-label="TikTok URL"/);
  assert.match(html, /aria-label="New media URL"/);
  assert.match(html, /aria-label="Upload new media file"/);
  assert.doesNotMatch(html, /aria-label="New media label"/);
  assert.match(html, /aria-label="Creator hero name"/);
  assert.doesNotMatch(html, /aria-label="Short profile description"/);
  assert.match(html, /aria-label="About section"/);
  assert.match(html, /aria-label="One-to-one reason"/);
  assert.match(html, /aria-label="15 minutes duration in minutes"/);
  assert.match(html, /aria-label="30 minutes duration in minutes"/);
  assert.match(html, /aria-label="15 minutes description"/);
  assert.match(html, /aria-label="30 minutes description"/);
  assert.match(html, /value="15"/);
  assert.match(html, /value="30"/);
  assert.match(html, /type="number" value="45"/);
  assert.match(html, /type="number" value="80"/);
  assert.match(html, /Book this seat/);
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

test("wires accepted creators to public profile publishing", async () => {
  const [
    schema,
    migration,
    aliasMigration,
    acceptRoute,
    adminApplicationPage,
    creatorOnboarding,
    dynamicProfilePage,
    checkoutRoute,
  ] = await Promise.all([
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
    readFile(new URL("../app/api/stripe/checkout/route.ts", import.meta.url), "utf8"),
  ]);

  assert.match(schema, /publicSlug:\s*text\("public_slug"\)/);
  assert.match(schema, /originalApplicationId:\s*text\("original_application_id"\)/);
  assert.match(schema, /publishedAt:\s*text\("published_at"\)/);
  assert.match(migration, /ADD `public_slug` text/);
  assert.match(migration, /creator_onboarding_profiles_public_slug_idx/);
  assert.match(aliasMigration, /ADD `original_application_id` text/);
  assert.match(aliasMigration, /creator_onboarding_profiles_original_application_id_idx/);
  assert.match(adminApplicationPage, /name="publicCreatorId"/);
  assert.match(adminApplicationPage, /This application link moved/);
  assert.match(adminApplicationPage, /<dt>Instagram<\/dt>/);
  assert.match(adminApplicationPage, /<dt>TikTok<\/dt>/);
  assert.doesNotMatch(
    adminApplicationPage,
    /Acceptance opens the creator setup link and emails them the next step/,
  );
  assert.match(adminApplicationPage, /getAvailableCreatorPublicIdSuggestion/);
  assert.match(adminApplicationPage, /that public creator ID is already taken/);
  assert.match(acceptRoute, /acceptCreatorApplication\(\s*creatorId,\s*normalizedPublicCreatorId/s);
  assert.match(acceptRoute, /sendCreatorAcceptedSms/);
  assert.match(acceptRoute, /createCreatorAcceptedNotification/);
  assert.match(acceptRoute, /inviteToken:\s*invite\?\.token/);
  assert.match(creatorOnboarding, /originalApplicationId/);
  assert.match(
    creatorOnboarding,
    /eq\(creatorOnboardingProfiles\.originalApplicationId,\s*cleanCreatorId\)/,
  );
  assert.match(creatorOnboarding, /getAvailableCreatorPublicIdSuggestion/);
  assert.match(creatorOnboarding, /suffix = 1; suffix <= 99/);
  assert.match(creatorOnboarding, /isCreatorPublicIdTaken\(candidate, profile\.id\)/);
  assert.match(creatorOnboarding, /function createPublishedSeats/);
  assert.match(creatorOnboarding, /STRIPE_PRICE_\$\{envSafeCreatorId\}_\$\{minutes\}/);
  assert.match(dynamicProfilePage, /getPublicCreatorBySlug/);
  assert.match(dynamicProfilePage, /<CustomerBookingFlow/);
  assert.match(checkoutRoute, /getBookableCreatorById/);
});

test("notifies accepted creators in email, text, and profile", async () => {
  const [acceptRoute, email, notifications, editor] = await Promise.all([
    readFile(
      new URL("../app/api/creators/applications/accept/route.ts", import.meta.url),
      "utf8",
    ),
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

  assert.match(acceptRoute, /sendCreatorAcceptedEmail/);
  assert.match(acceptRoute, /sendCreatorAcceptedSms/);
  assert.match(acceptRoute, /createCreatorAcceptedNotification/);
  assert.match(email, /CREATOR_PROFILE_EDITOR_URL\}\?invite=/);
  assert.match(email, /inviteToken\?: string/);
  assert.match(notifications, /application_accepted/);
  assert.match(notifications, /title: "Application accepted"/);
  assert.match(editor, /getNotificationHref/);
  assert.match(editor, /notification\.type === "application_accepted"/);
  assert.match(editor, /CREATOR_PROFILE_EDITOR_URL/);
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
        "oai-authenticated-user-email": "annabelflip1@gmail.com",
      },
    },
  );

  assert.equal(response.status, 200);
  assert.match(response.headers.get("content-type") ?? "", /^text\/html\b/i);

  const html = await response.text();
  assert.doesNotMatch(html, /This page could not be found/);
});

test("removes starter metadata and preview dependencies", async () => {
  const [page, layout, packageJson, css] = await Promise.all([
    readFile(new URL("../app/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/layout.tsx", import.meta.url), "utf8"),
    readFile(new URL("../package.json", import.meta.url), "utf8"),
    readFile(new URL("../app/globals.css", import.meta.url), "utf8"),
  ]);

  assert.match(page, /export const metadata:\s*Metadata/);
  assert.match(page, /<BookingPlatform \/>/);
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
  assert.match(html, /To give everyone private access/);
  assert.match(html, /a few minutes of context/);
  assert.match(html, /First seats/);
  assert.match(html, /Ella McLane/);
  assert.match(html, /Our story/);
  assert.match(html, /The advice was happening/);
  assert.match(html, /A private seat makes it real/);
  assert.match(html, /The point is useful access/);
  assert.match(html, /Become an Inspiration/);
  assert.match(html, /Find a Seat/);
});

test("server-renders Ella's profile page", async () => {
  const response = await render("/with/ella");
  assert.equal(response.status, 200);
  assert.match(response.headers.get("content-type") ?? "", /^text\/html\b/i);

  const html = await response.text();
  assert.match(html, /<title>Take a Seat with Ella McLane<\/title>/i);
  assert.match(html, /Ella McLane/);
  assert.match(html, /@ellamclane2/);
  assert.match(html, /https:\/\/www\.instagram\.com\/ellamclane2\//);
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
  assert.match(html, /Private video call on Google Meet/);
  assert.match(html, /ella-profile\.jpg/);
  assert.match(html, /www\.tiktok\.com\/player\/v1\/7665329691254951198\?autoplay=1&amp;muted=1&amp;loop=1&amp;controls=0/);
  assert.match(html, /www\.tiktok\.com\/player\/v1\/7661987130444418334\?autoplay=1&amp;muted=1&amp;loop=1&amp;controls=0/);
  assert.match(html, /www\.tiktok\.com\/player\/v1\/7657164268663557407\?autoplay=1&amp;muted=1&amp;loop=1&amp;controls=0/);
  assert.match(html, /www\.tiktok\.com\/player\/v1\/7668294958515784990\?autoplay=1&amp;muted=1&amp;loop=1&amp;controls=0/);
  assert.match(html, /www\.tiktok\.com\/player\/v1\/7667925672676838687\?autoplay=1&amp;muted=1&amp;loop=1&amp;controls=0/);
  assert.match(html, /play_button=0/);
  assert.match(html, /description=0/);
  assert.match(html, /music_info=0/);
  assert.doesNotMatch(html, /ella-reference-sundress\.jpg/);
  assert.doesNotMatch(html, /ella-reference-street-style\.jpg/);
  assert.doesNotMatch(html, /ella-reference-coast\.jpg/);
  assert.match(html, /Show availability/);
  assert.match(html, /Seats are non-refundable/);
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

test("starts Google Calendar OAuth for a creator", async () => {
  await withEnv(
    {
      GOOGLE_CLIENT_ID: "test-client.apps.googleusercontent.com",
      GOOGLE_CLIENT_SECRET: "test-client-secret",
      GOOGLE_OAUTH_REDIRECT_URI:
        "http://localhost:3000/api/google-calendar/oauth/callback",
    },
    async () => {
      const response = await render(
        "/api/google-calendar/oauth/start?creatorId=ella&returnTo=/creators/onboard",
      );
      assert.equal(response.status, 303);

      const location = response.headers.get("location");
      assert.ok(location);
      const authUrl = new URL(location);

      assert.equal(authUrl.origin, "https://accounts.google.com");
      assert.equal(authUrl.pathname, "/o/oauth2/v2/auth");
      assert.equal(
        authUrl.searchParams.get("client_id"),
        "test-client.apps.googleusercontent.com",
      );
      assert.equal(
        authUrl.searchParams.get("redirect_uri"),
        "http://localhost:3000/api/google-calendar/oauth/callback",
      );
      assert.equal(authUrl.searchParams.get("access_type"), "offline");
      assert.equal(authUrl.searchParams.get("prompt"), "consent");
      assert.match(
        authUrl.searchParams.get("scope") ?? "",
        /https:\/\/www\.googleapis\.com\/auth\/calendar\.freebusy/,
      );
      assert.match(
        authUrl.searchParams.get("scope") ?? "",
        /https:\/\/www\.googleapis\.com\/auth\/calendar\.events\.owned/,
      );
      assert.match(response.headers.get("set-cookie") ?? "", /HttpOnly/);
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
        const response = await dispatch("/api/stripe/checkout", {
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
  assert.equal(body.get("customer_email"), "customer@example.com");
  assert.equal(body.get("line_items[0][price]"), "price_test_ella_15");
  assert.match(body.get("client_reference_id") ?? "", /^booking_/);
  assert.match(body.get("metadata[booking_id]") ?? "", /^booking_/);
  assert.equal(body.get("metadata[appointment_start_at]"), "2026-09-18T10:30:00");
  assert.equal(body.get("metadata[customer_email]"), "customer@example.com");
  assert.equal(body.get("metadata[customer_name]"), "Customer Example");
  assert.equal(body.get("metadata[timezone]"), "America/New_York");
  assert.equal(body.get("metadata[charge_pattern]"), "destination_charge");
  assert.match(body.get("payment_intent_data[metadata][booking_id]") ?? "", /^booking_/);
  assert.equal(body.get("payment_intent_data[application_fee_amount]"), "750");
  assert.equal(
    body.get("payment_intent_data[transfer_data][destination]"),
    "acct_test_ella",
  );
  assert.equal(body.get("payment_method_types[0]"), null);
  assert.match(
    body.get("integration_identifier") ?? "",
    /^take_a_seat_checkout_[a-z]{8}$/,
  );
});

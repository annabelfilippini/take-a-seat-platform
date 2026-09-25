# Take a Seat Control Map

September 25 lifecycle QA found a Stripe hosted-return Clerk handshake omission;
the repair is local and not deployed. Production applications, delivered email,
original invites and fresh-login profile persistence passed. A subsequent real
homepage sandbox rehearsal passed authorization, capture, fee, transfer, webhook,
Calendar invitation and decline on Annabel's existing card after Calendar
reconnection. An additional QA card awaits its separate recipient onboarding.
Google OAuth remains External/Testing, so seven-day grant expiry is still a launch
blocker. See [booking rehearsal](homepage-booking-rehearsal-2026-09-25.md) and
[lifecycle findings](creator-lifecycle-qa-2026-09-25.md).

Fresh creator live QA on September 24 reproduced a Google OAuth callback session
refresh failure. PR #43 is deployed (`93d8d23`); the real callback, refresh and
fresh login now pass. Profile uploads and saved edits passed live. The new test
card remains private pending Stripe setup in Annabel's other terminal. See
[the current QA record](creator-live-qa-2026-09-24.md).

Last updated: 2026-09-16

**First creator release remains blocked.** Migration 0025 is applied; PR #37 is
still draft and undeployed. Main `5012acc` was merged into the candidate and all
87 Node / 35 Playwright tests, lint, TypeScript and build pass. Google domain ownership
is verified; Ella is already eligible under External/Testing, with temporary grants
and no public OAuth approval. Zoom API checks pass; guest legal acceptance/join test
remains open. Sandbox card-only Checkout, manual capture and full refund passed.
Live Stripe webhook is disabled, no live Connect recipient exists, payment-method
runtime config is missing, and the deployed Worker has no scheduled handler/cron.
See the [current release audit](first-creator-release-audit-2026-09-16.md).

This is the working source of truth for Take a Seat while the product is being
organized. It should stay short, current, and operational.

Photo upload repair deployed September 22 from PR #41 / `369be0a`. All 82 Node
and 32 browser tests pass; a production large-photo upload also passed. See [upload repair](profile-upload-repair-2026-09-22.md)
for confirmed failure paths and the remaining original-file/device check.

For email delivery, invitation, and admin/creator login troubleshooting, read
[the onboarding lessons](creator-onboarding-lessons.md) before live testing.

## Product North Star

Take a Seat is a curated marketplace where people can book private 1:1 calls
with creators, tastemakers, and experts they already trust.

The product should feel polished and editorial on the public side, but
operationally calm behind the scenes. The backend should let Annabel review and
approve creators, let accepted creators manage the pieces that affect their
bookings, and let Take a Seat safely coordinate money, calendar time, email, and
booking status.

## Product Surfaces

Public website:

- Introduces the brand.
- Lets visitors browse creators and categories.
- Shows public creator profiles.
- Lets customers pick a creator, seat length, and available time.
- Does not require customer accounts for v1 paid bookings.
- Public profiles use the shared `app/_components/CustomerBookingFlow.tsx`
  for compact call choices, time selection, and a separate details step.
  Phone and Instagram are optional; the summary explains authorization before
  creator acceptance. See [booking flow](mobile-booking-flow.md) for QA and release status.

Creator backend:

- Invite-only for accepted creators.
- Lets creators edit profile content that affects buyer confidence.
- Canonical editor: `/creator/profile`; `/creators/dashboard` remains a compatible entry.
- Persistent Profile, Availability, Requests, Payments, and Preview & Publish tabs.
- Profile/media/offerings save privately; explicit publication atomically updates
  public fields. Authenticated draft preview reuses the customer profile renderer.
- Original media is stored in bounded D1 chunks; profiles retain URLs and crop settings.
- Reliability repairs deployed from PR #30 (`43b586c`): stale-draft protection,
  timezone inheritance, upload retries and hydration. PR #31 (`6e96c56`) adds
  verified email account switching and accurate setup instructions. Booking
  confirmations distinguish declines; native anchors avoid the production
  framework navigation failure and resolve published creator slugs. Final code
  deployed from main `d8cec92`; full sandbox provider and production navigation
  checks passed. Real-money launch gates remain below. See the
  [reliability audit](marketplace-reliability-qa-2026-09-14.md) and
  [live rehearsal](marketplace-live-rehearsal-2026-09-14.md).
- Up to 12 ordered offerings with explicit durations, prices, descriptions, and an Active checkbox.
  Inactive offerings retain their IDs and historical booking details.
- One week dropdown selects default weekly hours or dated overrides through one year,
  with IANA timezones.
  Saved availability affects live bookings immediately; empty overrides close that week.
- Requests support authorized acceptance/capture and decline/cancellation, with retries.
- Payments reads current Stripe transfer readiness, balances, and historical sessions.
- Storefront deployed September 14 from merged PR #28 (`a5259fd`), with migrations
  0018–0020 applied and production public/creator-entry browser smoke checks passing.
  See [verification and deployment](creator-storefront-verification.md).

Admin:

- Reviews creator applications.
- Accepts creators and sends invite links.
- Accepts applications; creators publish through the explicit Go live step.
- Controls category placement, homepage featuring, refunds, exceptions, and
  launch readiness.
- Should not be the permanent home for normal creator self-service.

Customer account area:

- Not a v1 requirement.
- Add later only if saved bookings, reschedules, purchase history, messaging, or
  repeat booking workflows need it.

## Current Technical Shape

App/runtime:

- Framework: vinext.
- Production URL: `https://takeaseatwith.com/`.
- Link previews use `public/homepage-social-preview-v1.png`, a 1200 × 630 capture
  of the homepage hero, configured in `app/layout.tsx`. Use a new filename when
  changing this image; messaging services may retain previously cached cards.
- Production target: Cloudflare Workers.
- Production config: `wrangler.deploy.jsonc`.
- Local Vite config: `vite.config.ts`.

Source control:

- Durable GitHub repo: `annabelfilippini/take-a-seat-platform`.
- `origin` points to GitHub and is the source-of-truth remote.
- Default branch: `main`.
- Some local checkouts may still have a legacy `sites` remote, but GitHub and
  Cloudflare are the active source/deploy path.

Code layout:

- `app/` owns vinext routes and route-specific UI.
- `app/_components/` owns shared React components.
- `app/_lib/` owns server/domain helpers for auth, creators, bookings, email,
  calendar, notifications, and Stripe.
- `db/` owns the Drizzle connection and schema.
- `drizzle/` owns generated D1 migration SQL and Drizzle metadata.
- `public/` owns committed product imagery and icons.

Database:

- Cloudflare D1 binding: `DB`.
- Database name: `take-a-seat-platform-db`.
- Database id: `144a50a9-e15d-4fcc-a8eb-7e3bed735895`.
- Schema: `db/schema.ts`.
- Migrations: `drizzle/`.

Auth:

- Clerk production instance: `ins_3JFOtf1Vw17O6o6hLdO7c5SwEAz`.
- Frontend API: `clerk.takeaseatwith.com`; account portal: `accounts.takeaseatwith.com`.
- Shared sign-in route: `/sign-in`.
- Sign-in defaults to an email verification code using the application email.
  Acceptance emails use a one-use Clerk sign-in token valid for 24 hours at
  `/creators/email-sign-in`; expired links fall back to email codes. A different
  signed-in account requires an explicit switch. Phone-code requires a paid Clerk feature and
  is hidden unless `TAKE_A_SEAT_PHONE_SIGN_IN_ENABLED=true` and Clerk supports it.
- Clerk identities must have a verified primary email or phone before they can
  claim an accepted D1 profile. Later sign-ins return to `/creator/profile`.
- Clerk and admin configuration read Cloudflare Worker bindings directly.
- The Worker forwards Clerk handshake redirects and refreshed cookies on auth
  document requests; the first returned render receives the verified token.
- Signed-in accounts without an accepted profile see an explanation and can
  switch accounts. Code sending failures never fabricate a code-entry screen.
- Admin access is allowlist-based through configured admin emails and optional
  admin phones.
- Creator access is based on accepted creator profile identity and creator
  account links in D1.
- If an invitation matches a signed-in creator who already owns a profile from
  an earlier application, the dashboard opens that existing profile. Duplicate
  applications do not replace ownership or publish another card. A wrong-account
  invitation shows account switching without a Continue link back into the error.

Email:

- Resend is used for transactional email.
- Current branded sender: `Take a Seat <applications@takeaseatwith.com>`.
- Resend requires DNS-only CNAME records in Cloudflare: `rsend` points to
  `rsend.forge.rmta.net`, and `send` points to `send.forge.rmta.net`.
  Both were restored on 2026-09-12; Resend reports the domain verified.
- A successful send API response does not prove inbox delivery. Check Resend
  email events for delivered, bounced, or suppressed status. After repairing
  a bounce cause, clear the affected address's suppression before resending.
- After the DNS repair and suppression cleanup, an admin setup-email resend
  to the previously blocked test inbox was confirmed delivered in Resend.
- Application recipient/admin email is configured through runtime values.
- Creator applications send Annabel the admin review email and send the
  applicant a receipt email. A valid email is required to submit or accept.
- Acceptance reserves a public slug and prepares a private starter profile, then
  emails the applicant a setup link. `published_at` remains null until the creator explicitly goes live.
- Blank creator setup is deployed (PR #15): retain application identity, but
  start profile content/media/prices empty and sessions disabled. Existing saved
  profiles retain their content. See `docs/blank-creator-profile.md`.
- Creator setup and public profiles follow Ella's layout: round headshot and
  intro beside the gallery, About/help topics/one-to-one copy below, and call
  descriptions/prices on the right. Profile/call edits save in `profile_draft`; Go live copies the
  saved draft into public fields after setup checks. Saved availability updates
  live bookable hours immediately. See `docs/blank-creator-profile.md` for release status.
- Accepted emails provision or reuse the exact verified primary-email Clerk
  identity and send its sign-in token only to that inbox, in the URL fragment.
  Existing D1 ownership and saved profiles are preserved for repeat applicants.
  See `docs/creator-email-sign-in.md` for verification and release status.
- Failed setup emails are visible to the admin and can be retried. An optional
  inbox notification failure does not misreport the acceptance as failed.

SMS:

- Twilio is the intended SMS provider for accepted-creator and booking texts.
- Text notifications are skipped unless Twilio account/auth credentials plus a
  Messaging Service SID or sender phone number are configured.
- The admin acceptance result should show whether email/text/profile
  notifications were sent or skipped.

Calendar:

- Google Calendar OAuth is the chosen scheduling integration.
- Take a Seat owns public availability rules.
- Google Calendar supplies real busy/free conflicts and creator-owned event
  creation.
- OAuth callbacks use the initiating origin; canonical public GETs redirect to
  `takeaseatwith.com`. Google must authorize its exact callback URL. The legacy
  `GOOGLE_OAUTH_REDIRECT_URI` secret is no longer read.
- Shared v1 token encryption supports stored tokens and refresh. Partial granted
  scopes fail closed. Requests and pre-capture acceptance check Google free/busy
  with the saved booking buffer.
- Conditional D1 reservations prevent simultaneous requests sharing a slot or
  exceeding a creator limit. Attached Checkout sessions hold until a verified
  terminal webhook or server reconciliation with Stripe-confirmed expiry;
  session-less failed requests release after 30 minutes.
- Calendar retries reuse a deterministic event ID. A booking stays paid until
  Google provides its Meet link, then becomes approved.
- Local integration and desktop/mobile verification are recorded in
  `docs/calendar-rehearsal-2026-09-12.md`. September 14 live provider rehearsal
  verified OAuth persistence, busy-time rejection, deterministic event creation
  and a customer Inbox invitation with Meet; see the live rehearsal report.
- September 16 production hardening deployed from merged PR #35, main `dca3b8b`:
  Worker version `fd9bacc5-4e70-49f8-ab1b-41599b038c73` serves 100% of traffic.
  Includes creator-owned
  one-use OAuth attempts, live connection status, disconnect/reconnect, server
  slot filtering, complete pre-capture revalidation, and guarded event sync.
  Additive migrations 0021–0024 are applied remotely; required secret names and
  live desktop/mobile booking-calendar smoke checks passed. See
  [implementation and release evidence](google-calendar-implementation.md).
- The September 16 Google Console observation is External/Testing. Domain ownership
  is verified; first-creator test-user eligibility is confirmed, but sensitive-scope
  production approval remains pending. Exact values, separated production/dev
  projects, reviewer instructions and video script are in
  [Google production setup](google-oauth-production-readiness-2026-09-16.md).
- Booking request and Stripe Checkout routes server-validate submitted times
  against creator availability before creating a booking.
- Public creator profiles collect the request first, then send the customer to
  Stripe Checkout to authorize payment. The customer is not charged unless the
  creator accepts the appointment.

Payments:

- Launch status: payment repairs are deployed from main `86a8fbe`; the test
  webhook subscribes to all six payment events and a signed sandbox delivery
  returned HTTP 200. Live Connect is accepted and live account creation is
  enabled. The live webhook exists but is disabled; its signing secret is saved
  under the staging name `STRIPE_LIVE_WEBHOOK_SECRET`, which current code does
  not read. September 14 sandbox rehearsal passed hosted authorization, creator
  capture, decline/cancellation, 15% fee, webhook replay and Google invitation.
  Live credentials, first creator live onboarding and real-money settlement
  verification remain. See
  `docs/stripe-launch-readiness-2026-09-12.md` for evidence and launch gates.

- Stripe Connect is the chosen marketplace payment model.
- Creators use Express connected accounts with Stripe-hosted onboarding and the
  Express dashboard.
- Buyer checkout uses Stripe Checkout immediately after the request form, with
  manual capture so payment is held until creator acceptance.
- Destination charges are the intended first model: buyers purchase from Take a
  Seat, creators are paid out individually, and Take a Seat keeps the platform
  application fee.
- Request status flow is `requested` -> Stripe Checkout authorization ->
  `payment_authorized` -> creator acceptance/capture -> `paid` -> calendar
  confirmation. The creator request inbox should show actionable requests after
  payment authorization.
- Stripe Checkout can use existing seed/demo Price IDs when configured, or
  inline Checkout price data from accepted creators' saved seat prices. A signed
  webhook endpoint lives at `/api/stripe/webhook` for Checkout completion/expiry
  and PaymentIntent authorization, capture, and cancellation. Both checkout entry
  routes use manual capture. Canceled/expired payments close unpaid requests.
- Connect onboarding requires a creator contact email, and returned accounts
  are only marked connected after Stripe reports transfer readiness as active.

## Data Ownership

D1 should own operational marketplace state:

- Creator applications and published profile fields.
- Creator profile image crop position and zoom.
- Creator account links to Clerk users.
- Creator invite tokens.
- Creator Google Calendar connections.
- Creator Stripe connections.
- Creator availability rules.
- Customer bookings with immutable purchased offering snapshots and persisted decisions.
- Creator media metadata and original file chunks.
- Creator request, booking, and setup notification preferences and history.

Checked-in static data should only own:

- Seed/demo creators.
- Public copy and imagery that is not operational state.
- Temporary launch fixtures, clearly named as such.

## Current Route Ownership

Public:

- `/`
- `/take-a-seat`
- `/with/[slug]`
- `/with/ella`
- `/with/annabel`
- `/about`

Auth:

- `/sign-in`
- `/sign-up`
- `/creators/sign-in`
- `/creators/sign-up`

Creator:

- `/creators/onboard`
- `/creator/profile` (canonical storefront editor)
- `/creator/preview` (authenticated saved draft, checkout disabled)
- `/creators/dashboard` (compatible legacy entry)

Admin:

- `/admin/applications`
- `/admin/applications/[creatorId]`
- `/admin/creator-profile-editor-preview`

API:

- `/api/creators/*`
- `/api/google-calendar/oauth/*`
- `/api/stripe/*`
- `/api/bookings/*`
- `/api/admin/dev-login`

## Known Prototype Edges

The creator backend is not cleanly separated yet:

- `/creator/profile` owns the accepted creator editor; the legacy dashboard
  uses the same page without redirecting through admin.
- `/admin/creator-profile-editor-preview` is admin-only and uses the same editor
  component only as an internal preview.
- The shared editor component still needs a cleaner package boundary over time;
  shared editor remains in its historical admin folder; creator routes and
  authorization are separate. The requested `/creator/*` routes are intentional.

The public creator model is split:

- Some creators are checked-in seed/static records in `app/_lib/creators.ts`.
- Public browsing uses an explicit allowlist of published static marketplace
  creators; concept and test profiles should stay off directory cards.
- The homepage and directory merge published D1 creators with seed creators.
  Public routes and cards require accepted status plus publication and profile-save
  timestamps; old auto-published applications remain private until saved.
- This is acceptable for launch only if the distinction is documented as
  `seed creators` versus `published marketplace creators`.

Duplicate scratch files were compared and removed after the worktree was
preserved in GitHub source control:

- `app/BookingPlatform 2.tsx`: old client-side marketplace prototype replaced
  by the current server-rendered homepage, creator directory, and profile
  routes.
- `app/globals 2.css`, `app/globals 3.css`: starter/old prototype CSS replaced
  by the current full stylesheet.
- `app/layout 2.tsx`, `app/page 2.tsx`: starter/Sites preview shell replaced by
  the branded Take a Seat layout and homepage.
- `public/favicon 2.svg`: old starter favicon replaced by the active branded
  favicon.
- `tests/rendered-html.test 2.mjs`: starter preview tests replaced by the
  current route and integration smoke tests.

Legacy starter/tooling artifacts removed during repository cleanup:

- `.openai/hosting.json`: old Sites metadata. Cloudflare Workers is the active
  deploy target.
- `build/sites-vite-plugin.ts`: old Sites packaging hook.
- `examples/d1/`: starter notes API example unrelated to Take a Seat.
- `take-a-seat-home-updated.png`: old root-level screenshot artifact.

## Environment Map

Local:

- `.env.local` and `.dev.vars` are ignored.
- `.dev.vars.example` documents expected local runtime values.
- `npm run dev` starts local development.

Production:

- `wrangler.deploy.jsonc` declares Worker name, D1 binding, public vars, and
  required secrets.
- Non-secret public/config values can live in Wrangler vars.
- Secret values should be set as Cloudflare Worker secrets.
- Custom domain routes in `wrangler.deploy.jsonc` keep
  `takeaseatwith.com` and `www.takeaseatwith.com` attached to the Worker.
- Before deploying, confirm D1 migrations have been applied to
  `take-a-seat-platform-db` with `wrangler.deploy.jsonc`.
- Before inviting creators or testing live booking paths, confirm required
  Worker secrets exist in Cloudflare; do not rely on local `.dev.vars`.

Required or expected production secrets:

- `CLERK_SECRET_KEY`
- `RESEND_API_KEY`
- `TWILIO_ACCOUNT_SID`
- `TWILIO_AUTH_TOKEN`
- `TWILIO_MESSAGING_SERVICE_SID` or `TWILIO_FROM_PHONE_NUMBER`
- `GOOGLE_CLIENT_ID`
- `GOOGLE_CLIENT_SECRET`
- `GOOGLE_TOKEN_ENCRYPTION_KEY`
- `STRIPE_SECRET_KEY`
- `STRIPE_WEBHOOK_SECRET`
- `STRIPE_CONNECT_COUNTRY`
- Optional seed/demo creator Stripe Price IDs such as `STRIPE_PRICE_ELLA_15`
  and `STRIPE_PRICE_ELLA_30`

## Recommended Cleanup Sequence

Completed:

- Preserved the current worktree in the GitHub repo.
- Cleaned operational docs into this control map plus focused supporting docs.
- Removed obsolete duplicate scratch files after comparison.
- Separated `/creators/dashboard` from the admin preview URL while preserving
  the existing editor component.
- Removed legacy Sites packaging files, starter examples, and root screenshot
  artifacts.
- Moved shared components and domain helpers into `app/_components` and
  `app/_lib`.
- Normalized GitHub so `main` is the default branch.

Next:

1. Keep deployment preflight current.
   September 14 deployments verified required Worker secret names and no pending
   D1 migrations. Repeat before a launch-critical deployment.

2. Configure accepted-creator notifications.
   Decide whether launch requires SMS, then either configure Twilio secrets and
   send a real accepted-creator test text, or explicitly launch email/profile
   notifications first with SMS disabled.

3. Finish integration reliability.
   Sandbox checkout, capture, decline, signed webhook replay and Google Calendar
   busy/free and invitation checks passed September 14. Complete first-creator
   live onboarding, activate and verify live credentials/webhook, and verify
   real-money settlement before taking real customer payments.

## Launch Gate

Before inviting real creators or taking real paid bookings, Take a Seat should
have:

- GitHub/source control as the durable source of truth.
- A clean deployment story from committed code to Cloudflare Workers.
- Admin application review working in production.
- Accepted creator login working through Clerk.
- Creator profile setup working outside an admin-labeled preview route.
- D1 migrations applied.
- Resend branded emails verified after deployment.
- Accepted-creator notification rehearsal completed: branded email delivered,
  profile notification appears, and SMS is either verified through Twilio or
  intentionally deferred.
- Customer request notification rehearsal completed: creator email delivered
  and the request appears in the creator dashboard.
- Creator request acceptance rehearsal completed: creator can click “Accept
  this appointment,” captures the existing authorization, and the customer
  receives the calendar invitation; no payment is captured before acceptance.
- Stripe Connect test account onboarding completed from an accepted creator
  profile.
- Stripe webhook handling tested with a full Checkout event.
- Google Calendar OAuth and event creation tested.
- One full test booking from public profile to paid checkout to calendar event.

## Acceptance Repair Verification (2026-09-12)

- `tests/creator-lifecycle.test.mjs` runs the real domain and routes against
  isolated SQLite through the D1 statement interface. It verifies submission,
  email recipient/link payloads, acceptance, private-before-save, invite identity,
  ownership, publishing, repeat login, and email transport failure handling.
- Legacy trusted identity headers no longer grant admin access. Production admin
  access requires a verified Clerk identity on the allowlist.
- Production D1 now includes `0014_great_omega_flight.sql` (image positioning)
  and `0015_majestic_stryfe.sql` (the profile-save timestamp), applied on 2026-09-12.
- Production Clerk was created with email verification; account OAuth is restored.
  All five CNAME records resolve and Clerk email DNS is verified. A real email
  arrived in the existing creator's application inbox and its code completed
  production sign-up. The existing D1 ownership link now uses that verified
  production identity; its creator and related records were preserved.
- Production repair deployed from merged, committed code on 2026-09-12.
  A separately approved live rehearsal passed submission, both application
  emails, admin acceptance, setup email/link, custom email-code sign-in,
  private-before-save, publication on save, and returning login to saved edits.
- The test card was removed from public view and its temporary ownership link
  cleared. Its application remains a private draft. See
  `docs/creator-acceptance-repair.md` for release evidence and verification limits.


## Booking confirmation implementation (not deployed)

September 16 work on `codex/booking-confirmation` adds central Zoom, Stripe-derived
response deadlines, full-refund creator cancellation and scheduled delivery recovery.
Migration 0025 and new Zoom/card-only payment configuration secrets are required.
The approved customer session/time selection is unchanged. The five-scope Zoom app,
one licensed host and all four Worker secrets are configured; real API checks pass.
Guest joining and the combined real-provider workflow remain release gates. See [workflow](booking-confirmation-workflow.md) and
[exact setup / test evidence](zoom-production-setup.md). Earlier production Calendar
and Stripe evidence above does not certify this new Zoom workflow.

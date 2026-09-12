# Take a Seat Control Map

Last updated: 2026-09-12

This is the working source of truth for Take a Seat while the product is being
organized. It should stay short, current, and operational.

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

Creator backend:

- Invite-only for accepted creators.
- Lets creators edit profile content that affects buyer confidence.
- Lets creators set 15 minute and 30 minute seat pricing.
- Lets creators manage weekly availability and booking limits.
- Lets creators connect Google Calendar.
- Lets creators connect Stripe payouts.
- Shows request, booking, and setup notifications.

Admin:

- Reviews creator applications.
- Accepts creators and sends invite links.
- Accepts applications; creators publish their accepted profile by saving it.
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
  Production uses email codes only. Phone-code requires a paid Clerk feature and
  is hidden unless `TAKE_A_SEAT_PHONE_SIGN_IN_ENABLED=true` and Clerk supports it.
- Clerk identities must have a verified primary email or phone before they can
  claim an accepted D1 profile. Later sign-ins return to `/creators/dashboard`.
- Clerk and admin configuration read Cloudflare Worker bindings directly.
- The Worker forwards Clerk handshake redirects and refreshed cookies on auth
  document requests; the first returned render receives the verified token.
- Signed-in accounts without an accepted profile see an explanation and can
  switch accounts. Code sending failures never fabricate a code-entry screen.
- Admin access is allowlist-based through configured admin emails and optional
  admin phones.
- Creator access is based on accepted creator profile identity and creator
  account links in D1.

Email:

- Resend is used for transactional email.
- Current branded sender: `Take a Seat <applications@takeaseatwith.com>`.
- Application recipient/admin email is configured through runtime values.
- Creator applications send Annabel the admin review email and send the
  applicant a receipt email. A valid email is required to submit or accept.
- Acceptance reserves a public slug and prepares a private starter profile, then
  emails the applicant a setup link. `published_at` remains null until profile save.
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
- OAuth routes exist, but launch booking flow still needs final reliability work.
- Booking request and Stripe Checkout routes server-validate submitted times
  against creator availability before creating a booking.
- Public creator profiles collect the request first, then send the customer to
  Stripe Checkout to authorize payment. The customer is not charged unless the
  creator accepts the appointment.

Payments:

- Launch status: live Connect setup is incomplete and no live creator account or
  webhook is configured. See `docs/stripe-launch-readiness-2026-09-12.md` for the
  verified audit, prepared repairs, required event subscriptions, and launch gates.

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
- Customer bookings.
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
- `/creators/dashboard`

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

- `/creators/dashboard` now owns the accepted-creator profile editor URL and no
  longer redirects through `/admin/creator-profile-editor-preview`.
- `/admin/creator-profile-editor-preview` is admin-only and uses the same editor
  component only as an internal preview.
- The shared editor component still needs a cleaner package boundary over time;
  creator self-service should continue to live under `/creators`.

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
- `GOOGLE_OAUTH_REDIRECT_URI`
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

1. Verify Cloudflare and D1.
   Confirm the intended D1 migrations are applied to the production database and
   that required secrets exist.

2. Configure accepted-creator notifications.
   Decide whether launch requires SMS, then either configure Twilio secrets and
   send a real accepted-creator test text, or explicitly launch email/profile
   notifications first with SMS disabled.

3. Finish integration reliability.
   Complete a Stripe Connect onboarding pass from an accepted creator profile,
   test the signed Stripe webhook with a full checkout, complete Google Calendar
   busy/free conflict checks, and test a full booking flow before taking real
   payments.

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
  this appointment,” the customer receives a post-acceptance payment email, and
  no customer payment is collected before acceptance.
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

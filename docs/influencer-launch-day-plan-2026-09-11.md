# Influencer Launch Day Plan

Date: 2026-09-11

Goal: make Take a Seat credible and usable enough to invite first influencers by
the end of today.

## Recommended Target For Today

Invite influencers into an application and accepted-creator setup flow, not into
fully automated paid bookings.

The app is close enough to support:

- public brand and creator discovery
- influencer application submission
- admin application review
- acceptance with creator invite email
- creator dashboard/profile setup
- profile publishing to `/with/[slug]`
- booking requests or manual booking coordination

The app is not yet safe to represent as fully paid-booking-ready until the
Stripe webhook is configured in Stripe, the webhook secret is set in Cloudflare,
and a real test-mode booking proves that the webhook marks the booking paid.

## Current Readiness

Green today:

- Worktree started clean on `main`.
- `npm run lint` passes.
- `npm test` passes, including build and 20 rendered/API smoke tests.
- Production target is Cloudflare Workers through `wrangler.deploy.jsonc`.
- Branded Resend sender is configured in Wrangler vars as
  `Take a Seat <applications@takeaseatwith.com>`.
- Required production secrets currently declared by Wrangler are
  `CLERK_SECRET_KEY` and `RESEND_API_KEY`.
- Application submission sends Annabel an admin review link when Resend is
  configured.
- Admin acceptance creates/reuses an invite, sends the accepted email, attempts
  SMS when Twilio is configured, and creates an in-profile notification.
- Reusable published creator profile loading exists through D1 and falls back to
  checked-in seed profiles when D1 is unavailable.

Not green for public paid bookings:

- Stripe webhook handling exists in code, but still needs Stripe Dashboard or
  Stripe CLI configuration and an end-to-end test-mode booking.
- Google Calendar OAuth exists, but the full customer booking path still needs a
  real end-to-end rehearsal.
- Twilio is optional. If not configured, accepted creator texts are skipped and
  the admin page reports the reason.
- The reusable public profile component has static booking buttons. The dynamic
  `/with/[slug]` route uses the newer request-style booking flow, while bespoke
  routes still vary by creator.

## End-Of-Day Definition Of Done

By end of day, aim for this narrower, credible launch state:

1. The live site accepts influencer applications at `/creators/onboard`.
2. Annabel receives branded application emails from Resend.
3. Annabel can review an application at `/admin/applications`.
4. Annabel can accept one test creator application and send a creator setup
   invite.
5. The accepted creator can sign in and reach `/creators/dashboard`.
6. A polished first creator profile can be published or manually reviewed at a
   stable `/with/[slug]` URL.
7. Influencer outreach copy says applications/setup are open, and that booking
   launch is curated/manual while final payment automation is being finished.

Do not promise self-serve paid booking availability to influencers today unless
the Stripe webhook, calendar event creation, and a full booking rehearsal are
completed first in the intended mode.

## Today Priority Order

### 1. Production Reality Check

- Confirm Cloudflare D1 migrations are applied to
  `take-a-seat-platform-db`.
- Confirm Cloudflare Worker secrets exist:
  `CLERK_SECRET_KEY`, `RESEND_API_KEY`.
- Confirm the deployed Worker is on the latest `main` commit or explicitly
  deploy the current clean state after Annabel approves production deployment.
- Submit one application on the live site using Annabel-controlled test contact
  info.
- Confirm the branded application email lands in Annabel's inbox.

### 2. Acceptance Rehearsal

- Open the admin review link from the received email.
- Accept the test creator with a clean public slug.
- Confirm the admin page reports:
  - email sent
  - SMS sent or skipped with a clear Twilio reason
  - profile notification created
- Open the accepted email and confirm the setup link points to the live Worker
  origin.
- Sign in as the accepted creator and confirm `/creators/dashboard` loads.

### 3. First Influencer Profile QA

- Use Ella as the current launch profile, but rehearse risky payment/calendar
  changes with Annabel's test profile first.
- Confirm each launch creator has:
  - name, location, category, and social handles
  - buyer-facing intro, about section, help list, and 1:1 rationale
  - 15 minute and 30 minute offer copy and prices
  - profile image/gallery assets without text baked into the image
  - clear public slug
- Open the resulting `/with/[slug]` page on desktop and mobile.
- Check for clipped text, awkward image crops, inactive booking CTAs, and
  inconsistent booking language.

### 4. Outreach Packet

- Prepare one application link:
  `https://takeaseatwith.com/creators/onboard`
- Prepare one short creator promise:
  "Apply, build your private-call profile, and we will personally review it
  before your page goes live."
- Avoid saying "payments are live" or "followers can book instantly" until
  Stripe webhook testing and calendar event creation are done.
- Decide whether the first influencers should be asked to:
  - apply today only
  - apply and complete profile setup
  - apply, complete setup, and schedule a manual onboarding call

## Suggested Schedule

Morning:

- Confirm production secrets and D1 migrations.
- Deploy only if Annabel approves publishing the current app state.
- Run the live application submission test.

Midday:

- Rehearse acceptance and accepted creator dashboard access.
- Fix only blockers that prevent application, acceptance, or creator setup.

Afternoon:

- QA one polished creator profile on desktop and mobile.
- Tighten copy where the interface implies instant paid booking before the
  booking system is fully reliable.

End of day:

- Send influencer outreach only after the live application and acceptance flow
  have been rehearsed successfully.
- Capture any remaining booking automation tasks as post-invite launch gates.

## Post-Invite Launch Gates

Before real paid bookings:

- Configure `/api/stripe/webhook` in Stripe and store `STRIPE_WEBHOOK_SECRET`
  in Cloudflare.
- Create calendar events from confirmed payment or approved booking state.
- Rehearse Google Calendar OAuth and conflict handling with a real creator
  account.
- Rehearse Stripe Connect onboarding with the intended test or live account
  mode.
- Create and store creator Stripe Price IDs for each seat length.
- Run one full booking from public profile to payment to creator notification to
  calendar event.

## One-Line Recommendation

Send influencers into the application/setup funnel today, with manual review and
curated booking language. Treat paid booking automation as tomorrow's launch
gate unless the webhook and calendar rehearsal finish cleanly today.

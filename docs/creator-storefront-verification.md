# Creator storefront implementation and verification

September 14, 2026. Deployed to production after Annabel's explicit approval.

## Production release

- PR #28 merged; deployed source commit `a5259fde35cada529a906f5a61d3d0345c0c76d2`.
- Cloudflare version `b3a9293e-2e77-4994-8beb-b315888f8d0e` serves the custom domains.
- Required Worker secrets confirmed by name; migrations 0018–0020 applied successfully.
  Post-deploy check confirms no pending migrations.
- Production package dry run and build passed before deployment.
- Isolated, unauthenticated Chrome smoke checks returned HTTP 200 for `/`,
  `/take-a-seat`, `/creator/profile`, and `/creators/dashboard`. Both creator entry
  routes showed the expected secure sign-in screen.
- `/with/ella` opened the approved booking dialog at desktop 1280 × 900 and mobile
  390 × 844, with no horizontal overflow, browser errors or failed HTTP responses.
  No booking was submitted and no existing signed-in browser session was altered.
- Cloudflare's initial D1 check returned transient error 7403; retry succeeded with
  the same OAuth account and permissions. No credentials or access settings changed.
- Previous Worker version: `d386cbee-4be0-48bc-8c71-15f58ec0fa7b`. Retain additive
  D1 migrations if a Worker rollback becomes necessary.


## Implemented

- Reused the existing creator editor and approved customer booking component.
  `/creator/profile` is canonical; the legacy dashboard still works. The original
  invitation query string is retained through the sign-in destination.
- Persistent Profile, Availability, Requests, Payments, Preview & Publish navigation.
  Confirmed save timestamps, retained failed edits, retries and bottom save actions.
- Original JPG/PNG/WebP and MP4/WebM files stored separately from profile rows in D1.
  Profile references preserve crop/zoom and ordered gallery membership. Content hashes
  deduplicate storage; access checks keep unpublished media private. Uploads are capped
  at 8 MB each, eight gallery items and 128 MB total retained media per creator.
- Private profile drafts, accurate authenticated preview using the public renderer,
  and atomic publication. Preview cannot submit checkout. Published fields never read
  the draft. Saved availability is intentionally live, as the editor explains.
- Up to 12 ordered offerings with explicit title, duration, price, description and
  active/archive state. Bookings snapshot the purchased details; old records with no
  price snapshot say “Historical amount unavailable” rather than using today's price.
- Default weekly schedule and dated overrides, one-year navigation and IANA timezones.
  An empty override closes that week without deleting default hours.
- Requests show customer context and authorized actions. A persisted decision claim
  prevents conflicting accept/decline operations. Provider idempotency permits safe
  retries after interrupted capture/cancellation. Decline email failures have a retry.
- Payments reads current Stripe readiness and balances, provides Express dashboard
  access, and displays actual paid sessions. Provider errors never imply connection
  or fabricate earnings.
- Conditional D1 reservation compares both booking and schedule snapshots. Final
  submission rejects stale times. Checkout reconciliation releases attached holds
  only after Stripe confirms expiry; delayed successful payments remain blocking.

## Protected customer flow

Kept the existing session cards, “Find your moment” dialog, month/time selector,
customer details step, payment authorization wording and progression. Customer changes
are limited to explicit duration data, preventing pre-hydration clicks, a stale-slot
message and disabling checkout inside creator preview. No customer CSS redesign.

Before captures from the existing site:

- `/private/tmp/tas-customer-before.png`
- `/private/tmp/tas-customer-time-before.png`

After captures in the ignored local `.wrangler/` directory:

- `creator-profile-desktop.png`, `creator-profile-mobile.png`
- `creator-preview-mobile.png`, `creator-availability-mobile.png`
- `customer-time-after.png`, `customer-time-mobile-after.png`

Inspected desktop 1280 × 900 and mobile 390 × 844. Profile fields, persistent navigation,
preview close control, modal footer and booking controls remain usable without page
horizontal overflow. The booking dialog scrolls a long time list within its existing
layout. Screenshots use synthetic creator records and checked-in sample imagery.

## Repeatable browser environment

`npm run test:e2e` runs Chrome through `@playwright/test` with one worker, zero retries
and no skipped tests. The runner copies the application to an isolated temporary
workspace, starts the real vinext/Cloudflare local runtime, applies all real D1
migrations and uses real application routes for saves, publication and booking writes.

Only identity and external provider boundaries are test fixtures. The fixture route,
identity implementation and fetch adapter live under `tests/e2e`; the isolated copy
injects them. Production app routes and Vite configuration never load them. No real
creator accounts, customer data, charges, invitations or emails are used.

Unexpected browser console/page errors, failed requests and HTTP failures are collected
in the main journeys and must be empty. Deliberate failed saves and invalid uploads
assert recovery explicitly. Node/toolchain deprecation/optimization warnings are not
browser application failures.

## Playwright scenarios

| Journey | Result |
| --- | --- |
| Admin acceptance, generated email destination, original invite parameters, creator entry | PASS |
| Photo/crop/original bytes, name, social links, About, help items, gallery and offerings after hard reload/fresh login | PASS |
| Failed save retains edits, never shows false success, retry persists | PASS |
| Published A remains stable while draft B is saved/previewed; publish updates new navigation atomically | PASS |
| Default hours from empty setup, immediate readiness, dated empty override, timezone, year navigator, mobile | PASS |
| Stripe active/restricted/missing account states and balances | PASS |
| Approved customer flow with configured offering, duration, price, description and availability | PASS |
| Customer authorization, creator acceptance, refresh, safe repeated acceptance and separate decline | PASS |
| Historical booking/payment view retains price A after creator publishes price B | PASS |
| Two concurrent customers: only one reservation reaches checkout | PASS |
| Loaded time removed before submission: graceful rejection, no booking write | PASS |
| Abandoned Checkout releases only after Stripe-confirmed expiry | PASS |
| Multiple offerings persist their order; archived offerings disappear from new customer choices | PASS |
| Duplicate/unsupported media errors recover without ghost gallery items | PASS |

The combined journeys run as eight Playwright tests. HTML report:
`.wrangler/playwright-report/index.html` (ignored generated artifact).

## Other checks

- `npm run lint`: PASS.
- `npm test`: PASS, production build plus 80 Node tests.
- `npx tsc --noEmit`: PASS.
- `git diff --check`: PASS.
- Existing signed-webhook tests cover duplicate delivery, signature failure, delayed
  success, capture validation and provider failures. Added domain checks exercise a
  schedule edit during the provider call and concurrent opposite creator decisions.
- Discovered causes and regression coverage: [bug log](BUG_LOG.md).

## Deployment prerequisites and limits

The production release applied these three additive migrations:

1. `0018_classy_wasp.sql`: published offering JSON and historical booking snapshots.
2. `0019_furry_mantis.sql`: persisted creator decision and decline-notification marker.
3. `0020_magenta_hellfire_club.sql`: original media metadata/chunk tables.

No new production service or secret is introduced. Confirm the existing D1 binding,
Clerk, Stripe, webhook, Google Calendar and Resend secrets using the operational
[control map](take-a-seat-control-map.md). Commit and review before any deployment.
Rollback must retain these additive columns/tables and creator media; never reverse
migrations by deleting original files or historical booking data.

Local fixture results prove application behavior and D1 persistence, not live Clerk
code delivery, Stripe settlement/Express account behavior, Resend inbox delivery or
Google Calendar invitations. Those require the separately authorized live integration
rehearsal already listed in the launch gate. The production deployment and read-only smoke checks are recorded above; no live
payment, authenticated creator mutation or provider-delivery rehearsal was performed.

# First creator production release audit

Audit date: September 16, 2026. **FIRST CREATOR ONBOARDING: BLOCKED.**
PR #37 application commit reviewed: `3381a0c292eb6b5602738600b57c48441c837c92`.
Real-provider follow-up application fix: `190353d` (verify five-minute Zoom early join).
Final verification includes GitHub main `5012acc` merged into the candidate at
`491f2fb`; PR #37 remains draft, unmerged and undeployed.
This report separates observed external state, implemented capability and approved
launch policy. No real-money payment, refund, payout or new customer email was
initiated. A disposable $1 sandbox payment was authorized, captured and fully refunded.

## Completed automatically

- Applied production D1 migration 0025 and verified its migration record, both new
  tables and all 13 new booking columns. The existing application remains available.
- Inspected actual Cloudflare secret names, plain variables, binding, deployment and
  schedules; Google Console; Resend domain/delivery dashboard; Stripe live API/dashboard.
- Saved missing Google branding URLs: homepage `https://takeaseatwith.com/` and privacy
  `https://takeaseatwith.com/privacy`. Reload verified persistence. Did not publish
  OAuth, submit verification, change scopes or rotate credentials.
- Created a separate live Stripe configuration, **Take a Seat bookings — cards**,
  `pmc_1UGPKh1B3wHKPpd6FDzkHyr0`. API readback confirms active, live, card on and
  every other API-reported payment method off. Default configuration was preserved. This new
  configuration is not yet connected to a deployed booking flow.
- Verified the matching test configuration `pmc_1UGPTd1B3wHKPpd6A9yy9PLM` by
  real API and hosted Checkout: active, test mode, only `card` eligible. A public
  Stripe test card authorized $1 with manual capture and a real `capture_before`.
  Two capture calls with the same idempotency key returned the same charge. A full
  test refund succeeded. This resolves the earlier dashboard-preview uncertainty.
- Saved Google's exact root TXT with Annabel's owner-access approval; both public
  resolvers returned it and Search Console accepted domain ownership. Existing SPF
  and unrelated DNS were preserved. Keep the verification TXT in place.
- Annabel confirmed Ella as the first creator. Her supplied Google identity already
  appears in the two-user OAuth test audience; no new access grant was needed.
- Fresh lint, TypeScript, production build, 86 Node tests and 35 Playwright journeys
  passed. Tests include D1 persistence, hard refresh, returning fixture login,
  published customer data, payment/recovery failures and desktop/mobile coverage.
- Credential-pattern scan found no secret values in PR additions; compiled output
  contains none of the test auth/provider/control-route markers checked.
- Created and activated the Take a Seat Zoom S2S app with precisely five meeting
  scopes. Stored all four expected Zoom values as production Worker secrets without
  exposing credentials. Verified real-provider recovery/reschedule/delete and
  single-host reservation behavior; guest joining remains blocked as detailed below.
- Fixed the real-provider early-join mismatch and added regression coverage. Latest
  lint, TypeScript, production build, 87 Node tests and 35 Playwright journeys passed.
- Saved exactly `calendar.freebusy` and `calendar.events.owned` in Google Data Access;
  reload confirmed persistence. No additional Google permissions were requested.
- Removed development origins/callbacks from the existing Google Web client. Reload
  confirms no JavaScript origins and exactly the canonical production callback;
  credentials were preserved. Separate real development OAuth remains unconfigured.

## Cancellation, refund and reschedule capability versus policy

Earlier v1 planning documents proposed no customer self-cancellation and manual
Stripe refunds when the creator/platform cannot fulfil a session. Those planning
notes are not evidence of a final customer-facing business policy.

During implementation Annabel explicitly approved full refunds for creator
cancellations, including transfer and fee reversal. PR #37 implements that capability.
Annabel reconfirmed the existing behavior for the first creator launch on September
16: creator cancellation returns the full payment with transfer/platform-fee reversal;
requests expire after at most 24 hours, sooner near the session/card deadline;
customer cancellation/rescheduling stays support-managed with no promised self-service
policy. No additional entitlement, cutoff, fee or automated customer policy was added.

| Situation | Existing main behavior | PR #37 behavior / approved launch scope |
| --- | --- | --- |
| Creator declines before capture | Cancel authorization; notify customer | Same outcome with durable retry and expiry handling; no refund because nothing captured |
| Creator cancels after capture | Manual Stripe refund described in planning docs; no automated full-refund button | Owner-only Cancel & refund; full captured amount; `reverse_transfer=true`, `refund_application_fee=true`; no amount selector, cancellation fee, cutoff or completed-session exclusion |
| Customer cancels | No self-service endpoint/UI | Still absent; support-managed, with no promised self-service policy |
| Creator reschedules | Creator-authorized Calendar reschedule endpoint | Preserve payment/amount; reserve new capacity atomically; update same Zoom meeting and Calendar event; retry customer email. No extra charge or automatic partial refund |
| Customer reschedules | No customer self-service | Still absent; support-managed, with no promised self-service policy |
| Request expires | Provider cancellation reconciliation existed | New response deadline: earliest of request creation +24 hours, session start minus 30 minutes, actual card capture deadline minus 1 hour; unknown capture deadline cannot authorize capture |
| Refund before payout | Operator-managed | Full Stripe refund/reversal attempt; needs sufficient balances and Stripe success |
| Refund after bank payout | Operator-managed | Same API attempt; does not pull a completed bank payout back. Insufficient connected balance can reject refund plus reversal; platform shortfall can leave refund pending |

The 24-hour response SLA and earlier session/card margins are approved for this
launch. Rescheduling currently has an API, not a customer or creator
date-picker in Requests. Do not advertise self-service rescheduling.

Refund completion requires Stripe `succeeded` and the full amount. Pending/failed
refunds remain processing; existing partial/manual refunds require operator review.
Meeting/event cleanup and capacity release follow confirmed refund, so a blocked
refund also leaves cleanup pending. The platform application fee is different from
Stripe processing fees: the code returns the former and does not reimburse or
control Stripe's own fees. No automatic payout delay/reserve policy is implemented.
[Stripe Connect refund funding](https://docs.stripe.com/connect/charges),
[destination charge fees and reversals](https://docs.stripe.com/connect/destination-charges).

## Migration 0025: applied

File: `drizzle/0025_strong_lorna_dane.sql`. Adds `booking_deliveries` (durable email
payload/attempt/sent timestamps) and `zoom_host_reservations` (booking, host, interval).
Adds booking deadline, workflow step/retry/error/lease, Zoom identity/revision and
Stripe refund fields. Twelve columns are nullable; `workflow_attempts` is NOT NULL
with default 0. No row deletion, table replacement or business-data backfill.

Applied in isolated local D1 and Node SQLite testing and now **production D1**
`144a50a9-e15d-4fcc-a8eb-7e3bed735895`. Wrangler reported 16 commands, 8.72ms.
Readback confirmed `0025_strong_lorna_dane.sql`, both tables and booking columns.

```sh
npx wrangler d1 migrations apply take-a-seat-platform-db --remote --config wrangler.deploy.jsonc
```

Pre-migration Time Travel bookmark:
`000001bc-0000000d-000050e8-24ceb062db24365524d3e992a2174f27`.
No private database dump was exported or committed. Cloudflare Time Travel is the
recovery mechanism. Additive schema is compatible with the currently serving old
Worker, so normal code rollback should retain it. Whole-database restore would lose
subsequent writes and is an emergency operation requiring a write freeze and an
assessment of newer data; do not restore merely to undo this additive migration.
[Cloudflare Time Travel](https://developers.cloudflare.com/d1/reference/time-travel/).

## Production bindings and secrets audit

Existence means verified in the current Cloudflare Worker settings, not a claim
that secret values are correct, mode-matched or usable. Secret values were not read.
Cloudflare navigation: Workers & Pages → take-a-seat-platform → Settings → Variables
and Secrets. Paste credential values there, never into chat, Git or this report.

| Variable/binding | Provider / purpose | Secret? | Required now? | Production existence | Action |
| --- | --- | --- | --- | --- | --- |
| `STRIPE_SECRET_KEY` | Stripe API | Yes | Yes | Present | Verify active runtime account/mode; fresh sandbox key worked only in isolated rehearsal |
| `STRIPE_WEBHOOK_SECRET` | Stripe event verification | Yes | Yes | Present | Must match enabled endpoint and API-key mode |
| `STRIPE_LIVE_WEBHOOK_SECRET` | Staged live endpoint secret | Yes | Not read by app | Present | At deliberate live cutover copy correct signing secret to runtime name; presence here alone does nothing |
| `STRIPE_BOOKING_PAYMENT_METHOD_CONFIGURATION` | Stripe booking Checkout methods | No, private config | PR #37 | Missing | Set matching sandbox ID for rehearsal; use new live ID only with live credentials |
| `TAKE_A_SEAT_PLATFORM_FEE_BPS` | Platform fee | No | Yes | Present, 1500 | 15% configured; existing launch behavior retained |
| `STRIPE_PRICE_ELLA_15`, `STRIPE_PRICE_ELLA_30` | Demo price references | No, stored as secrets | No for accepted creators | Present | Mode-check only if using demo routes; saved creator offerings use inline prices |
| `STRIPE_CONNECT_COUNTRY` | Default onboarding country | No | Optional | Missing | Default behavior applies; verify actual creator country/capabilities |
| `GOOGLE_CLIENT_ID` | Google OAuth client | No, stored as secret | Yes | Present | Match inspected Web client during controlled OAuth |
| `GOOGLE_CLIENT_SECRET` | OAuth token exchange | Yes | Yes | Present | Rehearse token exchange/refresh; do not rotate casually |
| `GOOGLE_TOKEN_ENCRYPTION_KEY` | Stored OAuth tokens | Yes | Yes | Present | Preserve; changing can invalidate existing token decryption |
| `GOOGLE_OAUTH_REDIRECT_URI` | Legacy callback config | No, stored as secret | Unused | Present | Current code derives canonical callback; no longer relied on |
| `ZOOM_ACCOUNT_ID` | Central S2S account | Private identifier | PR #37 | Present, secret | Real account-credentials exchange passed |
| `ZOOM_CLIENT_ID` | Central S2S app | Private identifier | PR #37 | Present, secret | Exact activated app; token scopes verified |
| `ZOOM_CLIENT_SECRET` | Central S2S authentication | Yes | PR #37 | Present, secret | Transferred privately; real authentication passed |
| `ZOOM_HOST_USER_IDS` | Licensed dedicated host pool | No, private config | PR #37 | Present, secret | One opaque owner ID; API host match and one-lane reservation verified |
| `RESEND_API_KEY` | Transactional email | Yes | Yes | Present | Domain verified; local key is sending-only, so dashboard used for audit |
| `TAKE_A_SEAT_EMAIL_FROM` | Email sender | No | Yes | Present | `Take a Seat <applications@takeaseatwith.com>` |
| `TAKE_A_SEAT_APPLICATION_RECIPIENT` | Admin application inbox | Private contact config | Yes | Present | Existing monitored admin inbox retained |
| `NEXT_PUBLIC_SITE_URL` | Production email/app links | No | Yes | Present | `https://takeaseatwith.com` |
| `CLERK_SECRET_KEY` | Creator/admin authentication | Yes | Yes | Present | Full real invite/returning-login check remains part of release smoke |
| `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` | Clerk browser instance | No | Yes | Present, production instance | Do not mix with development Clerk identities |
| `TAKE_A_SEAT_ADMIN_EMAILS` | Admin authorization | Private contact config | Yes | Present | Existing allowlist retained |
| `TAKE_A_SEAT_ADMIN_PHONES` | Optional admin identity | Private, stored as secret | Optional | Present | No change |
| `TAKE_A_SEAT_PHONE_SIGN_IN_ENABLED` | Phone auth feature | No | No | Present, false | Email sign-in remains configured |
| `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_MESSAGING_SERVICE_SID` / `TWILIO_FROM_PHONE_NUMBER` | Optional SMS | Token secret; others private config | No | Missing | SMS skips; not an email/booking launch prerequisite |
| `DB` | Cloudflare D1 | Binding, not credential | Yes | Correct production ID verified | Migration0025 applied |
| `triggers.crons` | Cloudflare recovery scheduling | No | PR #37 | No deployed schedules | Deploy reviewed handler and five-minute trigger together |

## Cron and recovery

One scheduled job, `*/5 * * * *` UTC, calls `worker/index.ts` →
`runBookingMaintenance()`. It handles response expiry/authorization release, capture
reconciliation, Zoom creation, Calendar invitation, customer email, reschedule and
refund/cancellation cleanup. Up to 25 due rows, batches of 5; persistent retries and
booking leases prevent overlapping work. No separate cron secret is required.

Cloudflare API returned `schedules: []`: **production is not receiving these cron
events**. Enabling a trigger against the currently deployed old handler would not
complete setup, so it was not done.

Direct compiled scheduled-export smoke: HTTP 200 `ok` against isolated migrated D1
with no bookings/credentials. Local workerd supports only compatibility date
2026-05-22, so the isolated test used that date and omitted the static-assets router.
The older local asset-routing layer returned 500 before reaching the handler; a
diagnostic wrapper also verified the handler completed. Production configuration
was unchanged. Full workflow recovery was separately exercised by Playwright.
This is not proof of production cron delivery. After deployment observe at least
one scheduled invocation and a controlled recovery in Cloudflare logs.

## External status and exact remaining setup

### Google

Actual Console project `take-a-seat-platform`: Web OAuth client **exists** (“Take a
Seat Web”); audience **External**; publishing **Testing**; Calendar API **enabled**;
canonical callback **registered**:
`https://takeaseatwith.com/api/google-calendar/oauth/callback`.

Verification Center says verification is not required while Testing; there is no
approved/pending verification evidence. Treat verification as **not approved**;
historical submission state is not independently established by that message.
Two test users exist. Annabel confirmed Ella as the first creator, and the supplied
Google identity matches the existing test-user entry. **FIRST CREATOR CAN AUTHORIZE
TODAY: YES, as an eligible test user**, subject to her own sign-in/consent and account
restrictions. Her actual connection has not been exercised; no invitation was sent.

Branding homepage/privacy URLs, exactly `calendar.freebusy` and
`calendar.events.owned`, zero JavaScript origins and exactly the canonical callback
are saved. Credentials were preserved. A separate development OAuth client remains
unconfigured.

**Domain verified: YES.** After Annabel's explicit owner-access approval, only the
exact Google root TXT was added in Cloudflare. Public DNS readback and Search Console's
“Ownership verified” result confirmed the domain property. Preserve that TXT.

**Public OAuth fully approved: NO.** Audience remains External/Testing; Verification
Center says verification is not required in Testing. Domain ownership does not approve
sensitive scopes. Testing Calendar refresh grants generally expire after seven days
and Google warnings may appear. For unrestricted durable onboarding, finish the
production publishing and sensitive-scope review described in
[Google setup](google-oauth-production-readiness-2026-09-16.md).

### Stripe

Live account inspected through authenticated API: `acct_1TcSNS1B3wHKPpd6`.
Live webhook exists, correct URL and six events, **disabled**. Required events:
`checkout.session.completed`, `checkout.session.expired`,
`checkout.session.async_payment_succeeded`, `payment_intent.amount_capturable_updated`,
`payment_intent.canceled`, `payment_intent.succeeded`.

New live booking configuration has **cards only**. Apple Pay/Google Pay are currently
off in this dedicated configuration, so they are not promised at launch. They can
be added as card wallets after verification; wallet display also depends on the
customer device/browser. Link, bank methods and BNPL are off. Manual capture alone
does not guarantee every eligible method is a pure card authorization; the app
requires the actual card capture deadline. Creators continue receiving Connect
destination transfers after capture; checkout-method configuration does not replace
or modify their connected payout accounts or bank payout schedule.

The matching test configuration passed real API and hosted Checkout inspection with
only `card`. Disposable sandbox PaymentIntent `pi_3UGQs41B3wHKPpd603668CKZ` was
`requires_capture`, amount/capturable 100 cents, received 0, with an actual card
capture deadline. Two idempotent capture calls returned one charge and received 100.
Full test refund `re_3UGQs41B3wHKPpd60L6yJ6i7` succeeded for 100. No production
booking metadata was attached. The isolated harness cleared its in-memory credential.
This proves the provider payment boundary, not the complete application/Connect journey.

Sandbox webhook `we_1UEZSp1B3wHKPpd6AWnBkj8K` remains enabled with all six events
at the existing workers.dev callback. The live endpoint remains disabled. The live
API returned **zero live connected accounts**; D1 contains only the previous sandbox
connection and no first-creator live connection. Actual Worker key mode remains
unverified because Cloudflare does not expose saved secret values. The required
payment configuration runtime name is still absent.

Revealing the existing live key reached Stripe's “Verification required” panel,
which remained at “Please wait…” even after a reload/retry. No key was revealed or
rotated, and no security challenge was bypassed. Complete provider verification,
then set the matching live API/signing/config values and enable the live webhook
as one deliberate cutover after creator transfer readiness. An enabled test webhook
or staged `STRIPE_LIVE_WEBHOOK_SECRET` does not establish live readiness.

### Zoom

Marketplace is authenticated. Zoom account/user management verifies the owner and
one licensed Zoom Workplace Pro (Named Host) user. Annabel explicitly accepts one
simultaneous Take a Seat meeting for the initial launch and prohibits purchasing
another license. Zoom's API License and Terms of Use were accepted with her explicit
approval. The Server-to-Server app **Take a Seat booking meetings** is now activated
with exactly the five approved scopes; OAuth token scope readback matches. All four
runtime Zoom values are present as encrypted production Worker secrets.

Real Zoom API rehearsal through PR #37 helpers passed: one meeting per booking,
correct licensed host, safe join URL stored, no host start URL stored, recovery after
a deliberately lost successful create response, sequential/concurrent retries without
duplicates, same-meeting reschedule once, delete once, 404/list absence and reservation
cleanup. Persistence used isolated SQLite through the D1 statement interface, not
production D1. No payment or customer email was triggered.

The first rehearsal exposed Zoom ignoring `jbh_time=5` because the host's custom
early-join-limit checkbox was off. Enabled and saved the five-minute setting; a fresh
real meeting returned five minutes. Added backend rejection of a mismatched limit
and regression coverage (BUG_LOG). All required code checks passed.

Three sequential disposable booking runs were used for discovery, corrected API
verification and the guest-join attempt. Each created exactly one meeting despite
retries; all three were deleted and verified absent. The local harness is stopped.

Final follow-up: the existing **Take a Seat Onboarding** portal entry now shows
Launch instead of End/Join, and the native owner app has no active call. It was not
ended or deleted. A fresh disposable run again passed all API checks above. Its safe
stored link reached an unsigned-in browser guest prejoin without a host start URL.
Final Join explicitly accepts Zoom's Terms/Privacy; action-time human approval is
pending. **Guest joining remains unverified**, including two-participant, media,
duration and overrun behavior. Do not carry forward the old occupied-host diagnosis
as a current observation. The fresh disposable meeting was deleted once, verified
absent, and its reservation released. Both temporary provider harnesses are stopped;
no credentials were saved in them.

Minimum: one Take a Seat-owned paid/licensed dedicated host, S2S app activated,
five granular meeting scopes, four Worker settings and a two-participant joining
test without the owner present. One host supports one simultaneous booking lane
in this implementation, with 15-minute buffers. Add licensed host IDs for overlapping
creators; do not assume one account permits unlimited simultaneous meetings.

Use [Zoom production setup](zoom-production-setup.md) for exact app navigation,
scopes and values. Both participants join without host privileges; no host key or
start URL is shared. Verify join-before-host, waiting-room/authentication settings,
duration and overrun behavior with the actual plan. Plan capacity is verified;
actual unattended participation is still a rehearsal gate; the application
reservation test passed. No extra license or broad user-management scope is required.

### Email

Resend dashboard currently marks `takeaseatwith.com` **Verified**. Production sender
and canonical site URL verified in Worker settings. Dashboard shows recent creator
acceptance and application messages **Delivered**, and earlier request/paid/decline
messages Delivered. Delivery to a recipient server does not prove Inbox placement;
the user's open acceptance email was in Spam.

Acceptance, creator booking request, confirmation, decline, expiry, cancellation
and reschedule helpers use the shared Resend sender. New customer confirmation and
expiry templates have local fixture coverage but **no real-provider delivery proof**.
The request email goes to the creator; a separate customer request-receipt email is
not implemented. Confirmation includes the same Zoom participant URL as Calendar
and booking page. Public link base is canonical, not localhost; no newly generated
PR #37 real confirmation email exists to inspect yet.

### Cloudflare

Authenticated control-plane access works. Correct DB and secret names verified;
migration completed. The earlier audit observed version `fd9bacc5`; a fresh check
before Zoom setup found `118d3598-0f2c-4bc4-8223-c5566bbae692` serving 100% traffic,
deployed at 20:29 UTC outside this setup action. The Zoom secret-only dashboard save
produced `4a05c6c9-5ad0-4a78-8e71-617c27c93918`, serving 100% at 20:59 UTC.
All 129 code-module hashes are identical before/after this save. Deployed content
has no PR #37 Zoom implementation. This was an authorized configuration update;
PR #37 application code remains undeployed.

## PR, deployment and rehearsal decision

[PR #37](https://github.com/annabelfilippini/take-a-seat-platform/pull/37) remains open/draft.
GitHub main advanced to `5012acc2025747c851b1a7a69abef2c8a62d32b3` (PRs #38/#39).
It was merged without conflict into this candidate at `491f2fb`, preserving those
creator UI updates. Fresh checks on that merged candidate passed: lint, TypeScript,
production build, 87 Node tests and 35 Playwright journeys. There are no GitHub status
checks to substitute for this local evidence. Diff checks and scans found no added
credential values or checked test control/auth/provider markers in compiled output.

No newly reproduced application bug was found during this final follow-up. The
previous real Zoom early-join fix remains in BUG_LOG with regression coverage.
Existing cancellation policy is now explicitly approved; no policy code was changed.

Full PR #37 real-provider application rehearsal: **BLOCKED / NOT COMPLETE**. Real
Zoom API checks and a real hosted Stripe sandbox authorization/capture/refund passed
independently. They do not prove the entire customer request → creator accept →
Stripe capture → Zoom → Google attendee invitation → delivered confirmation chain.
The September 14 Meet rehearsal remains historical evidence only.

Production state rechecked: version `4a05c6c9-5ad0-4a78-8e71-617c27c93918`, created
20:59:23 UTC / deployed 20:59:24 UTC, serves 100%. Wrangler reports only **fetch**,
with no scheduled handler; dashboard has no cron trigger. Its exact source commit
is not recorded in version metadata and is not asserted. PR #37 was not deployed.
Migration 0025, both new tables and all 13 columns were freshly verified remotely.
No production cron execution, expiration or retry result is claimed.

Post-deployment smoke: **NOT RUN because no deployment**. Current production creator
profile/Payments/Availability screens loaded under the existing QA identity without
writes; the public founder test profile loaded. These do not prove the original
invite, save/refresh, returning login or new customer booking flow. Those complete
checks, mobile layout, console/network review and actual scheduled recovery remain
required after a permitted deployment.

## Current setup checkpoint

Resolved in the final follow-up: domain ownership, first-creator test-audience
eligibility, explicit launch policy, sandbox card-only configuration/manual capture,
and current-main integration with all release tests passing.

Remaining: Zoom guest legal acceptance and actual participant test; Stripe credential
verification and live runtime/webhook/first-creator Connect readiness; full combined
real-provider rehearsal and new confirmation delivery. Keep PR #37 draft and
undeployed while those gates remain. Once ready, merge reviewed code and deploy from
clean main under Annabel's conditional authorization, record the exact commit/version,
verify scheduled recovery, and complete production smoke. No deployment was made in
this final follow-up and no production customer record was changed.

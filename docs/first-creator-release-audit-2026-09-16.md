# First creator production release audit

Audit date: September 16, 2026. **FIRST CREATOR ONBOARDING: BLOCKED.**
PR #37 application commit reviewed: `3381a0c292eb6b5602738600b57c48441c837c92`.
Real-provider follow-up application fix: `190353d` (verify five-minute Zoom early join).
This report separates observed external state, implemented capability and undecided
business policy. No real payment, refund, payout or new customer email was initiated.

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
- Created the matching test-mode configuration `pmc_1UGPTd1B3wHKPpd6A9yy9PLM`.
  Link is disabled. Cards and Cartes Bancaires remain enabled; Stripe also shows
  Stripe balance as Enabled in preview with no disable control. This is not yet
  certified card-only: verify eligibility in an actual one-time/manual-capture
  Checkout before assigning it to the Worker. No real or test charge was made.
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
The latest request reopens launch-policy review. Keep the capability in the draft PR;
do not treat it as settled published terms or release it implicitly with this audit.

| Situation | Existing main behavior | PR #37 behavior / unresolved policy |
| --- | --- | --- |
| Creator declines before capture | Cancel authorization; notify customer | Same outcome with durable retry and expiry handling; no refund because nothing captured |
| Creator cancels after capture | Manual Stripe refund described in planning docs; no automated full-refund button | Owner-only Cancel & refund; full captured amount; `reverse_transfer=true`, `refund_application_fee=true`; no amount selector, cancellation fee, cutoff or completed-session exclusion |
| Customer cancels | No self-service endpoint/UI | Still absent; customer entitlement, notice windows and exceptions remain undecided |
| Creator reschedules | Creator-authorized Calendar reschedule endpoint | Preserve payment/amount; reserve new capacity atomically; update same Zoom meeting and Calendar event; retry customer email. No extra charge or automatic partial refund |
| Customer reschedules | No customer self-service | Still absent; notice window, consent requirements and limits need business policy |
| Request expires | Provider cancellation reconciliation existed | New response deadline: earliest of request creation +24 hours, session start minus 30 minutes, actual card capture deadline minus 1 hour; unknown capture deadline cannot authorize capture |
| Refund before payout | Operator-managed | Full Stripe refund/reversal attempt; needs sufficient balances and Stripe success |
| Refund after bank payout | Operator-managed | Same API attempt; does not pull a completed bank payout back. Insufficient connected balance can reject refund plus reversal; platform shortfall can leave refund pending |

The 24-hour response SLA and session margin are implementation choices requiring
launch-policy review too. Rescheduling currently has an API, not a customer or creator
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
| `STRIPE_SECRET_KEY` | Stripe API | Yes | Yes | Present | Verify active account/mode in controlled rehearsal; local test key returned 401 and cannot substitute |
| `STRIPE_WEBHOOK_SECRET` | Stripe event verification | Yes | Yes | Present | Must match enabled endpoint and API-key mode |
| `STRIPE_LIVE_WEBHOOK_SECRET` | Staged live endpoint secret | Yes | Not read by app | Present | At deliberate live cutover copy correct signing secret to runtime name; presence here alone does nothing |
| `STRIPE_BOOKING_PAYMENT_METHOD_CONFIGURATION` | Stripe booking Checkout methods | No, private config | PR #37 | Missing | Set matching sandbox ID for rehearsal; use new live ID only with live credentials |
| `TAKE_A_SEAT_PLATFORM_FEE_BPS` | Platform fee | No | Yes | Present, 1500 | 15% configured; business-policy review still applies |
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
Two test users exist, including Annabel's Gmail. The first creator's Google identity
has not been identified/verified against that list. Annabel can rehearse with her
already allowed account; arbitrary creators cannot be assumed eligible.

Branding homepage/privacy fields were blank and are now saved. The exact two
implemented Calendar scopes are now declared and reload-verified. The existing
production Web client now has no JavaScript origins and exactly the canonical
callback; localhost and workers.dev entries were removed without rotating credentials.
Real local OAuth needs a separate development project/client before reuse.
Domain ownership remains pending: the exact Google TXT is prepared in Cloudflare,
but not saved until owner-access confirmation. Before general launch: establish
Search Console ownership for `takeaseatwith.com`, complete branding, publish External/In production,
submit sensitive-scope verification and obtain Google's decision. Exact field
values/scopes/reviewer materials: [Google setup](google-oauth-production-readiness-2026-09-16.md).
Changing Publishing status is not verification approval. Testing Calendar grants
are temporary and not a durable unrestricted launch solution.

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

The existing account’s test-mode configuration is now prepared as noted above;
its preview method and actual Checkout still require validation. If the production
key instead belongs to a separate sandbox account, create the configuration there:
Stripe account switcher → intended sandbox →
Settings → Payments → Payment methods → For your platform account → Create → New
configuration → Next → name **Take a Seat bookings — cards** → Create configuration.
Inspect defaults (the live UI enabled Cards and Link despite documentation saying
methods start off); leave Cards on and disable Link and all other non-card methods.
Copy that sandbox `pmc_…` into the runtime configuration for rehearsal. Do not use
the live ID with a sandbox key. For live cutover verify first creator's live Connect
recipient/transfer readiness, set matching live API/signing/config values and enable
the live webhook together. No uncontrolled real-money transaction is authorized.
[Stripe configurations](https://docs.stripe.com/payments/payment-method-configurations).

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

Guest browser joining is **blocked**: Zoom reports another meeting in progress.
The host portal shows the existing **Take a Seat Onboarding** call in progress. It
was not created by this rehearsal; permission to end it is pending. Two-participant
joining, audio/video, duration and overrun behavior are therefore not verified.
Minimum: one Take a Seat-owned paid/licensed dedicated host, S2S app activated,
five granular meeting scopes, four Worker settings and a two-participant joining
test without the owner present. One host supports one simultaneous booking lane
in this implementation, with 15-minute buffers. Add licensed host IDs for overlapping
creators; do not assume one account permits unlimited simultaneous meetings.

Use [Zoom production setup](zoom-production-setup.md) for exact app navigation,
scopes and values. Both participants join without host privileges; no host key or
start URL is shared. Verify join-before-host, waiting-room/authentication settings,
duration and overrun behavior with the actual plan. Plan capacity is verified;
actual unattended participation and application-enforced capacity are still rehearsal
gates. No extra license or broad user-management scope is required.

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

[PR #37](https://github.com/annabelfilippini/take-a-seat-platform/pull/37) is open/draft,
mergeable against GitHub main `12f142ff01f0fa266ab0dbfa86a85e8afeb056a3`; zero reviews,
zero inline review comments, zero status checks, and no GitHub Actions workflows.
There is no CI pass to claim. Local release checks passed as recorded above.
Required migration/config/docs are included. No known failing local application
journey was found, but external gates mean **do not merge/deploy for launch yet**.

Full PR #37 rehearsal: **BLOCKED / NOT RUN**. Zoom API-only rehearsal passed; the
occupied host and unverified matching Stripe runtime configuration still prevent
customer→authorization→accept→capture→one Zoom→one Calendar→same-link email proof.
Previously successful Meet/sandbox rehearsal is not proof for this Zoom release.
Automation can inspect provider records, exercise configured test payments/retries,
and verify D1/email delivery. Account-owner steps remain Google consent/verification,
Zoom license/app access and two-device participant joining; use only controlled
identities and a verified sandbox payment key.

Post-deployment full smoke: **NOT RUN because no deployment**. Read-only checks of
the currently serving homepage, sign-in, creator entry, directory and privacy returned
200 after migration; `/e2e-control` returned 404. These checks do not prove login or
save persistence. Release smoke must still cover exact acceptance deep link, returning
login, profile save/refresh, availability save/refresh, published profile/session
selection, Requests, Payments, API/console/network failures and narrow/mobile layout.

Once gates pass: recheck exact PR head/main, rerun changed-code checks, merge reviewed
commit, deploy from clean main, record commit SHA and Worker version/traffic, confirm
cron invocation and perform the full smoke above. Annabel's conditional deployment
authorization applies only once these blockers are resolved.

## Current setup checkpoint

Annabel authorized autonomous provider setup, credential storage in Cloudflare and
controlled real-provider testing, followed by the next unresolved audit blocker.
PR #37 must remain undeployed until the release blockers and rehearsal requirements
are addressed. Zoom app/secrets/API checks are complete, with guest joining blocked
by an unrelated active owner call. Google domain verification TXT is prepared but
not saved; the tool-required confirmation to establish the same owner's verified
Search Console access is pending. No credentials have been displayed, saved in
documentation or committed.

Remaining launch blockers: unattended Zoom participant rehearsal, Google production/test-creator
eligibility, matching Stripe runtime configuration and live webhook/Connect readiness,
final cancellation/reschedule/response policy, real-provider Zoom rehearsal, then
reviewed deployment, production cron and complete production smoke verification.

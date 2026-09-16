# Zoom setup and booking release report

September 16, 2026. The account owner and one licensed **Zoom Workplace Pro
(Named Host)** user are verified in Zoom. Annabel approved one simultaneous
Take a Seat meeting for the first-creator launch; no additional license is needed
or authorized. The Server-to-Server app is activated with exactly the five scopes
below. All four Zoom values are encrypted production Worker secrets. The actual
integration passed real Zoom API creation, lost-response recovery, repeated and
concurrent execution, host/link validation, rescheduling and deletion. Unattended
two-participant joining is unverified. The old occupied-host state cleared without
ending a real meeting; the new guest test reached final legal acceptance.
No plan was purchased and PR #37 was not deployed.

Follow-up audit: production migration 0025 is now applied, Google public branding
URLs and exact Calendar scope declarations saved, and a separate live card-only
Stripe configuration prepared. Zoom's API terms and exact app access were explicitly
approved by Annabel. See the
[current release audit](first-creator-release-audit-2026-09-16.md)
for observed provider settings and remaining gates. The cancellation
implementation and request deadline were explicitly approved for first launch.
Customer cancellation/rescheduling remains support-managed without self-service promises.

## Recommended initial account

Use a Take a Seat-owned paid Zoom Workplace account and its licensed account owner
as the first dedicated host. One configured host allows one simultaneous Take a
Seat session. Buy/add more licensed users only when simultaneous sessions are
needed; each can become another host in the pool. Creators do not connect Zoom.

Basic/Pro users support one concurrent hosted meeting. Zoom documents up to two
for licensed Business/Education/Enterprise users, with host/alternative-host start
requirements. This implementation conservatively uses one per user even on those
plans. It does not infer licensing from an email or assume unlimited capacity.
[Zoom concurrent hosting limits](https://support.zoom.com/hc/en/article?id=zm_kb&sysparm_article=KB0068522).

For unattended participation, enable join before host and disable waiting room and
mandatory authentication for these dedicated hosts; keep passcodes enabled. The app
uses generated meeting IDs, a passcode and join-before-host five minutes early, with
recording disabled. Enable the host's **Participants can join 5 minutes before start
time** checkbox as well as join-before-host. The real rehearsal found that Zoom
returned `jbh_time=0` while that checkbox was unchecked, despite the create request
specifying five minutes. The host setting is now saved and real API readback returns
five minutes. The backend now rejects a differing returned limit; see BUG_LOG.
Verify no locked account/group setting overrides those choices.
Both creator and customer join as participants. They have no host moderation/recording
controls. If those controls become a product requirement, change the hosting model;
never send a start URL or host key to customers.
[Zoom unattended joining](https://support.zoom.com/hc/en/article?id=zm_kb&sysparm_article=KB0058759).

## Create the integration

1. Sign into the Take a Seat account at [Zoom App Marketplace](https://marketplace.zoom.us/).
   Open **Developer → Created apps → Develop → Build an app → Server-to-Server OAuth**.
   Use an account owner/admin with permission to manage S2S apps.
2. Name it “Take a Seat booking meetings”. Fill company and developer contact details.
3. On **App credentials**, copy Account ID, Client ID and Client Secret directly into
   the secure configuration below. Do not paste secret values into chat or Git.
4. Add only these granular admin scopes. No recordings, contacts, user management,
   Calendar or broad account-write scopes are needed.

| Scope | Purpose |
| --- | --- |
| `meeting:write:meeting:admin` | Create a session under an assigned account host |
| `meeting:read:list_meetings:admin` | Preflight host access and find a creation whose response was lost |
| `meeting:read:meeting:admin` | Verify meeting host, marker, safe join URL and actual join settings |
| `meeting:update:meeting:admin` | Reschedule the existing meeting |
| `meeting:delete:meeting:admin` | Delete the owned meeting after cancellation |

5. **Activate** the app. No creator consent/OAuth flow is used. The backend obtains
   a short-lived account-credentials token, used only server-side.
6. Obtain the first host's opaque Zoom user ID. If you only have their account email,
   use Zoom's API explorer to create one disposable scheduled meeting via
   `POST /v2/users/{host-email}/meetings` using this app. The result's `host_id` is the
   value to save. Delete that disposable meeting using its returned meeting ID. Do
   not copy its host `start_url`. The production config expects user IDs, not emails.

[Official S2S setup](https://developers.zoom.us/docs/internal-apps/create/),
[account-credentials authentication](https://developers.zoom.us/docs/internal-apps/s2s-oauth/),
[meeting API operations and scopes](https://developers.zoom.us/docs/api/meetings/).

## Exact runtime configuration

In Cloudflare Dashboard → Workers & Pages → **take-a-seat-platform** → Settings →
Variables and Secrets, configure these as server-side secrets. Save any pending
configuration without deploying until the code/migration release is approved.

| Name | Value source |
| --- | --- |
| `ZOOM_ACCOUNT_ID` | S2S app Account ID |
| `ZOOM_CLIENT_ID` | S2S app Client ID |
| `ZOOM_CLIENT_SECRET` | S2S app Client Secret |
| `ZOOM_HOST_USER_IDS` | JSON array of actual licensed host IDs, initially `["YOUR_HOST_USER_ID"]` |
| `STRIPE_BOOKING_PAYMENT_METHOD_CONFIGURATION` | Dedicated Stripe `pmc_…` configuration enabling only cards/card wallets, matched to test/live mode |

Use the same names in ignored `.dev.vars` locally; `.dev.vars.example` contains
placeholders only. No value should have a `NEXT_PUBLIC_` prefix. Existing Stripe,
Google and Resend secrets remain required. Restrict the Stripe key to required
Checkout/PaymentIntent reads and writes, refund reads/writes and existing Connect
operations. Destination-charge refunds reverse transfer and application fee.

The existing branded sender remains `Take a Seat <applications@takeaseatwith.com>`.
No creator Gmail permission or sender impersonation is used.

Stripe's actual charge `capture_before` supplies the deadline; this implementation
sets a 24-hour product response SLA with additional provider/session-time margins.
[Stripe authorization and capture](https://docs.stripe.com/payments/place-a-hold-on-a-payment-method).

## Before production release

1. Verify the named host is licensed, dedicated to Take a Seat and configured for
   unattended joining. Record the plan, user ID, verified capacity and date here.
2. Rehearse with Stripe sandbox, a real creator Google Calendar and Resend: authorize
   without charging, accept once, verify one capture, one Zoom meeting, attendee
   invitation and confirmation email with the same participant link.
3. Join as two separate participants without the account owner present. Verify video,
   duration, passcode and no waiting-room/authentication block. With multiple hosts,
   run overlapping sessions on separate hosts. Verify a full host pool rejects an
   acceptance before charging. Test end-of-session overruns operationally.
4. Rehearse decline, real capture deadline/expiration, reschedule, full refund with
   transfer/fee reversal, and cancellation of the correct meeting/event.
5. Apply generated migration 0025 to D1, configure secrets, verify the Worker cron
   (`*/5` minutes) is active, then deploy only from reviewed committed code after
   Annabel approves. Verify live scheduler retry/expiration in Worker logs.
6. Existing live Stripe/Connect and Google OAuth production readiness gates still
   apply. Do not enable real-money bookings just because the local suite passes.

## Local verification and limitations

### Real Zoom API evidence, September 16

An isolated loopback harness invoked the actual `reserveZoomHost`,
`ensureBookingZoom`, `withBookingLock`, `syncBookingZoom` and `releaseZoomHost`
helpers against isolated SQLite through the application's D1 statement interface.
Credentials existed only in process/browser memory and encrypted Cloudflare secrets.
Zoom requests were real; no payment, customer email or production booking was made.

- OAuth token scopes matched the five documented scopes exactly.
- A second creator's overlapping booking was rejected with one configured host.
- Exactly one create request succeeded per disposable booking. Dropping that real
  response before application persistence caused marker-based recovery, not another
  create. Sequential and concurrent retries kept the same meeting.
- Zoom's returned host matched the licensed owner; its participant URL matched the
  stored booking URL. No host start URL was stored in the booking.
- Corrected settings: five-minute early join, waiting room off, mandatory
  authentication off, generated meeting ID, passcode present, recording off.
- Rescheduling patched the same meeting once; repeating it made no extra patch.
  Cancellation deleted it once; GET returned 404/code 3001 and the host list had no
  matching meeting; the reservation was released.

Three sequential disposable booking runs covered initial discovery, corrected API
verification and the guest-join attempt. Each created one meeting; all three were
deleted and verified absent. The loopback harness is stopped. Follow-up application
fix commit: `190353d`; no credentials were written to the temporary harness or repo.

The earlier guest attempt reported **The host has another meeting in progress**.
On final follow-up the existing **Take a Seat Onboarding** entry shows Launch and
no active owner call was visible. No legitimate meeting was terminated or deleted.
A fresh API run passed the same recovery/reschedule/single-host checks. Its stored
participant URL opened an unsigned-in guest prejoin. Final Join explicitly accepts
Zoom's Terms/Privacy and is awaiting action-time human approval. Do not count joining,
two-participant media, duration or overrun checks as passed. Personal calls on this
host can still block booked sessions; dedicate it during booked hours. The fresh
disposable meeting was then deleted once and verified absent; its reservation was
released and the temporary harness stopped. A new disposable meeting is needed
after legal acceptance is approved.

Cloudflare secret-only configuration produced version
`4a05c6c9-5ad0-4a78-8e71-617c27c93918` at 100% traffic. All 129 code-module hashes
matched the previously deployed version `118d3598-0f2c-4bc4-8223-c5566bbae692`.
No PR #37 Zoom implementation was present in that deployed code before or after.

After the discovered early-join bug fix, lint, TypeScript, production build,
**87 Node tests and all 35 Playwright journeys passed**. The historical table below
records the earlier pre-provider run; it is not the only verification performed.

The tests use real application routes, isolated local D1 and browser contexts; Stripe,
Zoom, Google and Resend are intercepted at the server transport boundary. Real
payment-method entry, provider inbox delivery and Zoom licensing cannot be proven by
these fixtures. They remain explicit external verification gates.

The workflow architecture, idempotency boundaries, state transitions and recovery
runbook are in [booking-confirmation-workflow.md](booking-confirmation-workflow.md).
Final release checks passed on September 16, 2026:

| Check | Result |
| --- | --- |
| `npm run lint` | Passed |
| `npx tsc --noEmit --incremental false` | Passed (Worker types generated with `npm run typecheck`) |
| `npm test` | Production build and **86 Node tests passed** |
| `npm run test:e2e` | **35/35 Playwright journeys passed**, one worker, no retries, 1.4 minutes |
| `git diff --check` | Passed |
| Visual QA | Desktop customer time selection and 390px creator Requests/customer confirmation inspected; no clipping/overlap found |
| Browser errors | No unexpected feature console/page/network failures in the passing suite |

The browser release run includes the original 29 creator/customer/Calendar journeys
and six new workflow journeys: chained lost capture/Zoom and Calendar/email failures;
authorization expiration and slot reuse; full-refund cancellation including payment
history; cross-creator ownership and central host capacity; interrupted rescheduling;
and cancellation after uncertain meeting creation. It checks refreshed/returning
creator state, customer revisit, duplicate approval, the same Zoom URL, private-note
exclusion, invitation attendee and update behavior, and no repeated successful steps.

The Node suite additionally proves full-vs-partial capture, signed webhook replay,
actual provider deadlines, abandoned leases, atomic competing creator reservations
and expansion to a second licensed host. Provider calls in these suites are fixtures;
none of these results claims a real Zoom meeting or real money was exercised.

Adversarial review fixed missing expiry/recovery, private notes in Calendar/ICS,
split reschedule capacity writes, cancellation after uncertain creation, stale Meet
copy, disappearing refund history, and webhook partial-capture acceptance. Root
causes and regressions are recorded in [BUG_LOG.md](BUG_LOG.md). No known failing
application-controlled scenario remains in the release suite.

Zoom create has no general idempotency key. Uncertain outcomes are reconciled by
host and hashed booking marker and never blindly recreated. Operator intervention
can be necessary. Email retries stop before Resend's 24-hour idempotency window
expires instead of risking duplicate sends.
[Resend key retention](https://resend.com/docs/dashboard/emails/idempotency-keys).


Destination-charge refund parameters follow [Stripe's refund API](https://docs.stripe.com/api/refunds/create):
the full refund reverses the destination transfer and refunds the platform fee.

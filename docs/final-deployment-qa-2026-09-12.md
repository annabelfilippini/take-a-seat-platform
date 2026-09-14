# Final deployment QA — September 12, 2026

## Verdict

The creator UI release is live and its regression checks pass. **Do not treat this
as approval for a complete creator setup or paid booking launch.** Calendar has
both a production OAuth domain problem and a confirmed runtime failure after
payment. Security and reservation issues below also remain open.

Reviewed source: `9fe06c6`, with no source diff against merged main `843c3a8`.
Observed production version: `dbb8d1bb-80c0-4abc-8ca6-8aae85798611`, 100% traffic,
deployed September 12 at 17:55 Pacific. The separate release task performed the
deployment. This QA made no production configuration, source, account, payment,
calendar, or saved profile changes. Only this report was added to the worktree.

## Launch blockers

### P1: Calendar confirmation throws after a booking is paid

`app/_lib/google-calendar.ts:221` calls `getTokenEncryptionKey`, but this module
neither defines nor imports it. The encryption path at line 206 has the same
problem. A function with that name exists privately in the OAuth shared module;
it is not available here.

Local reproduction used the real calendar domain code, SQLite/D1 adapter, a paid
booking and an unexpired test connection. Result: `ReferenceError:
getTokenEncryptionKey is not defined`; the booking remains `paid`. Execution
fails before token decryption or any Google request. No external calendar or
payment action was performed. `tsc --noEmit --incremental false` independently
reports both missing references. Normal lint/build and all 51 tests pass despite
this defect.

Restore a shared key derivation helper compatible with OAuth token encryption.
Test token decryption, refresh and actual event creation, including the case where
payment has succeeded and calendar creation must be retried.

### P1: Google OAuth returns to the wrong host

After the new release, the actual signed-in dashboard Connect calendar button
still sends this redirect URI to Google's account chooser:

`https://take-a-seat-platform.annabelflip1.workers.dev/api/google-calendar/oauth/callback`

The initiating host is `takeaseatwith.com`. The nonce cookie is host-only
(`app/api/google-calendar/oauth/shared.ts:75`), and callback validation requires
it (`app/api/google-calendar/oauth/callback/route.ts:58`). The configured host
mismatch prevents the intended return flow. Consent was not granted during QA.

Align the Worker redirect URI and Google's authorized URI with the canonical
HTTPS domain, then complete the actual dashboard-to-Google-to-dashboard flow.
The signed-in dashboard also ignores calendar success/error/cancellation query
parameters (`app/creators/dashboard/page.tsx:31`), so show an explicit result.

### P1: Booking availability does not prevent all conflicts

`app/_lib/bookings.ts:91` checks recurring rules and existing Take a Seat bookings,
but never Google free/busy. A creator's external appointments remain bookable.
The public modal also derives slots from rules/fixtures without subtracting
existing Take a Seat bookings; those conflicts are caught only on submission.

Reservation is a separate check and insert (`app/api/bookings/request/route.ts:162`
and `:194`). A local concurrency probe through the real domain functions allowed
both requests for the same creator/time and stored two bookings. No Stripe
request was made. Use an atomic reservation with expiry and conflict validation
before opening unattended paid bookings.

Buffer enforcement has a separate gap: with a 15-minute buffer, an existing
approved booking ending at 09:30 did not block a 09:30 request in a local probe.
Slot spacing uses buffer values, but overlap comparison does not expand existing
appointments (`app/_lib/bookings.ts:136`). This matters when bookings span mixed
seat durations or the creator changes their schedule.

### P1: Plain HTTP serves the application form

Read-only requests to `http://takeaseatwith.com/`, `/creators/onboard`, and
`/sign-in` returned HTTP 200, no redirect and no HSTS header. The application
page contains a relative POST action `/api/creators/profile`. An HTTP visitor
can therefore remain on an unencrypted form path. No form was submitted.

Enforce HTTP-to-HTTPS before collecting real applicants' contact details.
Choose one canonical hostname as well: HTTPS www and the Workers endpoint both
currently serve the application without canonical redirects. Verify OAuth and
session behavior on the allowed host after configuration changes.

### Paid launch gate: Stripe still needs end-to-end proof

The current secret-name inventory includes both `STRIPE_WEBHOOK_SECRET` and the
staged `STRIPE_LIVE_WEBHOOK_SECRET`; existence does not prove mode, values or
working payment delivery. No key values were read. The independent Stripe audit
records a disabled live webhook and no completed app booking rehearsal. This
review did not change or independently reactivate that configuration.

Complete sandbox authorization, creator acceptance/capture, transfer/fee,
webhook, notification and calendar confirmation before live operation. See
`stripe-launch-readiness-2026-09-12.md` for live credentials, creator onboarding,
expiry, cancellation and refund requirements.

## Other confirmed findings

| Priority | Finding and evidence | Next action |
| --- | --- | --- |
| P2 | Open redirect: the real booking request route accepts a return path consisting of slash, backslash, then `example.com`; its Location header points off-site. `getSafeReturnTo` only rejects double forward slashes (`app/api/bookings/request/route.ts:75`). Similar guards exist in other redirect routes. Reproduced locally with no booking data or external request. | Normalize with URL parsing, require the expected origin, reject backslashes/control characters, and centralize the guard. |
| P2 | Ella's fallback dates ignore the clock and requested window (`app/_lib/availability.ts:179`). With a locally simulated January 2027 clock, the September 17, 2026 slot still matches server validation. | Expire seed slots and apply notice/window rules to fixtures too. |
| P2 | Booking modal displays 6:30 AM for a 9:30 AM Eastern slot without showing the viewer timezone. Confirmed desktop and mobile. | Name the timezone beside slots and confirmation details. |
| P2 | Keyboard focus escapes the booking modal: Shift+Tab from Close focuses background Find Availability; Tab from the final payment button also leaves. Escape does not close it (`app/with/ella/CustomerBookingFlow.tsx:114`). | Manage initial focus, trap focus, make background inert, support Escape and restore trigger focus. |
| P2 | Settings says Text On, but the Worker secret inventory has no Twilio credentials. This indicates a preference, not an operational SMS channel. | Show delivery availability separately from preferences and test before promising texts. |
| P2 | `/with/ella` still says “Profile preview for Ella’s first Take a Seat mockup.” Static Annabel and Amber routes also remain directly reachable. | Decide which demo pages should remain public and remove prototype copy before buyer outreach. |
| P3 | Booking JSON `{` and `null` throw uncaught SyntaxError/TypeError in the real request route (`app/api/bookings/request/route.ts:89`). | Return controlled 400 responses for malformed bodies. |

Calendar event insertion also lacks a stable event ID: the booking ID is used
only as the conference request ID (`app/_lib/google-calendar.ts:116`). Once the
missing helper is fixed, rehearse a successful Google insert followed by failed
D1 persistence; a retry should reuse the event rather than sending duplicate
invites. This is a code-review risk, not a live duplicate-event reproduction.

## Verification matrix

| Check | Result and limits |
| --- | --- |
| Isolation | Source snapshot and test build in `/private/tmp/tas-final-qa-20260912`; no build writes into the active deployment checkout. |
| Standard lint | Passed. |
| Production build and automated suite | Passed, 51/51. Includes real route/domain lifecycle tests with SQLite/D1 and mocked providers. |
| Additional TypeScript check | Failed: 18 diagnostics, including the missing calendar helper, missing Worker type declarations and existing type narrowing/generic issues. Build is not a typecheck. |
| Production dependency audit | `npm audit --omit=dev`: zero reported vulnerabilities. Dev/build dependencies were outside this scan. |
| D1 migration status | Independently read from production: no pending migrations. |
| Worker secret names | Clerk, Resend, Google OAuth/encryption and Stripe bindings present; no values read. |
| HTTP route sweep | 23 paths: expected success, redirects, unauthorized responses and 404s; no 5xx. Includes public, sign-in aliases, creator/admin gates, missing booking/profile and callback errors. |
| Asset sweep | All 36 extracted same-origin image/CSS/JS assets returned 200. This is not a crawl of external social destinations or every lazy asset. |
| Anonymous access | Creator account API 401; dev login 404; creator dashboard and both admin pages show sign-in gates with no application table. |
| Public browser interactions | Directory category empty state and submitted search no-result state work; Ella card opens; rating is removed. |
| Mobile public pages | Mission and sign-in at 390 px; application expanded navigation at 390 and 320 px. No observed clipping/overlap in these states. |
| Booking browser QA | Desktop 1440×900 and mobile 390×844: open, date/time selection, customer form, reachable payment control and close. Keyboard issues noted above. No request or payment submission. |
| Creator browser QA | Existing authenticated profile plus Availability, Payments and Settings. Recurring notice and empty schedule present; a slot toggled on/off locally without Save. Mobile grid scrolls within its container; no document overflow. |
| Browser console | No error/warning entries captured in this QA tab. This does not resolve the earlier report of intermittent hydration errors. |
| Working tree hygiene | Existing changes preserved; tracked env-file check found only `.dev.vars.example`. No secret values or applicant records were added to this report. |

## Explicit verification gaps

- No fresh real application, acceptance email, OTP, exact emailed invite, upload,
  saved profile, saved schedule or notification preference was exercised in
  production. Existing lifecycle regression tests passed. The earlier exact-link
  success remains historical evidence in `creator-onboarding-lessons.md`.
- No account switching occurred. The existing user's session was preserved and
  temporary browser viewport overrides were reset.
- No fresh Resend delivery/inbox confirmation, Twilio message, Google consent,
  free/busy query, token refresh, event creation, or Stripe end-to-end rehearsal.
- Live saving the existing private test profile would publish it under current
  behavior, so no Save button was used.
- No load test, penetration test, exhaustive accessibility audit, or mobile-device
  hardware test. Responsive QA used actual Chrome viewports.

## Recommended next release

Fix HTTPS enforcement and both calendar blockers first. Add the failing calendar
path to behavioral tests and make TypeScript checking a reliable release check.
Then implement atomic reservations, external busy checks, buffer enforcement and
calendar retry idempotency. Fix redirect validation and the booking modal before
buyer outreach. Rehearse one authorized fresh creator through the actual email
link, saved setup, sandbox booking and delivered calendar invitation. A successful
UI deployment alone is not evidence that the full marketplace works.

Temporary local evidence: `/private/tmp/tas-final-probes.log`,
`/private/tmp/tas-final-types.log`, `/private/tmp/tas-http-qa.json`,
`/private/tmp/tas-final-audit.json`. These files contain test fixtures and check
results, not production credentials. Source reproductions are isolated under
`/private/tmp/tas-final-qa-20260912/tests/final-probes.mjs`.

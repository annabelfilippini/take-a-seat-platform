# Google Calendar production implementation

Audit: September 16, 2026, starting at e562611 on codex/google-oauth-production.

## Architecture found before edits

Vinext routes execute on a Cloudflare Worker. Clerk identifies creators; D1 stores
creator ownership, availability, bookings, and Calendar connections. OAuth starts at
`/api/google-calendar/oauth/start` and returns to the existing
`/api/google-calendar/oauth/callback`. A signed ten-minute state and HttpOnly nonce
cookie guard the callback. Start checks creator access, including an admin override;
the callback previously relied only on state/cookie, without rechecking identity or
consuming a server-side attempt. The return path opens the creator Availability tab.

Runtime variables: GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET and
GOOGLE_TOKEN_ENCRYPTION_KEY. GOOGLE_OAUTH_REDIRECT_URI in the example is obsolete:
the callback is derived from the request origin after production canonicalization.
Tokens are AES-GCM encrypted in creator_calendar_connections. Its creator/provider
unique key prevents duplicate connections. Refresh preserves rotated refresh tokens.
The previous callback could mix a new account's access token with an old refresh token.

Scopes already requested: calendar.freebusy and calendar.events.owned. Endpoints:
OAuth token exchange/refresh, POST /calendar/v3/freeBusy, POST owned primary events
with sendUpdates=all and conferenceDataVersion=1, GET that deterministic booking
event on retry. No private event listing. Events contain booking/customer details,
a customer attendee and Google Meet conference. D1 stores event ID and HTML link.

The approved CustomerBookingFlow generates slots from saved rules in the browser.
Reservation checks schedule, bookings/holds, Google free/busy and an atomic D1
snapshot. Displayed slots did not exclude conflicts. Creator acceptance checked
Google again but not the complete current schedule/booking constraints. Dashboard
connection state and publishing depended on historical calendarConnectedAt.
There was no in-app disconnect or event update/delete boundary. A public /privacy
page and homepage link already existed on this branch, not proven deployed.

Implementation and release evidence below will distinguish local application tests
from real Google consent, Cloud configuration and production deployment.

## Changes made

The existing public paid booking layout, call selection, date/time selection,
details step and payment button positions are preserved. CustomerBookingFlow now
loads filtered monthly slots from `GET /api/bookings/availability`; preview-only
rendering can still show the saved schedule without making live provider calls.
The endpoint returns available slot data only and has no shared cache. It combines
saved hours, Google primary-calendar busy intervals, bookings/holds and buffer/limit
rules. Checkout repeats its existing atomic reservation check. Acceptance now
validates saved hours, historical duration, Google conflicts, other bookings and
holds, then compares the same D1 snapshot when claiming the decision after Google's
response. A changed schedule during provider latency cannot proceed to capture.

OAuth retains the existing callback and signed state/HttpOnly SameSite cookie
architecture. HMAC verification uses Web Crypto. Start and callback both require
the creator's authenticated ownership, not an admin-selected creator. D1 stores and
atomically consumes a ten-minute nonce/actor/creator attempt. Callback errors are
sanitized, access/refresh tokens stay encrypted server-side, and a reconnect needs
both scopes and a newly issued refresh token. A primary free/busy request must
succeed before saving the new grant. No expanded scopes or Google SDK dependency.

The dashboard and publication check use a current free/busy probe and offline/scope
checks instead of `calendarConnectedAt`. The UI exposes Connected, Needs attention,
Not connected, Reconnect and Disconnect; refresh/focus rechecks status. Provider
outages preserve the stored grant and saved hours. Disconnect deletes the local
credentials and pending attempts, clears the historical timestamp, requests Google
revocation and reports when Google could not confirm it. Existing bookings and
Google events are retained. Explicit disconnection stops Google's influence on
shown schedule times, while payment reservation/acceptance stays paused until
Calendar can deliver the confirmed appointment. It does not silently ignore a
broken connection that is still configured.

Calendar writes use deterministic event IDs and persist the attempted association
before insertion. A returned organizer calendar ID pins the original destination.
If an insertion's response was lost, a reconnect can recover the original event,
but cannot blindly recreate it on another account. Customer attendees use Google's
`sendUpdates=all`; patching preserves RSVP data. A future Zoom integration can supply
`meetingUrl`; until then the existing Google Meet creation remains in use.

`POST /api/bookings/[bookingId]/calendar` is creator-owned and checks Origin. With
no JSON body it retries synchronization from committed D1 state. With JSON
`{ "appointmentStartAt": "YYYY-MM-DDTHH:mm:ss", "timezone": "America/Los_Angeles" }`
it calls the prepared confirmed-booking reschedule service: validate, conditionally
update D1, then patch the same event. A per-booking lease and Google's ETag prevent
outgoing mutation races. If Google succeeded but persisting sync status failed,
retry compares the event before sending another update. Failed synchronization
keeps the booking and event association available for retry.

Cancellation synchronization consumes an already committed `cancelled` booking
and deletes only its deterministic stored event with matching booking metadata.
A 404 from a newly connected account is not proof that the original event was
deleted. Cancellation/refund business policy and a customer rescheduling UI are
not introduced here. The future cancellation service must serialize changes with
the same booking synchronization boundary; the Playwright cancellation fixture
supplies the authoritative cancelled record to test this boundary safely.

## Database and deployment prerequisites

Apply the generated additive migrations in order before an approved release:

1. `0021_zippy_taskmaster.sql`: one-use Google OAuth attempts.
2. `0022_dark_peter_parker.sql`: original Google calendar ID, synchronized revision,
   optional meeting URL on bookings.
3. `0023_striped_dexter_bennett.sql`: per-booking sync lease and expiry.
4. `0024_open_glorian.sql`: Google connection generation associated with insertion.

All were exercised from a fresh local D1 database by Playwright and independently
through SQLite-backed domain tests. No existing migration is edited. Required
Google secret names remain GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET and
GOOGLE_TOKEN_ENCRYPTION_KEY. Runtime values and keys were not exported or changed.
The approved September 16 deployment and remote migration/secret confirmation
are recorded below. Real Google/Stripe rehearsal remains a marketplace launch gate.

## Privacy and least privilege

The existing public `/privacy` page now explains interval-only conflict checks,
owned booking event updates/cancellations, in-app disconnect and retention of saved
Take a Seat hours/bookings. Existing homepage linking remains; Availability adds a
policy link and states that only the primary calendar is checked. The policy does
not claim that Zoom, automated deletion of all retained records, or new refund
features already exist. Final scopes and endpoint-by-endpoint justification are in
[the production configuration pack](google-oauth-production-readiness-2026-09-16.md).

## Security review

| Risk checked | Control / result |
| --- | --- |
| Exposed client secret or refresh token | Encryption and exchange remain server-side; built browser assets checked for Google secret names and encrypted-token field names; no matches. Browser status returns an enum only. |
| Sensitive provider errors/logs | OAuth provider error text is replaced with fixed application codes. New provider requests do not log tokens, bodies or authorization headers. |
| OAuth CSRF, replay, ownership switching | Signed expiring state, callback-path HttpOnly cookie, creator ownership at start and callback, consumed D1 actor-bound attempt. Admin cannot attach Google to another creator. |
| Broader scopes | Only calendar.freebusy and calendar.events.owned requested; incremental grant accumulation disabled. |
| Private event leakage | Only freeBusy intervals are read for conflicts; public endpoint serializes eligible slot fields. Existing private events are never listed. |
| Duplicate invitations | Deterministic event ID, durable pre-insert binding, recovery GET and matching private booking ID. |
| Arbitrary modification/deletion | Authenticated booking lookup, deterministic stored ID, original calendar binding, metadata check, lease and ETag. No client-supplied Google event ID. |
| Disconnect authorization | Creator ownership and same-origin POST; preserves booking/availability rows. |
| Calendar/availability race | Final claim/reschedule includes a D1 snapshot comparison after the external check. Google edits cannot be an atomic transaction with D1 or Stripe. |

Review used the adversarial-review-lite skill. Meaningful findings and fixes are
recorded in [BUG_LOG](BUG_LOG.md): false connection state/callback ownership,
incomplete displayed/final conflict checks, missing event lifecycle boundaries,
and the independently reproduced DST crossing bug. No known failing application
journey is being treated as passing.

## Automated and browser verification

The suite exercises the real application routes, server crypto, local Cloudflare
D1 writes and rendered creator/customer UI. Clerk identity, Google consent/token/API,
Stripe and email delivery are explicitly isolated providers. These fixtures are
copied only into a throwaway test app; production builds do not load them.

Calendar coverage includes:

- Actual connection button/start URL, exact scopes, return to Availability, usable
  status, hard refresh, fresh authenticated browser and encrypted persistence.
- Denied consent, missing code, forged signature, expired server attempt, wrong
  cookie, replay with the original cookie, logout before callback, unauthenticated
  connect, another creator's target and cross-origin disconnect rejection.
- Refresh success, invalid grant, partial permissions, missing offline refresh token,
  token-provider outage, Calendar 401/403/429/503 and malformed free/busy response;
  recovery does not fabricate success or overwrite a previous grant on failure.
- Saved schedule plus busy exclusion/unaffected slots, no private-event fields,
  stale slot rejection before Checkout, saved-hours changes before acceptance,
  an edit during the provider check and no premature capture.
- In-app disconnect preserves saved hours and confirmed booking rows; reconnect
  yields one connection row. Google no longer filters the disconnected schedule.
- One confirmed event/customer attendee, duplicate confirmation, validated reschedule,
  same-event patch, lost sync persistence, meeting URL input, cancellation notification,
  retry without duplicate deletion and refusal to touch an unrelated event.
- Lost insertion response, account reconnect, no duplicate event on another account,
  recovery on the original account and inaccessible-calendar cancellation failure.
- America/Los_Angeles creator → America/New_York viewer, spring and fall DST, no
  nonexistent spring times, no duplicated fall slot IDs, and rejection of sessions
  whose end cannot be represented correctly across the offset jump.
- Existing complete paid customer progression, publication, real D1 persistence,
  returning login, competing buyers, signed webhook replays, creator acceptance and
  decline, media and saved-profile regressions.

Desktop (1280×900) and narrow (390×844) creator/customer states were rendered in
Chrome. Viewport screenshots and modal bounds checks verify visible controls and
footer placement. Test screenshots/reports remain ignored under `.wrangler/`.
The exact failed DST reproduction was rerun successfully before the full suite.

Final verification on September 16, 2026:

| Check | Result |
| --- | --- |
| `npm run lint` | Passed, no warnings |
| `npm run typecheck` | Passed |
| `npm test` | Production build and all 82 Node tests passed |
| `npm run test:e2e` | All 29 journeys passed, 0 retries, 0 skipped; about 1.3 minutes |
| `git diff --check` | Passed |
| Built frontend secret/token-field scan | No matches; no fixture provider code in production bundles |
| Desktop/mobile Chrome inspection | Passed; narrow modal/footer bounds verified |

The Node suite additionally forces refresh/reconnect writes within the same
stored timestamp and proves the newer ciphertext cannot be overwritten.
Local proof is complete for these application-controlled scenarios. It is not
proof of deployed Google consent, real provider delivery or Google approval.

## Production deployment: September 16, 2026

Annabel explicitly approved deployment. PR #35 was squash-merged to main
`dca3b8b121d1f119d0ccca7f997ca86be31b1e6a`; its tree exactly matched the tested
branch commit `c3ca3ab`. Deployment ran from that clean committed checkout.

- Required Google, Clerk, Stripe and Resend Worker secret names were present.
  No secret values were exported or rotated.
- Remote D1 migrations 0021–0024 applied successfully; a subsequent list reported
  no pending migrations. An initial read-only D1 check returned Cloudflare 7403;
  after checking the authenticated account and permissions, the retry succeeded.
- `npm run deploy` built and published successfully at 19:09 UTC.
  Worker version `fd9bacc5-4e70-49f8-ab1b-41599b038c73` serves 100% of traffic on
  `takeaseatwith.com` and `www.takeaseatwith.com`.
- Previous Worker version: `ad332d31-0d87-4a44-a76a-03663ce11e37`.
- Live Playwright checks passed in fresh Chrome contexts at 1280×900 and 390×844:
  homepage/privacy link, updated public Calendar privacy text, Ella's published
  page, booking-calendar open/close, real server availability response, refresh,
  invalid OAuth state rejection and unauthenticated connect rejection.
- Both viewports had zero console/page errors or failed HTTP requests. Availability
  responses returned 200 and no token/private-event fields. Screenshots were
  inspected for modal bounds, calendar, time buttons, close control and footer.
- These were read-only public smoke checks. No booking, charge, invitation,
  creator connection or Google Console setting was changed by the smoke run.

The 82 Node tests and 29 complete local Playwright journeys documented above
passed on the identical application tree before deployment. Google production
audience, domain ownership, sensitive-scope verification and real-account consent
remain external steps; this deployment does not claim Google approval.

## Remaining external/product boundaries

- Nothing in this change proves Google Console values, API enablement, Search
  Console ownership or sensitive-scope approval. Use the exact submission pack.
- Real creator consent, revoked-account recovery and invitation delivery must be
  rehearsed after the explicitly approved deployment. Google login challenges
  were not bypassed or automated with real credentials.
- Calendar is primary-only. Busy intervals merge overlapping events; a reschedule
  overlapping the old event may conservatively be rejected. Do not subtract the
  old interval blindly, since that could hide a different private conflict.
- The local start/end plus IANA timezone format uses one deterministic occurrence
  of a repeated hour and excludes sessions spanning an offset change. A future
  UTC-based booking-storage migration can expose the second occurrence explicitly.
- Calendar failures retain authoritative booking state and support explicit retry;
  there is no scheduled retry worker added by this change. An existing paid booking
  with a failed/pending Meet event remains recoverable and must not be charged again.
- An uncertain event insertion after changing Google accounts may require reconnecting
  the original account or operator reconciliation. It fails safely instead of creating
  a second invitation. New-account 404 responses do not certify cancellation.
- Zoom authorization/meeting generation, a cancellation/refund business workflow,
  and customer reschedule controls remain separate product work. The Calendar
  data/service boundaries are prepared and tested without claiming those features.

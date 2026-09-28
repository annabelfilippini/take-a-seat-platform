# Launch rehearsal, September 25–27

Updated September 27, 2026. **Sandbox integration verified; production launch remains gated.**

## Candidate and fixes

The isolated candidate combines booking release `e9c54d5`, current main `35cb5b3`,
and Stripe return-session repair `e32e3fb`, tracked in draft PR #37. The original
shared checkout is preserved. Production has not been deployed or switched live.

Real browser/provider testing found and repaired:

1. Near-term availability could offer a slot after its acceptance cutoff. The common
   generator now enforces the same 30-minute response margin as payment acceptance.
2. Zoom interpreted fractional UTC timestamps as local time. Creation and rescheduling
   now send documented whole-second UTC and still verify the returned meeting time.
3. Stripe’s success URL encoded `{CHECKOUT_SESSION_ID}`, preventing substitution.
   The exact literal template is preserved; other query values remain encoded.
4. A verified Zoom meeting’s title changed to its Calendar event title. Later cleanup
   incorrectly required the original title. Updates now use the verified, persisted
   meeting ID and host; unknown-resource recovery still requires the booking marker.

Root causes and regression protection are in [the bug log](BUG_LOG.md).
The approved customer time-selection layout and payment progression are unchanged.

## Real services connected

- Separate Google project `take-a-seat-development`, Calendar API enabled, External /
  Testing, owner test user, web OAuth client with the local callback only. Owner
  granted free/busy and owned-event scopes. OAuth persistence and real Calendar
  reads/writes succeeded. Production Google configuration was not changed.
- Existing restricted Stripe test application key and matching card-only payment
  configuration. Official CLI authorized for the existing test environment; actual
  signed authorization, completion, capture and cancellation events returned HTTP 200.
  The September 25 listener expired; restarting September 27 refreshed existing access
  with the same signing secret. No extra account authorization was needed.
- Existing development Clerk authentication, branded Resend sending credential,
  and existing Zoom S2S app/single licensed host. No credential widening or rotation.
- Secrets remain in ignored local configuration with private permissions, not Git.
- Existing sandbox recipient reused in isolated D1 after Stripe reported transfers
  active. This was local setup, not a repeat test of hosted recipient onboarding.

## Real-service evidence

The approved Annabel test identity was clearly labeled throughout. No real money moved.

| Journey | Result |
| --- | --- |
| Application, acceptance email, original invitation link, normal creator authentication | Passed with real delivery and isolated D1 |
| Saved profile, publication, dated availability and customer data | Passed; persisted data supplied public booking flow |
| Hosted $45 sandbox authorization and signed webhooks | Passed; no capture before creator acceptance |
| Creator acceptance and capture | Passed; Stripe reported $45 captured and $6.75 platform fee |
| First Zoom failure and scheduled recovery | Wrong time was detected and invitation withheld; controlled repair reused the same meeting and recovered confirmation |
| Fresh Zoom booking after timestamp fix | Passed without manual repair: September 29, 13:00 Los Angeles equals 20:00 UTC, 15 minutes, five-minute early joining |
| Calendar and branded confirmation | Matching time and Zoom link delivered to test inbox; customer confirmation persisted after reload |
| First cancellation | Full $45 refund succeeded, destination transfer fully reversed, Zoom meeting returned 404, Calendar cancellation and branded refund email arrived |
| Corrected hosted return URL | Fresh checkout returned `booking=authorized` with an actual session ID handled by the server |
| Decline before capture | Creator and refreshed customer page showed declined; branded decline email delivered |

The second cancellation exposed the mutable-title check described above. After its
repair, the real scheduled handler returned HTTP 200 and persisted complete cleanup.
Zoom returned 404, Stripe confirmed a full refund, and both cancellation messages
arrived. The declined payment intent was canceled with zero amount received.

## Automated verification

- `npm run lint`: pass.
- `npm test`: production build and **92 Node tests pass**.
- `npm run typecheck`: pass.
- `TAKE_A_SEAT_E2E_PORT=4193 npm run test:e2e`: **40 pass**, no retries, 1.5 minutes.
- `npm run deploy:dry-run`: pass; no publication.
- Actual local secret values scanned against compiled JS/JSON/HTML: zero matches.
- Git diff whitespace checks: pass.

The browser suite uses real local D1 and fixture external providers. It covers
persistence, fresh login, publication, calendar checks, competing decisions,
recovery, rescheduling and cancellation. It is separate from the real-service
journeys above. Desktop/narrow booking controls were visually inspected earlier
in this combined candidate; no later repair changed customer markup.

The controlled Chrome session also reported a streaming-metadata hydration warning.
DOM inspection found the automation extension had replaced favicon URLs inside that
metadata with `data-codex-favicon-badge` markup. Clean Playwright contexts retain
strict console/error checking and passed. No application workaround was added for
that extension mutation. Running builds/browser artifacts alongside the local dev
server also caused HMR reloads; those reloads are not production behavior.

## Review and remaining launch gates

Adversarial review: meeting IDs enter application persistence only after strict
creation/recovery validation. Later synchronization still rejects a foreign host or
meeting ID before writing. Unknown meeting recovery retains its exact marker and
never blindly recreates an uncertain resource. Return URL repair restores only
Stripe’s exact template and leaves all user-controlled values encoded.

1. Finish unattended two-participant Zoom joining. A separate clearly labeled
   disposable meeting is prepared; its Join screen requires action-time acceptance
   of Zoom’s terms. Owner confirmation is pending. No camera/microphone access granted.
2. Resolve production Google External/Testing and sensitive-scope verification for
   durable creator grants. Development approval does not resolve production status.
3. Finish first creator live Stripe onboarding, including owner-entered identity,
   banking and legal details. Last read-only live account listing was empty.
4. Coordinate live application key, card-only configuration and matching signing
   secret. Live webhook remains disabled; do not mix test and live configuration.
5. Recheck remote migrations and required secret names immediately before deployment,
   obtain approval for the exact committed candidate, then verify scheduled recovery
   and the deployed customer/creator flow. Migration 0025 was already applied.
6. A real-money rehearsal needs separate authorization and settlement verification.

The currently deployed Meet flow has its own [September 25 evidence](homepage-booking-rehearsal-2026-09-25.md).
This report covers the newer Zoom candidate and does not claim production launch.

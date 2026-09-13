# Calendar repair and booking rehearsal

Status: code verified locally; production deployment and real provider rehearsal
are still required. This report does not certify paid launch readiness.

## Release scope

Based on GitHub main `843c3a8`, isolated on `codex/calendar-rehearsal`.
The original checkout and its unrelated documentation changes were preserved.
No new dependency, service, migration, or production deployment was introduced.

- Repaired the missing token decryption key helper with a shared, compatible v1
  AES-GCM codec. Expired tokens refresh and rotated refresh tokens are retained.
- OAuth uses the same origin for nonce cookie and callback. Partial permissions,
  rejected consent, malformed cookies, and provider failures do not create a
  successful connection. Dashboard notices distinguish success and failure.
- Booking requests check Google free/busy and buffers before Checkout. Acceptance
  checks again before capture. Missing/revoked calendars fail closed.
- A conditional D1 insert compares the creator's booking snapshot atomically.
  Competing requests cannot both reserve against the same availability/limit
  check. Session-less requests hold for 30 minutes; attached Checkout sessions
  release through verified expiry/cancellation webhooks, avoiding a delayed
  authorization webhook admitting a second customer.
- Google event IDs are deterministic per booking. A retry after event creation
  recovers the original event and does not send another invitation. A pending
  Meet conference remains recoverable as paid until its video link is available.
- App requests upgrade HTTP to HTTPS; public GET/HEAD requests canonicalize to
  the main domain. Existing HTTPS webhook POST endpoints retain their host.
- Return paths reject backslashes, protocol-relative URLs, and control characters.
- Booking dialogs show the viewer timezone, contain keyboard focus, close with
  Escape, restore trigger focus, and fit 320-pixel screens without clipped days.
- Added a reproducible Worker-aware TypeScript check and repaired the type errors
  exposed by the previous QA.

## Evidence

| Check | Result |
| --- | --- |
| `npm run lint` | Passed |
| `npm run typecheck` | Passed; Worker runtime declarations generated locally |
| `npm test` | Passed, 62 tests including a production build |
| Deployment packaging dry run | Passed, no upload |
| `git diff --check` | Passed |
| Remote D1 migrations | No unapplied migrations |
| Production Worker secrets | Required Google, Clerk, Resend, Stripe names present; values not exported |
| Google OAuth settings | Added canonical callback; reopened client and verified it persisted |

The new integration suite runs actual application, invitation, profile, OAuth,
request, signed webhook, acceptance, and calendar domain/route code against SQLite
through a D1 statement adapter. Google, Stripe, Resend, and signed-in identity are
simulated. This proves local state transitions and failure recovery, not real
email delivery, Clerk sign-in, payment-provider behavior, or Calendar delivery.

Covered failures include wrong OAuth nonce, cancelled/partial consent, wrong token
key, token refresh rejection, external busy time, buffer conflicts, malformed
free/busy results, simultaneous reservations, delayed webhooks, duplicate approval,
persistence recovery after event insertion, and pending Meet creation.

Browser checks used the actual booking component on the local app at 1440x900,
390x844, and 320x740. Date selection, time selection, the complete request form,
keyboard boundaries, Escape, background scroll locking, and focus return passed.
The 320-pixel check caught and fixed clipped calendar columns. Connection notices
were checked on desktop and mobile using the actual editor component with isolated
fixture props. These were UI checks, not a live OAuth connection.

## External change already made

Google Cloud project `take-a-seat-platform`, existing Take a Seat Web OAuth client:
added `https://takeaseatwith.com/api/google-calendar/oauth/callback` to authorized
redirect URIs. Existing redirect URIs were retained. No secret was rotated and no
additional permission scope was requested.

Google documents asynchronous conference creation and client-specified event IDs
in [Create events](https://developers.google.com/workspace/calendar/api/guides/create-events)
and the [Events API](https://developers.google.com/workspace/calendar/api/v3/reference/events).

## Required live rehearsal after approved deployment

1. Confirm the deployed revision and test-mode Stripe context before transactions.
2. Use Annabel's authorized inbox/calendar. Exercise the actual invitation URL,
   preserving its query parameters, and creator account entry. Existing-account
   success must not be reported as proof of first-time account creation.
3. Connect Google from the canonical dashboard; verify persisted connection after
   reload, cancellation recovery, and a real busy period blocking a request.
4. Use a completed Stripe test Connect account. Authorize a test booking, observe
   the verified webhook, accept it, and verify capture plus the platform fee.
5. Verify one calendar event, usable Google Meet link, correct timezone/duration,
   inbox delivery, and an acceptance retry without duplicate capture or invitation.
6. Remove only rehearsal artifacts and restore any modified profile/availability.

## Operational limits and remaining launch gates

- The live Stripe webhook was disabled in the preceding launch audit. This change
  does not enable live payments or switch payment credentials. See
  `stripe-launch-readiness-2026-09-12.md` for that separate launch gate.
- Free/busy is checked against the connected primary calendar. A creator can
  still add an external event after a check; external calendar edits are not an
  atomic transaction with payment capture.
- A paid booking with a pending/failed Meet creation requires an acceptance retry;
  repeated failures need operator intervention. Do not charge again.
- A missing terminal Checkout webhook intentionally retains the slot. Reconcile
  Stripe's actual session/payment state and redeliver its webhook before release.
- Snapshot reservations may reject an otherwise free time when another booking
  changes concurrently. A retry is safe. Query cost grows with creator history.
- Previous QA also flagged SMS showing enabled without Twilio and seed/demo copy.
  Those are outside this calendar repair and remain in the launch checklist.

# Booking confirmation workflow

September 16, 2026. Implementation on `codex/booking-confirmation`; not deployed.
Production setup and real provider delivery are still release gates.

The [first creator release audit](first-creator-release-audit-2026-09-16.md) records
the applied production migration and current provider state. Full creator refunds
were approved during implementation; the latest request reopens final launch-policy
review. This document describes the implemented capability, not settled customer terms.

## Architecture and state

Existing Checkout destination charges, booking snapshots, D1 reservations, Google
OAuth/freebusy and deterministic Calendar events are reused. The approved customer
session/time-selection layout and interactions are unchanged; its provider label
and related instructions now correctly say Zoom. Post-request status
and creator Requests now show authoritative processing/expiry/confirmation states.

| Booking state | Meaning / next transition |
| --- | --- |
| `requested` | Slot held while customer completes Checkout; existing verified Checkout expiry reconciliation remains |
| `payment_authorized` | Funds authorized, not captured; creator can accept or decline before respond-by |
| `approval_processing` | Creator decision persisted; revalidation and capture/reconciliation underway |
| `paid` | Stripe capture verified; time reserved; Zoom/Calendar delivery pending |
| `approved` | Confirmed, Zoom participant URL saved and Google invitation created; email may still be retrying |
| `decline_processing` / `expiration_processing` | Cannot accept; hold retained until Stripe verifies release |
| `declined` / `expired` | Authorization cancelled; customer notification retried independently |
| `cancellation_processing` | Full refund processing; existing reservation retained |
| `cancelled` | Stripe full refund verified; owned meeting/invitation deletion and customer notice recover independently |

The `workflow_step`, retry timestamp, attempt count and safe error describe delivery
separately from the commercial booking state. One shared, renewable five-minute D1
lease serializes acceptance, decline, recovery, cancellation and rescheduling. It
compares its token before external mutations and on release. Calls have timeouts.
The Worker scheduled handler processes up to 25 due bookings in groups of five every
five minutes. Backoff grows from a minute to an hour. No creator click is required
for recovery. Failed initial preflight leaves the request actionable until expiry.

`customer_bookings` is also the durable work queue. Payment transitions enqueue
recovery in the same write. Generated migration `0025_strong_lorna_dane.sql` adds
workflow fields, `zoom_host_reservations` and `booking_deliveries`.

## Payment and expiration

Checkout still uses `capture_method=manual` and destination charges with the saved
platform fee. `STRIPE_BOOKING_PAYMENT_METHOD_CONFIGURATION` must select a dedicated
configuration allowing cards/card wallets only. Do not enable installment payment
methods: some charge a first installment during authorization. The app requires
this configuration ID rather than silently inheriting account-wide payment methods.

Stripe reads expand `latest_charge`. The response deadline is the earliest of:

- 24 hours after request submission (product response SLA),
- one hour before Stripe's `payment_method_details.card.capture_before`,
- 30 minutes before the scheduled session.

The shared availability generator excludes sessions starting in 30 minutes or less,
so a new request has time remaining before the session response deadline. The same
rule rejects stale or forged submissions on the server. Longer creator notice still
applies.

The product SLA is not a claim about card network validity. Missing capture-deadline
information never authorizes capture. Acceptance reads current PaymentIntent status,
manual capture, metadata association, full amount and currency; unknown/unusable
capture information closes the request through authorization release. Scheduler
checks also reconcile older authorizations lacking a stored deadline. Existing
respond-by limits cannot be extended by delayed events.

Expired requests cannot be accepted even if the scheduler is delayed. Stripe cancel
must succeed or already be verified cancelled before the slot is released. A
captured payment encountered during release stops for operator refund review.

Capture uses a stable Stripe idempotency key; recovery reads current Stripe state
before issuing another capture. Webhook replay and late events cannot revive terminal
bookings. Partial/unverified capture does not produce a confirmed booking.

## Slot and host concurrency

Pending requests exclusively hold the creator slot. Existing atomic conditional
inserts compare saved availability and bookings, including times, statuses and
revisions. Acceptance revalidates availability rules, notice, limits, buffered Google
busy intervals, other bookings and holds. Processing/refund states remain blocking.
Reschedules compare the same availability snapshot before committing.

Zoom capacity is global across creators. Each configured licensed host has **one**
simultaneous lane. An atomic conditional D1 reservation rejects overlapping host
intervals, including a 15-minute buffer on both sides. Host access is checked before
capture. Add actual licensed host IDs to expand capacity; do not repeat an ID to
invent capacity. Rescheduling moves the booking and reserved host interval in one
D1 batch transaction. An occupied host blocks rescheduling before any provider edit.

External calendar edits can still happen after the final freebusy read; Google does
not offer a transaction spanning Stripe and D1. Hosts must be dedicated to Take a
Seat, and session overruns require operator management: scheduled duration does not
automatically end a Zoom meeting. See the setup report for the launch rehearsal.

## Provider delivery and idempotency

1. After verified capture, Zoom creates a scheduled meeting under the reserved host.
   Only meeting ID and participant `join_url` are stored. Host start URLs and tokens
   are discarded. Both participants receive the same saved link.
2. A SHA-256 booking marker in the Zoom topic correlates uncertain creation outcomes.
   An attempt is persisted **before** POST. After a timeout/server error or lost DB
   write, recovery searches the assigned host's paginated scheduled meetings and
   verifies marker and host ownership. It never blindly POSTs again. Multiple matches
   or no match require continued reconciliation/operator review, not a duplicate.
   Explicit 400/401/403/404/429 creation rejection permits a later new attempt.
3. Google uses the existing deterministic booking event ID and saved calendar/account
   association. `sendUpdates=all`, customer attendee, times/timezone and saved Zoom
   URL produce the ordinary Google invitation. Private application notes are omitted.
   Customers connect no calendar and get no fabricated RSVP controls. Their own Google
   settings determine whether the invitation appears before acceptance.
4. Branded Resend confirmation uses the existing legitimate Take a Seat sender.
   It states payment processed only after verified capture, includes the original
   amount/time and same Zoom URL, and asks the customer to accept the invitation.
   Creator Requests and the existing in-app notification provide confirmation.
5. `booking_deliveries` saves an immutable email payload, first-attempt time and sent
   time. Successful sends never repeat. Resend's idempotency key handles an uncertain
   send inside its retention window. At 23 hours, automatic sending stops and requires
   reconciliation rather than risking a duplicate after Resend's 24-hour window.

The legacy Google Meet helper remains for already-existing Calendar integration tests
and historical bookings; new workflow confirmation requires a saved Zoom meeting.
Historical approved bookings are not bulk-migrated to Zoom.

## Rescheduling and cancellation

Creator-owned Calendar POST accepts a reschedule. Validate new availability and host
capacity, transactionally commit time/reservation, then recover Zoom PATCH, Google
PATCH of the same event (`sendUpdates=all`) and a reschedule email. IDs and join URL
stay unchanged. The customer time-selection UI is untouched; no new customer self-
rescheduling UI was introduced.

Annabel approved full refunds for creator cancellations in this task. The creator
`Cancel & refund` action requires confirmation, current ownership and a paid booking.
Stripe refund sets `reverse_transfer=true` and `refund_application_fee=true`. The
workflow searches existing refunds and uses a stable idempotency key; manual/partial
refunds need operator review. It waits for a successful full refund before declaring
cancelled. It then verifies ownership and deletes only the associated Zoom meeting
and deterministic Google event. An uncertain Zoom creation is recovered for deletion.
Host capacity releases only after cleanup. A polite cancellation email follows.
Guests cannot self-cancel under the existing v1 policy.

## Operations and recovery

Inspect creator Requests for status, response deadline and retry errors. For deeper
triage, inspect the booking's workflow fields and sanitized `booking_workflow_retry`
Worker log event. Do not log provider bodies, attendee notes or credentials.

- **Zoom uncertain creation:** inspect the assigned host's scheduled meetings for the
  exact hashed marker. Recover the single owned meeting. If there is no match, verify
  the provider's request outcome before clearing `zoom_create_attempt_at`; never clear
  it solely because a local request timed out. Multiple matches require manual review.
- **Resend retry window ended:** check provider delivery by idempotency key/recipient
  and immutable payload. Mark sent only with actual delivery evidence. A fresh email
  requires an intentional operator decision; never reset the first-attempt timestamp
  automatically.
- **Refund pending/failed:** retain processing state and inspect Stripe. Do not mark
  cancelled without a verified full refund or silently issue another refund.
- **Missing old Google account:** reconnect the original account. A 404 from a different
  account is not proof that the old invitation was deleted.
- **Missing Zoom/Stripe config:** complete the setup report before enabling production.
  Missing Zoom configuration blocks acceptance before capture.

Deployment needs Annabel's separate approval, committed reviewed code, migration 0025,
all required secrets, the five-minute cron, and real provider rehearsals. Local
provider fixtures prove application behavior, not production delivery/licensing.

## Verification

Final command counts and remaining external checks are recorded in
[the setup and verification report](zoom-production-setup.md).

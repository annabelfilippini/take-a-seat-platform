# Stripe launch readiness

Audited September 12, 2026. **Not ready for real paid bookings.** The first
creator will use a United States payout account, as confirmed by Annabel.

## Verified configuration

- Production Worker has `STRIPE_SECRET_KEY` and `STRIPE_WEBHOOK_SECRET`, plus
  Google Calendar secrets. Secret values and their mode were not exposed or read.
- Production D1 reports no pending migrations. Its only Stripe connection is an
  Annabel test account with active transfers. No live creator connection is saved.
- Production booking counts: two `requested`; no authorized, paid, or approved
  booking. This is not evidence of a completed payment rehearsal.
- The enabled test webhook targets the existing Workers URL at
  `/api/stripe/webhook`, API version `2026-08-26.dahlia`. It now subscribes to all
  six events listed below. A Stripe Shell sandbox `payment_intent.succeeded`
  event reached the deployed Worker and returned HTTP 200 with `received: true`.
  This verifies signed transport, not a complete booking or creator transfer.
- Live Stripe Connect still has no connected accounts and account creation is
  disabled. Annabel reports completing setup several times. The dashboard
  initially showed Confirm final details; editing the industry from Website
  building or hosting to On-demand services reopened the platform questionnaire.
  It now shows two remaining steps. Do not assume Annabel skipped onboarding or
  ask her to repeat the entire flow; inspect and resolve this saved draft.
- Buyers purchasing from the platform and sellers being paid individually were
  present in the initial summary. Stripe-hosted onboarding remains selected.
  Automatic approval review blocked advancing the edited Connect configuration
  because it changes consequential account settings that become locked.
- Live Workbench has no event destination. A form is prepared for
  `https://takeaseatwith.com/api/stripe/webhook`, named Take a Seat live payments,
  using API version `2026-08-26.dahlia` and all six events below. Creation was
  blocked by automatic approval review because it would enable live delivery
  before the live signing secret, API key, and creator payout readiness were
  verified. The endpoint was not created and no live secrets were changed.
- No Google Calendar connection or weekly availability is saved for the current
  sandbox creator. Its profile remains private. These prerequisites prevent a
  full public booking and calendar rehearsal; no profile was published for QA.
- Code uses an Express dashboard, platform fee collection and platform negative
  balance liability, with destination charges. The fee is 15% of the seat price.
  Stripe processing fees reduce the platform's share; 15% is not net margin.

## Deployed payment fixes

- Require a complete Checkout and verified PaymentIntent authorization or payment
  state before showing success. Unpaid/open Checkout no longer means authorized.
- Reuse the request/manual-capture route for the older Checkout endpoint, removing
  its immediate-charge path.
- Reconcile capture success and canceled authorizations through signed webhooks;
  read current Stripe state and verify the stored Checkout/PaymentIntent binding.
- Reconcile expired Checkouts and preserve paid/approved states on delayed events.
- Return retryable failures when payment reconciliation cannot reach Stripe or D1.
- Set Checkout expiry to 30 minutes and use a booking-specific idempotency key.
- Mark Connect returned/connected only after active transfer capability is verified.
- Verify capture response identity and success before saving paid status.
- Render payment headings from stored state, not URL flags; show ended requests
  clearly and show calendar controls only for confirmed appointments.

With Annabel's approval, PR #9 was merged and clean main commit `86a8fbe` was
deployed to production. Cloudflare Worker version:
`7d958e65-5675-450d-b351-d0e45e9231fd`. This main commit also includes PR #10's
creator invitation recovery. Required Worker secret names were verified and D1
reported no pending migrations before deployment. No migration was required by
the payment fixes. No real payment, refund, live key change, or account activation
was performed. Stripe Shell created only a sandbox payment fixture.

## Required next steps

1. Resolve the pending Connect draft without repeating completed onboarding.
   Obtain approval for the specific edited industry and locked configuration
   before advancing the action blocked by automatic approval review.
2. Connect the sandbox creator's Google Calendar, save real test availability,
   and prepare a reviewable profile. Complete a real Stripe sandbox booking
   through the app before switching the runtime to live mode.
3. Provision the corresponding live Worker key and a separate live webhook
   signing secret. Verify the key belongs to the intended platform and has the
   required Checkout, PaymentIntent read/capture, Accounts v2, and account-link
   permissions. Do not reuse test Price IDs or test connected-account IDs.
4. Resolve the live-webhook approval block and create the destination for
   `https://takeaseatwith.com/api/stripe/webhook` with:
   `checkout.session.completed`, `checkout.session.async_payment_succeeded`,
   `checkout.session.expired`, `payment_intent.amount_capturable_updated`,
   `payment_intent.succeeded`, and `payment_intent.canceled`.
5. Have the first creator complete live Stripe-hosted onboarding, including their
   own identity and bank details. Verify transfer capability and payout readiness
   in Stripe, rather than relying only on a successful return redirect.
6. Rehearse buyer Checkout authorization, creator acceptance/capture, correct 15%
   application fee and creator transfer, webhook delivery, notifications, and
   calendar confirmation. Rehearse decline, expiry, repeated delivery and refund
   with transfer reversal in test mode. A real-money check requires separate
   authorization and an agreed amount.

## Remaining product and operational risks

- Booking availability is checked before insertion, without an atomic reservation.
  Concurrent requests can reserve the same slot. Resolve this before unattended
  paid bookings; it is outside this payment-state repair.
- Calendar creation follows capture. A calendar failure leaves a paid booking
  needing creator/admin retry. A full calendar rehearsal is still required.
- Creator decline/cancel, refund, dispute handling and notification retry are not
  complete automated workflows. Define an operator process and refund/transfer
  recovery before taking real payments. Notification delivery errors are still
  swallowed; the database payment state alone does not prove an email arrived.
- Authorization expiry is handled when Stripe sends cancellation; the app does
  not yet expose the actual `capture_before` deadline or remind creators to act.
- Existing test connections are stored one per creator, not one per environment.
  Switching keys does not convert them to live connections. Preserve test audit
  history and deliberately create/link live accounts.
- The default country is US. Do not onboard non-US creators through this default
  without country-aware configuration and a separate cross-border review.

## Verification

`npm run lint` and `npm test` pass on deployed main: 50 tests, including nine payment-lifecycle
cases using actual route/domain code and SQLite with mocked Stripe responses.
These cover incomplete Checkout, zero capturable amount, capture recovery,
out-of-order and duplicate delivery, cancellation/expiry, ownership checks,
signature expiry, transient Stripe failure and incomplete Connect onboarding.
They are not a real Stripe or production end-to-end test. Separately, sandbox
event `evt_3UF0tZ1B3wHKPpd61dBurcsn` was delivered successfully on September 12
Pacific time through test endpoint `we_1UEZSp1B3wHKPpd6AWnBkj8K`. The unrelated
fixture was correctly acknowledged without creating or changing a booking.

Browser QA: local confirmed and canceled booking pages at desktop and 390 px
mobile widths, plus the authorized state. No clipping or overlapping controls
observed. A forged `booking=authorized` URL does not change a canceled heading.
Creator approval is exercised in route tests; browser access to the local dev
login endpoint was blocked, so signed-in creator approval was not browser-tested.

## Stripe references

- [Manual capture and authorization expiry](https://docs.stripe.com/payments/place-a-hold-on-a-payment-method)
- [Connect charges and fee ownership](https://docs.stripe.com/connect/charges)
- [Refunds and transfer reversal](https://docs.stripe.com/connect/marketplace/tasks/refunds-disputes)

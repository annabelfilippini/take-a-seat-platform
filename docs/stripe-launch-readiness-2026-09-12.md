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
- Stripe test account has an enabled webhook targeting the existing Workers URL
  at `/api/stripe/webhook`, API version `2026-08-26.dahlia`. It subscribes only to
  Checkout completed and async payment succeeded.
- Live Stripe Connect shows no connected accounts, disabled account creation,
  and one remaining setup step: Confirm final details.
- Final review correctly says buyers purchase from the platform and sellers are
  paid individually. The industry is incorrectly set to Website building or
  hosting. Of the offered categories, On-demand services best matches booked
  creator advice. Annabel must review before submitting: Stripe explicitly says
  confirming locks the platform configuration.
- Live Workbench has no event destination. Its single available import is the
  test-mode webhook. No import or live configuration change was made.
- Code uses an Express dashboard, platform fee collection and platform negative
  balance liability, with destination charges. The fee is 15% of the seat price.
  Stripe processing fees reduce the platform's share; 15% is not net margin.

## Fixes prepared on codex/stripe-launch-readiness

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

No production deployment, live key change, payment, refund, or account activation
was performed. No database migration is required by these fixes.

## Required next steps

1. Review the Connect industry and finish the live platform configuration in
   Stripe. The locked final confirmation belongs to Annabel.
2. Review and deploy the fixes with Annabel's explicit production approval.
3. Update the test webhook subscriptions and prove a real Stripe sandbox booking
   through the app before switching the runtime to live mode.
4. Provision the corresponding live Worker key and a separate live webhook
   signing secret. Verify the key belongs to the intended platform and has the
   required Checkout, PaymentIntent read/capture, Accounts v2, and account-link
   permissions. Do not reuse test Price IDs or test connected-account IDs.
5. Create the live webhook for `https://takeaseatwith.com/api/stripe/webhook` with:
   `checkout.session.completed`, `checkout.session.async_payment_succeeded`,
   `checkout.session.expired`, `payment_intent.amount_capturable_updated`,
   `payment_intent.succeeded`, and `payment_intent.canceled`.
6. Have the first creator complete live Stripe-hosted onboarding, including their
   own identity and bank details. Verify transfer capability and payout readiness
   in Stripe, rather than relying only on a successful return redirect.
7. Rehearse buyer Checkout authorization, creator acceptance/capture, correct 15%
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

`npm run lint` and `npm test` pass: 49 tests, including nine payment-lifecycle
cases using actual route/domain code and SQLite with mocked Stripe responses.
These cover incomplete Checkout, zero capturable amount, capture recovery,
out-of-order and duplicate delivery, cancellation/expiry, ownership checks,
signature expiry, transient Stripe failure and incomplete Connect onboarding.
They are not a real Stripe or production end-to-end test.

Browser QA: local confirmed and canceled booking pages at desktop and 390 px
mobile widths, plus the authorized state. No clipping or overlapping controls
observed. A forged `booking=authorized` URL does not change a canceled heading.
Creator approval is exercised in route tests; browser access to the local dev
login endpoint was blocked, so signed-in creator approval was not browser-tested.

## Stripe references

- [Manual capture and authorization expiry](https://docs.stripe.com/payments/place-a-hold-on-a-payment-method)
- [Connect charges and fee ownership](https://docs.stripe.com/connect/charges)
- [Refunds and transfer reversal](https://docs.stripe.com/connect/marketplace/tasks/refunds-disputes)

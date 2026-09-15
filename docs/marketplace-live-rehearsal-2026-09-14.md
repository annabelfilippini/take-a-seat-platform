# Production reliability rehearsal

September 14, 2026 Pacific (September 15 UTC). Annabel explicitly approved
deployment and live integration testing. Payments remain in Stripe sandbox mode.

## Deployment

- PR #30 merged as `43b586c`; its tree matches the locally verified QA changes.
- Production Worker version: `45a1a16f-efb3-4ba7-83bb-9ab02e52095f`.
- Required Clerk, Google, Resend and Stripe secret names verified; no values exported.
- D1 reports no pending migrations. Dry run and deploy succeeded from a clean tree.

## Provider evidence

| Journey | Result |
| --- | --- |
| New creator application and admin acceptance | Private QA identity created through public application and authenticated admin UI; application, admin alert and setup emails arrived in Inbox |
| First sign-in and returning login | One-use setup link opened private starter profile after reload; saved draft survived hard refresh and real Clerk email-code logout/login; publication timestamp stayed null |
| Wrong-account email switch | Reproduced same-document stall twice; repaired with explicit reload after sign-out; local regression passes; post-deploy live recheck pending |
| Published data | Existing creator's published $45 offering remained distinct from newer private draft edits |
| Google OAuth | Live connection persisted with free/busy and owned-event scopes, and the creator UI showed connected |
| Checkout and capture | Two real hosted sandbox Checkouts authorized $45 each; creator acceptance captured and advanced each to approved |
| Destination charge economics | First payment captured $45, recorded $6.75 application fee (15%), and created one destination transfer; Stripe processing fee shown as $1.61 |
| Webhook delivery/replay | Checkout event delivered with HTTP 200 and manually replayed with HTTP 200 after acceptance; D1 retained one booking, one event ID and one notification per type |
| Calendar/Meet | One deterministic Google event per accepted booking, with a real Meet URL; separate customer inbox received the second event invitation with correct timezone conversion |
| Real busy-time rejection | Temporarily moved the first disposable event to a free slot; booking submission rejected it before Checkout. Restored the event to its original time afterward |
| Creator inbox | Request and paid-booking emails arrived in the creator's Inbox |

The first invitation addressed the calendar owner itself, so it did not generate
a separate customer email. A second authorized test booking used a different
owned recipient account and established actual invitation delivery.

Non-secret evidence references: first booking
`booking_7f2461f4-47b1-43b3-a7a4-df362a12199f`, payment
`pi_3UFnb31B3wHKPpd61W5NcKFH`, Checkout event
`evt_1UFnb41B3wHKPpd6vXNorMS9`; second booking
`booking_7fd8559e-ec90-487c-bb7e-67117f0e34d8`.
No invitation credentials, email codes, private messages or calendar tokens are
stored in this report.

## Additional repairs

1. Account switching on a fragment-bearing email link needs an explicit page
   reload after sign-out. Same-URL redirects can retain the old Clerk hook.
   The new browser regression fails with same-document navigation and passes
   with reload, preserving the invite, removing the ticket and redeeming once.
2. Setup emails and the admin acceptance panel incorrectly described saving as
   publication. Both now instruct creators to use Preview & Publish.

Root causes and regression coverage are in [BUG_LOG.md](BUG_LOG.md).
Customer booking component and CSS remain unchanged.

## Scope and outstanding checks

- Final live account-switch recheck and follow-up deployment are pending.
- Sandbox proves authorization/capture/webhook/fee logic, not live-bank payouts,
  legal onboarding, settlement or real-card readiness. Live webhook remains disabled.
- The existing picker displays scheduled hours; final submission checks current
  D1 reservations and Google conflicts. Busy slots are safely rejected there.
- Chrome and narrow viewport coverage does not certify Safari or Firefox.
- Link CLI was run at the user's request; financial-wallet setup was then skipped
  by the user. The user explicitly approved continuing with public test cards.
- The private QA profile and two sandbox bookings are retained as test evidence;
  calendar cleanup and final artifact state will be recorded before completion.

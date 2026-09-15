# Production reliability rehearsal

September 14, 2026 Pacific (September 15 UTC). Annabel explicitly approved
deployment and live integration testing. Payments remain in Stripe sandbox mode.

## Verdict

**PASS for the tested application and Stripe sandbox journeys.** Final production
return navigation, declined confirmation and admin queue navigation passed. No
unexpected errors were captured in the fresh final customer browser document.
Real-money launch remains gated by live Stripe setup, webhook activation and
settlement verification below.

## Deployment

- PR #30 merged as `43b586c`; its tree matches the locally verified QA changes.
- Initial Worker version: `45a1a16f-efb3-4ba7-83bb-9ab02e52095f`.
- Auth and email follow-up PR #31 merged as `6e96c56`, deployed as Worker
  `6811bc8b-08a0-4e5d-8077-cd39699f78ed` from the verified clean tree.
- Required Clerk, Google, Resend and Stripe secret names verified; no values exported.
- D1 reports no pending migrations. Dry run and deploy succeeded from a clean tree.

- Decline-copy PR #32 merged as `e69f43d`, deployed as Worker
  `95b31b4d-5758-48e5-acf5-2a26a9ff4792`. Fresh browser confirmed corrected text.

- Final code: PR #33, main `d8cec92`, Worker
  `8a10f655-921a-43c0-a825-361a9f6fb270`. The deployed committed tree matched
  GitHub main; the later evidence-only documentation commit needs no redeploy.

## Provider evidence

| Journey | Result |
| --- | --- |
| New creator application and admin acceptance | Private QA identity created through public application and authenticated admin UI; application, admin alert and setup emails arrived in Inbox |
| First sign-in and returning login | One-use setup link opened private starter profile after reload; saved draft survived hard refresh and real Clerk email-code logout/login; publication timestamp stayed null |
| Wrong-account email switch | Reproduced same-document stall twice; repaired with explicit reload after sign-out; local regression passes; two post-deploy switches reached the correct saved profile without manual reload; original admin session restored |
| Published data | Existing creator's published $45 offering remained distinct from newer private draft edits |
| Google OAuth | Live connection persisted with free/busy and owned-event scopes, and the creator UI showed connected |
| Checkout and capture | Two real hosted sandbox Checkouts authorized $45 each; creator acceptance captured and advanced each to approved |
| Destination charge economics | First payment captured $45, recorded $6.75 application fee (15%), and created one destination transfer; Stripe processing fee shown as $1.61 |
| Webhook delivery/replay | Checkout event delivered with HTTP 200 and manually replayed with HTTP 200 after acceptance; D1 retained one booking, one event ID and one notification per type |
| Calendar/Meet | One deterministic Google event per accepted booking, with a real Meet URL; separate customer inbox received the second event invitation with correct timezone conversion |
| Real busy-time rejection | Temporarily moved the first disposable event to a free slot; booking submission rejected it before Checkout. Restored the event to its original time afterward |
| Decline and authorization release | Third $45 hosted sandbox authorization declined in creator UI; Stripe cancel API returned 200, payment is Canceled with $0 net, D1 is declined with no calendar event, and customer cancellation email arrived in Inbox |
| Final customer confirmation and navigation | Declined page explains canceled authorization and no capture; native Creator link reaches the public profile; fresh production document has no captured errors; admin detail/back-to-queue links also work |
| Acceptance copy | Fresh post-deploy branded email and admin panel correctly distinguish Save draft from Preview & Publish |
| Creator inbox | Request and paid-booking emails arrived in the creator's Inbox |

The first invitation addressed the calendar owner itself, so it did not generate
a separate customer email. A second authorized test booking used a different
owned recipient account and established actual invitation delivery.

Non-secret evidence references: first booking
`booking_7f2461f4-47b1-43b3-a7a4-df362a12199f`, payment
`pi_3UFnb31B3wHKPpd61W5NcKFH`, Checkout event
`evt_1UFnb41B3wHKPpd6vXNorMS9`; second booking
`booking_7fd8559e-ec90-487c-bb7e-67117f0e34d8`; declined booking
`booking_2723e3b3-9a13-4aa7-923c-733ff030f15d`, payment
`pi_3UFntT1B3wHKPpd618FHqiKN`.
No invitation credentials, email codes, private messages or calendar tokens are
stored in this report.

## Additional repairs

1. Account switching on a fragment-bearing email link needs an explicit page
   reload after sign-out. Same-URL redirects can retain the old Clerk hook.
   The new browser regression fails with same-document navigation and passes
   with reload, preserving the invite, removing the ticket and redeeming once.
2. Setup emails and the admin acceptance panel incorrectly described saving as
   publication. Both now instruct creators to use Preview & Publish.

3. A refreshed declined booking page fell through to the generic payment-needed
   text. Added a declined heading and cancellation explanation, and removed the
   creator approval panel for declined requests. The existing full booking
   journey now checks the customer result, refresh and creator controls.

4. The production confirmation's Creator link failed through vinext client
   navigation and logged a prefetch TypeError. All remaining next/link uses now
   use native anchors. The new regression also requires returning to the public
   slug when a booking stores a different internal creator ID. Final production
   navigation and console checks passed after deployment.

Root causes and regression coverage are in [BUG_LOG.md](BUG_LOG.md).
Customer booking component and CSS remain unchanged.

## Scope and outstanding checks

- Local release checks: 20 Playwright journeys, 80 Node tests, lint and TypeScript
  passed again after the final navigation/slug repair (20 browser journeys in
  49.6s, no retries or skips). The new regression first reproduced an internal-ID
  404, then passed after published-slug resolution. Production navigation smoke
  passed on the committed deployment.
- Sandbox proves authorization/capture/webhook/fee logic, not live-bank payouts,
  legal onboarding, settlement or real-card readiness. Live webhook remains disabled.
- The existing picker displays scheduled hours; final submission checks current
  D1 reservations and Google conflicts. Busy slots are safely rejected there.
- Local Playwright covers desktop and narrow layouts. Live browser auth checks
  passed at desktop width with no captured console errors. The in-app viewport
  override reported success but remained 1280 pixels wide, so this is not live
  mobile proof. Safari and Firefox were not exercised.
- Link CLI was run at the user's request; financial-wallet setup was then skipped
  by the user. The user explicitly approved continuing with public test cards.
- Retained evidence: one private QA profile, two accepted sandbox bookings and
  one declined sandbox booking. Two test Google events remain on September 16
  at 09:15 and 10:15 America/Los_Angeles (15 minutes each). These accepted
  bookings still reserve those slots. No real money was charged.
- Original Chrome creator tab and its saved private draft were preserved. The
  isolated browser was restored to the original admin account and viewport override reset.

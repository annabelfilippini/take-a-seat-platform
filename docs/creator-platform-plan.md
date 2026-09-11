# Creator Platform Plan

Date: 2026-08-29

Status note: use `docs/take-a-seat-control-map.md` as the current operational
source of truth. This file remains the longer product and integrations plan.

## Product Direction

Take a Seat should become a true creator marketplace, not just a set of Cal.com
links. Creators should onboard inside Take a Seat, connect the external accounts
needed for scheduling and payouts, set their own prices, and then go live.

Cal.com is no longer part of the active implementation path. Use direct Google
Calendar OAuth for scheduling.

## Creator Onboarding Flow

1. Creator signs up or is invited.
2. Creator builds their profile:
   - name
   - Instagram handle
   - TikTok handle
   - detailed intake about what they can help with
   - profile images
   - topics or categories
   - session types
3. Creator connects Instagram or adds profile images manually.
4. Creator connects Google Calendar.
5. Creator sets Take a Seat availability rules:
   - bookable days
   - bookable time windows
   - timezone
   - buffer time
   - minimum notice
   - maximum bookings per day or week
6. Creator connects Stripe through Stripe Connect.
7. Creator sets pricing for each seat length.
8. Take a Seat checks that profile, calendar, payout, and pricing setup are
   complete.
9. Creator profile becomes bookable.

## Google Calendar Flow

Use direct Google Calendar OAuth as the scheduling layer.

Google Cloud setup created on 2026-08-29:

- Project name: `Take a Seat`
- Project ID: `take-a-seat-platform`
- Project number: `806032223625`
- Calendar API: enabled
- OAuth app audience: external
- OAuth web client: `Take a Seat Web`
- OAuth client ID:
  `806032223625-tereljfvh2l3che7nfnu3m602jonb2ov.apps.googleusercontent.com`
- OAuth callback path: `/api/google-calendar/oauth/callback`

Implementation started on 2026-09-01:

- `/api/google-calendar/oauth/start` creates a signed Google authorization URL
  for a selected creator.
- `/api/google-calendar/oauth/callback` exchanges Google authorization codes and
  stores encrypted token values in D1.
- First requested scopes are `calendar.freebusy` for conflict checks and
  `calendar.events.owned` for creating booking events on creator-owned
  calendars.
- The callback expects a `DB` D1 binding and the generated Drizzle migration to
  be applied before a real connection can be saved.

Do not commit the OAuth client secret. Google only shows it once after client
creation; download the JSON or store it directly in Cloudflare secrets before
closing the dialog.

Creator-facing flow:

1. Creator clicks `Connect Google Calendar`.
2. Google shows an OAuth consent screen.
3. Creator approves access.
4. Google redirects back to Take a Seat.
5. Take a Seat securely stores the creator's calendar connection.
6. Creator sets their availability rules inside Take a Seat.

Booking flow:

1. Buyer opens a creator profile.
2. Take a Seat generates possible slots from the creator's availability rules.
3. Take a Seat calls Google Calendar `freeBusy.query` to remove real calendar
   conflicts.
4. Buyer chooses an available slot.
5. Take a Seat checks free/busy again before payment.
6. Buyer pays through Stripe.
7. After payment succeeds, Take a Seat creates a Google Calendar event with the
   creator and buyer.

Google Calendar should block real conflicts. Take a Seat should own the public
availability rules.

## Stripe Connect Flow

Use Stripe Connect from the start so creators can receive payouts through their
own connected accounts.

Creator-facing flow:

1. Creator clicks `Set up payouts`.
2. `/api/stripe/connect/start` creates or retrieves the creator's connected
   Stripe account.
3. Creator completes Stripe-hosted onboarding.
4. Stripe collects legal, identity, tax, and payout details.
5. Take a Seat records whether the creator can receive payouts.

Buyer payment flow:

1. Buyer chooses a creator, seat length, and time.
2. Take a Seat confirms the creator has a connected Stripe account that can
   receive transfers.
3. Take a Seat creates a Stripe Checkout Session as a destination charge.
4. Stripe routes the booking payment to the creator's connected account and
   returns the configured Take a Seat application fee to the platform.
5. The buyer cannot self-cancel after paying in the v1 policy.
6. If the creator or Take a Seat cannot honor the booking, Take a Seat handles
   the refund manually from Stripe.
7. On successful payment, Take a Seat confirms the booking and creates the
   calendar event.

Recommended starting model:

- Stripe Connect with creator connected accounts.
- Stripe-hosted or embedded onboarding for creators.
- Destination charges for bookings.
- Take a Seat keeps a configurable application fee per booking, starting with a
  15% pilot fee.
- Start in test mode before launching live bookings.
- No guest-side cancellations for v1; refund only when the creator or Take a
  Seat cannot fulfill the seat.

International creator note:

- The first implementation uses recipient-style connected accounts and checks
  that the creator can receive Stripe transfers before checkout.
- Before launching creators outside the platform's Stripe region, confirm the
  required cross-border setup with Stripe. Some destination-charge flows need
  `payment_intent_data[on_behalf_of]` and connected-account payment
  capabilities, which is a different account configuration from a
  transfer-only recipient.

## What You See In Stripe

In the Stripe Dashboard, Take a Seat should see:

- connected creator accounts
- payment history
- application fees
- creator payout status
- failed onboarding or verification requirements
- refunds and disputes

For example, on a 45 GBP booking:

- customer pays 45 GBP
- creator receives their agreed share
- Take a Seat keeps its platform fee
- Stripe processing fees are deducted according to the Connect setup

## MVP Build Checklist

1. Add D1 tables for creators, profiles, availability rules, calendar
   connections, Stripe connected accounts, seat prices, and bookings.
2. Add creator sign-in and invite-only access.
3. Build creator profile editor.
4. Build Google Calendar OAuth connection.
5. Build weekly availability editor.
6. Build Stripe Connect account onboarding.
7. Build pricing editor.
8. Build public slot picker on creator profiles.
9. Create Stripe Checkout Sessions for selected slots.
10. Configure accepted-creator notifications with Resend email, profile
    notifications, and Twilio SMS or an explicit email-only launch decision.
11. Add Stripe webhook handling for successful payments.
12. Create Google Calendar events after successful payment.
13. Add creator/admin-led refund and reschedule rules.

## Near-Term Decision

The next build decision is whether to keep polishing Ella's launch path first,
or broaden the reusable creator onboarding dashboard for the next invite.

Recommended path: focus the first release on Ella, prove the reusable creator
onboarding dashboard with her flow, and keep expansion invite-only until the
booking system is reliable.

## Dashboard Decision Notes

The first creator backend should be a single invite-only page, linked as
`Creator login` from the public site. Public customers can book without an
account in v1. Add customer accounts later only when saved bookings, reschedule
requests, purchase history, or messaging justify the extra friction.

For creators, do not start with unlimited page customization. Let them control
the profile content that changes the buyer's decision:

- Instagram and TikTok handles
- detailed answers about what followers can bring to a call
- pricing for 15 minute and 30 minute seats
- weekly calendar-grid availability rules
- Google Calendar and Stripe connections

Take a Seat should keep final approval over category placement, profile go-live,
refund exceptions, homepage feature placement, and any custom offer outside the
standard 15 or 30 minute private video call.

The 15 minute vs. 30 minute labels should stay standardized so buyers can scan
profiles quickly. The creator chooses whether to offer each length and sets the
price. Take a Seat should generate the description beneath each length from the
creator's detailed intake, then approve it before publishing.

Annabel's test profile at `/with/annabel` is the first internal QA path for this
dashboard shape. Before using it for real payments, add Annabel's Stripe Price
IDs, finish Stripe-hosted onboarding, save availability, and add webhooks so
paid bookings create calendar events from Stripe's confirmed payment event.

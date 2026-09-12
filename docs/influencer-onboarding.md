# Influencer Onboarding

Use Ella as the current launch profile. Each bookable creator needs profile
copy, a Google Calendar connection, availability rules, and Stripe Connect when
paid checkout is enabled.

Annabel has an internal test profile at `/with/annabel`. Use it to prove the
creator setup path before inviting an outside creator.

## Recommended Launch Flow

1. Add seed/demo creator records only when needed in `app/_lib/creators.ts`.
2. Save profile, seat copy, pricing, and weekly availability from
   `/creators/onboard`.
3. Connect the creator's Google Calendar from `/creators/onboard`.
4. Connect Stripe payouts through Stripe-hosted onboarding.
5. Run a test booking before changing broader creator access to live.

## Creator Dashboard Scope

V1 should be invite-only. Creators can edit the pieces that make their profile
feel like theirs:

- display name, Instagram handle, TikTok handle, location, category, and offer
  name
- a detailed intake about what followers can ask them, what they are excited to
  help with, and what they do not want to cover
- generated intro, about, "can help with", and "Why a 1:1 call?" sections
- whether 15 and 30 minute seats are offered
- price for each seat length, with generated customer-facing descriptions
- a weekly calendar grid, timezone, buffer, notice, and per-day/per-week limits
- Google Calendar connection
- Stripe payout onboarding

Take a Seat should still approve category changes, profile go-live, refund
exceptions, and any unusually high or off-brand pricing while the marketplace is
small.

## Profile Image Rules

- Do not use creator images that have text baked into the image, captions,
  quotes, subtitles, product overlays, or other words on top of the photo.
- For profile galleries, choose clear creator-led images that show the person,
  outfit, beauty look, object, or setting directly.
- If an Instagram post image includes visible words, skip it even when the
  underlying photo is otherwise strong.

## Production Deploy Target

Push production updates to the Cloudflare Workers site:
`https://takeaseatwith.com/`.

The underlying Worker endpoint remains
`https://take-a-seat-platform.annabelflip1.workers.dev/`.

## Google Calendar Setup

Google Cloud setup created on 2026-08-29:

- Project name: `Take a Seat`
- Project ID: `take-a-seat-platform`
- Project number: `806032223625`
- Calendar API: enabled
- OAuth callback path: `/api/google-calendar/oauth/callback`

The app requests Google Calendar scopes for availability conflict checks and
creator-owned event creation. Take a Seat owns the public availability rules;
Google Calendar supplies the creator's real busy/free conflicts.

## D1 Setup

The Cloudflare D1 database stores calendar connections and availability rules.

Current production database:

```jsonc
{
  "binding": "DB",
  "database_name": "take-a-seat-platform-db",
  "database_id": "144a50a9-e15d-4fcc-a8eb-7e3bed735895",
  "migrations_dir": "drizzle"
}
```

Apply migrations with:

```bash
npx wrangler d1 migrations apply take-a-seat-platform-db --remote --config wrangler.deploy.jsonc
```

## Cloudflare Secrets

Production secrets:

```bash
npx wrangler secret put GOOGLE_CLIENT_ID --config wrangler.deploy.jsonc
npx wrangler secret put GOOGLE_CLIENT_SECRET --config wrangler.deploy.jsonc
npx wrangler secret put GOOGLE_OAUTH_REDIRECT_URI --config wrangler.deploy.jsonc
npx wrangler secret put GOOGLE_TOKEN_ENCRYPTION_KEY --config wrangler.deploy.jsonc
npx wrangler secret put TWILIO_ACCOUNT_SID --config wrangler.deploy.jsonc
npx wrangler secret put TWILIO_AUTH_TOKEN --config wrangler.deploy.jsonc
npx wrangler secret put TWILIO_MESSAGING_SERVICE_SID --config wrangler.deploy.jsonc
# Or use TWILIO_FROM_PHONE_NUMBER instead of TWILIO_MESSAGING_SERVICE_SID.
npx wrangler secret put STRIPE_SECRET_KEY --config wrangler.deploy.jsonc
npx wrangler secret put STRIPE_WEBHOOK_SECRET --config wrangler.deploy.jsonc
npx wrangler secret put STRIPE_CONNECT_COUNTRY --config wrangler.deploy.jsonc
```

Keep real secrets out of source and load them through Worker secrets. The
platform fee is not a secret; configure it in `wrangler.deploy.jsonc` as
`TAKE_A_SEAT_PLATFORM_FEE_BPS`.

## Accepted Creator Notifications

When an admin accepts a creator application, Take a Seat should create the
invite, send the accepted email, attempt the accepted SMS, and create the
in-profile notification. SMS delivery depends on Twilio runtime secrets. If
Twilio is not configured, the admin acceptance result should clearly say the
text was skipped and why.

Before inviting real creators, rehearse one accepted application with a test
recipient and confirm:

- the creator receives the accepted email with the profile setup link
- the creator receives the accepted text, unless SMS is intentionally deferred
- the creator dashboard shows the application accepted notification
- the admin acceptance page reports the delivery status accurately

## Stripe Setup

Stripe Connect now starts from `/creators/onboard`. The `Connect Stripe` button
creates or reuses a Stripe connected account, stores the account id in D1, and
sends the creator to Stripe-hosted onboarding for payout details. The current
starting model is marketplace-style recipient onboarding with Express Dashboard
access.

Paid bookings still sit after the Google Calendar scheduling layer. The app uses
server-created Stripe Checkout Sessions with inline price data from the
creator's saved seat prices, so the secret key never reaches the browser.

Current app keys:

```ini
STRIPE_SECRET_KEY="sk_test_replace_me"
STRIPE_WEBHOOK_SECRET="whsec_replace_me"
STRIPE_CONNECT_COUNTRY="US"
TAKE_A_SEAT_PLATFORM_FEE_BPS="1500"
TWILIO_ACCOUNT_SID="AC_replace_me"
TWILIO_AUTH_TOKEN="replace_me"
TWILIO_MESSAGING_SERVICE_SID="MG_replace_me"
```

Paid booking model:

- Require the creator to finish Stripe Connect onboarding before their paid
  seats can be booked.
- Use inline Checkout price data from the creator's approved D1 seat prices,
  with optional Stripe Price IDs only for seed/demo profiles that need them.
- Create Checkout Sessions as destination charges using the creator's connected
  Stripe account as `payment_intent_data[transfer_data][destination]`.
- Collect Take a Seat's share through
  `payment_intent_data[application_fee_amount]`; the pilot default is 15%.
- Confirm paid bookings from signed Stripe webhook events at
  `/api/stripe/webhook`, not only from the customer return URL.
- Keep guest bookings non-refundable in v1. If the creator or Take a Seat
  cannot honor the booking, process the refund manually in Stripe.

## Next Creator Checklist

For seed/demo creators, add the next creator to `app/_lib/creators.ts` with
unique values:

- `id`
- `slug`
- `image`
- `seats[].id`
- `seats[].stripePriceEnv`, only when the seed/demo profile should use a
  prebuilt Stripe Price instead of inline Checkout price data

Accepted marketplace creators should use the application and onboarding flow so
their operational profile data lives in D1. Add a bespoke profile route under
`app/with/<slug>/page.tsx` only when the creator needs a temporary custom launch
mockup; otherwise prefer the reusable `/with/[slug]` route.

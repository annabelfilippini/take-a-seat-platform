# Take a Seat

Take a Seat is a creator marketplace for booking private 1:1 seats with
creators, tastemakers, and experts. The product has three main surfaces:

- Public website: brand, creator discovery, public creator profiles, and booking
  entry points.
- Creator backend: invite-only creator profile setup, availability, calendar,
  payout, pricing, and booking notifications.
- Admin: application review, creator approval, profile publishing, operational
  overrides, and launch readiness checks.

Start with `docs/take-a-seat-control-map.md` when you need the current source of
truth for architecture, environments, roles, and cleanup priorities.

## Current Production Target

Production deploys use Cloudflare Workers through `wrangler.deploy.jsonc`.

```bash
npm run deploy
```

The canonical production URL is:

```text
https://take-a-seat-platform.annabelflip1.workers.dev/
```

## Local Development

Prerequisite:

- Node.js `>=22.13.0`

Useful commands:

```bash
npm install
npm run dev
npm run build
npm test
```

Other commands:

```bash
npm run deploy:dry-run
npm run db:generate
```

Local runtime values are represented in `.dev.vars.example`. Real secrets should
stay in ignored local env files or Cloudflare Worker secrets.

## Core Services

- App/runtime: vinext on Cloudflare Workers.
- Database: Cloudflare D1 via Drizzle schema in `db/schema.ts`.
- Auth: Clerk phone-code sign-in at `/sign-in`.
- Email: Resend transactional email.
- Calendar: Google Calendar OAuth groundwork.
- Payments: Stripe Connect and Stripe Checkout groundwork.

Cloudflare production bindings are declared in `wrangler.deploy.jsonc`.

## Project Layout

- `app/`: vinext routes and route-specific UI.
- `app/_components/`: shared React components used across routes.
- `app/_lib/`: server/domain helpers for auth, creators, bookings, email,
  calendar, notifications, and Stripe.
- `db/`: Drizzle database connection and schema.
- `drizzle/`: generated D1 migration SQL and Drizzle metadata.
- `public/`: committed visual assets used by the product.
- `tests/`: route and integration smoke tests.
- `worker/`: Cloudflare Worker entrypoint.

## Current Route Map

- `/`: public homepage.
- `/take-a-seat`: creator directory.
- `/with/[slug]`: reusable public creator profile route.
- `/with/ella`, `/with/annabel`, `/with/amber`: profile/test routes that still
  need consolidation into the reusable route over time.
- `/sign-in`: shared Clerk phone sign-in.
- `/creators/onboard`: creator application and setup entry.
- `/creators/dashboard`: creator-owned profile, availability, payouts, and
  notifications dashboard for accepted creators.
- `/admin/applications`: admin creator application queue.
- `/admin/creator-profile-editor-preview`: admin-only profile editor preview.

## Important Docs

- `docs/take-a-seat-control-map.md`: source of truth for product, architecture,
  environments, roles, and cleanup.
- `docs/creator-platform-plan.md`: longer creator marketplace and integrations
  plan.
- `docs/influencer-onboarding.md`: practical creator launch checklist and
  runtime setup notes.

## Cleanup Priorities

Do not deploy a launch-critical production update until these are handled:

1. Confirm D1 migrations are applied to the intended Cloudflare database.
2. Confirm required Cloudflare Worker secrets exist for Clerk, Resend, Google
   Calendar, and Stripe.
3. Add Stripe webhooks before any real paid booking flow is treated as reliable.

Already handled during repository cleanup:

- Preserved the current state in the GitHub repo.
- Removed duplicate scratch files such as `app/page 2.tsx`,
  `app/globals 2.css`, and `tests/rendered-html.test 2.mjs` after comparison.
- Separated the creator dashboard URL from the admin profile editor preview.
- Removed legacy Sites packaging files and starter D1 example code.
- Moved shared UI and domain helpers out of the route root into
  `app/_components` and `app/_lib`.

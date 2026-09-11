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

The legacy `.openai/hosting.json` file is retained for local/tooling history,
but it is not the production deploy target.

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

## Current Route Map

- `/`: public homepage.
- `/take-a-seat`: creator directory.
- `/with/[slug]`: reusable public creator profile route.
- `/with/ella`, `/with/annabel`, `/with/amber`: profile/test routes that still
  need consolidation into the reusable route over time.
- `/sign-in`: shared Clerk phone sign-in.
- `/creators/onboard`: creator application and setup entry.
- `/creators/dashboard`: currently redirects to the profile editor preview.
- `/admin/applications`: admin creator application queue.
- `/admin/creator-profile-editor-preview`: current shared admin/creator profile
  editor prototype.

## Important Docs

- `docs/take-a-seat-control-map.md`: source of truth for product, architecture,
  environments, roles, and cleanup.
- `docs/creator-platform-plan.md`: longer creator marketplace and integrations
  plan.
- `docs/influencer-onboarding.md`: practical creator launch checklist and
  runtime setup notes.

## Cleanup Priorities

Do not deploy the current dirty worktree until these are handled:

1. Commit or otherwise preserve the current state in a real source-of-truth repo.
2. Separate the creator backend route from the admin preview route.
3. Remove or archive duplicate scratch files such as `app/page 2.tsx` and
   `app/globals 2.css`.
4. Confirm D1 migrations are applied to the intended Cloudflare database.
5. Add Stripe webhooks before any real paid booking flow is treated as reliable.

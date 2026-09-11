# Production Readiness Pass

Date: 2026-09-11

Branch: `codex/production-readiness-pass`

## Verdict

Not ready for a launch-critical production deploy yet.

The app builds, typechecks, lints, tests, packages for Cloudflare, and the live
public routes respond. The remaining blockers are external production state:
remote D1 migrations are pending, Stripe price secrets are missing, production
Clerk still appears to be using a test/development publishable key, and Stripe
webhooks are not implemented.

## Checks Run

- `npx tsc --noEmit`: pass.
- `npm run lint`: pass.
- `npm test`: pass, 20 tests.
- `npm run deploy:dry-run`: pass, no deploy performed.
- `npx wrangler whoami`: authenticated as `annabelflip1@gmail.com`.
- `npx wrangler d1 info take-a-seat-platform-db --config wrangler.deploy.jsonc
  --json`: remote D1 exists.
- `npx wrangler d1 migrations list take-a-seat-platform-db --remote --config
  wrangler.deploy.jsonc`: pending migrations found.
- `npx wrangler secret list --config wrangler.deploy.jsonc --format json`:
  secret names checked without reading values.
- Live route smoke checks with `curl`: `/`, `/creators/onboard`,
  `/admin/applications`, and `/creators/dashboard` all returned HTTP 200.

## Confirmed Ready

- GitHub `main` is the source-of-truth branch.
- Cloudflare account access works.
- Cloudflare D1 database exists:
  - name: `take-a-seat-platform-db`
  - id: `144a50a9-e15d-4fcc-a8eb-7e3bed735895`
  - region: `WNAM`
  - tables reported by Cloudflare: 7
- Cloudflare deploy packaging works in dry-run mode.
- Runtime config binds `DB`, public site URL, admin/application email values,
  branded Resend sender, platform fee, and Stripe Connect country.
- Worker types are generated in `worker-configuration.d.ts`.
- TypeScript issues found during the pass were fixed.

## Blockers

### 1. Remote D1 migrations are pending

Cloudflare reports these unapplied remote migrations:

- `0007_heavy_lionheart.sql`
- `0008_deep_lady_bullseye.sql`
- `0009_concerned_sue_storm.sql`
- `0010_chunky_amphibian.sql`
- `0012_clammy_black_bird.sql`
- `0013_parched_blue_marvel.sql`

Do not rely on creator dashboard, published profiles, booking persistence,
calendar connections, or Stripe connection persistence in production until these
are applied.

Apply only after Annabel approves touching the production D1 database:

```bash
npx wrangler d1 migrations apply take-a-seat-platform-db --remote --config wrangler.deploy.jsonc
```

### 2. Stripe price secrets are missing

Configured Worker secrets currently include:

- `CLERK_SECRET_KEY`
- `GOOGLE_CLIENT_ID`
- `GOOGLE_CLIENT_SECRET`
- `GOOGLE_OAUTH_REDIRECT_URI`
- `GOOGLE_TOKEN_ENCRYPTION_KEY`
- `RESEND_API_KEY`
- `STRIPE_SECRET_KEY`

Missing for current bookable seed/test profiles:

- `STRIPE_PRICE_ANNABEL_15`
- `STRIPE_PRICE_ANNABEL_30`
- `STRIPE_PRICE_ELLA_15`
- `STRIPE_PRICE_ELLA_30`

Without these, paid checkout should show setup blockers instead of real bookable
checkout.

### 3. Production Clerk appears to use a test/development publishable key

`wrangler.deploy.jsonc` currently sets `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` to a
`pk_test_...` value. This may be acceptable for a private test Worker, but it is
not launch-ready for real creator/customer traffic.

Before public launch, decide whether Take a Seat should keep this as a sandbox
site or switch Cloudflare config to the intended production Clerk instance.

### 4. Stripe webhook handling is still missing

The app can create Checkout Sessions, but real paid bookings should not be
treated as reliable until a Stripe webhook confirms payment and updates booking
state server-side.

## Non-Blocking Follow-Ups

- Wrangler reports an available update from `4.92.0` to `4.131.0`; upgrade in a
  separate dependency-maintenance pass, not inside launch readiness.
- `wrangler --version` should be run with project-local logging env vars or via
  package scripts in this sandbox:
  `WRANGLER_LOG_PATH=.wrangler/wrangler.log WRANGLER_WRITE_LOGS=false`.
- Consider adding a lightweight authenticated production health route later,
  but do not add it until there is a clear operations need.

## Changes Made In This Pass

- Added `npm run typecheck`.
- Generated `worker-configuration.d.ts`.
- Updated `wrangler.deploy.jsonc` required secrets to match Google Calendar,
  Resend, Stripe, and current seed/test profile price IDs.
- Added `STRIPE_CONNECT_COUNTRY` as an explicit non-secret Worker variable.
- Aligned `.dev.vars.example` and onboarding docs with current Ella/Annabel
  Stripe price env names.
- Fixed narrow TypeScript readiness issues in Clerk provider config, Google
  Calendar token encryption, Stripe error parsing, admin application typing,
  profile editor defaults, and creator profile route helper types.

## Next Production Step

Ask Annabel for explicit approval to apply the pending D1 migrations to the
remote production database. After migrations are applied, rerun this readiness
pass and then test one complete creator application and admin acceptance flow on
the live Worker.

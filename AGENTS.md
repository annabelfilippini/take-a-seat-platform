# Take a Seat Codex Rules

## Source Of Truth

- Treat `main` on GitHub as the source-of-truth branch.
- Read `README.md` and `docs/take-a-seat-control-map.md` before broad changes.
- Keep `docs/take-a-seat-control-map.md` short, current, and operational.
- Do not deploy from an uncommitted or poorly understood worktree.
- Never commit secrets, real `.env*` files, real `.dev.vars`, API keys, private
  keys, exported credentials, or customer/private creator data.

## Repository Structure

- Keep route files in `app/`.
- Put shared React components in `app/_components/`.
- Put server/domain helpers in `app/_lib/`.
- Put database schema and connection code in `db/`.
- Put generated Drizzle migrations in `drizzle/`.
- Put product images and icons used by the app in `public/`.
- Put route and integration smoke tests in `tests/`.
- Put Cloudflare Worker entry code in `worker/`.
- Do not add duplicate scratch files such as `page 2.tsx`, `globals 2.css`, or
  copied components with suffixes. Compare, consolidate, then delete or archive
  outside source control.
- Do not add old Sites/Vercel starter files unless the deploy target changes
  intentionally and the docs are updated in the same change.

## Change Flow

- Start each coding task from a clean worktree when possible.
- Use a short branch for meaningful changes: `codex/<topic>`.
- Keep commits focused: one product/fix/docs idea per commit.
- Before editing many files, state the intended structure change.
- Preserve user changes you did not make; do not reset or revert unrelated work.
- Update docs when a change affects routes, deployment, integrations, data
  ownership, onboarding, or the project layout.
- Prefer removing stale prototype code over carrying parallel implementations.
- Do not introduce a new dependency, service, deploy target, or data store
  without an explicit product reason and documentation.

## Product Boundaries

- Public customer-facing routes live under `/`, `/take-a-seat`, `/with/*`, and
  `/about`.
- Creator self-service belongs under `/creators/*`.
- Admin review and operational controls belong under `/admin/*`.
- API routes should mirror the domain they serve: `/api/creators/*`,
  `/api/bookings/*`, `/api/stripe/*`, `/api/google-calendar/*`, and
  `/api/admin/*`.
- Operational marketplace state belongs in D1. Checked-in creator data should
  be seed/demo data or clearly named launch fixtures.

## Verification

- Run `npm run typecheck` and `npm run lint` after code changes.
- Run `npm test` before presenting a meaningful repo change.
- For customer-facing UI changes, also open the affected flow in a real browser
  viewport and verify the primary interactive state.
- For modals, drawers, calendars, booking forms, sticky headers, and overlays,
  check at least one desktop viewport and one narrow/mobile viewport for
  overlap, clipping, hidden controls, accidental background controls showing
  through, and text that is too large for its container.
- If a browser QA step cannot be completed, say that clearly before presenting
  the work.

## Deployment

- Production deploys use Cloudflare Workers through `wrangler.deploy.jsonc`.
- Cloudflare Worker secrets must live in Cloudflare, not in Git.
- Before any launch-critical deployment, confirm D1 migrations and required
  Worker secrets.
- Do not treat paid bookings as reliable until Stripe webhooks are implemented
  and tested.
- Ask Annabel before deploying production or changing GitHub repository
  settings.

## Customer-Facing UI QA

- Follow the verification rules above for every customer-facing UI change.

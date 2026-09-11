# Contributing To Take a Seat

Use this flow for GitHub and source control.

## Branches

- `main` is the source-of-truth branch.
- Use short working branches for meaningful changes: `codex/<topic>`.
- Keep old experiment branches out of GitHub once their work is merged or
  deliberately abandoned.
- Do not use branch names as permanent project status. Put status in docs or
  issues instead.

## Commits

- Keep commits small enough to review.
- Use plain imperative commit messages, for example:
  `Separate creator dashboard from admin preview`.
- Do not bundle unrelated product, cleanup, and deployment changes in one
  commit.
- Commit generated Drizzle migrations with the schema change that produced them.
- Do not commit build output, local runtime folders, screenshots, throwaway
  exports, or duplicate scratch files.

## Pull Requests

- Open a PR for changes that affect production behavior, routes, payments,
  calendar, auth, database schema, or public UI.
- A PR should explain the user-facing change, touched areas, verification, and
  any deploy or migration steps.
- If the change is docs-only, say so clearly.
- If browser QA was skipped, say why.

## Review Checklist

Before merging:

- The branch is up to date with `main`.
- `npm run lint` passes.
- `npm test` passes, unless the PR explicitly explains why it could not run.
- Relevant desktop and mobile browser QA has been done for customer-facing UI.
- No secrets or private data are in the diff.
- The README/control map changed if routes, deployment, integrations, or repo
  structure changed.
- Launch gates are still respected: no real paid booking flow without Stripe
  webhooks, D1 migrations, required secrets, and a full booking test.

## GitHub Settings

Recommended repository settings:

- Default branch: `main`.
- Delete merged branches.
- Require PRs for risky changes once the project has more than one active
  contributor.
- Protect `main` before inviting external collaborators or running automatic
  production deploys.
- Keep GitHub issues focused on actionable work, not long strategy notes. Put
  durable product context in `docs/`.

## Deployment

- Deploys go to Cloudflare Workers with `npm run deploy`.
- Do not deploy production from a dirty worktree.
- Do not deploy production without Annabel explicitly approving the deploy.
- Use `npm run deploy:dry-run` when validating deployment packaging without
  publishing.

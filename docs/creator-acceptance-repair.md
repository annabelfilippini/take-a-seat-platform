# Creator Acceptance Repair

The intended flow is application, admin review, acceptance email, verified
creator sign-in, profile editing, and publication on save.

## Fixed in code

- Application emails identify the specific review page; applicants receive receipts.
- Acceptance atomically prepares a private creator profile and reserves its URL.
  It sends a setup link to the application email and reports failed delivery.
- Email verification is the production sign-in method. Phone verification is
  opt-in only when supported by the Clerk plan. Wrong-account and service failures show
  recovery text, and failed sends never fabricate a successful code request.
- The Worker handles Clerk session refresh redirects and cookies instead of
  treating a refresh request as signed out. Configuration reads Worker bindings.
- Verified primary contact information establishes profile ownership. A legacy
  caller-supplied identity header no longer grants admin access.
- Saving an accepted profile records `profile_saved_at`. Public profiles, the
  homepage, and the directory require this timestamp. Old applications previously
  auto-published by acceptance remain private until saved again.

## Verified

- Lint and 40 automated tests pass, including real domain/routes against isolated
  SQLite using D1's statement interface. Email transport is mocked.
- Regression tests cover correct email recipients and links, private acceptance,
  wrong-account denial, ownership, publication on save, old unfinished profiles,
  repeat login, transport failure, and Clerk refresh redirects/cookies.
- Desktop (1365 x 900) and mobile (390 x 844) sign-in/directory layouts inspected.
  Phone fallback, empty-input validation, and category filtering exercised.
- Production secret names exist for Clerk and Resend. No secret values were exposed.
- A disposable Clerk development test account was created and removed.
- With Annabel's explicit localhost approval, the protected editor was checked
  at desktop and mobile sizes. A location edit persisted after reload and was
  restored. The availability date picker fits both viewports.
- The final Cloudflare deployment dry-run passes. Clerk account OAuth was
  reconnected successfully; production readiness reports `not_started`.
- Production Clerk was then created with email-code-only authentication after
  cloning the development phone-code configuration failed its subscription gate.
  All five DNS records were added in Cloudflare without proxying. Clerk reports
  DNS and email readiness complete. A real production verification email arrived
  in Annabel's application inbox, and its code completed account-portal sign-up.

## Remaining before claiming live completion

- Complete actual OTP verification in a browser. Automated attempts were blocked
  by Clerk/Turnstile before code delivery. No real inbox or SMS delivery is proven.
- Switch the Worker to the prepared production Clerk keys together, preserving
  unrelated secrets. The new production account has a verified application email.
- Migrations `0014_great_omega_flight.sql` and `0015_majestic_stryfe.sql`
  are applied to both local and production D1.
- Annabel explicitly approved production Clerk setup, preservation of the
  existing creator account link, both migrations, and deployment after verification
  on 2026-09-12. No further approval is needed for that scope.
- After deployment, run one controlled application through receipt, acceptance
  email, first verification, profile save, public card, sign-out, and repeat login.
- The repo-wide optional TypeScript check has existing Calendar/Stripe typing
  errors and missing Cloudflare runtime type declarations. Build/lint/test are
  the configured checks; a passing build is not a passing repo-wide typecheck.

## Deployment notes

Keep the existing database records and static seed profiles. The new migration
adds one nullable timestamp; it does not delete applications. Existing accepted
D1 profiles need a save to publish under the new rule. Static seed cards remain.
This repair is based on the existing profile-editing branch and should follow its
PR into main, with production deployment from a clean, committed checkout.

Switching Clerk environments changes user IDs. Before changing live keys, map
the existing D1 creator account to the same verified identity in production Clerk.
Preserve its creator ID and related profile/calendar/payment records. Do not
relax profile ownership checks or delete the account to force a fresh claim.

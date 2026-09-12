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
  reconnected successfully.
- Production Clerk was then created with email-code-only authentication after
  cloning the development phone-code configuration failed its subscription gate.
  All five DNS records were added in Cloudflare without proxying. Clerk reports
  DNS, certificates, and email readiness complete. A real production verification email arrived
  in Annabel's application inbox, and its code completed account-portal sign-up.

## Production verification completed (2026-09-12)

- PRs #6 and #7 are merged into `main`. Worker version
  `fcdcc8b6-0223-4c0f-b055-fb916a330da5` serves 100% of production traffic.
- The Worker switched to production Clerk public and secret keys together,
  preserving unrelated secrets. The existing creator account was mapped to its
  verified production identity without changing its profile or related records.
- Migrations `0014_great_omega_flight.sql` and `0015_majestic_stryfe.sql`
  are applied to both local and production D1.
- Annabel explicitly approved production Clerk setup, preservation of the
  existing creator account link, both migrations, and deployment after verification
  on 2026-09-12. No further approval is needed for that scope.
- With separate explicit approval for the live test and cleanup, submitted one
  controlled application through the public form. The admin review email and
  applicant receipt arrived. Acceptance through the actual admin UI sent the
  setup email, and its link opened the correct private starter profile.
- The production custom sign-in UI sent actual email codes and completed
  verification. Saving an edited location published the test profile on its
  public route, homepage, and directory. Signing out and verifying a fresh code
  returned to the same editor with the saved location intact.
- Cleanup returned the test record to private draft status and removed only its
  temporary ownership link. The application remains private. The test public
  route now returns 404, both card lists exclude it, and the original creator
  ownership link is preserved. No SMS verification is claimed; production uses
  email codes.

## Verification limitation

- The repo-wide optional TypeScript check has existing Calendar/Stripe typing
  errors and missing Cloudflare runtime type declarations. Build/lint/test are
  the configured checks; a passing build is not a passing repo-wide typecheck.

## Deployment notes

Keep the existing database records and static seed profiles. The new migration
adds one nullable timestamp; it does not delete applications. Existing accepted
D1 profiles need a save to publish under the new rule. Static seed cards remain.
The repair followed the existing profile-editing PR into main and was deployed
from a clean, committed checkout.

Switching Clerk environments changes user IDs. For any future switch, map
the existing D1 creator account to the same verified identity in production Clerk.
Preserve its creator ID and related profile/calendar/payment records. Do not
relax profile ownership checks or delete the account to force a fresh claim.

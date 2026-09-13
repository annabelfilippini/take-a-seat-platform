# Acceptance email sign-in

Prepared September 13, 2026. Not deployed; production approval and live email
rehearsal remain required.

Acceptance/resend now provisions an email-only Clerk identity when needed, or
reuses the exact existing verified primary email. Clerk creates a one-use
sign-in token valid for 24 hours. Only accepted applications can reach this
helper through the authenticated admin acceptance/resend routes.

The branded email opens `/creators/email-sign-in?invite=...#ticket=...&email=...`.
The credential stays in the fragment, outside HTTP request URLs and referrers,
and is removed from the address bar before redemption. A successful Clerk
session then opens the dashboard with the original D1 invitation intact. The
email value only helps choose account-switch UI; Clerk and D1 remain the access
authorities. Invalid/used/expired tickets offer normal email-code sign-in.
Existing emails with dashboard-only links continue to use normal sign-in; a
newly sent acceptance email is needed for the automatic flow.

A matching signed-in creator goes directly to their profile. A different
signed-in account gets an explicit switch button. Repeat applications preserve
existing D1 ownership and saved edits. First-time creators use the blank-profile
behavior already shipped on main; this change does not clear applications,
reset profiles, or republish any creator.

Clerk user creation provisions a verified email identity before the creator's
first visit. Only the recipient gets its sign-in credential. No password,
private metadata, admin role, or D1 ownership is provisioned by this helper.
An unverified/secondary email, blocked account, or provider failure makes setup
email generation fail visibly in the existing admin retry flow. If Clerk is
entirely unconfigured, the existing code-based link remains the fallback.

## Verification

- Based on current main `b8a72e2`, including blank-profile and calendar repairs.
- Lint, TypeScript, build, deployment dry run and all 68 tests passed. Tests cover exact-email reuse,
  new identity provisioning, concurrent creation, disallowed account states,
  email recipients/links, private-before-save, blank profiles, duplicate
  application ownership and saved edits.
- Real Chrome desktop and 390 × 844 viewports: expired-link recovery and
  wrong-account switch fit with visible controls. Actual client component ran
  with synthetic Clerk responses. Successful redemption reached the dashboard
  destination with the invite intact, activated a session once under React
  StrictMode, and removed the ticket from the URL. Switching also completed.
- These browser checks simulate Clerk and the destination; they do not prove
  production token redemption or a first-time live account.
- The user's original production invitation was observed opening their existing
  saved editor with its invite parameter intact. No live session was switched,
  application cleared, profile saved, or email sent during this investigation.

## Release

No schema migrations, new packages, or new secret names. Existing
`CLERK_SECRET_KEY`, `RESEND_API_KEY`, and public Clerk/site settings are used;
required secret names are present in production and D1 reports no pending migrations. Deploy only the reviewed,
committed change from a clean checkout after Annabel approves.

After deployment, send an authorized replacement acceptance email and test its
exact link while signed out. Also rehearse a genuinely new creator identity;
reusing an established creator email exercises saved-profile recovery instead.
Confirm no extra code, private blank profile, repeat login, and recovery after
one-use redemption. Do not save a test profile unless publication is intended.

References: [Clerk sign-in tokens](https://clerk.com/docs/reference/backend/sign-in-tokens/create-sign-in-token)
and [Clerk user provisioning](https://clerk.com/docs/reference/backend/user/create-user).

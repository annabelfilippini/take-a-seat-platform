# Fresh creator live QA, September 24, 2026

## Scope and identity

Annabel requested a genuinely new application/account, creator editing and
uploads, and a visible card on takeaseatwith.com. Used a unique owner-controlled
email alias and a fresh Playwright browser context. Admin and creator sessions
remained separate. The new profile is clearly named **Take a Seat QA Test**,
slug `take-a-seat-qa-test`; it must not be presented as a real bookable creator.
No existing creator, including Ella, was edited.

## Verified on production

- Application submitted through the public form; receipt arrived in Inbox.
- Admin queue displayed the new application; normal acceptance sent an Inbox
  invitation. Its exact original link opened the blank editor in the fresh
  creator context, with no manual account provisioning or database bypass.
- Uploaded a labeled PNG profile picture, changed its crop, filled About,
  intro, help topics and a test offering, then saved and fully reloaded.
- Added two gallery images, reordered them, updated intro text, saved and
  reloaded. All profile fields and image URLs/order persisted. The availability
  week selector resets to the current week; saved default hours are separate.
- Saved default weekly availability.
- Deliberately returned one browser-local HTTP 503 for this test account's
  photo upload. The UI showed the error. Selecting the exact same file again
  succeeded; the replacement survived save/reload. Restored the labeled image.
- Selecting an existing gallery image showed the duplicate message and disabled
  Add media, leaving the two saved items intact.
- Mobile editor had no horizontal overflow at 390 px. The authenticated customer
  preview displayed the correct text, offering and all three loaded images.
- Signed out through the account-switch UI and signed back in using the fresh
  alias and its actual emailed code. Saved name, updated intro and all three
  media URLs remained intact.

## Found blocker and repair

Google consent returned `creator-access` twice, including with a still-valid
Clerk session cookie. The callback skipped Clerk's cross-origin navigation
handshake. Added the two Calendar OAuth GET paths to the existing session refresh
wrapper. Ownership, signed state, nonce, expiry and single-use checks remain.
No credentials, OAuth grants, callback codes or session cookies are recorded here.

The initial 35-test run passed against the existing booking-development checkout;
that branch is not the deployed source and is not release proof for this repair.
The repair is based on fetched main `1d1bc7c`, including the September 22 photo
upload repair. Current-main checks and final live evidence will be recorded below.

The first current-main Playwright run had 31 passes and one test-harness race:
the offerings journey cleared browser cookies while the old editor was still
mounting its Requests/Payments panels. The trace shows both HTTP 403 requests
without cookies 40 ms after `clearCookies`. End that document at `about:blank`
before clearing cookies and logging in again. Do not suppress the 403 observer;
the separate expired-session journey still deliberately checks signed-out errors.

Final candidate verification:

- Lint and TypeScript pass.
- Production build and all 83 Node tests pass, including the new callback regression.
- All 32 current-main Playwright journeys pass without retries after the harness fix.
- Wrangler deployment dry run passes; production reports no pending migrations
  and all required secret names are present. No schema or secret changes required.
- Production baseline remains Worker `3be6d4c0-b311-4ad1-9783-86a143654506`.
- Adversarial review: callback processing waits for verified authentication;
  signed-out and provider failure stay denied; nonce/state/owner/single-use checks
  are unchanged; POST bodies and unrelated API fetches are not redirected.
- Anonymous live visitor sees no test card on `/` or `/take-a-seat`, and the
  unpublished `/with/take-a-seat-qa-test` returns 404, as expected.

These checks do not establish live callback repair until deployment and real
Google consent succeed. Preserve dashboard variables on deployment and recheck
the active Worker version to avoid overwriting simultaneous work.

## Publication and remaining checks

The profile is a private draft. Production requires a ready Calendar connection
and Stripe payout account before Publish. Annabel authorized Calendar setup and
explicitly reserved Stripe for her other terminal. No Stripe account was created
or configured here; automatic approval review blocked the initial Connect click.
Do not bypass readiness checks or claim the public card is visible.

Pending: repair release approval, actual Calendar callback success/persistence,
fresh public visitor verification after publishing,
and Stripe readiness coordinated by Annabel. The exact original file/device
behind Ella's report has not been supplied, so her specific failure is not proven.

References: [Clerk's session handshake](https://clerk.com/docs/guides/how-clerk-works/overview)
and the installed `@clerk/backend` cross-origin document authentication branch.

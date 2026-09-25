# Creator lifecycle QA, September 25, 2026

**Partial pass; marketplace launch is not certified.** Production application,
email, original invitation, private editing and returning login passed. A
production Stripe callback authentication defect was reproduced and repaired
locally. Complete provider booking remains blocked.

## Environment and boundaries

- Source: GitHub main `35cb5b3bf1dc4db44c3b76b7556e81126e14505f`, independently
  checked against GitHub; branch `codex/creator-lifecycle-qa` in an isolated worktree.
- Production: `https://takeaseatwith.com`, Worker
  `bb9598b8-dbe7-4005-a301-fc0070d92797`, September 25 16:38 UTC, 100% traffic.
  The deployment has no source-commit tag; exact source attribution is not proven.
- Real-provider local app: normal application on loopback port 4274, its own local
  D1, existing restricted Stripe test key and the app's local admin access.
  This proves a real Stripe integration segment, not real Clerk authentication.
- Automated browser suite: separate temporary app/D1 on port 4273, real Chromium,
  with fixture Clerk, Stripe, Calendar and Resend. Fixtures are never deployment
  code and never receive real credentials.
- New production fixture: **Lifecycle QA September 25**, slug
  `lifecycle-qa-20260925`, unique owner-controlled Gmail alias. Admin and creator
  used separate browser contexts; recovery used another fresh creator context.
- No deployment, live payment, payout, legal acceptance, webhook configuration,
  shared-checkout modification, or unrelated creator edit occurred.

## Observed results

| Scenario | Result | Evidence and limit |
| --- | --- | --- |
| Public application | PASS, production | Submitted through actual form; acknowledgment and admin notification arrived in Gmail Inbox. Admin queue persisted the record. |
| Email validation | PASS, local browser/D1 | Invalid email prevented submission; valid application persisted once, remained private, produced both email payloads and survived refresh. Provider delivery here is a fixture. |
| Admin acceptance | PASS, production | Accepted through the actual admin form, starter remained private, delivered acceptance email appeared in Inbox. SMS correctly reported unconfigured. |
| Original email link | PASS, production | Exact original query/fragment link opened the blank editor for the new identity. No direct-dashboard bypass or manual ownership assignment. |
| Wrong-account invite | PASS, production | Separate signed-in admin received explicit account-switch UI; its session was preserved. |
| Reused link and recovery | PASS, production | Fresh context rejected the used ticket, offered an email-code route, and the actual delivered code restored the same saved creator profile. Natural 24-hour expiry was not waited out. |
| Photo/profile/price | PASS, production | Labeled synthetic PNG, intro, about, help topic, active offering and $1 price saved; hard reload and fresh actual email-code login retained the data. |
| Availability | PASS, production | Default weekly slot saved, reloaded and remained selected. Calendar connection is a separate gate. |
| Preview/layout | PASS, production | Correct draft name, text, offering and loaded private image; 1280×900 editor and 390×844 preview inspected. No horizontal overflow or hidden preview-close control. |
| Publication/privacy | PASS for privacy; publication BLOCKED | Own profile absent from directory; anonymous profile and image returned 404. Stripe readiness remains incomplete; Calendar was subsequently connected with owner approval. No gate bypass. |
| Existing published QA card | PASS, read-only production | Directory card opened the other task's `take-a-seat-qa-test` profile; content/images consistent, booking disabled, mobile no overflow and no observed JS/HTTP errors. It was left unchanged. |
| Connect start | PASS, real Stripe test mode | Actual local app button created one test recipient, saved it to local D1 and redirected to Stripe hosted onboarding. |
| Connect cancellation/retry | PASS, real Stripe test mode | Stripe Return to Take a Seat returned `stripe-transfers` setup-needed. Retry reached a fresh hosted link for the same stored account; `livemode=0`, `connected_at=null`. |
| Existing completed Connect onboarding | PASS, current read-only sandbox check | The owner's existing Annabel sandbox recipient, created September 11, has active transfers and payouts. Its onboarding does not need repeating. |
| Fresh QA recipient onboarding | INCOMPLETE | The additional recipient created by this task remains restricted. Its hosted next step includes Stripe terms; no identity/bank data or attestations were invented. This is distinct from the already-completed owner recipient. |
| Cross-origin Stripe callback auth | FAIL in production; FIXED locally | Same session and return parameters passed the same-origin ownership boundary but failed from another origin with `creator-auth`. Details below. |
| Google OAuth for this creator | PASS, production | After explicit owner approval, the actual Connect calendar flow returned `calendar=connected`. HTTP 200 status reports connected, requiring both scopes, a stored refresh token and a successful real Google free/busy probe. Full reload and another authenticated context retained it. |
| Calendar/availability/booking edge cases | PASS, local fixtures | Full suite covers OAuth nonce/owner/replay/partial grants, refresh/revocation, busy filtering, saved hours, timezone/DST, pre-capture conflict checks and retry-safe event operations. These are not new Google delivery evidence. |
| Customer paid flow | PASS, local fixtures only | Published data, immutable prices/durations, timezone conversion, race/slot protections, Checkout progression, acceptance/decline and confirmations exercised. Own production fixture remained unpublished. |
| Full real sandbox booking | BLOCKED | No new hosted payment authorization, webhook delivery, capture, fee, creator notification, Calendar invitation or confirmation-email chain completed in this task. |
| Zoom | NOT IN MAIN WORKFLOW / BLOCKED | Main uses Meet. Zoom/recovery candidate PR #37 remains draft/unmerged; not incorporated or deployed here. No Zoom joining claim. |

## Defect and repair

The session-refresh wrapper included Calendar navigation but omitted Stripe
Connect start/return. Clerk can require a handshake on cross-origin navigation
before the route's creator ownership checks. A controlled callback navigation
using this new creator reproduced the failure without completing onboarding or
creating a live Stripe account. The expected same-origin missing-connection
response also establishes that the identity and creator ID were correct.

`app/_lib/clerk-session-refresh.ts` now includes only those two additional GET
routes. The regression in `tests/creator-lifecycle.test.mjs` failed before the fix
(200 instead of handshake 307) and passes afterward. It checks original query
retention, no route execution before refresh, verified-token forwarding, refreshed
cookies, signed-out denial and provider-authentication failure. Ownership checks,
POST bodies, Checkout and webhook handling are unchanged. This fix is **not live**;
an approved deployment plus actual hosted-return test is still required.

The test harness also reused a destructive global temporary directory. This
branch adopts the isolation approach already prepared in the separate booking
rehearsal: per-invocation source/D1, validated configurable port, consistent
fixture callback URLs and cleanup of only its own directory. No parallel test
source/database was overwritten.

## Verification

- `npm run lint`: pass.
- `npm test`: production build and **84 Node tests pass**.
- `npm run typecheck`: pass.
- Complete existing Playwright suite: **33 pass**, no retries, port 4273.
- Added public-application journey: **1 pass**, invalid email, real D1 persistence,
  two fixture email messages and refresh. Total covered journeys: 34.
- Browser tests assert unexpected page/console errors, request failures and HTTP
  failures; deliberately induced failures are explicitly scoped by each test.
- Credential/fixture scan of built JavaScript/config: zero matches for the actual
  local Stripe key or test-auth/SQL/provider-fixture markers.
- Auth review: route allowlist stays narrow, only GETs refresh, failed auth remains
  denied, and the provider route still verifies the specific creator ownership.
- Visual evidence (ignored): `.wrangler/qa/production-profile-desktop.png`,
  `.wrangler/qa/production-preview-mobile.png` and labeled fixture PNG.

## Current provider/release evidence

Rechecked September 25, not inferred from historical tests:

- Live Accounts v1 and Accounts v2 lists both empty.
- Live Stripe booking webhook still disabled with its six configured events.
- Active Worker still exports only `fetch`, has no booking payment-method
  configuration binding, and has no pending checked-in D1 migrations.
- Stripe/Calendar/Zoom secret **names** exist in production. Actual live Worker
  credential mode and signing-secret match were not inspected or established.
- PR #37 still open/draft at `e9c54d5889ae1ec4d5d0451a259c1fa9d5547857`.
- The owner correctly recalled prior completed Stripe setup. Accounts v2 confirms
  the existing Annabel sandbox recipient has active transfers and payouts, while
  this task's additional local QA recipient remains restricted. Both are test-mode
  accounts; existing onboarding is not a remaining prerequisite.
- [September 14 provider rehearsal](marketplace-live-rehearsal-2026-09-14.md)
  already records actual sandbox authorization, capture, 15% fee, webhook delivery,
  Calendar/Meet invitations and decline. That historical success is retained as
  evidence; it does not certify the current code or the newer Zoom candidate.
- Original checkout's old test key returned 401. The separate rehearsal's newer
  restricted key passed read-only checks for the intended platform, active
  test card-only configuration and Accounts v2. No key was created or widened here.
- Previous local rehearsal still lacks webhook listener/signing setup, Clerk dev,
  separate Google dev OAuth, Zoom and Resend configuration. See its existing
  `/private/tmp/tas-booking-rehearsal-20260924/docs/booking-rehearsal-2026-09-24.md`.
  Its historical successful fixtures do not certify real providers.

## Remaining actions and cleanup

1. Calendar OAuth and the live free/busy probe passed. Real busy-slot effects,
   natural token expiry/refresh and booking invitations still need the complete
   booking rehearsal. Disconnect/revoke was not exercised on this shared owner
   Google account because it could affect other existing test connections.
2. Use the already-ready sandbox recipient for a separately identified downstream
   rehearsal where appropriate, preserving its existing ownership and configuration.
   Do not request repeat owner onboarding. Completing the additional fresh recipient
   is needed only to prove fresh-creator hosted onboarding end to end; that case
   remains unverified, including the app return/expired-link path.
3. Finish the dedicated real-provider rehearsal configuration using the existing
   restricted test key, without changing live settings. Configure a local Stripe
   listener with its actual signing secret and controlled Calendar/email identities.
4. Run one full actual hosted authorization → verified webhook → creator acceptance
   → capture/15% fee → event/invitation → delivered confirmation chain, followed by
   decline/cancel/replay/recovery. Verify Zoom guest joining on the candidate branch
   if that is the intended release. Production launch remains blocked until these pass.
5. Review the auth repair PR; deploy only on Annabel's explicit approval, from a
   clean committed source. Verify its real hosted callback after deployment.

The production QA creator remains a private draft with no bookings and an owner-approved Calendar
connection. No publication was created, so none required removal. The other task's
published test card is untouched. The one incomplete Stripe sandbox recipient is
retained for owner continuation, tied to the task's local D1 only. No real creator,
customer, original browser session, or unrelated record was deleted or reassigned.

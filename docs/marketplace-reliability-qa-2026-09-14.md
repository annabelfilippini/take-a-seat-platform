# Creator/customer reliability audit

September 14, 2026. Branch: `codex/marketplace-reliability-qa`.

## Verdict

**Local application QA: PASS. Overall production release: BLOCKED pending live-provider
rehearsal and an approved deployment.** All 19 Playwright journeys pass with zero retries
and zero unexpected browser/network errors. No known critical/high-priority bug remains
in the tested local scope. No production data was changed by this audit.

## Repairs

| Failure | Root cause | Protection |
| --- | --- | --- |
| Stale creator tab overwrote another tab's saved draft | Whole-form writes had no loaded-version precondition | Server-confirmed monotonic draft revision, conditional D1 update, HTTP 409 with retained edits; old clients must reload |
| Untouched week displayed the old default timezone | Hours and timezone used different fallback precedence | Updated defaults supply both values; explicit overrides keep their own timezone |
| Payout-ready creator could not publish | Publication still required a duplicated historical Stripe timestamp | Current Stripe capability lookup remains authoritative |
| Retrying the same failed photo did nothing | File input retained its selection, so no change event fired | Reset all three upload inputs after retaining the File object |
| Back/forward produced a navigation hydration error | React positional IDs differed in the history-restored tree | Stable route-label-based ID in the shared header |
| Fast gallery disclosure click caused hydration mismatch | Disabled fieldsets do not disable native details/summary | Entire editor stays inert until hydration; delayed-script browser regression |
| Fresh customer contexts emitted icon 404s | Conventional `/favicon.ico` had no handler | Redirect to the existing PNG |

Detailed reproduction, root cause, previous test gaps and regression records are in
[BUG_LOG.md](BUG_LOG.md). No dependency, migration, payment layout or new service.

## Playwright evidence

The runner starts the actual vinext/Cloudflare application with migrated, isolated
local D1. Saves, publication, media, bookings, request decisions and notification
records use the application routes and real D1 persistence. Fixtures replace Clerk
identity and external Stripe/Google/Resend calls only. Production sources never load
these adapters. Browser errors and unexpected HTTP failures are checked across every
journey; induced failures are allowed only at the specific endpoint/status tested.
No retries or skipped tests are configured.

| Journey | Verification |
| --- | --- |
| Acceptance and creator entry | Generated invitation parameters retained; accepted ownership; editor reached |
| Profile/media/offering persistence | Field edits, image bytes, crop/zoom, gallery ordering/deletion; hard refresh and fresh authenticated context |
| Failed and slow saving | Failed save retains edits; rapid newer edits remain unsaved; double click sends one write; retry persists |
| Stale creator tabs | Conflicting whole-form save rejected; D1 preserves the first save; publication cannot bypass conflict; old browser request rejected |
| Draft/public separation | Public A stays visible during saved draft B; preview shows B; publication switches fields together |
| Repeated Publish | One publish request and one coherent public snapshot |
| Offerings | Order, duration, description, price and archive persist; historical booked price remains immutable |
| Availability | Defaults, empty dated override, future week/year navigation, timezone after save and refresh, narrow viewport |
| Stale/default timezone | Untouched weeks inherit the new timezone before refresh as well as afterward |
| Stripe | Current active/restricted/missing states; missing profile timestamp; provider outage clears readiness and recovery rechecks |
| Customer selection | Approved call/time/details/payment progression; configured prices and durations; desktop and narrow viewports |
| Competing customers | Two isolated browser contexts select the same slot and submit concurrently; exactly one reservation/authorization in D1 |
| Stale availability | Removed time rejected on final submission; no booking inserted |
| Request decisions | Acceptance, decline, refresh, repeats; opposing actions from two tabs result in one capture or cancellation |
| Checkout hold | Existing hold blocks another customer; Stripe-confirmed expiry releases it |
| Signed webhook replay | Concurrent duplicate authorization events, post-capture replay, invalid signature; one booking, notification per type, capture and logical calendar event |
| Upload recovery/privacy | Failed replacement retries the identical file; originals persist; unpublished files are inaccessible to guests; publication changes access |
| Browser/session resilience | Expired session cannot save; login restores pending edit save and destination; back/forward followed by mobile-menu interaction |
| Initial interaction | Delayed JavaScript cannot permit native disclosure mutation before hydration |

The separate Node suite also covers DST gaps/folds, one-year date bounds, notice and
buffer rules, provider failures, delayed payment events, capture validation, original
invitation ownership, and transactional availability rollback.

## Commands and artifacts

- `npm run test:e2e`: 19 passed in 50.7 seconds, zero retries/skips.
- `npm test`: production build and all 80 Node tests passed after the final code change.
- `npm run lint`, `npx tsc --noEmit --incremental false`, `git diff --check`: passed.
- Ignored browser report: `.wrangler/playwright-report/index.html`.
- Ignored screenshots: `.wrangler/creator-conflict-mobile.png`,
  `.wrangler/creator-conflict-desktop.png`, `creator-profile-*.png`,
  `creator-availability-mobile.png`, `customer-time-*-after.png`.

Desktop 1280 × 900 and mobile 390 × 844 screenshots were visually inspected.
Conflict text, navigation, retry action and booking-dialog controls were legible and
accessible without horizontal overflow or clipped primary controls.

## Protected customer experience

`CustomerBookingFlow.tsx` and its customer CSS are unchanged by this audit. The existing
session cards, calendar/time selection, details step, payment progression and button
positions remain. Repairs feed data and reliability into that experience.

## Remaining verification limits

- Local fixture login proves application ownership/redirect/persistence behavior,
  not real Clerk verification-code delivery, token expiry or provider session renewal.
- Signed webhook requests prove application reconciliation against local D1, not real
  Stripe event delivery, settlement, Express onboarding or banking readiness.
- Calendar and Resend fixtures prove logical requests and idempotency, not receipt of
  real invitations, Meet creation, inbox delivery, or live Google free/busy correctness.
- Chrome desktop/narrow views were exercised; this is not Safari/Firefox certification.
- Dated overrides can be edited or closed with the existing controls. There is no
  dedicated remove-override-to-inherit-defaults control in the current product.
- Production still serves the earlier code until a reviewed, committed deployment is
  explicitly approved. Existing live rehearsal gates in the control map remain.

# Take a Seat bug log

Read relevant entries and linked incident records before changing affected code.
This is the central index for meaningful bugs. Existing feature notes retain
their detailed historical evidence; link to them instead of duplicating it.
Follow the [engineering release gate](engineering-release-gate.md).

## Existing incident records

- [Creator onboarding lessons](creator-onboarding-lessons.md): original invite
  links, duplicate ownership, shared browser sessions, and email delivery failures.
- [Profile save repair](profile-save-repair.md): oversized inline media, D1 row
  limits, save confirmation, retries, and navigation trapped behind failed saves.

Historical checks in these records are evidence only for what they explicitly
tested. They do not establish that the new Playwright release gate has passed.

## 2026-09-14: Profile media exceeded D1 limits

### Bug

The editor submitted approximately 6 MB of inline gallery images in one draft.
Saving failed and tab navigation waited for that save to succeed.

### User impact

Creators could not save their photos and could become stuck on the Profile tab.

### Root cause

Full camera photos were embedded as data URLs without an adequate storage budget,
exceeding D1's string/row limits. Tab navigation was coupled to save success.

### Fix

The existing repair resizes images, enforces shared media and server row budgets,
and permits immediate tab navigation while retaining mounted unsaved panels.
Save failures retain edits and offer retry; Saved requires backend confirmation.

### Regression prevention

Existing tests in `tests/creator-lifecycle.test.mjs` cover oversized payloads,
UTF-8 byte counts, legacy row space, unchanged data after failure, retry, and
publication. The linked repair record documents local D1/browser and production
reload checks. It does not establish a complete Playwright logout/login journey.

### Related files

- [Detailed repair and release evidence](profile-save-repair.md).
- `tests/creator-lifecycle.test.mjs`.

### Date / feature

Repair deployed September 14, 2026. Creator profile draft saving and navigation.
Indexed here from the existing repair record; not newly discovered in this task.

## Entry template

Append a dated entry for each meaningful bug. Update it as diagnosis and repair
progress. Never invent a root cause or label an unverified fix resolved. Keep
tokens, credentials, and private creator/customer records out of this file.

### Bug

What happened and how it was reproduced.

### User impact

What the creator or customer experiences.

### Root cause

The actual technical reason, not a restatement of the symptom. Mark unknown while
investigating, then replace it with the established cause.

### Fix

What changed, or the current repair status if still open.

### Regression prevention

The test, validation, shared guard, or database constraint preventing recurrence.
Include verification results and explain any impractical automated coverage.

### Related files

Important implementation/test files and any detailed incident evidence.

### Date / feature

Date, affected journey, and environment or release context.

## 2026-09-14: Named offerings lost duration and historical prices

### Bug

Booking duration came from digits in the session title; bookings did not store price, currency, or description snapshots.

### User impact

Renaming an offering could change its effective length, and payment history could not reliably show its original price.

### Root cause

The original implementation assumed two duration-named offerings and persisted only the seat ID/name and appointment times.

### Fix

Add explicit offering durations and immutable booking snapshots, retaining title parsing only for legacy seed seats. Keep archived offerings and their IDs.

### Regression prevention

Domain reservation tests and the Playwright customer/request journey verify durations, original price after publication of a new price, and payment-history display.

### Related files

`app/_lib/offerings.ts`, `app/_lib/bookings.ts`, `db/schema.ts`, `tests/e2e/creator-journeys.spec.ts`.

### Date / feature

September 14, 2026; flexible offerings and historical sessions. Verified in local Playwright and Node regression suites.

## 2026-09-14: Availability could change during reservation

### Bug

The conditional booking insert compared bookings but did not compare the availability used before its calendar-provider call.

### User impact

An availability edit during the provider request could leave an obsolete slot eligible for reservation.

### Root cause

The reservation's atomic predicate guarded only competing bookings, omitting schedule changes.

### Fix

Compare the complete saved schedule in the same conditional insert and re-read the published creator before checking the slot. Keep final server validation and show a specific stale-slot message.

### Regression prevention

Playwright tests stale slots and competing customers. Domain tests retain the simultaneous-reservation guard.

### Related files

`app/_lib/bookings.ts`, `app/with/[slug]/page.tsx`, `tests/calendar-lifecycle.test.mjs`, `tests/e2e/creator-journeys.spec.ts`.

### Date / feature

September 14, 2026; availability and marketplace concurrency. Verified in local Playwright and Node regression suites.

## 2026-09-14: Saved-time label caused hydration failure

### Bug

Playwright saw a browser error and development error overlay after reopening a saved draft.

### User impact

Reloading the editor could regenerate the page and disrupt interactions.

### Root cause

The new saved-time label formatted the same timestamp in server UTC and browser local time, producing different initial markup.

### Fix

Format with an explicit locale and the saved creator timezone on both server and browser.

### Regression prevention

Playwright captures console/page errors while saving, reloading, publishing, and entering a fresh authenticated context.

### Related files

`app/admin/creator-profile-editor-preview/EditableCreatorProfilePreview.tsx`, `tests/e2e/creator-journeys.spec.ts`.

### Date / feature

September 14, 2026; last-saved status. Found during this implementation; verified in local Playwright and Node regression suites.

## 2026-09-14: Controls accepted input before React was ready

### Bug

Playwright filled the server-rendered name field before its change handler attached. A later failed save showed the previous name. An early customer availability click was also ignored.

### User impact

A fast edit on initial load could disappear, or a booking button could appear unresponsive.

### Root cause

Server-rendered controls were interactive before hydration attached React handlers.

### Fix

Keep the creator form/navigation and customer booking entry disabled until hydration is complete, using a shared server/client snapshot contract. The approved booking layout and progression are retained.

### Regression prevention

Playwright immediately interacts after navigation and checks retained edits on failure and the opened customer dialog without arbitrary sleeps.

### Related files

`app/admin/creator-profile-editor-preview/EditableCreatorProfilePreview.tsx`, `app/_components/CustomerBookingFlow.tsx`, `tests/e2e/creator-journeys.spec.ts`.

### Date / feature

September 14, 2026; initial creator/customer interaction. Verified in local Playwright and Node regression suites.

## 2026-09-14: Acceptance rejected its own reserved slug

### Bug

The acceptance journey returned `public-id-taken` for a profile's own reserved public slug.

### User impact

An admin could not finish acceptance for an application with its own slug already assigned.

### Root cause

`getCreatorApplication` resolves both IDs and slugs. A second uniqueness check treated the current profile returned by its slug as a different creator.

### Fix

Reject only when the resolved profile has a different ID. Database uniqueness and the existing duplicate-identity checks remain.

### Regression prevention

The Playwright acceptance fixture retains its reserved slug and must generate a successful email destination.

### Related files

`app/_lib/creator-onboarding.ts`, `tests/e2e/creator-journeys.spec.ts`.

### Date / feature

September 14, 2026; acceptance and entry-link destination. Verified in local Playwright and Node regression suites.


## 2026-09-14: Published creator IDs failed checkout lookup

### Bug / user impact

A visible accepted profile returned “unknown seat” when its customer submitted checkout.

### Root cause / fix

The booking helper sent the internal `onboard_*` ID through public-slug normalization,
changing underscores to hyphens. Resolve the internal ID first, then enforce accepted
status and publication before constructing bookable offerings.

### Regression prevention

The Playwright paid journey uses a distinct internal ID and public slug and completes
authorization, acceptance, history, and competing reservations.

### Related files / context

`app/_lib/creator-onboarding.ts`, `tests/e2e/creator-journeys.spec.ts`.
Found and verified locally September 14; not deployed.

## 2026-09-14: Stale Stripe timestamp blocked a ready account

### Bug / user impact

Payments and Publish correctly showed Stripe readiness, while checkout returned
`stripe-onboarding` for the same currently active connected account.

### Root cause / fix

Checkout required a historical local `connectedAt` timestamp before asking Stripe.
Use the current Stripe transfer capability as the readiness authority, consistently
with Payments and Publish. Missing accounts and provider failures still block checkout.

### Regression prevention

Playwright fixtures intentionally omit the local timestamp while returning active
Stripe readiness; checkout must succeed. Restricted and missing accounts have separate
visible-state checks.

### Related files / context

`app/api/bookings/request/route.ts`, `tests/e2e/creator-journeys.spec.ts`.
Found and verified locally September 14; not deployed.

## 2026-09-14: Abandoned Checkout could hold a slot indefinitely

### Bug / user impact

If Stripe's expiry webhook never arrived, an attached Checkout session remained blocking.

### Root cause / fix

Only the webhook could end an attached hold. Final server booking checks now reconcile
older holds with Stripe. Only a confirmed expired session releases its hold; completed
sessions awaiting delayed authorization webhooks remain protected.

### Regression prevention

Playwright proves expired holds release. Node tests prove elapsed time and delayed
completion events cannot expose a successful checkout's slot.

### Related files / context

`app/_lib/checkout-holds.ts`, `app/_lib/bookings.ts`, `tests/calendar-lifecycle.test.mjs`.
Found and verified locally September 14; not deployed.

## 2026-09-14: Newly saved default hours left readiness incomplete

### Bug / user impact

A creator starting with no schedule could save default hours but still see an incomplete
availability checklist until refreshing.

### Root cause / fix

The checklist considered saved dated weeks and initial rules, omitting newly saved
defaults. Apply the same default fallback used by the week editor when computing readiness.

### Regression prevention

The availability Playwright journey covers defaults, empty overrides, timezones and reload;
a dedicated empty-schedule assertion verifies readiness immediately after the save.

### Related files / context

`EditableCreatorProfilePreview.tsx`, `tests/e2e/creator-journeys.spec.ts`.
Found during final review September 14; local verification recorded in the storefront report.


## 2026-09-14: Media replacement could duplicate gallery items

### Bug / user impact

Replacing one gallery file with another existing file could show duplicate media;
unsupported selections had no clear explanation. A non-image upload could also be
submitted as a profile photo through the media API.

### Root cause / fix

Duplicate checking covered Add only, and file-type checks returned silently. Validate
replacement identity and supported types, show a recoverable error, and reject stored
video sources when saving a profile image. Original byte storage remains deduplicated.

### Regression prevention

Playwright selects a duplicate and an unsupported file, checks the error and disabled
Add action, then saves/reloads to verify one gallery item remains. Profile save validates
media ownership and image MIME type on the server.

### Related files / context

`EditableCreatorProfilePreview.tsx`, `app/_lib/creator-media.ts`, `tests/e2e/creator-journeys.spec.ts`.
September 14; found during final review, local verification in the storefront report.

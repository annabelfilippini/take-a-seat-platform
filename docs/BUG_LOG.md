# Take a Seat bug log

Read relevant entries and linked incident records before changing affected code.
This is the central index for meaningful bugs. Existing feature notes retain
their detailed historical evidence; link to them instead of duplicating it.
Follow the [engineering release gate](engineering-release-gate.md).

## 2026-09-24: Google Calendar callbacks rejected a signed-in new creator

- **Reproduction:** A fresh production applicant accepted the actual emailed
  invitation, saved a profile, and completed Google consent. Two callback attempts
  returned `calendar=error&detail=creator-access`. The second callback carried a
  still-valid Clerk session cookie and came from Google's cross-site document.
- **Root cause:** Clerk requires a handshake for cross-origin document navigation,
  even with a valid session. The Worker refresh wrapper excluded the OAuth start
  and callback routes. `getCalendarOwner` therefore treated the pending handshake
  as signed out, before consuming OAuth state or exchanging Google's code. The
  subsequent editor navigation refreshed the session, hiding the original cause.
- **Fix:** Include only the two Calendar navigation GET routes in the existing
  Clerk refresh wrapper. Preserve the complete callback URL and nonce through the
  handshake, then pass the verified token into the original ownership checks.
  Keep signed-out/failed authentication denied and leave other API calls alone.
- **Protection:** Regression covers handshake-before-callback ordering, original
  code/state/nonce retention, refreshed cookies, signed-out and provider failure,
  and unchanged mutation/API handling. Existing Calendar browser journeys still
  cover ownership, replay, denied scopes, persistence, and disconnect.
- **Release:** Prepared in an isolated main-based checkout. Not deployed; live
  Calendar retest and marketplace publication remain pending. See
  [fresh creator QA](creator-live-qa-2026-09-24.md).

## Existing incident records

- [Creator onboarding lessons](creator-onboarding-lessons.md): original invite
  links, duplicate ownership, shared browser sessions, and email delivery failures.
- [Profile save repair](profile-save-repair.md): oversized inline media, D1 row
  limits, save confirmation, retries, and navigation trapped behind failed saves.

Historical checks in these records are evidence only for what they explicitly
tested. They do not establish that the new Playwright release gate has passed.

## 2026-09-14: Production framework links failed to navigate

- **Reproduction:** Open a fresh production declined-booking confirmation and
  click Creator. Both normal browser and accessibility clicks left the URL and
  page unchanged. The console reported a vinext RSC prefetch setup TypeError.
- **Root cause:** These routes still used next/link and its production vinext
  client-navigation path. The built prefetch module attempted to call a missing
  function. The development-server journeys did not reproduce this production
  framework behavior, so passing those tests alone missed it. The new return-link
  regression also exposed a second mismatch: a booking stores the internal
  creator ID, while its public profile can use a different published slug.
- **Fix:** Replace the remaining next/link uses in booking, admin, About and
  public-profile routes with normal anchors. Browser document navigation avoids
  the failing framework path and preserves classes and layout. The booking
  return link resolves the creator application's public slug before linking.
  No dependency or framework upgrade is required.
- **Protection:** The complete booking browser journey now follows Creator from
  a declined confirmation back to the public booking controls. Production smoke
  verified this transition after deployment: the declined page opened the
  published profile with no captured console errors; admin detail/queue links
  also worked. All 20 browser journeys, 80 Node tests, lint and TypeScript passed.
- **Files:** `app/bookings/[bookingId]/page.tsx`, `app/admin/applications/page.tsx`,
  `app/admin/applications/[creatorId]/page.tsx`, `app/about/page.tsx`,
  `app/with/annabel/page.tsx`, `app/_components/PublicCreatorProfile.tsx`,
  `tests/e2e/creator-journeys.spec.ts`.

## 2026-09-14: Declined customer confirmation still asked for payment

- **Reproduction:** Authorize a sandbox booking, decline it in creator Requests,
  then refresh the customer's booking page. Status read declined, but the heading
  and explanation still said payment authorization was required.
- **Root cause:** The booking page's status-to-copy helpers omitted declined,
  falling through to the initial request text. The creator approval panel also
  remained visible for this terminal state.
- **Fix:** Explicit declined heading and explanation that authorization was
  canceled with no captured payment. Hide creator approval for declined requests.
- **Protection:** Extend the full Playwright booking journey through decline,
  customer confirmation, hard refresh and absence of creator acceptance controls.
  Live Stripe and D1 independently confirmed cancellation before the copy repair.
  A fresh production browser confirmed the corrected declined text after deploy.
- **Files:** `app/bookings/[bookingId]/page.tsx`,
  `tests/e2e/creator-journeys.spec.ts`.

## 2026-09-14: Setup instructions described saving as publication

- **Reproduction:** The live admin acceptance panel and newly delivered setup
  email said a creator card appears after saving the profile.
- **Impact:** Creators could save a private draft and incorrectly believe it was
  public, or avoid saving because they expected immediate publication.
- **Root cause:** The explicit draft/publication split updated the editor but
  left acceptance instructions describing the earlier save-to-publish behavior.
- **Fix:** Admin and both email formats now direct creators to Preview & Publish;
  draft saves are described as private preparation.
- **Protection:** The acceptance-email test checks the draft/publication wording
  in HTML and plain text. All 80 Node tests, lint and 20 Playwright journeys pass.
  Live rehearsal verified a new creator's saved draft survives refresh and
  returning email-code login while D1's publication timestamp stays null.
- **Files:** `app/_lib/email.ts`, `app/admin/applications/[creatorId]/page.tsx`,
  `tests/creator-lifecycle.test.mjs`.

## 2026-09-14: Email invitation account switch stalled on the same document

- **Reproduction:** Open a fresh setup email while signed into a different
  account, then choose Switch to my creator account. Two live attempts stayed
  on the sign-in status with the ticket fragment intact; reloading recovered.
- **Root cause:** The sign-out redirect targeted the identical URL including
  its fragment. Same-URL navigation can remain in the current document, leaving
  the legacy Clerk sign-in hook in its signed-out transition instead of
  initializing a fresh client. The redemption timeout never starts while the
  hook has no sign-in resource. Merely calling location.replace with the same
  URL reproduced the failure in the browser regression as well.
- **Fix:** Use Clerk's post-sign-out callback to explicitly reload the document.
  Suppress ticket redemption during sign-out. The original invitation and
  fragment survive until the fresh client removes and redeems the credential.
- **Protection:** A new Playwright journey runs the real email entry component
  with a test-only Clerk transition boundary, then reaches the real D1-backed
  saved profile. It checks one redemption, retained invitation, removed ticket,
  refresh persistence and continued private status. The old same-document
  transition failed; explicit reload passes. Two production account switches
  passed after deployment without manual reload; the saved draft and original
  admin account were both recovered through their exact email entry links.
- **Files:** `app/_components/CreatorEmailSignIn.tsx`,
  `tests/e2e/clerk-email-client.ts`, `tests/e2e/vite-plugin.ts`,
  `tests/e2e/creator-journeys.spec.ts`.

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

## 2026-09-14: Untouched weeks reused the old default timezone

### Bug

The adversarial Playwright journey saves default hours in America/New_York, then
opens an untouched future week. Its hours inherit the new default, but its timezone
still shows America/Los_Angeles until refresh.

### User impact

Saving that week can unintentionally move customer availability by three hours.

### Root cause

Week navigation reads updated default slot keys from local saved state but resolves
the timezone from the original server rules. The two parts use different fallback
precedence. Earlier timezone coverage reloaded first, masking this stale-state path.

### Fix

Resolve inherited default timezones from the same saved state as inherited hours,
while keeping a dated override's own timezone authoritative.

### Regression prevention

Playwright checks an untouched week immediately after changing an existing default
schedule's timezone and again after refresh. Verified in the final 19-journey Playwright run; all passed.

### Related files

`app/admin/creator-profile-editor-preview/EditableCreatorProfilePreview.tsx`,
`tests/e2e/creator-journeys.spec.ts`.

### Date / feature

September 14, 2026; adversarial creator/customer reliability audit, isolated local D1.

## 2026-09-14: A stale editor could overwrite another tab's saved draft

### Bug

Two creator tabs load the same draft. The first saves a new name; the second edits
About and saves its whole stale form, silently restoring the original name.

### User impact

Previously confirmed saved work is lost. Publishing from the stale tab can replace
public content with the overwritten draft.

### Root cause

Client revision tracking protected only edits within one tab. The server accepted
whole-form replacements without checking the version loaded by that editor.
Publication compared the draft during its own request, after the stale save had
already overwritten it. Existing fresh-login tests never interleaved two writers.

### Fix

Add a server-confirmed draft revision to editor writes and atomically reject stale
updates, keeping local edits visible with instructions to copy them before reloading.
Increment the stored revision timestamp monotonically and return it after commit.
Older browser clients without a revision must reload before replacing an existing draft. Internal callers also receive a database guard against simultaneous writes.

### Regression prevention

Playwright interleaves two tabs, checks the conflict and retained local edits, reads
D1 to prove the first save remains, and verifies publication cannot bypass the conflict.
Verified in the final 19-journey Playwright run; all passed.

### Related files

`app/_lib/creator-onboarding.ts`, `app/_lib/profile-save.ts`,
`app/api/creators/profile/route.ts`, `EditableCreatorProfilePreview.tsx`,
`tests/e2e/creator-journeys.spec.ts`.

### Date / feature

September 14, 2026; adversarial persistence and publication audit, local D1.

## 2026-09-14: Publication still required a stale Stripe profile timestamp

### Bug

Payments reports a currently ready Stripe account and enables Publish, but publishing
fails if `creator_onboarding_profiles.stripe_connected_at` is null.

### User impact

A payout-ready creator cannot publish despite a complete readiness checklist.

### Root cause

The previous Stripe repair removed a stale timestamp check in checkout, but publication
retained a second check on the profile row before its authoritative Stripe lookup.
The prior fixture cleared only the connection-row timestamp, leaving this copy populated.

### Fix

Remove the historical profile timestamp prerequisite. Publication continues to require
a saved account and a successful current Stripe capability check.

### Regression prevention

Playwright publishes with the profile timestamp absent and current provider readiness
active; existing restricted/disconnected cases plus provider-failure tests enforce
fail-closed behavior. Verified in the final 19-journey Playwright run; all passed.

### Related files

`app/_lib/creator-onboarding.ts`, `tests/e2e/creator-journeys.spec.ts`.

### Date / feature

September 14, 2026; adversarial Stripe readiness audit, isolated provider boundary.

## 2026-09-14: Fresh browser contexts requested a missing conventional favicon

### Bug / user impact

Two isolated customer browsers emitted console 404 errors for `/favicon.ico`.

### Root cause / fix

Document metadata supplies `/favicon.png`, but the conventional browser icon request
had no route. Redirect that request to the existing icon; no new visual asset is needed.

### Regression prevention / related files

The two-browser journey monitors errors with source URLs; `app/favicon.ico/route.ts`
resolves the exact failing URL. Browser rerun passes this check.

## 2026-09-14: Retrying the same failed photo upload did nothing

### Bug

After an induced HTTP 503 uploading a replacement profile photo, selecting that same
file again issued no upload. The original photo remained despite provider recovery.

### User impact

Creators cannot retry the failed file without first selecting something different.

### Root cause

The file input retained its selected value. Browsers do not fire a change event when
the same file is selected again. Prior upload tests covered invalid and duplicate
files, but not retrying an identical file after a network failure.

### Fix

Clear each upload input immediately after extracting its File, for profile photos,
gallery replacement and new gallery media. The upload retains the File object.

### Regression prevention

Playwright induces an upload failure, selects the exact same file after recovery,
saves/reloads, and verifies draft/public access before and after publication.
Verified in the final 19-journey Playwright run; all passed.

### Related files

`EditableCreatorProfilePreview.tsx`, `tests/e2e/creator-journeys.spec.ts`.

### Date / feature

September 14, 2026; adversarial media recovery audit, local D1.

## 2026-09-14: Browser-forward navigation produced mismatched header IDs

### Bug

Navigate from the saved creator editor to About, back to the editor, then forward
and open mobile navigation. React reports different server/client `aria-controls`
and nav IDs. The strengthened Playwright observer fails the journey.

### User impact

Browser history produces a hydration error and risks a broken accessible association
between the mobile navigation button and menu.

### Root cause

The shared header's positional React `useId` differs between the initial server tree
and vinext's history-restored tree (`_R_ma_` versus `_R_2p_`). Earlier navigation tests
stopped at the URL change before hydration and did not interact with the returned page.

### Fix

Derive the shared header ID from its stable, route-specific navigation label. All four
callers supply distinct labels and render one header per page. No layout changes.

### Regression prevention

The history journey opens the narrow-screen menu after forward navigation and waits
for its expanded state, keeping error monitoring active through hydration.
Verified in the final 19-journey Playwright run; all passed.

### Related files

`app/_components/PageHeader.tsx`, `tests/e2e/creator-journeys.spec.ts`.

### Date / feature

September 14, 2026; creator browser-resilience audit, local Chrome/vinext.

## 2026-09-14: Native disclosure controls bypassed the hydration guard

### Bug

The full Playwright suite opened Photos and videos immediately after navigation.
React then reported that the server-closed details element was already open.

### User impact

A fast native disclosure click can cause a creator-editor hydration error.

### Root cause

The earlier pre-hydration repair disabled form controls, but HTML fieldset disabling
does not disable native details/summary toggles. Those could mutate server markup
before React attached, unlike the guarded form fields.

### Fix

Make the creator editor inert until its existing hydration signal is ready, covering
native disclosure controls as well as forms and buttons without changing layout.

### Regression prevention

The gallery journey opens its native disclosure immediately after navigation. Every
journey now monitors hydration errors, including tests previously missing observers.
Full suite and deterministic delayed-script regression passed (19 journeys).

### Related files

`EditableCreatorProfilePreview.tsx`, `tests/e2e/creator-journeys.spec.ts`.

### Date / feature

September 14, 2026; regression of incomplete initial-interaction protection.

## 2026-09-16: Calendar connection and OAuth lifecycle lacked usable-state proof

- **Bug / impact:** Expired or revoked credentials still displayed Connected;
  publishing trusted a timestamp. Callback replay/session switches were not
  checked against a consumed server attempt. Reconnecting without a refresh token
  could combine a different Google's account access token with the old refresh token.
- **Root cause:** Historical flags and browser-only callback correlation stood in
  for current provider capability and authenticated, one-use ownership.
- **Fix:** Live free/busy status check, offline/scope checks, creator-only start and
  callback ownership, one-use D1 attempt, fresh refresh token required on reconnect,
  generic errors and in-app disconnect with local credential deletion and revocation.
  Refresh writes compare the prior ciphertext as well as timestamp, so concurrent
  reconnects cannot be overwritten even within the same millisecond.
- **Regression prevention:** Playwright OAuth success, denial, replay, missing code,
  wrong/stale state, account ownership, refresh/revoke/failure/reconnect and persistence.
- **Related files:** OAuth routes, calendar-oauth-security.ts, google-calendar.ts,
  dashboard, migrations 0021–0024, creator-journeys.spec.ts.
- **Context:** September 16, 2026; isolated local application/provider boundaries.

## 2026-09-16: Displayed slots and acceptance used incomplete conflict checks

- **Bug / impact:** Customers could select already-busy slots. A creator could
  accept a request after removing its availability or adding another booking.
- **Root cause:** Browser generation used rules alone; reservation had the full
  guard but acceptance checked Google only. This repeats the incomplete-guard
  pattern in the September 14 availability incident.
- **Fix:** Server slot endpoint filters Google intervals, bookings and active holds;
  final acceptance checks current saved schedule, duration, limits, bookings and
  Google, excluding only the current request. The approved paid layout is preserved.
- **Regression prevention:** Playwright conflict exclusion/unaffected slots, stale
  slot rejection, changed availability before acceptance, timezone/DST and customer
  paid progression; existing atomic reservation regressions remain mandatory.
- **Related files:** bookable-times.ts, availability endpoint, CustomerBookingFlow.tsx,
  google-calendar.ts, bookings.ts and creator-journeys.spec.ts.

## 2026-09-16: Booking calendar destination lacked update/cancellation boundaries

- **Bug / impact:** Confirmed event IDs existed, but no safe update/delete path;
  a retry after reconnect could resolve primary to a different calendar.
- **Root cause:** Calendar synchronization only implemented insertion and stored
  its association after asynchronous Meet creation completed.
- **Fix:** Persist association early and store the returned organizer calendar ID;
  deterministic IDs, pre-insert connection binding, booking metadata checks and ETag-conditional mutations target
  only the booking event. An inaccessible old calendar after reconnect is never
  misreported as a completed cancellation. Reschedule validates and commits D1 before sync. The
  cancellation sync consumes an already-authoritative cancelled booking; it does
  not implement or impersonate a payment refund policy. A meeting URL field prepares
  later Zoom supply while existing bookings retain Meet behavior.
- **Regression prevention:** Playwright repeated confirmation/update/delete, wrong
  metadata rejection, attendee sendUpdates behavior and retained D1 booking records.
- **Related files:** google-calendar.ts, booking calendar route, schema/migrations,
  creator-journeys.spec.ts.

## 2026-09-16: Sessions spanning a DST change had an unsafe wall-clock end

- **Reproduction:** Playwright requests March 14, 2027 or November 1, 2026
  availability in America/Los_Angeles. A 15-minute call at 01:45 was offered.
- **Impact:** Spring's stored 02:00 end does not exist; fall's stored 02:00 end is
  75 real minutes later. Calendar invitations could disagree with the paid duration.
- **Root cause:** Slot generation verified the start against DST but bookings store
  local start/end plus timezone, and end arithmetic assumed no offset transition.
- **Fix:** The shared generator checks the actual elapsed-time end against the
  representable local end and excludes transition-spanning slots. The repeated
  fall hour uses the existing deterministic first occurrence; nonexistent times
  remain excluded. This applies equally to displayed slots and final validation.
- **Regression prevention:** Dedicated Playwright reproduction must pass for both
  transitions, alongside creator/customer timezone and complete booking journeys.
- **Related files:** availability.ts and creator-journeys.spec.ts.


## 2026-09-17: Shared homepage links showed an obsolete promotional image

- **Bug / impact:** Messaging previews showed the old Amber clothing collage instead
  of the homepage headline and towel-haired woman.
- **Root cause:** Root Open Graph and Twitter metadata still explicitly selected
  the old `public/og.png`; previews do not automatically capture the current homepage.
- **Fix:** Select a versioned 1200 × 630 homepage hero capture and align descriptions
  with the current headline. Existing messaging cards may remain cached.
- **Regression prevention:** Browser coverage checks server-delivered metadata,
  fetchable PNG dimensions, refresh, fresh mobile context, and homepage CTA navigation.
- **Verification:** Lint, build and all 82 Node tests pass. The focused Playwright
  journey passes; inspected desktop (1200 × 630) and mobile (390 × 844). Actual
  Messages rendering remains unverified until deployment.
- **Release:** Isolated from the pending booking branch; deployment requires approval.


## 2026-09-17: Three checkout tests expired with the real clock

- **Bug / impact:** The full Node suite rejected three valid-checkout fixtures at
  the availability guard before exercising the intended Stripe behavior.
- **Root cause:** Those tests hardcoded September 17 at 09:30 New York while using
  the real current date; the fixture became a past appointment today.
- **Fix / regression:** Freeze Date to September 14 within each affected test using
  automatically restored Node test mocks. Production availability checks are unchanged.

## 2026-09-22: Creator photo uploads rejected selectable files or stalled editing

- **Report:** A creator could not add photos. Her original file/device/error is
  unavailable, so her exact trigger remains unconfirmed.
- **Confirmed root causes:** Wildcard file pickers offered unsupported formats;
  MIME-only checks rejected missing metadata; camera photos over 8 MB had no
  resize path; unbounded upload requests disabled the entire editor; errors
  appeared away from the gallery picker.
- **Fix:** Shared file preparation, explicit supported picker types, bounded
  native photo conversion/resizing, a 60-second upload timeout, and local error
  feedback. Existing ownership, signature, storage, draft, and publication
  checks remain authoritative.
- **Regression protection:** Playwright checks large-photo D1 persistence,
  reload, returning login, publication, HEIC failure recovery, and a stalled
  mobile upload followed by retry of the same file with text edits preserved.
- **Evidence and limits:** [Upload repair](profile-upload-repair-2026-09-22.md).
  Deployed September 22 from PR #41; production large-photo upload passed.
  The creator's original-file retest remains pending.

## 2026-09-22: Homepage navigation retained the positional hydration-ID bug

- **Observed:** The full upload-repair suite reported a homepage hydration error:
  server `_R_6a_` versus client `_R_p_` for the menu ID and `aria-controls`.
- **Root cause:** `BookingPlatform` still used React `useId`, the same positional
  pattern already repaired in `PageHeader` on September 14. Vinext's server and
  client route trees can allocate different IDs.
- **Fix:** Give the single homepage primary menu a stable page-specific ID.
  Customer booking selection, layout, and payment behavior are untouched.
- **Regression protection:** The homepage journey retains console/network
  monitoring across refresh and now opens/closes the narrow-screen navigation
  and checks its control association.

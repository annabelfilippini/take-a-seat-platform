# Mobile booking flow

Status: implemented on `codex/mobile-booking-flow`, pending review and production approval.

## Behavior

Bookable public profiles link to call selection from the introduction and show
starting price. The call selector compares duration, price, and description in
compact cards. One Find availability button opens the selected call's calendar.

The booking dialog has separate time and details steps. Its header, appointment
summary, and footer stay visible while the middle scrolls. Back/Edit time retain
name, email, topic, and optional contact details. Changing the call length clears
the selected slot. Unavailable dates are disabled, Continue requires a slot, and
empty months offer the next available date when one exists.

The details form requires name, email, and topic. Phone and Instagram are optional
and disclosed together. The footer repeats the price and explains that Stripe
Checkout authorizes payment, which may hold funds until the creator accepts.
The existing booking endpoint, calendar conflict checks, reservation rules, manual
capture, and webhook behavior are unchanged. The UI never claims a booking was
accepted before the server confirms it.

## Ownership

- Shared interaction: `app/_components/CustomerBookingFlow.tsx`.
- Early entry link: `app/_components/BookingEntryLink.tsx`.
- Public routes: `/with/[slug]` and `/with/ella`.
- Existing static/concept routes and creator-editor preview are outside this change.
- No new package, service, secret, route, or database migration.

## Verification

- `npm run lint`: passed with no warnings.
- `npm test`: build and 68 tests pass.
- `npm run typecheck`: generates the local Cloudflare declarations, then checks TypeScript.
- Existing calendar lifecycle rehearsal now also checks that a guest request without
  phone/social data retains the full name, topic, and creator-local timestamp in
  the reservation. Providers in this integration test are mocked.
- Real Chrome browser: 1512 × 861, 390 × 844, and 320 × 568.
- Checked initial profile booking entry, both call lengths, date/time selection,
  disabled Continue before selection, details layout, required-email validation,
  optional fields, returning to change time without losing entered details,
  Escape/close with focus restored to the trigger, and scrolling in the small dialog.
- A local guest form with phone omitted reached the existing safe database-setup
  error. No real payment, email, calendar event, or production booking was created.
- Local preview uses the repository's Ella seed data, not production creator data.
- Live Stripe Checkout, authorization, capture, and inbox/calendar delivery still
  require the existing launch rehearsal. This UI QA does not establish those gates.

## Review and release

Started from GitHub main `1f74f84` in an isolated worktree. The separate
`codex/dated-availability` commit and original checkout's uncommitted documents
were preserved. Coordinate the two branches before release; this branch does not
include the separate availability migration.

Adversarial review checked stale selection, duplicate submission, native form
validation, optional fields, source time zone, dialog focus/scroll behavior, and
failure-state reporting. No unresolved release-blocking finding specific to this
UI change remains; the live-provider rehearsal above remains a release limitation.

Production is not deployed by this change. Review the preview and PR, complete
required launch checks, then obtain Annabel's explicit production deployment approval.

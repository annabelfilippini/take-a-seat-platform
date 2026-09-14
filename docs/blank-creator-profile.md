# Blank creator profiles

## Profile template revision, September 13

Implemented on `codex/creator-profile-template`; pending production approval.

- Accepted creators use the shared editor at `/creators/dashboard`. Identity
  stays prefilled from their application; About, conversation topics, photos,
  and prices stay empty until they fill them in. Seat options start disabled.
- The top section pairs identity and “Pull up a seat for…” topics with a photo
  carousel. An empty carousel has an upload prompt and no inactive arrows.
- About and “Schedule a time to meet” appear below the carousel. The profile
  no longer asks for a separate public intro, one-to-one reason, or descriptions
  for each seat. Existing stored values are preserved, not deleted.
- The reusable public `/with/[slug]` layout matches this order and omits the
  retired intro, reasons, seat descriptions, and generated gallery captions.
  Dedicated seed profile routes keep their existing presentation.
- “How does your seat work?” is a shared, always-visible question and answer
  at the bottom of the public profile and editor Profile tab, with no dropdown.
- Save behavior is unchanged: saving an accepted profile publishes it. This
  revision does not introduce draft/publish controls or change invitation auth.
- No migration, secrets, service, or production-data changes are required.

Verification uses a synthetic accepted creator in an isolated local D1 database:
blank state, upload two photos, edit topics/About, enable a priced seat, save,
reload, and inspect its public profile. Desktop (1440 px) and mobile (390 px)
checks cover carousel arrows, content order, booking dialog, and no horizontal
document overflow. No live invitation or production account is used.
After integration with `main`, `npm run lint` and `npm test` (production build
and all 68 tests) passed. The shared booking flow was checked through time
selection and customer details on both viewports without submitting a booking.

## Original blank-profile release

Deployed September 12, 2026, with Annabel's explicit approval.

New accepted creators start with their application name, contact details and
social links. Photos, gallery, intro, About, help topics, location, one-to-one
copy and session descriptions are empty. Prices start empty and both session
options are off. The editor retains its standard 15/30-minute structure,
category, currency and timezone settings.

The application no longer generates profile copy or sample $45/$80 prices.
Before the first accepted-profile save (`profile_saved_at` is null), the editor
also ignores prototype content in applications submitted by older releases.
Existing profiles with a save timestamp retain their saved content and prices.
There is no database cleanup or migration.

Missing photos use initials instead of Amber's image. An empty gallery has no
carousel controls. Saving blank text or session descriptions does not restore
sample text. Private application answers remain available to admin review but
are not used as public profile copy. Saving still publishes the accepted profile.

Verification:

- Lint and the production build plus all 63 tests passed.
- Lifecycle coverage exercises submission, acceptance, invitation ownership,
  legacy sample defaults, a blank editor, first save, reload and cleared fields.
  Existing saved-photo, gallery, crop and price regression coverage also passes.
- Local browser QA at 1440 × 900 and 390 × 844 checks blank fields, no photo,
  empty prices, disabled offerings, editing and both Save buttons. The narrow
  viewport has no horizontal document overflow.
- Browser save responses use a local stub; persistence is separately tested
  through the real route/domain code with SQLite using the D1 statement API.
- No production application, email, identity or profile was changed during QA.

## Production release

- PR #15 merged to main as `bd93506` (source identical to tested `54e508d`).
- Deployed from clean checkout `/private/tmp/tas-blank-release-20260912`.
- Worker version: `4f1d0fc8-a88c-41bf-bac8-fc70db7329f1`, serving 100% of traffic.
- Previous version for rollback: `4a969948-12d5-4cbf-9ff8-646ec5c0dc08`.
- Before deployment, D1 reported no pending migrations and all required Worker
  secret names were present. No secret values were read or changed.
- Production build succeeded. Public home, application, sign-in, dashboard entry
  and directory HTTP checks succeeded. The live browser application form omits
  generated profile copy, descriptions, sample prices and enabled offerings.
- The deployed editor JavaScript matches the release artifact byte for byte.
  No new live application, emailed invitation, OTP, or profile save was rehearsed.

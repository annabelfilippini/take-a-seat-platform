# Blank creator profiles

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

## Pending layout update

The accepted creator editor and `/with/[slug]` follow Ella's profile layout:
round headshot, name, social links and intro beside a wide gallery; About,
help topics and the one-to-one reason below; call options and pricing on the
right. Gallery upload controls sit with the gallery, and empty media retains
two blank frames in the editor. The public booking form is unchanged.

Profile copy maps to its matching section without filling cleared fields from
the bio. A published Ella profile also respects empty saved media and text,
instead of restoring launch-fixture content. No migration is required.
These layout changes are local and have not been deployed.

Verification: lint and all 74 tests pass. Local browser checks cover the blank
editor on desktop and at 390px, text edits, adding a help topic, photo upload,
and the call-section anchor below the mobile header. Public profile layout and
Ella's image loading were checked too. Test edits were discarded without saving
to an account; persistence and cleared-field behavior are covered by the local
SQLite lifecycle tests. The application-form changes from the earlier
misunderstanding have been removed.

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

# Blank creator profiles

Prepared September 12, 2026. Production deployment requires Annabel's approval.

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
- No production application, email, identity, profile or deployment was changed.

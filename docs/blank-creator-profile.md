# Blank creator profiles

## Profile setup revision, September 13

PR #22 combines the accepted-creator setup and public profile. Annabel approved
production deployment on September 13.

- `/creators/dashboard` uses five steps: Your profile, Your calls, Availability,
  Get paid, and Go live. Requests and notification settings remain accessible.
- The spacious setup form keeps a numbered sidebar and a live profile preview on
  desktop. Phones use a compact step row and a full-page Preview page dialog.
- Accepted creators keep application identity, but start About, conversation
  topics, pictures, and prices empty, with both calls disabled.
- Public profiles pair identity/topics with a carousel at the top. About and
  “Schedule a time to meet” follow. Calls show duration and price. A plain,
  always-visible “How does your seat work?” answer is last, without a dropdown.
- Removed intro/tagline, one-to-one explanation, call descriptions, and gallery
  reference captions are absent from the reusable public page and setup form.
  Older stored fields remain preserved. Dedicated seed routes retain their layout.
- Save draft and Save and continue keep profile content and call prices private.
  For an already live creator, public fields stay at the last published snapshot.
- Go live / Publish changes explicitly publishes the saved draft. Server checks
  accepted status, name, photo, About, topics, positive prices for enabled calls,
  saved availability, and connected Google Calendar and Stripe timestamps.
- Availability and account connections are operational settings. Saved hours
  affect existing live booking availability immediately; the form says so.
- Private application answers and identity contacts are never copied into the
  public snapshot. Invitation authentication and ownership are unchanged.

Migration `0016_magenta_sabretooth.sql` adds nullable `profile_draft` and
`draft_saved_at` columns in D1. Existing live fields and publication timestamps
are unchanged. Apply this additive migration before deploying the new Worker.
No new secrets or services are required. The old Worker can run with the extra
columns, but rolling back also restores the old publish-on-save behavior.

Verification uses synthetic local data only. Lifecycle tests exercise blank
profiles, private saves, live snapshots, authorization and readiness failures,
explicit publishing, restored edits, and the booking/calendar flow after
publication. Browser QA covers desktop and 390 px mobile editing and previews.
No production creator, email, invitation, or external connection is used for QA.

Release verification: lint, TypeScript, and the production build with all 70
tests pass. Desktop (1440 px) and mobile (390 px) QA covers blank fields, photo
upload, step navigation, private save/reload, draft/live separation, availability
save, preview dialog, incomplete setup, and explicit Go live (private 404 becomes
public 200). Preview pages have no horizontal overflow. Local connection flags
are synthetic; real OAuth/payout readiness and paid-booking launch gates are
unchanged. Production preflight confirms all required secret names and only
this release migration pending.

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

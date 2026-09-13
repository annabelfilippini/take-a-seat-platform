# Dated creator availability

Prepared September 13, 2026. Not deployed.

Creators can navigate dated Sunday–Saturday weeks with previous/next arrows,
select a date to jump ahead, and save different hours through the calendar-year
anniversary in their selected timezone. The final partial week disables dates
beyond that anniversary. New creators start with no hours. Changes are saved
one week at a time; drafts survive week/tab navigation and failed saves.

Existing recurring schedules remain the default for untouched weeks. A dated
week replaces the entire default week, including when the creator clears all
hours and saves. The editor explains when it starts from recurring hours.

## Storage and booking

- Migration `0016_lively_molecule_man.sql` adds nullable `week_start` to
  `creator_availability_rules`. Null means an existing recurring default.
- A disabled dated row records an explicitly closed week. It must survive account
  and public-profile serialization so default hours do not reappear.
- New API saves require a valid Sunday and valid quarter-hour slots within the
  current calendar-year horizon. Saves replace only that creator/week.
- Delete and insert run in one atomic D1 batch, with small insert groups to stay
  within the [D1 parameter limit](https://developers.cloudflare.com/d1/platform/limits/).
- Public slot generation and server booking validation cover the same full year,
  retaining notice, buffer, and booking caps. Timezone conversion resolves the
  offset at the appointment instant and rejects nonexistent spring-forward times.

## Verification

- `npm run lint`, `npm run typecheck`, and `npm test` pass after rebasing onto
  current GitHub main (74 tests, including the production build).
- Automated cases cover adjacent weeks, empty-week overrides, defaults, reload,
  malformed/out-of-range input, unauthorized saves, rollback on insert failure,
  fragmented schedules, the anniversary, notice, buffers, caps, and DST.
- Local browser QA uses the real React editor and CSS with synthetic profile data
  and a local save fixture. Desktop: separate weekly selections, keyboard toggles,
  drafts across navigation, failure/retry, save controls disabled while pending,
  reload, date jump and final-day limits. Mobile: navigation, selection, clearing a week, and save
  controls at 390 × 844 and a narrow 320 × 740 layout. The creator sticky header
  is opaque so scrolled calendar text cannot show through. Production authentication and D1 writes were not exercised
  through that browser fixture; persistence is covered by SQLite/D1 domain tests.

## Release

Apply migration 0016 before deploying the new Worker. It preserves existing rows.
Old open editor tabs will need a refresh because new saves require a week.
Roll back code only to another dated-availability-aware build: older save code
replaces all rules and older booking code interprets dated rules as recurring.
No new service, dependency, secret, or Stripe configuration change is needed.
Production deployment requires Annabel's explicit approval.

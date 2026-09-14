# Availability and profile QA

September 13, 2026. Follow-up to the deployed six-month availability release.

## References

Inspected Mobbin's actual screen previews for:

- [Calendly: Editing weekly hours](https://mobbin.com/flows/91856e2b-26a9-4544-8ec5-376b9eb73b4f): schedule context, timezone, weekly/date-specific hours, and saved feedback.
- [MasterClass: Editing profile](https://mobbin.com/flows/edb55ab7-cd68-4a15-afcc-94168486b2c5): editable profile fields and an explicit Save action.

These are interaction references, not evidence about Take a Seat persistence.

## Findings repaired

- Week switching discarded timezone edits and could show Saved incorrectly.
  Timezones now remain attached to their week, including drafts and saved changes.
- Saving availability moved the creator to Payments. It now keeps the calendar open.
- Clearing one week incorrectly reset the overall availability setup check.
  The check now accounts for saved hours in other weeks.
- An empty successful save displayed Unsaved. Empty weeks now display Saved,
  including after navigation and reload.
- Availability drafts lacked reload protection and useful failure feedback.
  Unsaved weeks now register a leave warning, errors retain drafts, and a
  pending request blocks duplicate submission and editing.
- Mobile week labels clipped; the selector now uses Week of labels in its own
  row. Arrow controls have 44px height, and the save button wraps within its panel.

## Checks completed

The real local editor, API routes, and local D1 were used, with the dedicated
mock profile. Production profile data was not modified. The mock needed accepted
status to exercise creator profile drafts; an application draft is not that flow.

- Keyboard slot selection, independent weeks, and unsaved drafts across weeks.
- Timezone edits across navigation, successful save, and full reload.
- Simulated HTTP 500: availability and profile changes remain; retry returns 200.
- Pending availability save disables week selection, timezone, and Save.
- Empty week persists on reload while another week retains its selected slot.
- First/last week navigation boundaries and 26 weekly options at the test date.
- Accepted-creator profile save, failure/retry, and full reload restore saved text.
- Desktop 1440x1000 and narrow 390x844 / 320x740 layout checks; screenshots
  inspected for navigation, date labels, header overlap, and control clipping.
- Lint, typecheck, and 76 automated tests, including build, passed. Domain tests
  cover unauthorized writes, rollback, six-month boundaries, defaults, and DST.
- Production migration listing reports no pending migrations; required secret
  names are present. No new migration or secret is needed for these UI fixes.

## Verification limits

The original production invitation URL was opened with its query intact. This
browser is signed out and sees the creator sign-in flow. Authenticated production
Save/reload and Publish/public-page checks were not performed in this pass.
Local browser persistence plus domain tests do not replace that final live check.

Profile Save currently stores a private draft; Go live / Publish changes updates
the public profile. Immediate public updates on Save remain a product decision,
not a verified capability. Mobbin comparisons and passing tests do not establish
zero defects or complete Stripe/Google Calendar launch readiness.

# First Influencer QA

Reviewed September 12, 2026, against `https://takeaseatwith.com` and local
`main` at `f224b53`. Stripe's deeper review is outside this report.

## Decision

Hold the full creator setup invitation until calendar connection and the
availability editor are corrected. The application page is usable for a
personally supported pilot, but this review does not establish a fresh,
first-time application-to-invitation rehearsal.

## Findings

### P1: Calendar OAuth returns to the wrong domain

The live signed-in dashboard's **Connect calendar** link starts on
`takeaseatwith.com`. Google's account chooser receives this redirect URI:

`https://take-a-seat-platform.annabelflip1.workers.dev/api/google-calendar/oauth/callback`

The nonce cookie is host-only on the domain that starts the flow
(`app/api/google-calendar/oauth/shared.ts:75`). The callback rejects a missing
or different nonce (`app/api/google-calendar/oauth/callback/route.ts:58`).
Therefore, the observed cross-domain return cannot pass nonce validation.
This conclusion combines the live authorization URL with the callback code;
Google consent and a successful callback were not completed in this review.

Fix the production redirect URI and Google's authorized redirect configuration
to use `https://takeaseatwith.com/api/google-calendar/oauth/callback`. Retest
from the actual dashboard button through consent and back to the dashboard.
Also show calendar success, cancellation, and error messages: the signed-in
dashboard currently ignores those query parameters and opens the Profile tab.

### P1: Dated availability controls save a repeating weekly schedule

The live editor shows **Select date**, a particular week, and dated day columns.
However, its save payload contains only `dayOfWeek` and `startTime`, without the
selected date/week (`EditableCreatorProfilePreview.tsx:2084`, `:2108`). Saving
also copies the selected pattern into every cached week (`:1287`). The server
then generates recurring weekly slots (`app/_lib/availability.ts:225`).

A creator marking one Tuesday can unintentionally offer every Tuesday.
The smallest fix is to present this as recurring weekly availability, remove
the misleading date picker, and explain repetition. If date-specific schedules
are intended, store dates and exceptions instead. No production availability
was saved during this review.

### P1 before bookings: Google Calendar busy events are not checked

`app/_lib/bookings.ts:91` validates weekly rules and existing Take a Seat
bookings. It does not request Google free/busy data. The Google module creates
events but does not implement the conflict lookup. Connecting Google alone
will therefore not exclude appointments already in the creator's calendar.

Implement and rehearse conflict checking before automated booking launch.
This is separate from Stripe and need not block an application-only pilot.

### P2: Mobile application navigation overlaps the heading

At 390 × 844, opening the menu on `/creators/onboard` places **Find a Seat**
over **Apply to Inspire**. The transparent navigation allows the heading to
show through. The expanded header extends to y=274 while the heading starts
at y=176. Navigation works, but the overlap is visibly unfinished.

Give the expanded menu an opaque surface or move the page content below it.
Relevant styles: `app/globals.css:5645` and `:5667`.

### P2: Public demo and rating presentation needs cleanup

- `/with/ella` displays **Profile preview for Ella's first Take a Seat mockup**
  (`app/with/ella/page.tsx:83`). Either intentionally label the page as an
  example or replace the prototype announcement before presenting it as live.
- Directory cards show a hardcoded **5.0** rating, without a review-derived
  value (`app/_components/CreatorDirectory.tsx:129`). Remove that rating until
  there is real supporting review data.

### P2 before bookings: Appointment timezone is invisible

The booking modal converts times to the visitor's detected timezone but does
not name that timezone beside the slots. The checked example displayed
6:30 AM for a 9:30 AM Eastern slot. Show the timezone explicitly so the creator
and customer can interpret appointment times consistently.

### Follow-up: Creator dashboard logs a hydration error

Two live dashboard loads logged React error 418. The dashboard recovered and
tabs worked; one early Settings click needed repeating. Investigate differing
server/client initial text, including date-sensitive availability state, before
calling the console clean. The root cause was not isolated in this review.

## Verification

| Check | Result |
| --- | --- |
| Build and automated suite (`npm test`) | Passed, 41/41 tests |
| Standard `npm run lint` | Failed on an existing unused React import in ignored scratch file `.wrangler/invite-qa/main.tsx` |
| Scoped lint (`npx eslint app db worker tests --ignore-pattern dist --ignore-pattern .next`) | Passed |
| Home, mission, directory, application, sign-in, Ella profile | Live pages returned 200 |
| Search and category filtering | Search for Ella and empty Food result worked |
| Public mobile layouts | No horizontal document overflow or broken image elements on the five checked core pages |
| Application menu | Links work; overlap finding above |
| Booking modal | Desktop and mobile calendar, slot selection, customer fields, scroll to payment button, and close checked; no request/payment submitted |
| Existing accepted creator | Live saved profile opened; Profile, Availability, date picker, and Settings inspected on desktop/mobile; no account switch |
| Anonymous access | Creator dashboard and admin queue showed sign-in gates rather than private records |
| Application form validation | Read native validity: email and phone required; names, handles, and expertise optional; no live submission |
| Email evidence | Existing September 11 branded application emails found in the admin Gmail inbox |
| Original invite repair | Prior successful exact-link production retest documented in `creator-onboarding-lessons.md`; not repeated here |

## Remaining verification limits

- Automatic approval review rejected clicking the production application Submit
  button because it could create an application and send notifications. No
  workaround submission was attempted. A fresh authorized test recipient and
  live submission/acceptance/email/invite rehearsal remain needed.
- Google consent, token refresh, busy-event conflicts, event creation, and
  notification delivery were not completed live in this pass.
- Saving profiles, uploading media, saving availability, and changing notification
  preferences were not exercised against production. Saving the existing test
  profile would republish its card. Local lifecycle tests cover profile save and
  publication, but are not a substitute for a fresh creator rehearsal.
- Worker version, current remote migrations, and secret inventory were not
  independently rechecked. No production deployment or configuration change
  was made. No application, invitation, email, text, or booking was created.
- The three pre-existing documentation changes were preserved. Product code
  was not changed. Browser viewport overrides were restored.

## Recommended order

1. Correct calendar OAuth domain and surface its return status.
2. Make recurring availability explicit.
3. Fix the mobile menu overlap and public demo/rating presentation.
4. Run one authorized fresh test application through emailed invitation and
   profile setup, keeping its test profile private.
5. Send the first influencer a personally supported setup invitation.
6. Keep calendar conflict/event testing and Stripe's independent review as
   booking launch gates.

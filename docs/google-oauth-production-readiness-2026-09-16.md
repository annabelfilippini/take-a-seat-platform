# Google Calendar production setup and verification submission

Prepared September 16, 2026. This is the setup/submission pack for the implementation
in [the architecture and release report](google-calendar-implementation.md).
**The application was deployed with Annabel's approval on September 16 from main
`dca3b8b`; migrations 0021–0024 and live desktop/mobile smoke checks passed. Google
Console configuration, domain verification and Google verification approval remain
unconfirmed.** Earlier account observations
are historical: project `take-a-seat-platform` had an External/Testing audience,
blank homepage/privacy URLs and undeclared Data Access scopes. Recheck the Console.

## 1. Project and environment separation

Use the existing `take-a-seat-platform` project for production after auditing its
clients. Create a separate project named **Take a Seat Development** for local and
staging testing (Google will assign/validate its unique project ID). Do not put
localhost, preview hosts or development-only clients in the production project.
Existing production tokens are tied to their issuing client: retain that client
when possible, remove its development redirect entries, and move development to
the separate project. Changing the production client requires creator reconnection.
Do not delete/rotate the currently used client before scheduling that transition.
Google recommends separate testing/production projects and excludes development
origins from production clients. [Google production policy guidance](https://developers.google.com/identity/protocols/oauth2/production-readiness/policy-compliance).

## 2. Enable Calendar API

Select the production project in Google Cloud Console. Open **APIs & Services →
Library**, search **Google Calendar API**, select it and choose **Enable** if needed.
If **Manage** is displayed, inspect **Enabled APIs & services** and confirm Google
Calendar API is listed. Service name: `calendar-json.googleapis.com`.
Repeat in the separate development project. No API key or service account is needed
for this server-side user-consent integration. [Google Calendar setup](https://developers.google.com/workspace/calendar/api/quickstart/python).

## 3. Google Auth Platform → Branding

| Field | Exact value |
| --- | --- |
| App name | `Take a Seat` |
| User support email | `annabelflip1@gmail.com` |
| Application homepage | `https://takeaseatwith.com/` |
| Application privacy policy | `https://takeaseatwith.com/privacy` |
| Terms of service | Leave blank; no published terms page is claimed |
| Authorized domain | `takeaseatwith.com` |
| Developer contact email | `annabelflip1@gmail.com` |
| Optional app logo | Existing `public/favicon.png`, if approved for branding |

Select the support address from Google's eligible dropdown. If absent, sign in as
that project owner or add the authorized support identity; do not substitute an
unmonitored address. Keep developer contact monitored. Deploy and open the homepage
and privacy page without signing in before submission. Confirm the homepage's
Privacy link and the Calendar connection area's policy link are visible.

## 4. Google Auth Platform → Audience

Choose **External**. Creators use personal Google accounts and accounts outside one
Workspace organization. Development remains **Testing**, with authorized test users.
When the production website, credentials and submission materials are ready, open
production **Audience → Publishing status → Publish app**, confirm **In production**.
This removes the testing-only audience restriction; it does **not** approve sensitive
scopes. Unverified warnings/user limits may remain until verification. Testing
Calendar grants generally have a seven-day refresh-token lifetime. Production grants
can still expire or be revoked; reconnect handling remains necessary. [Google OAuth app states](https://developers.google.com/identity/protocols/oauth2/production-readiness/overview).

## 5. Google Auth Platform → Data Access

Choose **Add or remove scopes**, add these exact scopes and save:

```text
https://www.googleapis.com/auth/calendar.freebusy
https://www.googleapis.com/auth/calendar.events.owned
```

| Scope | Exact endpoint and feature | Why narrower access is insufficient |
| --- | --- | --- |
| `calendar.freebusy` | `POST https://www.googleapis.com/calendar/v3/freeBusy`; primary-calendar conflicts filter customer slots and are rechecked at reservation and acceptance | Scheduling requires busy intervals on the creator's existing calendar. No event contents are needed. This is the documented narrow free/busy scope. |
| `calendar.events.owned` | `POST /calendar/v3/calendars/{calendarId}/events`, `GET`, `PATCH` and `DELETE /calendar/v3/calendars/{calendarId}/events/{eventId}`; creator-owned Take a Seat event insertion, retry recovery, reschedule and cancellation synchronization | Read-only/freebusy scopes cannot create invitations or update/cancel the booking event. `calendar.app.created` limits access to app-created secondary calendars; the product writes to the creator's existing primary calendar. Owned-events access avoids writing other people's shared calendars. |

The GET/PATCH/DELETE paths use only the stored deterministic Take a Seat event ID
and verify booking metadata; they never list unrelated events. No full `calendar`,
`calendar.readonly`, CalendarList, Gmail, Drive, Contacts, profile or customer-calendar
scope is requested. Customer invitations do not require customer OAuth consent.
[Free/busy API](https://developers.google.com/workspace/calendar/api/v3/reference/freebusy/query),
[insert](https://developers.google.com/workspace/calendar/api/v3/reference/events/insert),
[patch](https://developers.google.com/workspace/calendar/api/v3/reference/events/patch),
[delete](https://developers.google.com/workspace/calendar/api/v3/reference/events/delete).

## 6. Google Auth Platform → Clients

Edit the current production client after confirming its ID matches the deployed
Worker's GOOGLE_CLIENT_ID; or create a **Web application** client named
**Take a Seat Production Web** if the existing client is unsuitable.

**Authorized redirect URIs: exactly one**

```text
https://takeaseatwith.com/api/google-calendar/oauth/callback
```

**Authorized JavaScript origins: leave empty.** There is no browser Google SDK or
browser token exchange. If Google presents this optional field, no origin is needed.
Do not add localhost, www, workers.dev or a new callback path. The existing Worker
canonicalizes production GET/OAuth entry requests to takeaseatwith.com, so the nonce
cookie and callback share the canonical host. Local dev uses its own origin-derived
callback, for example `http://localhost:3000/api/google-calendar/oauth/callback`,
registered only in the separate development project/client.

## 7. Production Worker secrets

| Runtime name | Source / handling |
| --- | --- |
| `GOOGLE_CLIENT_ID` | Production Web OAuth client's Client ID. Non-secret identifier; stored as server configuration alongside the secret. |
| `GOOGLE_CLIENT_SECRET` | Client secret for that exact production client. Cloudflare Worker secret only. |
| `GOOGLE_TOKEN_ENCRYPTION_KEY` | Independent high-entropy application encryption key, not supplied by Google. Preserve the existing key for existing encrypted connections. |

The obsolete `GOOGLE_OAUTH_REDIRECT_URI` is not read; the example no longer suggests
configuring it. No Google value needs a NEXT_PUBLIC_, VITE_ or frontend variable.
Do not paste real values into docs, shell history, tickets or this report. Use
Cloudflare's secret-entry UI or an interactive secret command when setting values.
Confirm names exist without exporting values. The legacy codec supports a client-secret
fallback for previously stored tokens; production should use the independent key.
Changing an encryption key requires re-encryption or creator reconnection, not a
blind secret replacement. Keep production credentials out of local test files.

## 8. Domain ownership

Sign into Search Console using a Google account that is an owner/editor of the
production Cloud project. Add a **Domain** property for `takeaseatwith.com`.
Choose the **manual DNS TXT** method. Copy the exact generated
`google-site-verification=...` TXT value into Cloudflare DNS at the root (`@`),
then select **Verify** in Search Console after propagation. Keep the record.
Do not invent a TXT value, overwrite existing verification records, or authorize
Google to manage the Cloudflare account merely to verify a domain. Confirm the
property's verified owner identity corresponds to the production project team.
[Google brand/domain verification requirements](https://developers.google.com/identity/verification/authentication-verification).

## 9. Verification Center submission

After the reviewed app is deployed and its URLs work publicly, open **Google Auth
Platform → Verification Center**. Complete brand verification and the Data Access /
sensitive-scope submission. Check that the displayed client, domain, homepage,
privacy notice, support/developer contacts and declared scopes match the app.
Supply the descriptions below, an accessible unlisted demo-video link and secure
reviewer access arrangements. Read the per-project requirements Google actually
shows; this document cannot establish their approval status. Monitor the contact
inbox and Verification Center for follow-up. [Sensitive-scope submission guidance](https://developers.google.com/identity/protocols/oauth2/production-readiness/sensitive-scope-verification).

## 10. Copy/paste app description

> Take a Seat is a marketplace where customers book private one-to-one video calls
> with creators. Accepted creators sign into their own Take a Seat account, save
> their working hours, and optionally authorize Google Calendar from Availability.
> Take a Seat reads free/busy intervals from the creator's primary calendar to
> exclude conflicts from customer time choices and rechecks availability before
> reserving and confirming an appointment. After confirmation, Take a Seat creates
> a booking event on the creator's owned calendar, creates a Google Meet link, and
> invites the customer's email through Google Calendar. The customer does not need
> to connect a Google account. Booking records remain authoritative in Take a Seat.
> The calendar integration can update or cancel only the corresponding booking
> event. Creators can disconnect without losing saved hours or booking records.

## 11. Copy/paste scope justifications

**https://www.googleapis.com/auth/calendar.freebusy**

> Take a Seat uses POST /calendar/v3/freeBusy to obtain busy time intervals on the
> connected creator's primary calendar. The server subtracts those intervals from
> the creator's saved Take a Seat hours, existing bookings and temporary booking
> holds. It repeats the conflict check before reservation and creator acceptance.
> We do not list private events or expose event titles, descriptions, locations,
> attendees or notes to customers. This scope supplies the scheduling information
> required without permission to read full event contents.

**https://www.googleapis.com/auth/calendar.events.owned**

> Take a Seat uses events.insert on the creator's existing owned primary calendar
> after a booking is confirmed. The event contains the appointment time and title,
> the customer's email as an attendee, a meeting link, and a private booking ID.
> Google sends attendee invitations using sendUpdates=all. A deterministic event ID
> supports events.get recovery after interrupted processing; prepared reschedule
> and cancellation synchronization use events.patch and events.delete on that same
> stored ID, with booking ownership checks. Read-only and free/busy permissions
> cannot create or maintain these invitations. calendar.app.created would require
> a separate app-created calendar instead of the creator's existing primary one.
> We therefore request owned-events access rather than full Calendar access.

## 12. Copy/paste reviewer instructions

> Open https://takeaseatwith.com/ and its linked Privacy page. Contact
> annabelflip1@gmail.com for an accepted test creator identity under your control.
> We will supply the exact public test-profile link and secure access arrangement
> directly to the Google review team; no passwords or one-time codes appear in
> repository documentation. Sign in at https://takeaseatwith.com/sign-in with that
> creator email and its emailed verification code. Open /creator/profile and select
> Availability. Save future hours in the stated IANA timezone. Click Connect
> calendar, choose your review Google account, approve both requested permissions,
> and return to Availability. Refresh to verify the connected status persists.
>
> Create a disposable busy event inside those saved hours in the same Google
> account's primary calendar. Open the supplied public test-profile link, choose
> the call and Find availability. The conflicting interval is absent and unaffected
> times remain available. Remove only that disposable conflict after the check.
>
> Coordinate a Stripe test-mode booking with the Take a Seat team, using their
> prepared test creator and customer inbox. Do not use a real payment card for the
> review. The customer chooses an available time and authorizes the test payment.
> In the creator's Requests tab, accept the request. Observe one confirmed booking
> event, its meeting link, and the customer invitation in Google Calendar. Repeating
> processing retains the same event. The attendee can respond through Google's
> normal RSVP controls. Finally disconnect in Availability and verify saved hours
> and the Take a Seat booking remain.

Before sending these instructions, Annabel must actually provision that reviewer
identity and authorized test-payment context. Do not claim the local E2E identity
`creator@example.com` exists in production. The real reschedule/refund customer UI
is not part of this change; demonstrate event creation to justify write scope,
and describe backend synchronization honestly if Google asks about update/delete.

## 13. Video recording script

1. Use disposable creator/customer accounts and a clean browser profile. Open the
   canonical homepage; show the app name and Privacy link, then the Calendar notice.
2. Sign in as the accepted test creator. Do not record passwords or emailed codes.
3. Open Availability. Show saved future hours and the creator's IANA timezone.
4. Click Connect calendar. Show Google's real consent screen, Take a Seat identity
   and both permissions, then approve. Record the actual flow, not the mock used
   in automated tests. Redact authorization codes/tokens if visible in a URL.
5. Show the direct return to Availability, connected status, and hard refresh.
6. Open the connected primary Google Calendar. Create a clearly named disposable
   busy event overlapping the saved hours; use no private pre-existing events.
7. Open the public test creator page as a customer. Show the original approved time
   picker, its viewer timezone, the missing conflicted slot and unaffected slots.
8. Choose another slot and complete an authorized Stripe test-mode request. Show
   creator Requests → Accept request → Booked. Do not expose payment secrets.
9. Show the single Take a Seat Google event with correct date/time, creator organizer,
   customer attendee and meeting link. Show the customer's normal Google invitation
   and RSVP behavior. Customers never authorize calendar write access to Take a Seat.
10. Show retry behavior retaining that event. If demonstrating the backend reschedule
    service, show validated D1 change and the same event moving, not a fictional UI.
11. Disconnect in Availability. Show Not connected and retained saved hours/bookings.
    Reconnect to demonstrate recovery, then clean up only disposable review artifacts.
12. Upload an accessible unlisted recording and verify it plays without account
    access requests. Submit its link in Verification Center with the scope text.

## 14. Application release and manual checklist

- Review the code and migrations linked in the implementation report; run lint,
  typecheck, production build/Node tests and all Playwright journeys.
- Apply the new generated D1 migrations before the approved Worker deployment.
- Confirm Google, Clerk, Stripe and notification secret names for the intended
  Worker. Do not rotate the existing encryption key during this release.
- September 16 production deployment was explicitly approved and completed from
  clean, committed main `dca3b8b`; see the implementation report for version and
  live smoke evidence. Future deployments still require Annabel's approval.
- Complete the Console, API, domain and verification steps above; then have the
  actual creator complete real Google sign-in/consent and verify the fresh connection.
- Rehearse real provider conflict detection, a confirmed Stripe test booking,
  one event, attendee invitation delivery, refresh, revoke/reconnect and disconnect.
  Local fixtures prove application behavior; they do not prove Google delivery.

## 15. Limits to state accurately

Google controls verification approval, external account challenges, Workspace admin
restrictions, quotas and attendee invitation delivery/display. An attendee's Google
settings can require acceptance before an invitation appears on their calendar.
Changing publishing status is not verification approval. Offline access is renewable,
not permanent. Only the creator's primary calendar is checked; secondary/shared
calendar selection would be a separate product change. Existing Google Meet remains
active; Zoom is a prepared meeting-URL input, not an implemented Zoom integration.

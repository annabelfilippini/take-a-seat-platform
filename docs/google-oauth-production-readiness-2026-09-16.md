# Google OAuth production readiness

Prepared September 16, 2026. This is a configuration and release checklist, not
evidence that Google has approved the app.

## Current state

- Google Cloud project: `take-a-seat-platform` (`Take a Seat`).
- Audience: External.
- Publishing status: Testing.
- Ella's intended Google account is already in the test-user list. No additional
  test-user entry is needed for her rehearsal.
- Testing is the reason a Calendar authorization and offline refresh token can
  expire after seven days. The creator must reconnect Google Calendar after that
  expiry until the app is moved to production.
- The production callback is already authorized:
  `https://takeaseatwith.com/api/google-calendar/oauth/callback`.
- A live provider rehearsal already proved persisted OAuth, free/busy conflict
  rejection, deterministic event creation, Google Meet creation, and customer
  invitation delivery. See `marketplace-live-rehearsal-2026-09-14.md`.
- OAuth branding currently has the app name and support/developer email, but the
  application homepage and privacy-policy URL are blank.
- Google Auth Platform Data Access currently declares no scopes even though the
  application requests two Calendar scopes at runtime.
- The Google account that owns the Cloud project has not yet verified ownership
  of the `takeaseatwith.com` Search Console domain property.

## Required production configuration

Deploy the reviewed public privacy page before saving these URLs in Google:

- Application homepage: `https://takeaseatwith.com/`
- Privacy policy: `https://takeaseatwith.com/privacy`
- Terms of service: optional for this submission; do not invent a URL.
- Authorized domain: `takeaseatwith.com` (already listed).
- App logo: the existing square `public/favicon.png` can be used if branding
  review needs a logo.

Declare the exact scopes used by `app/api/google-calendar/oauth/shared.ts`:

```text
https://www.googleapis.com/auth/calendar.freebusy
https://www.googleapis.com/auth/calendar.events.owned
```

The scope justification should stay narrow and match the product:

- `calendar.freebusy`: check the creator's primary calendar for conflicts before
  a customer can reserve and again before the creator accepts.
- `calendar.events.owned`: create one creator-owned appointment with a Google
  Meet link and customer invitation, and retrieve that same event safely on
  retry.

Do not request broader Calendar read/write access. The app does not need full
calendar contents, contacts, Gmail, Drive, or profile scopes for this integration.

## Submission sequence

1. Merge and deploy the public `/privacy` page from a clean, reviewed branch.
2. Confirm the production privacy URL returns HTTP 200 and the homepage visibly
   links to it on desktop and mobile.
3. Verify `takeaseatwith.com` ownership in Search Console with the generated
   manual TXT record in Cloudflare DNS. This avoids authorizing Google to access
   the Cloudflare account. Keep the record after verification.
4. Save the homepage and privacy URLs on Google Auth Platform > Branding. Add the
   square logo only if it is ready to become part of the verified brand.
5. Add the two exact Calendar scopes on Data Access and save.
6. Change Audience from Testing to In production. Until Google approves the
   sensitive scopes, users may still see an unverified-app warning and the
   unverified-user cap remains relevant.
7. In Verification Center, submit brand and sensitive-scope verification. Supply
   the narrow scope justifications above, a video showing the complete Connect
   Google Calendar flow and resulting creator state, and any temporary reviewer
   access Google requests. Never put invitation tokens, email codes, OAuth tokens,
   or private creator/customer data in the submission video or repository.
8. Monitor the Cloud project support/developer inbox and answer Google reviewer
   questions. Sensitive-scope review timing is controlled by Google.

## Ella reauthentication

After the app is In production—or immediately before Ella's onboarding session
if review is still pending—Ella should sign in with the exact email from her
accepted creator application, open the Availability tab, and choose the existing
Google Calendar connection control. The OAuth flow deliberately uses
`prompt=consent`, so completing it writes a fresh encrypted access/refresh-token
pair while preserving her profile and availability.

After reconnecting:

1. Confirm the creator UI reports Google Calendar connected.
2. Hard-refresh the profile and confirm the connected state persists.
3. Add a short disposable busy event to Ella's primary calendar and verify a
   request for that time is rejected before Checkout.
4. Remove only the disposable rehearsal event and do not modify Ella's saved
   profile content or availability without her direction.

Ella must complete her own Google sign-in, consent, and any verification prompt.
No one else should enter or retain her Google credentials or verification code.

## Release evidence prepared locally

- Public `/privacy` page describes the actual Calendar scopes, encrypted token
  storage, event identifiers, service providers, revocation, and deletion path.
- The public homepage links to `/privacy`.
- Desktop and 390-pixel browser checks passed locally.
- `npm run lint`, `npm run typecheck`, and `npm test` pass with 81 tests.

This work does not change Google, Search Console, Cloudflare DNS, production code,
or Ella's stored Calendar connection until the corresponding reviewed actions are
explicitly approved and completed.

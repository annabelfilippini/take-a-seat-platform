# Launch rehearsal, September 25

## Release candidate

The isolated candidate at `/private/tmp/tas-booking-rehearsal-20260924` combines
booking release `e9c54d5`, current main `35cb5b3`, and Stripe return-session repair
`e32e3fb`. Merge conflicts preserved both bug histories, the current application
journeys, and the Zoom/recovery provider fixtures. A duplicated test import was
removed. The original shared checkout and its untracked Stripe status note were
preserved. Production has not been deployed or switched to live payments.

Browser testing reproduced an actual release bug: zero-notice availability offered
a session whose 30-minute acceptance cutoff had already passed. Commit `b3dc265`
shares the response margin between payment deadlines and the common slot generator.
Listings and server validation now exclude those times. Longer creator notice and
the approved booking layout are preserved. See the bug log for root cause.

## Fresh verification

- Lint and TypeScript: pass.
- `npm test`: production build and **90 Node tests pass**.
- `TAKE_A_SEAT_E2E_PORT=4187 npm run test:e2e`: **40 pass**, no retries, 1.6 minutes.
- The first combined run had two failures exposing the near-term deadline bug;
  the complete final run passes after the fix.
- Desktop and narrow/mobile time selection, empty availability and confirmed
  booking screenshots inspected. Controls are visible without horizontal clipping.
- `npm run deploy:dry-run`: pass; no publication.
- Compiled JS/JSON scanned against actual local secret values and test auth/control
  markers: zero matches.
- Adversarial review of the fix: the common generator covers listed, submitted,
  fallback and stale slots; the exact cutoff fails closed. Fixed-clock regression
  covers these boundaries; full browser acceptance and competing decisions pass.

The browser suite uses real local D1 persistence and fixture external providers.
It is not proof of the complete real Zoom/Stripe/Calendar/email chain.

## Existing real-provider evidence

The separate [homepage rehearsal](homepage-booking-rehearsal-2026-09-25.md) completed
today on the currently deployed Google Meet flow: actual hosted sandbox payment,
signed webhook HTTP 200, creator acceptance, capture, 15% fee, Google invitation,
creator emails, persisted confirmation and a second declined authorization.
Do not repeat the owner's completed sandbox Connect onboarding. The new Zoom
candidate still needs its own combined real-provider rehearsal.

Fresh read-only checks in this task:

- Restricted sandbox key authenticates to the intended platform, the matching
  active card-only configuration and Accounts v2 (all HTTP 200).
- Existing development Clerk credential authenticates (HTTP 200).
- Existing Resend credential is sending-only: domain-list read returns the explicit
  `restricted_api_key` error. That is not an invalid-key diagnosis or delivery proof.
- Live connected-account list remains empty. Live webhook remains disabled with
  its six expected events and canonical URL.
- Production Worker `bb9598b8-dbe7-4005-a301-fc0070d92797` remains at 100% traffic,
  deployed September 25 at 16:38 UTC. Remote D1 has no pending repository migrations.

## Setup completed and pending

Annabel approved the existing Annabel test identity/Gmail for labeled test messages
and Calendar invitations. Existing development Clerk and sending configuration were
copied privately into the isolated ignored `.dev.vars` (0600), alongside the existing
restricted test Stripe credential. No production credentials were changed.

Annabel separately approved creating **Take a Seat Development**, project ID
`take-a-seat-development`, linked to the existing selected billing account. Creation
succeeded. Production Google configuration is unchanged. Development OAuth branding
is prepared with that name, External/Testing audience and owner contact. Its final
Google User Data Policy acceptance is awaiting specific confirmation. The Calendar
API page is open but Enable has not been clicked; its API terms also apply. No OAuth
client or Calendar grant exists yet for this project.

Stripe official CLI 1.52.0 is available through npm execution without changing repo
dependencies. It was initially unauthenticated. A test-only device pairing was
prepared using ignored `.wrangler/stripe-cli.toml`. Automatic approval review blocked
the initial code entry because CLI access had not been specifically authorized.
Annabel then authorized test-environment CLI access, and Test mode was selected.
The final page discloses **Super Administrator** test access and enabling CLI access
for all team members on that selected test account. Approval of that exact broader
permission is pending. No live account was selected; authorization is not complete.
If pairing expires, restart only the pending CLI pairing; do not create another
Stripe platform or widen the restricted application key.

## Remaining release gates

1. Complete approved development OAuth setup, Calendar API terms/activation, and a
   Web client with callback `http://127.0.0.1:4188/api/google-calendar/oauth/callback`.
   Owner completes any credential-entry and Calendar consent steps required by UI
   policy. Keep production callbacks unchanged.
2. Complete the specifically approved test-only CLI pairing, forward six payment
   events to the local app, and privately save its actual signing secret. Do not
   change existing shared-test or live webhook destinations.
3. Supply existing Zoom S2S configuration securely to the isolated app; keep the
   single licensed host. Verify unattended two-participant joining, including any
   action-time legal/camera/microphone approval.
4. Use normal development authentication and isolated D1 for the full candidate
   booking → signed authorization → creator acceptance → capture → Zoom → Calendar
   invitation → delivered confirmation, then decline/refund/recovery. The fixture
   server is not this real-provider app.
5. Prepare the coordinated live credential/signing/configuration change and first
   creator live onboarding. Creator identity/bank details/legal acceptance remain
   owner actions. Resolve production Google Testing/verification for durable grants.
6. Obtain approval to deploy the exact committed candidate only after the real
   provider gates pass. Enable the live webhook with the matched release/config,
   verify scheduler invocation and full post-deploy flow. Real-money rehearsal
   requires separate specific authorization.

No claim is made that launch or the full new real-provider rehearsal is complete.

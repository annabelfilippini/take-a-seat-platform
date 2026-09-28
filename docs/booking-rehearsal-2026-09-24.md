# Booking rehearsal preparation

Updated September 25, 2026. Automated preparation passes. The complete real-provider
booking rehearsal is still blocked by credentials and development-provider setup.

## Isolated candidate

- Branch: `codex/booking-rehearsal-20260924`.
- Worktree: `/private/tmp/tas-booking-rehearsal-20260924`.
- Booking release `e9c54d5` merged with current main `1d1bc7c` at `01a9773`.
- Only conflict was appended bug-log entries; both histories were retained.
- Includes the latest photo-upload and navigation fixes.
- Nothing pushed or deployed. PR #37 and the original checkout remain unchanged.

Each fixture server invocation now owns a unique temporary app/database instead
of resetting the shared `/private/tmp/take-a-seat-e2e-app` directory. The
`TAKE_A_SEAT_E2E_PORT` setting controls server/browser URLs, cookies, fixture
Checkout redirects and OAuth assertions. Default is 4173; this run used 4187.
The fixture server copies no real credentials and cleans up its own directory.

## Verification

Lint, TypeScript, production build and **87 Node tests passed**.
**38 Playwright journeys passed in 1.6 minutes**, one worker, no retries, no
unexpected browser errors under the suite's console/network assertions.
Mobile confirmation screenshot inspected without clipping/overflow.

Coverage includes original invite and returning login, profile/media persistence,
publication, customer booking, authorization, acceptance, decline, expiration,
refund, reschedule, capacity, ownership and recovery after lost capture/Zoom
responses and Calendar/email outages. D1 is real local persistence; Clerk,
Stripe, Google, Zoom and Resend are fixtures. This does not prove real Checkout,
Calendar consent, email delivery, Zoom joining or scheduled Worker delivery.

```sh
npm run lint
npm run typecheck
npm test
TAKE_A_SEAT_E2E_PORT=4187 npm run test:e2e
```

## Actual Stripe checks

The original checkout's local test credential returned HTTP 401; its file was
not changed. Existing restricted test key **Take a Seat Cloudflare test Connect**
was retrieved privately from the authenticated sandbox dashboard and saved only
in this worktree's ignored `.dev.vars`, mode 0600. Read-only API checks confirm
the intended platform `acct_1TcSNS1B3wHKPpd6` and active, test-mode, card-only
configuration `pmc_1UGPTd1B3wHKPpd6A9yy9PLM`. That configuration is set locally.
That older key returned HTTP 403 for Accounts v2 list.

A separate **Take a Seat local booking rehearsal 2026-09-24** restricted key was
created on September 25 after Annabel's explicit confirmation. It replaced the
older key only in this worktree's ignored `.dev.vars`, with mode 0600. No existing
Stripe key was edited. The new key passed all three read-only API checks with
HTTP 200: correct platform account, active test card-only payment configuration,
and Accounts v2 list. The previous Connect read-access blocker is resolved.

| Granted resource | Platform permission | Connect permission |
| --- | --- | --- |
| Accounts v2 | Read | Read, linked by Stripe |
| Recipient Configuration | Write | Write, linked by Stripe |
| Accounts | Read | n/a |
| Account Links; Login Links | Write | n/a |
| Checkout Sessions; Payment Intents; Charges and Refunds | Write | None |
| Application Fees; Transfers | Write | n/a |
| Payment Method Configurations; Events | Read | None |
| Webhook Endpoints, Event Destinations | Read | n/a |
| Balance | None | Read |

Other resources remain None. These read checks do not prove
onboarding/capture/refund writes. Do not silently widen
permissions or substitute an unrestricted key. The key is for the local rehearsal
app and cannot operate live-mode objects.

## Remaining preparation

1. Restricted test key creation and read-access checks are complete. Exercise
   onboarding, Checkout, capture and refund writes during the actual rehearsal.
2. Configure a local Stripe event listener and its signing secret. The listener
   needs appropriate CLI authorization, which is not included in the restricted app
   key. Keep existing shared-test and production webhook destinations unchanged.
3. Supply Clerk development credentials and a test creator identity. Do not use
   production identities or expose fixture authentication.
4. Set up a separate development Google OAuth client with callback
   `http://127.0.0.1:4188/api/google-calendar/oauth/callback`, the existing two
   Calendar scopes and a consenting test creator. Do not add development callbacks
   to the production client. See the existing Google production setup document.
5. Supply the existing dedicated Zoom host's credentials securely. No additional
   license is authorized. Two-participant joining and any required legal acceptance
   are still pending.
6. Configure Resend and explicitly select test recipients before sending real email
   or Calendar invitations. Production secrets remain unchanged.

Read-only preflight, printing only presence/status and refusing live Stripe keys
or non-loopback origins before network access:

```sh
node tests/rehearsal/preflight.mjs .dev.vars
```

The fixture server is not the real-provider server. Real-provider rehearsal uses
the ordinary application, development authentication and its own local D1 on port
4188 once configured. Do not paste real credentials into the fixture server or
expose its SQL/auth control route. Real scheduled recovery needs a Worker
handler/trigger rehearsal; fixture tests invoke the same maintenance function
through a local test-only route.

## Evidence

HTML report: `.wrangler/playwright-report/index.html` in this worktree.
Fixture screenshots are retained in the original checkout, outside Git:

- `.playwright-mcp/booking-rehearsal-2026-09-24/booking-confirmed-mobile.png`
- `.playwright-mcp/booking-rehearsal-2026-09-24/booking-requests-mobile.png`

No real customer was charged, emailed or booked. One approved restricted test key
was created. No real-provider booking, existing-key rotation, deployment or
production change was made. The overall preflight remains incomplete because
webhook, Clerk, Google, Zoom and Resend configuration is still missing locally.

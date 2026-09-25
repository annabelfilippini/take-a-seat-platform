# Homepage booking rehearsal, September 25, 2026

**Existing homepage card: real sandbox booking and decline pass. Additional QA
card: in progress.** Annabel requested a public creator card and an actual
customer journey from the homepage through time selection and sandbox payment,
then explicitly chose to publish an additional QA creator.

## Starting evidence

- The homepage already displays Annabel's published card at
  `/with/annabel-filippini`, with $45/15-minute and $80/30-minute offerings.
- The existing recipient remains associated with that creator in D1; its test-mode
  transfers and payouts are active. The deployed Payments endpoint independently
  reports connected and a balance with `livemode=false`. No ownership reassignment
  or Stripe setup was performed.
- The existing sandbox webhook is enabled at the Worker's `/api/stripe/webhook`
  endpoint, with the six booking events. The disabled live webhook is a separate
  resource and is not relevant to proving sandbox delivery.
- Homepage card navigation and Find availability open the expected customer
  booking modal. The availability endpoint returns HTTP 503 on repeated attempts,
  displays an availability-check error and prevents progression to payment.
- The failure also appears at 390×844 with no horizontal overflow; the close
  control and error remain visible. Screenshot retained in ignored
  `.wrangler/qa/rehearsal-availability-failure-mobile.png`.

## Calendar diagnosis

The existing connection contains both required Calendar scopes and an encrypted
refresh token. It was connected September 15 and last refreshed September 16.
The authenticated Google Cloud console still reports External / Testing for
`take-a-seat-platform`. Google documents a seven-day refresh-token lifetime for
these grants. The creator dashboard reported reconnection required. After normal
creator email-code login and owner-completed Google sign-in, reconnection returned
`calendar=connected`, the live status/free-busy check passed, and the public
availability request recovered without any code or schedule change. The old grant
was unusable; its age and Testing status support expiry as the explanation. The
exact Google token-endpoint error was not exported.

The existing creator identity uses a separate owner-controlled inbox. The owner
supplied its verification code and completed Google sign-in in an isolated browser
context. Admin access is deliberately insufficient for attaching a Calendar to a
different creator. No access or readiness checks were bypassed.

Source: [Google OAuth token expiration](https://developers.google.com/identity/protocols/oauth2#expiration).

## Completed real-provider evidence

| Check | Observed result |
| --- | --- |
| Homepage to customer booking | Fresh anonymous context clicked Annabel's homepage card, chose the $45/15-minute offering, selected September 26 at 15:15 America/Los_Angeles and entered an owner-controlled customer alias. |
| Mobile booking UI | 390×844 time selection and details inspected; selected time, price, back/close controls and payment progression visible. |
| Actual Checkout | Stripe hosted page explicitly showed Sandbox and the expected offering/price. Used Stripe's public test card; Link storage disabled. |
| Authorization before acceptance | Stripe `requires_capture`, manual capture, $45 capturable, $0 received. Persisted app request was `payment_authorized`, with no Calendar event. |
| Creator notification | Request appeared in the actual creator Requests tab; request email arrived in the creator Inbox. |
| Webhook | Stripe Dashboard showed HTTP 200 for the actual `checkout.session.completed` delivery to the existing sandbox webhook. |
| Acceptance and capture | Clicked Accept request in creator UI. It became Booked; Stripe confirmed `succeeded`, $45 received, $0 remaining capturable. |
| Fee and recipient | Stripe recorded $6.75 application fee (15%) and a $45 destination transfer to the existing creator recipient. Creator net before other adjustments is $38.25 after the platform fee. No real money moved. |
| Calendar and customer confirmation | D1 retained one deterministic event. The customer Inbox received a September 26, 15:15–15:30 PDT invitation with a Google Meet link. Reloaded customer page showed Appointment confirmed and approved. |
| Creator paid email | Actual paid-booking email arrived in the creator Inbox. |
| Persistence and duplicates | Independent D1 read found one booking, one event ID and one notification each for requested/paid. The booked 15:15 slot disappeared from public availability. |
| Decline | Second hosted $45 sandbox authorization for 16:15 was declined through the creator UI. Stripe status became canceled, with $0 received/capturable. Customer reload showed Request declined and explained that no payment was captured. No event was created. |

Non-secret references:

- Accepted booking `booking_66f2e3c2-3ef3-454f-ba36-0afc5eb9e22e`, payment
  `pi_3UJd3G1B3wHKPpd60kzS33Bl`, event `evt_1UJd3H1B3wHKPpd6qPAkceAa`.
- Declined booking `booking_6b98f86e-2456-48cd-aa90-66098baf8875`, payment
  `pi_3UJdDY1B3wHKPpd61W2hOcd8`.
- Ignored evidence: `.wrangler/qa/rehearsal-time-mobile.png`,
  `.wrangler/qa/rehearsal-details-mobile.png`,
  `.wrangler/qa/rehearsal-confirmation-mobile.png`.

## Remaining work and limits

- Publish the additional `lifecycle-qa-20260925` card, then repeat the customer
  booking on that exact card. Its saved profile and approved Calendar are ready;
  its separate Stripe recipient was created through the actual deployed Connect
  button and is awaiting owner completion of hosted test onboarding/terms.
- The extra already-captured acceptance replay was rejected by automatic approval
  review as a possible duplicate capture/notification. It was not executed or
  bypassed. Read-only counts passed; destructive replay is not claimed as tested.
- Google External / Testing remains a launch blocker: reauthorization restores
  this rehearsal, but does not remove the seven-day grant expiry. Production OAuth
  setup and verification still need their own reviewed configuration changes.
- Checkout currently displays additional dynamic payment methods. This run proves
  card authorization/capture; it does not certify every alternative payment method.
- Main uses Google Meet. This does not certify draft PR #37's Zoom/recovery work.
- App-page checks after reconnection had no unexpected JS/HTTP errors. Stripe's
  hosted page aborted two third-party hCaptcha image requests during navigation;
  payment still completed. No CAPTCHA was solved or bypassed.
- A Cloudflare read briefly returned 7403, then succeeded on one read-only retry.
  Persisted app/API and Stripe observations independently agreed throughout.

The accepted test event remains September 26 at 15:15–15:30 Pacific, explicitly
labeled as a test in its note. It occupies that slot. The declined request has no
Calendar event. No production code deployment, provider-setting change, legal
acceptance by the agent, or real-money operation occurred. Existing Annabel draft
profile edits and unrelated creators remain unchanged.

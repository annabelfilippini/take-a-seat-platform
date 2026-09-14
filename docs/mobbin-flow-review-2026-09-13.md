# Mobbin flow review

Research date: 2026-09-13. Recommendations only; no product changes or deployment.

## Scope and evidence

Take a Seat currently uses creator and influencer for the same hosting role.
This review covers that role and the customer booking a call.

Reviewed the README, control map, creator application/editor source, booking
source, and the live directory → published profile → calendar → request form
journey. No application, booking, payment, or email was submitted. Creator
dashboard findings are from source inspection; this was not a full desktop and
mobile QA pass. Local code and production may differ.

Mobbin tools are not exposed in this session. No Mobbin search results or paid
reference screens were retrieved. The recommendations below are product
judgments based on Take a Seat, with a research brief for validating them.

[Mobbin's feature documentation](https://docs.mobbin.com/mcp/features) describes
`search_flows` for multistep journeys, `search_screens` for individual interfaces,
and `search_sections` for website sections. It also documents an inline results
gallery in Codex App. Its [MCP page](https://mobbin.com/mcp) lists paid-plan access
and OAuth authorization. The official endpoint is `https://api.mobbin.com/mcp`.

## Recommended creator journey

Apply → application received → acceptance link → guided setup → preview →
publish → manage requests and upcoming calls.

1. **Make setup a visible sequence.** The dashboard currently defaults to Profile,
   with Availability, Payments, and Settings as peers. Add a checklist for profile,
   session offer/pricing, available hours, calendar, and payouts. Each item should
   show its actual saved or connected state and one next action. Resume after
   returning from Google or Stripe without losing progress.
2. **Separate saving from going public.** Accepted creators' profile saves currently
   set publication timestamps. Provide Save draft, Preview, and an explicit Publish
   action. Distinguish profile completeness, public visibility, and readiness to
   accept paid requests. Decide whether incomplete integrations permit a visible
   profile with bookings disabled. Enforce the chosen rule on the server.
3. **Put Requests and Bookings in primary navigation.** They currently appear in
   Settings as notifications. Returning creators should see pending requests and
   upcoming calls first. A request detail should show the customer's question,
   local date/time, duration, payment state, and acceptance action. A future decline
   action requires real payment-release/status behavior, not just a button.
4. **Keep dated availability and reduce repetition.** Preserve different schedules
   for different weeks. Research explicit Copy previous week and Apply to selected
   weeks actions, with confirmation of the dates affected. Show upcoming bookable
   hours, saved state, timezone, and what an empty week means. This extends the
   current dated-week work; it should not replace it with recurring-only hours.

## Recommended customer journey

Creator profile → choose call → choose time → request details → authorize payment
→ awaiting creator → confirmed call and joining instructions.

1. **Give request details enough room.** In the live flow, selecting a time adds
   six fields beneath the slots in the calendar's right column. Use a dedicated
   details step with a persistent summary of creator, duration, date, timezone,
   and total. Back navigation should retain the selected slot and entered details.
2. **Reduce required information.** Keep name, email, and the call question.
   Reconsider mandatory phone collection unless a specific booking operation needs
   it; label optional social information clearly. Match server validation to any
   UI change. Keep guest booking.
3. **Explain the wait accurately.** Existing copy says the customer is only charged
   if accepted. Add plain language explaining the temporary payment hold and show
   Awaiting creator separately from Confirmed. Display response/expiry deadlines
   only when backed by actual system data and policy. Preserve the distinction
   between captured payment and a successfully created calendar invitation.
4. **Improve recovery and confidence.** Make timezone correction accessible, provide
   useful no-availability and expired-request states, and clearly identify the
   support path. Use a direct Join call action when the actual meeting link exists.
   Review profile content before publication; the live profile inspected contained
   placeholder text, which weakens confidence regardless of visual polish.

## Mobbin research brief

Search complete web flows first, then inspect mobile versions and individual
states. Product names below are search candidates, not verified Mobbin results.

| Priority | Search brief | Pattern to evaluate |
| --- | --- | --- |
| 1 | Host or seller onboarding: draft, setup checklist, external payout connection, preview, publish. Try Airbnb and seller platforms if available. | Clear next action and explicit public readiness |
| 2 | Appointment booking: duration, timezone, date/time, guest details, checkout. Try Calendly and booking marketplaces if available. | Short steps with a persistent booking summary |
| 3 | Host request inbox: pending request, acceptance, upcoming booking, empty states. | Operational work visible immediately |
| 4 | Weekly availability: date exceptions, copy hours, blocked dates, save feedback. | Flexibility without repetitive setup |
| 5 | Request-to-book checkout: authorization, awaiting approval, confirmation, expiry. | Accurate payment and booking status |

For each search, select two or three relevant examples, keep direct source links,
record the complete sequence and recovery states, then explain precisely what
Take a Seat should adopt. Preserve the site's editorial styling. Do not copy
instant-confirmation behavior into an approval-based booking model.

## First implementation slice and validation

Start with creator setup/readiness and explicit publishing, then the request
inbox and customer details step. Publication changes need lifecycle verification;
booking changes need authorization/status verification. Keep production launch
gates from the control map in force.

Measure setup completion, time from acceptance to bookable profile, slot-selection
to payment-authorization completion, and creator response time. These are proposed
measures, not existing analytics or claimed improvements. Verify desktop and
mobile layouts, back navigation, connection returns, empty weeks, expired payment
authorization, and delayed calendar confirmation before shipping.

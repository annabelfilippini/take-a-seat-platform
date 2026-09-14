# Take a Seat: application and app design direction

Reviewed September 13, 2026. Research and a conversation-only interactive concept;
no product code changes, production submissions, emails, bookings, or deployments.

## Recommendation

Keep the warm editorial identity and make each screen answer three questions:
what is this for, what do I need to do, and what happens next?

Start with the creator application. Follow with guided accepted-creator setup,
then discovery and public profile polish. Preserve the improved customer booking
flow already visible in production.

## Evidence and limits

Inspected live homepage and application on desktop; application, directory,
Ella's public profile, calendar selection, and customer details on a 390 × 844
mobile viewport. Selected a time and advanced to details without submitting.
Restored the browser viewport. This was a focused design inspection, not full
regression QA, an authenticated creator-dashboard walkthrough, or a payment test.

Read the README, control map, existing Mobbin research, application component,
and accepted-entry route. Existing uncommitted work was preserved.

Mobbin MCP returned actual inline images. Visually inspected representative
previews from four web flows, two Linktree editor screens, and two Airbnb mobile
screens. Findings describe these captured references, not every step or the
current behavior of accounts in those services. No conversion uplift is proven.

The earlier `mobbin-flow-review-2026-09-13.md` is partly superseded: the live
booking UI now has a separate details step, optional additional details, a
persistent selection summary, and temporary payment-hold copy. Those are existing
strengths, not outstanding features to rebuild.

## Reference patterns

| Inspected reference | Visible evidence | Adaptation |
| --- | --- | --- |
| [Airbnb host listing](https://mobbin.com/flows/390e0140-7492-495a-8669-6cbdb8f73655) | Focused question pages; progress along the bottom; Back, Next, Save and exit. | Group related application questions into a small number of steps. Use a longer saved sequence only for accepted-creator setup. Do not copy a 20-screen listing process. |
| [Contra freelancer onboarding](https://mobbin.com/flows/d4c93ddb-39d6-4851-8d9b-dbb54d2397e9) | Step 2/3 groups one-liner, skills, rate, location and photo; social-link step has field-level errors. | Clear question wording, sensible field groups and local error recovery. Avoid adding an AI assistant or freelance CV requirements. |
| [Linktree header editor](https://mobbin.com/screens/f6104f8a-605c-478b-a3b5-bf8339c3289f) | Editing controls alongside a phone preview of the page. | Accepted creators see their actual profile taking shape. On mobile, use Edit and Preview views. Keep one Take a Seat template. |
| [Linktree appearance review](https://mobbin.com/screens/e4c6f23e-2160-45c3-ac57-66813bc6359d) | Suggested changes beside the profile preview and a clear Save changes action. | Make the result of changes visible before committing them. Theme suggestions and AI edits are unnecessary for this first slice. |
| [Calendly booking](https://mobbin.com/flows/964e2ca5-51e6-4245-9dea-d8fe41226b50) | Date/time selection beside meeting context and timezone; final confirmation summarizes the appointment. | Retain booking context and timezone throughout. Take a Seat needs Awaiting creator before Confirmed because acceptance is required. |
| [Patreon publishing](https://mobbin.com/flows/34a9d6ae-c8d5-4de6-a32e-1c51714c5053) | Setup checklist, deliberate Publish action, then a live-page sharing state. | Separate Save draft, Preview and Publish. Give creators a real shareable page at completion. |
| [Airbnb mobile experience](https://mobbin.com/screens/52b29c50-2480-4676-90fd-ea2eec45befb) | Concrete activity list and persistent price/Show dates control. | Explain what a call helps someone do; consider a compact mobile booking bar that respects content and safe areas. |
| [Airbnb mobile host](https://mobbin.com/screens/d71700a0-2e5e-4274-9d02-75b399408802) | Portrait, short personal facts, supporting host copy and a persistent reservation control. | Give creators human presence and scannable credibility. Ratings, scarcity and track records require genuine supporting data. |

## The application

The current full-room photograph and serif headline establish a distinctive
atmosphere. The translucent form competes with that image. On mobile, identity,
phone and social fields occupy a long column before the substantive question.
The application offers little explanation of the opportunity or review process.

Proposed desktop layout: a concise editorial invitation on the left, an opaque
form on the right. On mobile, a short invitation followed by the active step.
Keep the photograph as a bounded editorial image if retained; avoid placing
important form text over it. Keep the primary button close to the active fields.

Suggested invitation: **Your perspective. Someone's next step.** Supporting
copy: “Share your expertise in private 1:1 calls. Choose your prices and
availability. We review each application and invite accepted creators to set up
their page.” Keep “Apply to Inspire” as an optional brand phrase.

1. **About you:** first name, last name, email, and one social handle or work link.
   Explain that application updates and the invitation use this email. Defer phone
   collection unless there is a concrete operational need; if optional, label it.
2. **Your perspective:** “What do people turn to you for?” Ask for the question
   someone might bring and the help they would receive. Use a persistent example
   and brief helper copy. Do not request a full public biography or pricing here.
3. **Review:** show the submitted information, an easy Back action, and the review
   process. In production the final button is “Submit application.”

After success: acknowledge the stored application, show the submitted email if
appropriate, and explain the next step. Report receipt-email status accurately.
Do not promise a response deadline without a supported operating commitment.
Replace provider-configuration error details with a useful recovery message.

The inline concept simulates these steps locally; its final action is explicitly
“Preview received screen.” It does not implement saving or sending. The warmer
layout and copy are design hypotheses. Test them against the existing compact
form: more steps can also introduce friction.

Implementation must update server validation and social-link storage if field
requirements change. Preserve entered values on Back and recoverable errors.
Do not add Save and exit until draft persistence exists. For a short application,
in-session preservation may be sufficient; accepted-creator setup needs reliable
saved progress and connection-return recovery.

## The wider experience

**Discovery:** add one concrete reason to book on each creator card, such as
“Build outfits from the clothes you own,” ahead of optional category detail.
Keep portrait crops consistent and duration/price legible. With two visible
creators, a large category selector occupies disproportionate mobile space.
Reduce its footprint and ensure empty categories explain the situation. Add a
literal private-call explanation near the homepage's more expressive headline.

**Public profiles:** put portrait, short promise, a few useful call examples and
call options before long biography material. Remove the live prototype banner
on Ella's profile once the intended public status is confirmed. Use consistent
templates and navigation. A public preview/mockup label weakens purchase trust.

**Accepted-creator setup:** Your profile → Your calls → Availability and calendar
→ Payouts → Preview and publish. Show actual saved/connected state and one next
action. Preserve dated weekly availability. Separate saving from publication;
the current control map says saving publishes. This is a lifecycle change and
requires server enforcement and tests, not just a new button.

**Returning creators:** prioritize actionable requests and upcoming calls, with
profile and configuration work secondary. Authenticated behavior was not tested
in this review; this recommendation builds on the existing source-backed review.

**Booking:** retain the current distinct time and details steps, guest booking,
optional extras, selected-time summary, and payment authorization explanation.
Consider clearer stage wording (“Choose time → Your details → Payment”) and an
accessible timezone adjustment. Verify no-availability, request expiry, rejected
requests, and delayed calendar confirmation before claiming a complete flow.

## First implementation slice and evaluation

Build the application layout, copy, grouped steps, review and receipt states as
one focused change. Follow with creator setup/publication separately, then
discovery/profile improvements. No new service is needed for the design itself.

Measure application starts/completions, abandonment by step, validation failures,
and whether received applications contain enough information to judge fit.
For later slices measure acceptance-to-bookable-profile completion and booking
authorization completion. These are proposed metrics; no baseline was collected.

Before shipping code, run repository lint and tests, test application lifecycle
and email failure recovery, and inspect desktop/mobile layouts with keyboard,
Back, long text and narrow screens. Production deployment requires Annabel's
approval. This research added no production code, so application tests were not
run for this documentation and concept artifact.

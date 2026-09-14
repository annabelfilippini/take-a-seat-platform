# Proposed creator setup

Status: recommendation for discussion, 2026-09-13. Not implemented.

## Product decision

Use a resumable five-step setup for accepted creators:

Your profile → Your calls → Your availability → Get paid → Preview and publish.

The acceptance link remains the entry point. Do not ask creators to repeat their
application or create a second identity. Show a short welcome above the checklist:
“Welcome to Take a Seat. Let's get your page ready for bookings.”

Use one main form per step, a visible checklist, Save and continue, and Save and
exit. Completed steps remain editable. Creators can work on another step if an
external connection is unfinished. Show saved progress accurately; returning to
setup opens the first unfinished step. No invented completion-time estimate.

## 1. Your profile

Question: Who are you, and what can someone come to you for?

Collect:

- Display name and social links, prefilled from the application where available.
- Profile photo with the existing crop and position controls.
- One short introduction: “I help [who] with [what].”
- Two or three concrete examples of questions the creator can help answer.

An optional section holds a longer About paragraph, location, and extra photos
or videos. Extra media should not block progress. Keep category placement under
the existing admin ownership; do not silently make it a creator-controlled field.

Proposed completion rule: saved display name, photo, introduction, and at least
one useful help topic. Examples are prompts, not prefilled claims about the
creator. Do not require separate bio, introduction, About, and “why a 1:1 call”
essays. Use shared product copy to explain how calls work.

## 2. Your calls

Question: What can someone book, and what will it cost?

Show two simple offer cards for the current 15-minute and 30-minute options.
Allow either or both. Each enabled offer has a price, clearly identified currency,
and one short description of what that amount of time is useful for.

Example prompts: “One focused question” and “More time to work through a decision.”
Keep them editable and visibly illustrative. Do not silently enable an offer or
insert a price. Google Meet and the acceptance-based request model are explained
once in shared copy.

Proposed completion rule: at least one enabled offer with valid duration, price,
and description. If an earnings estimate is shown, use the actual configured fee
model and disclose what the estimate excludes. Do not invent a net payout.

## 3. Your availability

Question: When would you like to take calls?

Confirm timezone first. Explain and offer Google Calendar connection here because
it prevents conflicting bookings and supports call invitations. Then present the
existing dated-week editor for choosing hours. Creators can draft hours before
connecting; both are required for launch readiness.

Keep the ability to vary each week. Do not reintroduce recurring-only scheduling.
Offer an explicit Copy previous week action as a later convenience, showing which
week receives the copied hours. Keep buffers, notice periods, and booking limits
in an expandable booking-preferences section with their current values visible.

Proposed completion rule: saved timezone, a working calendar connection, and at
least one future customer-bookable slot after duration, notice, and conflicts are
considered. Saving hours alone is not proof that a customer can book.

## 4. Get paid

Question: Where should your earnings go?

Give a short explanation and a Connect payouts button into the existing Stripe
Express flow. Keep identity and banking collection in Stripe. Save earlier work
before leaving and return to this step afterward.

Show Not started, Needs attention, or Ready according to the actual account
readiness. Returning from Stripe alone does not mean setup is complete. Give a
specific next action when Stripe requires more information.

Proposed completion rule: backend-confirmed readiness for the current payment
model. Platform-wide live payment readiness remains a separate operational gate.

## 5. Preview and publish

Question: Is this the page you want customers to see?

Show the actual public profile rendering with its call offers, prices, and an
availability summary. Let creators return directly to the relevant setup step.
Show missing requirements in plain language, each with a fix link.

Recommended launch policy: keep new profiles private until their content,
calendar, availability, and payouts are ready. Allow private preview throughout
setup. The final action is Publish profile; saving a draft must never publish it.
If platform operations have not enabled launch, explain that publishing is waiting
on Take a Seat, without presenting it as a creator setup failure.

On success, show “Your page is live,” View your page, Copy your link, and Go to
dashboard. Link sharing is a useful next action, not another required setup step.

## After setup

Use the normal creator dashboard for ongoing work. Lead with pending requests and
upcoming calls. Keep Profile, Calls, Availability, Payouts, and Settings accessible
for maintenance; do not make returning creators repeat onboarding.

A live creator running out of slots is different from an unpublished creator.
Keep the page visible with an honest no-availability state and prompt the creator
to add hours. An integration failure should block unsafe new booking actions and
show a repair action without deleting profile work.

## Implementation implications

- This is a proposed structure for existing capabilities, not a new service.
- Accepted-profile saves currently set publication timestamps. Separate draft
  persistence and explicit publication, including the server-side rules.
- The profile adapter currently uses the first profile-save timestamp to decide
  whether to show saved content. Ensure partial drafts persist and reload correctly.
- Preserve existing published profiles and their content during migration.
- Derive completion from persisted data and integration status. Do not rely only
  on checked boxes or a “step completed” flag.
- Keep contact email/phone private and distinguish them from public profile fields.
- Verify the original acceptance link, interrupted setup, connection returns,
  save failure, missing prerequisites, publication, and returning login. Review
  desktop and mobile with the existing repository verification requirements.

## Mobbin comparison

The subsequent [ten-reference review](mobbin-ten-reference-comparison.md) inspected
Mobbin profiles and setup galleries through the authorized browser session. The
official MCP connection was also added and authenticated. The review retains this
five-step outline and recommends a Linktree-style editor beside a live preview,
Airbnb-style focused questions, Calendly-style readiness feedback, and a
Patreon-style explicit publish/share finish. See that review for observed evidence,
source links, limitations, and the proposed visual structure.

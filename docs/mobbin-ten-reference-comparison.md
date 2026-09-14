# Creator setup: ten Mobbin references

Reviewed 2026-09-13. Design recommendation, not a product implementation.

## Recommendation

Use a five-step guided editor: **Your profile → Your calls → Your availability →
Get paid → Preview and publish**. Show a live customer-view preview beside profile
and offer editing on desktop. On mobile, switch between Edit and Preview rather
than squeezing two columns together.

Use Linktree for the editor/preview relationship, Airbnb Services for focused
setup questions and service cards, Calendly for readiness feedback, and Patreon
for an explicit publish-and-share finish. Keep Take a Seat's warm editorial
typography, cream surfaces, and restrained brown/green accents.

The research refines the earlier outline chiefly in **presentation**: make the
creator see their page taking shape as they enter the minimum useful information.
Do not turn the setup into a public webpage covered with editing controls, or make
the creator complete several overlapping biographies.

## Access and research limits

The official Mobbin MCP server was added to Codex at `https://api.mobbin.com/mcp`.
Annabel explicitly authorized connecting the account displayed as Phil. The CLI
confirmed “Successfully logged in,” and the server configuration is enabled.
The running task did not expose newly added Mobbin tools, so research used the
authorized signed-in Mobbin browser session.

The sample is ten **product references**, including public profiles, profile
creation, and supporting scheduling/publication patterns. It is not ten identical
influencer marketplaces or ten completely exercised signup flows. Screens and flow
galleries were visually inspected, with representative stages selected. The
findings describe those captures, not guaranteed current behavior in each live
product. No external account, listing, booking, or payment was created in research.

ADPList and Maven were searched but did not produce a matching web-app reference
in the visible search suggestions. Preply supplied a closer one-to-one service
reference. Preply and Fresha evidence is customer-side, not provider onboarding.

## Comparison

| Reference and inspected source | What was observed | Apply to Take a Seat | Limit / avoid |
| --- | --- | --- | --- |
| [Contra: adding profile information](https://mobbin.com/flows/7400f482-fb63-475f-9eea-c2673920d94b) | “Build your profile,” step 2/3, one-liner, up to three skills, rate, location and photo; form beside contextual assistance. | Lead with a clear introduction and a small set of help topics. Group related fields in one calm form. | Its hourly freelance model differs from fixed-length calls. An AI side panel is unnecessary here. |
| [Linktree: adding profile details](https://mobbin.com/flows/3ff0ad1b-3b32-4b39-a521-37fc60c5b2c5) | Simple photo/name/bio setup and crop dialog. The adjacent onboarding-checklist gallery shows editing controls alongside a phone preview. | Strongest reference for a creator seeing the public result while editing. Make basic identity fast to complete. | Do not add a theme marketplace or arbitrary blocks. Take a Seat should retain a consistent profile template. |
| [Airbnb Services: service details](https://mobbin.com/flows/dc8c5061-45bc-4733-90ec-10dbf5876213) and [listing a service](https://mobbin.com/flows/a498fc4b-6426-4042-8b42-48a68d83122c) | Public profile joins imagery and provider identity with a short promise, offerings, prices/durations and qualifications. Setup has focused questions, progress and Save and exit. | Give the person and offer equal clarity. Use discrete setup steps and comparable call cards. | Physical location and professional qualification requirements should not be imported into every creator's call setup. |
| [Calendly: completing setup guide, within its flows](https://mobbin.com/apps/calendly-web-15cbcaca-a6c4-421c-a732-dc7a7842ad42/c8cc080b-dbd7-412f-abfc-d6070f12c831/flows) | A setup guide beside the event dashboard lists calendar, video, meeting location, availability, preview and sharing. Completed connections have visible checks. | Show actual saved/connected state and the next useful action. Return creators to their unfinished connection step. | Avoid exposing its full scheduling administration during initial setup. |
| [Cal.com: public page](https://mobbin.com/flows/ee37dc77-7638-4fce-b940-784e4896f895) and [onboarding](https://mobbin.com/flows/8400c4ca-9733-480c-b243-ba58806c88a6) | Public page is compact: identity/bio followed by bookable event types. Setup uses progress segments and a final photo/About step. | Call options should be short, comparable and easy to scan. The customer must quickly understand duration and purpose. | Its utility-first public page is visually too sparse for Take a Seat. Its setup order is not a reason to put creator identity last here. |
| [Patreon: publishing a page](https://mobbin.com/flows/34a9d6ae-c8d5-4de6-a32e-1c51714c5053) | Checklist separates photo, description, first post, publication and telling people. A “Your page is live” state offers sharing and a copy link. | Separate saving from publication. Finish with the actual public page and a share link. | Do not add first-post or membership-tier obligations to a call marketplace. |
| [Fiverr: seller detail](https://mobbin.com/flows/a5520674-25bf-4f8c-bd65-3dc3e5185aa7) and [seller setup](https://mobbin.com/flows/3ea8473f-3b0c-4fd4-8112-1fe7fa08674e) | Seller profile separates identity/About/skills from gigs and a contact panel. Setup distinguishes seller profile from creating and publishing an offer. | Separate Your profile from Your calls. A call's description should explain the result, not repeat the biography. | Do not import gig requirements, complex packages, seller training, or upsells. |
| [Upwork: public preview](https://mobbin.com/flows/f57ae6f2-823d-47e7-b5f3-48a86692a64e) and [profile creation](https://mobbin.com/flows/6821dbf6-04df-4b57-889c-553d0a100185) | Public preview removes owner controls. Profile has headline/rate, biography, skills and work evidence. Setup includes import options and detailed career information. | Preview should be the actual customer view. Keep optional credibility material below the core offer. | A CV-style onboarding process is excessive for a creator already accepted into Take a Seat. |
| [Preply: tutor detail](https://mobbin.com/flows/67065e95-b9aa-4a41-94a7-876c33ad0b29) | Intro video and identity lead the profile; a separate booking panel carries price and primary booking action. Supporting profile details follow below. | Optional intro media can help customers recognize the person. Keep a clear booking panel near the top. | Do not copy unsupported ratings, lesson counts, urgency messages, or subscription/trial mechanics. Tutor onboarding was not reviewed. |
| [Fresha: appointment booking](https://mobbin.com/flows/0ae100c9-f9bb-4a81-8837-772fd8ac330c) | Business identity, rating, image mosaic, services and prominent Book now lead into service booking. | Photos should establish confidence and calls should be easy to find. Use purposeful media rather than mandatory filler galleries. | Salon addresses, group appointments and large service catalogs add unnecessary steps here. Provider onboarding was not reviewed. |

## Proposed appearance

### Creator editor

- Top bar: Take a Seat, private/draft status, Save and exit.
- Desktop left rail: five numbered setup steps with clear active/completed states.
- Main form: one heading phrased around the creator's current task; fields grouped
  by meaning; one primary Save and continue action.
- Right preview: the public profile using the entered photo, name, introduction,
  help topics, and call offers. Changes should be visible without navigating away.
- Optional content appears below core fields; not as equal-weight setup steps.
- Availability and payout steps use a compact readiness summary in the preview
  area, not an unrelated decorative phone image.
- Mobile: step count and an accessible step selector above a full-width form.
  Edit/Preview switches views while retaining entries and position.
- Final preview: enough room to inspect the whole customer page, with readiness
  checks and a deliberate Publish profile action.

### Public profile produced by setup

1. Portrait, creator name, clear one-sentence promise, and social links.
2. Two or three concrete “Bring me this question” examples.
3. Comparable 15/30-minute offers: price, purpose, Google Meet, availability action.
4. Optional fuller story and selected media for people who want more confidence.
5. Shared explanation of payment authorization, creator acceptance and confirmation.

On a wide public page, keep the booking area beside the creator content; on mobile,
place offers directly after the short introduction/help topics. Keep reviews and
other trust signals absent until supported by genuine data.

## Flow and publication policy

1. Your profile: prefilled identity, photo, short intro, help topics. Optional About
   and additional media. Existing admin category ownership is preserved.
2. Your calls: enable one or both current call lengths, enter price and useful
   description. Display currency. Do not silently fill prices or publish examples.
3. Your availability: confirm timezone, connect Google Calendar, save dated hours.
   Keep variable weekly schedules. Put notice/buffers/limits in a compact preferences
   section. A future slot must actually survive booking rules and conflict checks.
4. Get paid: Stripe-hosted onboarding, accurate return state, direct recovery action.
5. Preview and publish: missing requirements link to their relevant step. New
   profiles remain private until the creator and platform are ready for bookings.

These are product recommendations, not behavior proven by Mobbin. Preserve existing
published profiles. A live creator temporarily running out of hours should get a
no-availability state rather than having their page silently disappear.

After publishing, the dashboard should lead with requests and upcoming calls.
Maintenance links should be Profile, Calls, Availability, Payouts and Settings.

## Build order

First separate draft saving from publication and persist partial progress safely.
Then reorganize existing editor controls into the five steps and reuse the public
profile renderer for preview. Add real readiness checks and external-connection
return states. Finally add the publish/share finish and the operational dashboard
entry. A new service or data store is not needed for the visual structure.

Before shipping: verify the acceptance-email entry, interrupted/returning setup,
failed saves, connection cancellation and partial readiness, existing profiles,
desktop/mobile preview, publication rules and the booking launch gates. Measure
setup completion and creator time-to-ready after implementation; no conversion
uplift is claimed from these visual references alone.

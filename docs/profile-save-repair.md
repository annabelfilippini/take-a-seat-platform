# Creator profile save repair

Prepared September 14, 2026. Production deployment awaits Annabel's approval.

The live editor accepted full camera photos as inline data URLs. A gallery of
roughly 6 MB was then submitted inside one private profile draft, beyond the
[D1 2 MB string and row limit](https://developers.cloudflare.com/d1/platform/limits/).
Tab navigation required that save to succeed, trapping the creator on Profile.

## Behavior

- Uploaded photos are resized in the browser before saving, including uploads
  already present in the editor. Existing image URLs are preserved. A shared
  650 KB inline media budget leaves room for draft and published copies.
- Server validation rejects oversized profiles with HTTP 413 and
  `profile-too-large`, before updating data. Profiles are capped at 800 KB with
  a separate check for space occupied by legacy published uploads.
- Tab navigation is immediate. Panels remain mounted, retaining unsaved profile
  and weekly availability edits. A dirty draft saves in the background once;
  failure never cancels navigation or causes repeated automatic retries.
- Errors explain the next action and offer Retry Save draft on every tab.
  Failed or interrupted requests retain edits and the browser leave warning.
  HTTP success alone is insufficient: the response must confirm `saved`.
- Go live still saves successfully before publishing. Publication sends only
  identity and intent; the server publishes its saved draft.

## Verification

- Lint, typecheck, and the production build plus 78 tests passed.
- Regression tests cover oversized data, UTF-8 byte counts, legacy row space,
  unchanged draft/public state after failure, retry, and publication.
- Real local browser and D1: a 5.9 MB synthetic PNG saved as a roughly 535 KB
  inline WebP and survived reload. A deliberately oversized video displayed the
  size error; removing it allowed retry.
- Stopping the local server reproduced a network error. Availability, Payments,
  Settings, and Profile remained accessible and the edited text survived tab
  navigation. Desktop 1280 × 900 and mobile 390 × 844 checks found no clipping
  or overlapping error, navigation, or retry controls.
- Production save failure was reproduced, but the repaired code has not yet
  been deployed or verified with the user's production profile.

## Release and limits

No new dependency, service, secret, or database migration. Deploy understood,
committed code only after approval. Preserve the creator's open unsaved draft
before refreshing to load the new client; an old tab still runs old code.

Large videos remain subject to the inline budget and produce an explicit error.
Full video upload support should move media to object storage in a separate
change. Photos may be downsampled to fit a large gallery. This repair does not
establish Stripe or calendar launch readiness.

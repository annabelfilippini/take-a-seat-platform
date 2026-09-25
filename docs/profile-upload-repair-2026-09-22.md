# Creator photo upload repair

## Report and diagnosis

Annabel reported a creator could not add photos on September 22. The exact
file, device, and error were unavailable. Read-only production checks confirmed
an accepted account with a recent private draft save and no media uploads.
A JPG uploaded successfully on the existing live QA account. The selection was
not saved or published, and the test profile was reloaded afterward.
These checks do not establish the individual creator's exact failure cause.
Historical Worker logs were unavailable with the current CLI credential scope.

Confirmed upload failure paths in the code:

- Broad `image/*` and `video/*` pickers offered formats subsequently rejected by
  strict MIME validation. HEIC photos and files with missing MIME metadata could
  be selected and then refused. Wildcard image acceptance can also prevent
  Apple's picker from converting HEIC to JPEG.
- Photos over 8 MB were rejected before any resizing, including camera photos.
- Uploads had no timeout and disabled the entire editor until fetch completed.
- Upload errors appeared above the editor, away from the gallery picker.

## Repair

The shared `app/_lib/creator-upload.ts` prepares files for all three upload
controls. Pickers explicitly request JPEG, PNG, WebP, MP4, and WebM as appropriate.
Missing browser MIME metadata falls back to the extension; the existing server
continues checking file signatures and creator ownership.

Photos from 8 to 30 MB resize locally to JPEG with a maximum 2400-pixel edge.
Supported smaller originals remain unchanged. HEIC files reaching the handler
use native browser decoding when available; otherwise a nearby message explains
how to choose the photo in Safari or export a JPG. This is not a universal HEIC
decoder. No dependency, remote conversion service, migration, or secret is added.

Uploads time out after 60 seconds, abort the request, release the editor, and
permit choosing the same file again. A late result cannot update the profile.
Errors stay beside the affected photo/gallery controls even when collapsed.
Gallery instructions explain Add media followed by Save draft.

## Verification and release

Final checks passed on September 22:

- `npm run lint` and `npm run typecheck`.
- `npm test`: production build and all 82 Node tests.
- `npm run test:e2e`: all 32 journeys, with console/network error monitoring.
- Large-photo resizing, missing MIME metadata, HEIC error recovery, real local
  D1 persistence, hard refresh, fresh authenticated context, publication and
  public image access, timeout/retry with unsaved text retained.
- Inspected desktop 1280 × 900 and narrow 390 × 844 screenshots. Fixed a help
  text overlap found in desktop QA; picker, errors and retry controls are usable.
- Wrangler deployment dry run, no pending production migrations, and presence
  of every secret required by this main-based patch.

A preliminary full run hit an artifact-stream failure during browser teardown.
A subsequent run exposed a real homepage navigation hydration mismatch caused
by positional `useId`, a pattern already repaired in the shared page header.
The homepage now uses a stable ID, with mobile-menu regression coverage. The
final complete run passed without retries or suppressed unexpected failures.

Adversarial review checked type/size rejection, failed and timed-out requests,
late results, retained draft data, and unchanged authorization/publication.
The upload changes and discovered homepage repair are separate focused commits.
This patch is isolated from the unreleased booking workflow on
`codex/profile-update-repair`, based on main `823d7ae`.
Annabel approved deployment on September 22. PR #41 merged as `369be0a` and
that clean main commit was deployed with `npm run deploy`.
Worker version: `3be6d4c0-b311-4ad1-9783-86a143654506`.

Production browser verification on the existing QA account confirmed the new
picker/help text, successful resizing and upload of a padded PNG over 9 MB,
an enabled Add media action, and a loaded image in the gallery. No console
errors were captured. The selection was not saved or published; reloading
restored the original QA profile. The affected creator's data was unchanged.
Local persistence/returning-login/publication proof is listed above.

A real-device Apple Photo Library conversion and the creator's original file
remain unverified. Browser automation verifies the advertised accept types and
the failure/recovery fallback; it cannot certify the native iPhone picker.

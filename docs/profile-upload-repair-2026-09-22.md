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

Pending final verification. This patch is isolated from the unreleased booking
workflow on `codex/profile-update-repair`, based on main `823d7ae`.
Production deployment requires Annabel's explicit approval.

A real-device Apple Photo Library conversion and the creator's original file
remain unverified. Browser automation verifies the advertised accept types and
the failure/recovery fallback; it cannot certify the native iPhone picker.

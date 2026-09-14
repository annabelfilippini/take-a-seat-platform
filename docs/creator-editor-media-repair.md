# Creator editor media repair

## Behavior

Sidebar navigation keeps in-memory edits and no longer waits for profile save.
Save draft and Save and continue remain explicit; a failed save displays an
error without trapping the creator in the current section. Uploads block saving
until the files finish; closing or reloading with unsaved edits shows a warning.

Selecting photos adds them directly to the carousel editor. The extra Add media
step is removed. Large 3:4 previews support drag repositioning, zoom, horizontal
and vertical sliders, reset, replacement, removal, and earlier/later ordering.
The editor, draft preview, and public gallery use the same crop representation.
Following Annabel's final direction, the public page and wider desktop preview
keep a smaller carousel on the right, with portrait, name, and Instagram
underneath on the left. Mobile stacks them.

Public Instagram links also retain dots and underscores in usernames.

The admin preview now uses the same notification-save permissions as profile
and availability saves and restores saved notification preferences.

## Storage decision

Camera files previously became base64 inside a D1 profile row and its draft.
D1 limits each string/blob/row to 2 MB, so image-heavy saves could fail and also
block sidebar navigation. The file-selection step also did not mark the draft
dirty until the user separately clicked Add media.

Add the private Cloudflare R2 bucket `take-a-seat-creator-media`, bound as
`CREATOR_MEDIA`. This is a new storage service for uploaded files; D1 remains the
source of truth for profiles, draft/public references, order, and crop metadata.
No package dependency or new D1 table is required. Local Vite uses local R2.
The production bucket was checked on September 13 and does not exist yet.

- `POST /api/creators/media` authenticates the creator owner or verified admin.
- `GET /api/creators/media/[id]` serves published references publicly; otherwise
  only the owner or verified admin can read the file. The bucket itself stays
  private. Responses use `no-store` so unpublishing does not leave a public cache.
- Uploads are limited to 20 MB each and galleries to 12 items. Camera photos are
  resized to at most 1800 px in the browser and encoded as WebP; canvas strips
  embedded camera metadata. Unsupported photos produce an actionable error.
- New gallery values are JSON with per-image crop/order. Legacy newline URL lists
  remain readable. Legacy base64 files move into R2 on the next profile save.
- Saving validates uploaded-file ownership. Private draft saves never replace
  public photo references; explicit publishing copies the reviewed draft.
- Replacements use new keys. Removed/unreferenced files are retained, avoiding
  breakage in other open drafts or the still-live profile. A future retention
  job should only purge files absent from every draft and public reference;
  there is no automatic garbage collection in this release.

References: [D1 limits](https://developers.cloudflare.com/d1/platform/limits/)
and [R2 Worker API](https://developers.cloudflare.com/r2/api/workers/workers-api-reference/).

## Release requirements

1. Obtain Annabel's production deployment approval.
2. Create the private R2 bucket `take-a-seat-creator-media` if absent. Do not
   enable r2.dev or public bucket access. The Worker binding supplies access;
   no new API key or Worker secret is needed.
3. Confirm D1 migrations through `0016_magenta_sabretooth.sql` (already required
   by the previous editor release) and existing Worker secrets.
4. Deploy reviewed, committed code with `wrangler.deploy.jsonc`.
5. Repeat upload, save, reload, crop, and sidebar checks on the real dashboard.
   Saving is a private draft action. Do not publish test profile changes to the
   marketplace without explicit approval.

Rollback must retain support for JSON galleries and the media-serving route once
creators save new uploads; blindly rolling back to the previous Worker would
break newly saved galleries. Prefer a forward repair or a compatibility build.

## Verification

- Lint and TypeScript pass. Full build and 72 tests pass.
- SQLite lifecycle tests exercise real routes/domain behavior and a test R2
  adapter: large uploads keep D1 rows small, crops/order survive reload, draft
  media is private, publishing exposes only published references, removal stays
  private until publishing, bad media/ownership/storage errors preserve drafts,
  and notification settings save and reload.
- Local browser uses real local D1 and R2. Multi-photo file selection, image
  preparation, upload, save/reload, zoom, drag, ordering, replacement, removal,
  and separate portrait upload passed.
- Desktop and 390 px mobile editor/preview checks passed. Every sidebar section
  opens, including after a failed save with the local server stopped; unsaved
  text remains when switching back. Availability and notification saves passed.
- The local Go live action, public desktop/mobile layout, gallery arrows,
  saved crops, and Instagram URL were also checked using disposable local
  integration-ready fixtures; no external integrations were invoked.
- Production is not deployed by this repair. Live Clerk, Stripe, and Calendar
  integrations are not reconfigured or claimed as newly rehearsed here.

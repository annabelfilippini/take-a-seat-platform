# Creator Availability and Mobile Polish

Prepared September 12, 2026. Requires an approved production deployment.

## Result

- The availability editor now describes and edits one repeating weekly schedule.
  The date picker, dated headings, per-week UI state, and unused calendar styles
  have been removed. The existing weekly API and storage format remain in use.
- New creators start with an empty schedule. Existing saved slots are selected,
  including hours ending at 9 PM, the end of the visible grid.
- Mouse users can drag to select multiple slots. Keyboard users can toggle a
  focused slot with Enter or Space. Touch users tap to select and can swipe the
  grid without creating selections. Selection and timezone controls are disabled
  while a save is pending; failed saves preserve the draft for retry.
- The mobile application menu has an opaque background and moves the heading
  below the expanded menu. Shared header menus also use the opaque surface.
- Shared creator cards no longer show stars or the hardcoded 5.0 rating.
- ESLint now excludes generated `.wrangler` files, consistent with Git's existing
  runtime-directory exclusion.

## Validation

- `npm run lint` and `npm test` passed (build plus 50 tests), after rebasing onto
  the latest main with the separately reviewed Stripe changes.
- Local browser QA uses the actual React components and CSS with a demo profile.
  Availability save responses are intercepted locally; no production profile,
  application, email, or availability was changed.
- Desktop: mouse drag, keyboard selection, failed save and retry, preservation
  across tab changes, and restoration of saved 8–9 PM slots.
- Touch viewport at 390 × 844: tap to select/clear and horizontal scrolling without
  selecting slots; application menu open/closed and creator cards without ratings.
- Additional 320 px viewport: no document overflow; expanded menu ends above the
  application heading. Desktop viewport: 1440 × 1000.

## Release Notes

No migration, dependency, or secret change is needed for this patch. It does not
repair Google OAuth's return domain, add Google busy-event checks, or complete
Stripe's independent review. Those remain separate launch work.

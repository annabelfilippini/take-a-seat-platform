# Engineering release gate

Established September 14, 2026. Reliability takes priority over speed.
Read relevant [bug log](BUG_LOG.md) entries and their linked incident records
before editing. Inspect existing implementations and reuse working systems.

## Definition of done

A feature is complete only when all of these checks are satisfied:

1. The feature is implemented.
2. The feature works in a real browser.
3. Changes persist through the real application data layer.
4. A hard browser refresh preserves saved data.
5. Logging out and back in preserves saved data.
6. Customer-facing surfaces receive the correct published data.
7. Existing functionality has not regressed.
8. Playwright covers the complete relevant user journey.
9. Every relevant Playwright test passes reliably.
10. Bugs encountered are documented with their actual root causes.
11. Regression protection is added whenever practical.

Continue debugging and rerunning the relevant checks until the gate passes.
Missing access or an unavailable integration is a verification blocker, never a
pass. Report blockers honestly without calling the feature complete. A docs-only
change establishes instructions; it does not certify application behavior.

## Authoritative saves and marketplace state

Every important save follows this sequence:

1. Editing marks the frontend dirty or unsaved.
2. The frontend sends a request and shows saving state.
3. The backend validates the data.
4. The database commits successfully.
5. The backend confirms the committed save.
6. Only then does the frontend show Saved.

Failed saves must retain edits and provide clear error and retry behavior.
Verify persistence by reopening the data, not by trusting the displayed state.
The server and database are authoritative for bookings, availability, prices,
payments, publication, and customer requests. Client-only validation is insufficient.

Prefer shared validation, explicit state transitions, database constraints,
idempotent operations, and small understandable modules. Fix a shared faulty
pattern across affected callers instead of patching only its visible symptom.

## Protected customer experience

The approved paid session/time-selection experience is protected. Preserve its
layout, visual hierarchy, session and time interactions, payment progression,
button positions, and overall booking flow.

Creator durations, prices, offering descriptions, availability, timezone
calculations, and profile information should supply data into that existing flow.
Before altering customer interaction or presentation, determine whether the
backend or data layer can meet the requirement. Make customer-flow changes only
when necessary to fix a bug or support a requirement, and record the reason.

## Playwright release procedure

Test realistic creator and customer journeys together where relevant, including
the transition from saved private drafts to explicitly published public data.
For every run:

- Check visible behavior and navigation, including exact invitation URLs and
  query parameters for authentication repairs.
- Capture and inspect console errors and failed network requests, including
  HTTP error responses. Feature-related unexpected failures fail the gate.
- Verify persisted data after a hard reload and after logout/login or a fresh
  authenticated browser context where appropriate.
- Exercise expected failures and recovery. Assert deliberately induced errors
  explicitly; do not suppress unexpected failures to obtain a passing run.
- Exercise fast and double interactions where races are possible, including
  save/publish sequencing and duplicate booking protection.
- Check desktop and narrow/mobile views for interactive UI changes, including
  clipping, overlap, hidden controls, and accidental background interaction.

Use the real application persistence path for persistence proof. Mocks and
isolated integration tests can cover failure branches but do not establish real
authentication, D1, Stripe, Calendar, or provider delivery success. Use authorized
test identities and isolate creator/admin sessions; preserve private data.

When Playwright exposes a bug:

1. Stop feature expansion and record the observed failure in the bug log.
2. Investigate the actual root cause; label it unknown until established.
3. Fix the underlying issue and update the incident record.
4. Add or update regression protection whenever practical.
5. Rerun the failed scenario, then the surrounding relevant suite.
6. Repeat until all relevant checks pass without unresolved flakiness.

Do not hand back known feature failures: console/network errors, simulated
saving, database/UI divergence, refresh data loss, auth redirect loops, duplicate
bookings, stale availability, incorrect Stripe state, or customer regressions.

Run the repository's required lint and test checks alongside Playwright.
Record commands, environment, scenarios, outcomes, and limits. `npm test` builds
the application and runs Node tests. `npm run test:e2e` runs the separate Playwright
creator/customer journeys against an isolated local D1 instance. Its test-only
authentication and external provider fixtures never enter the production build.
See [creator storefront verification](creator-storefront-verification.md) for
scenarios, commands, and the distinction between local proof and live integration proof.

## Release report

Keep the final report concise and include:

1. What changed.
2. Files or areas changed.
3. Bugs discovered.
4. Root causes.
5. Regression protections added.
6. Playwright scenarios run.
7. Test results.
8. Remaining known limitations.

Known bugs affecting the requested feature mean it is not ready for release.
Deployment still requires Annabel's explicit approval, committed understood
code, and the existing integration and migration checks in the
[control map](take-a-seat-control-map.md). Passing local checks is not production
or marketplace launch evidence.

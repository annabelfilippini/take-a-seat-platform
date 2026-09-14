# Creator Onboarding: Lessons From September 12, 2026

## Mistakes and required checks

| What went wrong | What to do next time |
| --- | --- |
| The agent opened the dashboard directly and claimed success while the emailed invitation still failed. | Reproduce and retest the exact user action, including the original invitation query parameters. Call a bypass a workaround until the original link succeeds. |
| The agent initially attributed the entire failure to the wrong signed-in account. The correct account also failed on a duplicate invitation. | Verify both the signed-in identity and its existing D1 ownership link before diagnosing. Check duplicate applications as a separate case. |
| Switching between admin and creator accounts repeatedly disrupted the user's admin access. | Tabs in one browser profile share site authentication. Prefer separate browser profiles; otherwise explain the switch, verify the active identity, and restore the account the user needs. |
| A successful send response did not establish inbox delivery. The affected recipient remained suppressed. | Distinguish API acceptance, provider delivery events, and actual inbox arrival. Inspect the specific recipient's bounce/suppression history. |
| Repeated applications for an established test account exercised duplicate ownership instead of a new influencer's first visit. | Use a fresh authorized test identity for a first-time rehearsal. Test duplicate invitations separately, without deleting or reassigning existing ownership. |

## Email diagnosis and recovery

- Observed bounce: `smtp; 550 Unknown host: rsend.takeaseatwith.com`.
  Some other recipients received email; this was not evidence that every send failed.
- Missing Cloudflare records were restored as DNS-only CNAMEs:
  `rsend` to `rsend.forge.rmta.net` and `send` to `send.forge.rmta.net`.
  Verify public DNS resolution and Resend domain status after a repair.
- Repair the bounce cause before clearing only the affected suppression.
  Use the authenticated admin resend action, then verify provider events and inbox arrival.
- A sending-only Resend key cannot list email history. Its read restriction is
  not a broken credential; use the authorized dashboard without expanding permissions.
- If a browser action is blocked or its result is uncertain, refresh observable
  state and check provider history before retrying. Do not assume a message was sent.
- Never put invitation tokens, verification codes, credentials, or private
  applicant records in source control or troubleshooting notes.

## Invitation repair and evidence

[PR #10](https://github.com/annabelfilippini/take-a-seat-platform/pull/10)
merged as `f224b53`. For a matching verified identity that already owns a profile,
a duplicate invitation now opens the existing profile. Wrong or missing identity
remains blocked. Duplicate records stay unclaimed and unpublished. The error
screen no longer offers a Continue link back into the same failure.

- Regression coverage: `tests/creator-lifecycle.test.mjs` verifies original
  ownership, duplicate invitation recovery, repeat visits, and rejected identities.
- Release checks: lint, 41 tests, build, and deployment dry run passed.
- Desktop and narrow browser checks used simulated Clerk state to inspect the
  error UI; those checks alone were not proof of production authentication.
- After the approved production deploy, the original link from the actual test
  email opened the saved profile with the invitation query still present.
  The availability tab also opened. The profile was not saved during this check.
- Deployed Worker version: `4ac2c880-0004-441f-bff7-198a28939583`.

## Operational boundaries and remaining work

- Removing a test creator card means unpublishing the intended profile while
  preserving its data and account link. Saving an accepted profile publishes it
  again under current behavior; avoid Save during read-only verification.
- Account switching remains shared across tabs. The invitation repair does not
  create separate admin and creator sessions or change admin permissions.
- Duplicate application prevention and clearer admin sign-in copy remain follow-ups.
- The application still distinguishes transport errors, not guaranteed delivery;
  persistent provider delivery tracking is not implemented by this repair.
- This release does not establish Stripe, Calendar, or complete marketplace
  launch readiness. Check their own current evidence before making that claim.
- Deploy only understood, committed code. Preserve unrelated work from other
  tasks and never include it in a repair deployment without review.

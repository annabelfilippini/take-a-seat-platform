# Creator setup and profile save deployment

Annabel approved production deployment on September 12, 2026.

- PR #13 merged to main: `843c3a8`.
- Deployed from clean detached checkout `/private/tmp/tas-release-20260912`.
- Cloudflare version: `dbb8d1bb-80c0-4abc-8ca6-8aae85798611`.
- Previous version for rollback: `7d958e65-5675-450d-b351-d0e45e9231fd`.
- Canonical URL: https://takeaseatwith.com/.

Before deployment, the clean source tree passed lint and the production build
plus all 51 tests. Required Worker secret names were present, including Clerk,
Resend, Google Calendar, and Stripe. D1 reported no pending migrations. No
secret values, payment modes, database records, or email recipients were changed.

After deployment, homepage, directory, Ella profile, application, sign-in, and
dashboard entry routes returned HTTP 200. Desktop browser confirmed the creator
card appears without a rating. At 390 px, the expanded application menu ends at
292 px and the heading starts at 330 px, with no horizontal document overflow.
The live profile editor JavaScript and stylesheet match the tested release
byte for byte. Profile save interactions and storage were verified locally in
this release; no creator profile was modified in production for smoke testing.

Stripe review and the previously documented Google Calendar launch work remain
separate. See `creator-availability-polish.md` for the implementation and QA.

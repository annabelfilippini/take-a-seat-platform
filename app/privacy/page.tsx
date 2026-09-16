/* eslint-disable @next/next/no-html-link-for-pages */
import type { Metadata } from "next";
import { PageHeader } from "../_components/PageHeader";

export const metadata: Metadata = {
  title: "Privacy | Take a Seat",
  description:
    "How Take a Seat collects, uses, stores, and shares information, including Google Calendar data.",
};

export default function PrivacyPage() {
  return (
    <main className="legal-page">
      <PageHeader ctaLabel="Find a Seat" navLabel="Privacy page navigation" />

      <article className="legal-content">
        <header>
          <span>Privacy</span>
          <h1>Privacy at Take a Seat</h1>
          <p>Last updated September 16, 2026</p>
        </header>

        <section>
          <h2>What Take a Seat does</h2>
          <p>
            Take a Seat is a marketplace for booking private video calls with
            creators. We use information only to operate creator applications,
            profiles, availability, bookings, payments, and related support.
          </p>
        </section>

        <section>
          <h2>Information we collect</h2>
          <p>
            Creators may provide contact details, social handles, profile copy,
            images, availability, pricing, notification preferences, and payout
            onboarding information. Customers may provide their name, email,
            booking note, selected time, and payment information. Authentication
            providers also give us the account identifiers needed to keep creator
            profiles private.
          </p>
          <p>
            Payment details are handled by Stripe. Take a Seat keeps the booking,
            payment status, and provider identifiers needed to operate and support
            the transaction, but does not store full card details.
          </p>
        </section>

        <section>
          <h2>Google Calendar data</h2>
          <p>
            When a creator chooses to connect Google Calendar, Take a Seat asks
            for permission to check free and busy times on the creator&apos;s primary
            calendar and to create, recover, update, or cancel Take a Seat booking events on calendars the
            creator owns. This is used to prevent scheduling conflicts, add
            confirmed appointments, create Google Meet links, and invite the
            customer.
          </p>
          <p>
            We store the connected calendar identifier, granted scopes,
            connection timestamps, and encrypted OAuth access and refresh tokens.
            We also store the Google event identifier and event link associated
            with a confirmed booking. We do not use Google Calendar data for
            advertising, audience profiling, or unrelated purposes. Free/busy checks
            use time intervals, not private event titles, descriptions, locations,
            notes, or attendees. Customers receive available times only; we do not
            store the contents of unrelated Google Calendar events.
          </p>
          <p>
            Take a Seat&apos;s use and transfer of information received from Google
            APIs follows the Google API Services User Data Policy, including its
            Limited Use requirements.
          </p>
        </section>

        <section>
          <h2>How information is used and shared</h2>
          <p>
            We use information to review creator applications, authenticate
            accounts, publish approved profiles, show availability, prevent
            conflicts, process booking requests, coordinate payment, send service
            messages, create calendar invitations, and provide support. Booking
            details are shared between the customer and creator as needed to hold
            the call.
          </p>
          <p>
            We use service providers including Cloudflare for hosting and storage,
            Clerk for authentication, Google for Calendar and Meet, Stripe for
            payments and creator payouts, and Resend for transactional email.
            These providers process information on our behalf for those services.
            We do not sell personal information or Google user data.
          </p>
        </section>

        <section>
          <h2>Security and retention</h2>
          <p>
            Take a Seat uses HTTPS, access controls, and application-level
            encryption for stored Google OAuth tokens. We keep information while
            it is needed to provide the service, support bookings, satisfy legal
            or accounting obligations, and resolve disputes. Retention can vary by
            record type and transaction status.
          </p>
        </section>

        <section>
          <h2>Your choices</h2>
          <p>
            You can disconnect Calendar on your creator Availability page. This removes
            our stored Calendar credentials and requests revocation with Google, while
            preserving your saved Take a Seat availability and booking records. Existing
            Calendar events remain. You can also revoke access from your Google Account
            permissions at any time. To request access, correction, or deletion of
            information held by Take a Seat, contact us at{" "}
            <a href="mailto:annabelflip1@gmail.com">annabelflip1@gmail.com</a>.
            Revoking Google access stops future Calendar access; contact us if you
            also want the stored connection record removed, or use Disconnect in Availability.
          </p>
        </section>

        <section>
          <h2>Changes</h2>
          <p>
            We may update this notice as the service changes. The current version
            and its effective date will remain available on this page.
          </p>
        </section>
      </article>

      <footer className="site-footer legal-footer" aria-label="Site information">
        <span>Take a Seat</span>
        <a href="/">Home</a>
      </footer>
    </main>
  );
}

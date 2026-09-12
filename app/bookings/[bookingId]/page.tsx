/* eslint-disable @next/next/no-html-link-for-pages */
import type { Metadata } from "next";
import Link from "next/link";
import { headers } from "next/headers";
import { notFound } from "next/navigation";
import { getSignedInAdminEmail } from "../../_lib/admin-auth";
import {
  canManageCreatorProfile,
} from "../../_lib/creator-onboarding";
import { getSignedInClerkUserFromHeaders } from "../../_lib/clerk-auth";
import {
  formatBookingDateTime,
  getCustomerBooking,
  type CustomerBooking,
} from "../../_lib/bookings";

type BookingPageProps = {
  params: {
    bookingId: string;
  };
  searchParams?: Record<string, string | string[] | undefined>;
};

export const metadata: Metadata = {
  title: "Booking Confirmation | Take a Seat",
  description: "Review a Take a Seat booking and add it to your calendar.",
};

export const dynamic = "force-dynamic";

export default async function BookingPage({
  params,
  searchParams,
}: BookingPageProps) {
  const booking = await getCustomerBooking(params.bookingId);

  if (!booking) {
    notFound();
  }

  const calendarStatus = getStatus(searchParams?.calendar);
  const bookingStatus = getStatus(searchParams?.booking);
  const canApprove = await canApproveBooking(booking);
  const googleCalendarHref = getGoogleCalendarTemplateUrl(booking);
  const calendarFileHref = `/api/bookings/${encodeURIComponent(
    booking.id,
  )}/calendar`;

  return (
    <main className="platform-shell amber-profile-page">
      <header className="topbar profile-topbar">
        <a className="brand-mark" href="/" aria-label="Take a Seat home">
          Take a Seat
        </a>
        <nav className="profile-nav" aria-label="Booking navigation">
          <Link href={`/with/${booking.creatorId}`}>Creator</Link>
          <form action="/sign-in" className="nav-action-form" method="get">
            <button className="profile-sign-in-link" type="submit">
              Sign In
            </button>
          </form>
        </nav>
      </header>

      <section className="booking-section" aria-labelledby="booking-heading">
        <article className="booking-card">
          <span>Booking</span>
          <h1 id="booking-heading">
            {getBookingHeading(booking.status, bookingStatus)}
          </h1>
          <p>
            Stripe has the payment information for this request. The customer
            is charged only if the creator accepts the appointment.
          </p>

          {calendarStatus ? (
            <p className="booking-notice">
              {getCalendarNotice(calendarStatus)}
            </p>
          ) : null}

          <dl className="seat-detail-list">
            <div>
              <dt>Creator</dt>
              <dd>{booking.creatorName}</dd>
            </div>
            <div>
              <dt>Seat</dt>
              <dd>{booking.seatName}</dd>
            </div>
            <div>
              <dt>Time</dt>
              <dd>{formatBookingDateTime(booking)}</dd>
            </div>
            <div>
              <dt>Status</dt>
              <dd>{formatStatus(booking.status)}</dd>
            </div>
          </dl>

          <div className="creator-connect-actions">
            <a className="seat-primary-button" href={googleCalendarHref}>
              Add to Google Calendar
            </a>
            <a className="seat-secondary-button" href={calendarFileHref}>
              Download calendar file
            </a>
          </div>

          {booking.googleCalendarHtmlLink ? (
            <a className="booking-profile-link" href={booking.googleCalendarHtmlLink}>
              Open creator invite
            </a>
          ) : null}
        </article>

        {canApprove ? (
          <aside className="creator-invite" aria-label="Approve booking">
            <span>Creator approval</span>
            <h2>Accept this appointment</h2>
            <p>
              Accepting captures the customer&apos;s authorized Stripe payment
              and confirms this appointment.
            </p>
            <form action="/api/bookings/approve" method="post">
              <input name="bookingId" type="hidden" value={booking.id} />
              <input name="returnTo" type="hidden" value={`/bookings/${booking.id}`} />
              <button
                className="creator-apply-primary"
                disabled={!canSubmitCreatorApproval(booking.status)}
                type="submit"
              >
                {getCreatorApprovalButtonLabel(booking.status)}
              </button>
            </form>
          </aside>
        ) : null}
      </section>
    </main>
  );
}

async function canApproveBooking(booking: CustomerBooking) {
  const adminEmail = await getSignedInAdminEmail();

  if (adminEmail) {
    return true;
  }

  const requestHeaders = await headers();
  const mutableHeaders = new Headers(requestHeaders);
  const user = await getSignedInClerkUserFromHeaders(
    mutableHeaders,
    requestUrlFromHeaders(mutableHeaders, `/bookings/${booking.id}`),
  );

  return user ? canManageCreatorProfile(booking.creatorId, user) : false;
}

function getGoogleCalendarTemplateUrl(booking: CustomerBooking) {
  const target = new URL("https://calendar.google.com/calendar/render");
  target.searchParams.set("action", "TEMPLATE");
  target.searchParams.set("text", `${booking.seatName} with ${booking.creatorName}`);
  target.searchParams.set(
    "dates",
    `${formatLocalDateTimeForGoogle(booking.appointmentStartAt)}/${formatLocalDateTimeForGoogle(
      booking.appointmentEndAt,
    )}`,
  );
  target.searchParams.set("ctz", booking.timezone);
  target.searchParams.set(
    "details",
    "Take a Seat booking request. The creator will send the official invite after approval.",
  );

  return target.toString();
}

function formatLocalDateTimeForGoogle(value: string) {
  return value.replace(/[-:]/g, "");
}

function getStatus(value: string | string[] | undefined) {
  return typeof value === "string" ? value : null;
}

function formatStatus(value: string) {
  return value.replace(/_/g, " ");
}

function getBookingHeading(status: string, bookingStatus: string | null) {
  if (status === "approved") {
    return "Appointment confirmed.";
  }

  if (status === "paid") {
    return "Payment captured.";
  }

  if (status === "payment_authorized" || bookingStatus === "authorized") {
    return "Payment authorized.";
  }

  if (status === "accepted") {
    return "Seat request accepted.";
  }

  if (bookingStatus === "success") {
    return "Your seat is requested.";
  }

  return "Seat request";
}

function getCalendarNotice(calendarStatus: string) {
  if (calendarStatus === "accepted") {
    return "Appointment accepted.";
  }

  if (calendarStatus === "sent") {
    return "Google Calendar invite sent.";
  }

  return "Calendar invite needs the creator Google Calendar connection.";
}

function getCreatorApprovalButtonLabel(status: string) {
  if (status === "approved") {
    return "Invite sent";
  }

  if (status === "accepted") {
    return "Accepted";
  }

  if (status === "requested") {
    return "Waiting on payment authorization";
  }

  if (status === "payment_authorized") {
    return "Accept this appointment";
  }

  if (status === "paid") {
    return "Approve and send";
  }

  return "Waiting on customer payment";
}

function canSubmitCreatorApproval(status: string) {
  return status === "payment_authorized" || status === "paid";
}

function requestUrlFromHeaders(requestHeaders: Headers, path: string) {
  const host = requestHeaders.get("host") ?? "takeaseatwith.com";
  const protocol = requestHeaders.get("x-forwarded-proto") ?? "https";

  return `${protocol}://${host}${path}`;
}

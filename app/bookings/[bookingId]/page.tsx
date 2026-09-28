/* eslint-disable @next/next/no-html-link-for-pages */
import type { Metadata } from "next";
import { headers } from "next/headers";
import { notFound } from "next/navigation";
import { getSignedInAdminEmail } from "../../_lib/admin-auth";
import {
  canManageCreatorProfile,
  getCreatorApplication,
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
  const canApprove = await canApproveBooking(booking);
  const creator = await getCreatorApplication(booking.creatorId);
  const creatorHref = `/with/${encodeURIComponent(creator?.publicSlug || booking.creatorId)}`;

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
          <a href={creatorHref}>Creator</a>
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
            {getBookingHeading(booking.status)}
          </h1>
          <p>
            {getPaymentDescription(booking.status)}
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

          {booking.status === "approved" ? <div className="creator-connect-actions">
            {booking.meetingUrl && <a className="seat-primary-button" href={booking.meetingUrl}>Join Zoom</a>}
            <p>Accept the Google Calendar invitation to add the session to your calendar.</p>
            <a className="seat-secondary-button" href={calendarFileHref}>
              Download calendar file
            </a>
          </div> : null}

          {booking.googleCalendarHtmlLink ? (
            <a className="booking-profile-link" href={booking.googleCalendarHtmlLink}>
              Open creator invite
            </a>
          ) : null}
        </article>

        {canApprove && booking.status === "payment_authorized" ? (
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

function getStatus(value: string | string[] | undefined) {
  return typeof value === "string" ? value : null;
}

function formatStatus(value: string) {
  if (value === "approved") return "Confirmed";
  return value.replace(/_/g, " ");
}

function getBookingHeading(status: string) {
  if (status === 'expired' || status === 'expiration_processing') return 'Request expired.';
  if (status === 'approval_processing') return 'Confirmation in progress.';
  if (status === 'decline_processing') return 'Releasing payment authorization.';
  if (status === 'cancelled') return 'Session cancelled and refunded.';
  if (status === 'cancellation_processing') return 'Cancellation in progress.';
  if (status === "declined") return "Request declined.";
  if (status === "checkout_expired") return "Checkout expired.";
  if (status === "payment_canceled") return "Payment authorization ended.";
  if (status === "approved") {
    return "Appointment confirmed.";
  }

  if (status === "paid") {
    return "Payment captured.";
  }

  if (status === "payment_authorized") {
    return "Payment authorized.";
  }

  if (status === "accepted") {
    return "Seat request accepted.";
  }

  return "Seat request";
}

function getCalendarNotice(calendarStatus: string) {
  if (calendarStatus === "processing") return "Your request is processing. Updates will appear here automatically when you refresh.";
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

function getPaymentDescription(status: string) {
  if (status === 'expired') return 'This request is no longer active. Your authorization has been cancelled and no payment was captured.';
  if (status === 'expiration_processing' || status === 'decline_processing') return 'This request cannot be accepted. We are confirming release of your payment authorization with Stripe.';
  if (status === 'approval_processing') return 'The creator accepted your request. We are verifying payment and setting up your session. Please refresh shortly.';
  if (status === 'cancellation_processing') return 'We are processing your full refund. Your cancellation will be confirmed once Stripe verifies it.';
  if (status === 'cancelled') return 'Your full payment has been refunded. Your bank may take several days to show it.';
  if (status === "declined") {
    return "The creator could not accept this request. Your payment authorization has been canceled and no payment was captured. You can choose another time from the creator's profile.";
  }
  if (status === "payment_canceled" || status === "checkout_expired") {
    return "This request is no longer active. Your payment has not been captured. Please start a new booking request.";
  }
  if (status === "approved") {
    return "Your payment has been captured and your appointment is confirmed.";
  }
  if (status === "paid") {
    return "Your payment has been captured and your time is reserved. Meeting details are being prepared automatically.";
  }
  if (status === "payment_authorized") {
    return "Your payment is authorized. You are charged only if the creator accepts before the authorization expires.";
  }
  return "Payment authorization is still required. This appointment is not confirmed.";
}

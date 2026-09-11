import type { Metadata } from "next";
import Link from "next/link";
import {
  DEFAULT_ADMIN_EMAIL,
  getAdminSignInHref,
  getSignedInAdminEmail,
} from "../../../_lib/admin-auth";
import { CREATOR_PROFILE_EDITOR_URL } from "../../../_lib/creator-destination";
import {
  getAvailableCreatorPublicIdSuggestion,
  getCreatorApplication,
} from "../../../_lib/creator-onboarding";

export const metadata: Metadata = {
  title: "Review Creator Application | Take a Seat",
  description: "Review and accept a Take a Seat creator application.",
};

type AdminApplicationPageProps = {
  params: {
    creatorId: string;
  };
  searchParams?: Record<string, string | string[] | undefined>;
};

export default async function AdminApplicationPage({
  params,
  searchParams,
}: AdminApplicationPageProps) {
  const adminEmail = await getSignedInAdminEmail();

  if (!adminEmail) {
    return <AdminLocked creatorId={params.creatorId} />;
  }

  let application;

  try {
    application = await getCreatorApplication(params.creatorId);
  } catch {
    return (
      <main className="admin-page">
        <section className="admin-shell admin-locked">
          <span>Setup</span>
          <h1>D1 is not available.</h1>
          <p>The application can be reviewed once the database binding is live.</p>
        </section>
      </main>
    );
  }

  if (!application) {
    return <AdminMissingApplication creatorId={params.creatorId} />;
  }

  const acceptedLink = CREATOR_PROFILE_EDITOR_URL;
  const acceptStatus = getStatus(searchParams?.accept);
  const emailStatus = getStatus(searchParams?.email);
  const profileStatus = getStatus(searchParams?.profile);
  const smsStatus = getStatus(searchParams?.sms);
  const acceptDetail = getStatus(searchParams?.detail);
  const emailDetail = getStatus(searchParams?.emailDetail);
  const smsDetail = getStatus(searchParams?.smsDetail);
  const suggestedPublicId =
    await getAvailableCreatorPublicIdSuggestion(application);
  const acceptMessage =
    acceptStatus === "accepted"
      ? [
          "Accepted.",
          getNotificationStatus("Email", emailStatus, emailDetail),
          getNotificationStatus("Text", smsStatus, smsDetail),
          `Profile ${profileStatus === "sent" ? "notified" : "not updated"}.`,
        ].join(" ")
      : getAcceptErrorMessage(acceptDetail);

  return (
    <main className="admin-page">
      <header className="admin-topbar">
        <Link href="/" className="admin-brand">
          Take a Seat
        </Link>
        <nav aria-label="Admin navigation">
          <Link href="/admin/applications">Applications</Link>
          <Link href={acceptedLink}>Creator view</Link>
        </nav>
      </header>

      <section className="admin-shell" aria-labelledby="review-heading">
        <Link className="admin-back-link" href="/admin/applications">
          Back to queue
        </Link>

        {acceptStatus ? (
          <p className="admin-notice">
            {acceptMessage}
          </p>
        ) : null}

        <div className="admin-review-layout">
          <article className="admin-review-main">
            <span className={`admin-status admin-status-${application.applicationStatus}`}>
              {application.applicationStatus.replace("_", " ")}
            </span>
            <h1 id="review-heading">{application.name}</h1>
            <p>{application.bio}</p>

            <dl className="admin-facts">
              <div>
                <dt>Email</dt>
                <dd>{application.email || "Not provided"}</dd>
              </div>
              <div>
                <dt>Phone</dt>
                <dd>{application.phone || "Not provided"}</dd>
              </div>
              <div>
                <dt>Instagram</dt>
                <dd>{application.instagramHandle || "Not provided"}</dd>
              </div>
              <div>
                <dt>TikTok</dt>
                <dd>{application.tiktokHandle || "Not provided"}</dd>
              </div>
              <div>
                <dt>Category</dt>
                <dd>{application.category || "Style & Beauty"}</dd>
              </div>
            </dl>

            <section className="admin-review-section">
              <h2>Expertise</h2>
              <p>{application.profileDetails}</p>
            </section>

            <section className="admin-review-section">
              <h2>Draft public profile</h2>
              <p>{application.profileIntro || application.bio}</p>
              <ul>
                {splitLines(application.helpItems).map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </section>
          </article>

          <aside className="admin-accept-panel" aria-label="Accept application">
            <span>Decision</span>
            <h2>Accept application</h2>
            <form action="/api/creators/applications/accept" method="post">
              <input name="creatorId" type="hidden" value={application.id} />
              <label className="admin-public-id-field">
                <span>Public creator ID</span>
                <input
                  defaultValue={suggestedPublicId}
                  disabled={application.applicationStatus === "accepted"}
                  name="publicCreatorId"
                  pattern="[a-z0-9](?:[a-z0-9-]{0,118}[a-z0-9])?"
                  required
                />
                <small>/with/{suggestedPublicId}</small>
              </label>
              <button
                className="creator-apply-primary"
                disabled={application.applicationStatus === "accepted"}
                type="submit"
              >
                {application.applicationStatus === "accepted"
                  ? "Already accepted"
                  : "Accept and invite"}
              </button>
            </form>
            <a href={acceptedLink}>Open creator setup view</a>
          </aside>
        </div>
      </section>
    </main>
  );
}

function AdminMissingApplication({ creatorId }: { creatorId: string }) {
  return (
    <main className="admin-page">
      <header className="admin-topbar">
        <Link href="/" className="admin-brand">
          Take a Seat
        </Link>
        <nav aria-label="Admin navigation">
          <Link href="/admin/applications">Applications</Link>
          <Link href={CREATOR_PROFILE_EDITOR_URL}>Creator view</Link>
        </nav>
      </header>
      <section className="admin-shell admin-locked" aria-labelledby="missing-heading">
        <span>Application link</span>
        <h1 id="missing-heading">This application link moved.</h1>
        <p>
          The application ID {creatorId} was not found. It may have already been
          accepted and published under a public creator ID.
        </p>
        <Link className="creator-apply-primary" href="/admin/applications">
          Back to applications
        </Link>
      </section>
    </main>
  );
}

async function AdminLocked({ creatorId }: { creatorId: string }) {
  const returnTo = `/admin/applications/${encodeURIComponent(creatorId)}`;
  const signInHref = await getAdminSignInHref(returnTo);

  return (
    <main className="admin-page">
      <section className="admin-shell admin-locked" aria-labelledby="locked-heading">
        <span>Admin</span>
        <h1 id="locked-heading">Sign in as {DEFAULT_ADMIN_EMAIL}</h1>
        <p>This application is only visible to the Take a Seat admin.</p>
        <a className="creator-apply-primary" href={signInHref}>
          Sign in
        </a>
      </section>
    </main>
  );
}

function getStatus(value: string | string[] | undefined) {
  return typeof value === "string" ? value : null;
}

function getAcceptErrorMessage(detail: string | null) {
  if (detail === "public-id-taken") {
    return "Application update failed: that public creator ID is already taken. Try the suggested available ID below.";
  }

  return `Application update failed${detail ? `: ${detail}` : ""}.`;
}

function getNotificationStatus(
  label: "Email" | "Text",
  status: string | null,
  detail: string | null,
) {
  if (status === "sent") {
    return `${label} sent.`;
  }

  const reason = getNotificationSkipReason(detail);
  return `${label} not sent${reason ? `: ${reason}` : ""}.`;
}

function getNotificationSkipReason(detail: string | null) {
  switch (detail) {
    case "missing-account":
      return "Twilio account is not configured";
    case "missing-from":
      return "sender is not configured";
    case "missing-key":
      return "API key is not configured";
    case "request-failed":
      return "provider request failed";
    default:
      return null;
  }
}

function splitLines(value: string | null) {
  return (value ?? "")
    .split("\n")
    .map((item) => item.trim())
    .filter(Boolean);
}

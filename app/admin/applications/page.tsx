/* eslint-disable @next/next/no-html-link-for-pages */
import type { Metadata } from "next";
import {
  DEFAULT_ADMIN_EMAIL,
  getAdminSignInHref,
  getSignedInAdminEmail,
} from "../../_lib/admin-auth";
import { listCreatorApplications } from "../../_lib/creator-onboarding";

export const metadata: Metadata = {
  title: "Creator Applications | Take a Seat",
  description: "Review Take a Seat creator applications.",
};

type AdminApplicationsPageProps = {
  searchParams?: Record<string, string | string[] | undefined>;
};

export default async function AdminApplicationsPage({
  searchParams,
}: AdminApplicationsPageProps) {
  const adminEmail = await getSignedInAdminEmail();

  if (!adminEmail) {
    return <AdminLocked />;
  }

  let applications: Awaited<ReturnType<typeof listCreatorApplications>> = [];
  let setupError = false;

  try {
    applications = await listCreatorApplications();
  } catch {
    setupError = true;
  }

  const acceptStatus = getStatus(searchParams?.accept);
  const detail = getStatus(searchParams?.detail);

  return (
    <main className="admin-page">
      <header className="admin-topbar">
        <a href="/" className="admin-brand">
          Take a Seat
        </a>
        <nav aria-label="Admin navigation">
          <a href="/take-a-seat">Directory</a>
          <a href="/creators/onboard">Application</a>
        </nav>
      </header>

      <section className="admin-shell" aria-labelledby="applications-heading">
        <div className="admin-heading">
          <span>Applications</span>
          <h1 id="applications-heading">Creator review queue</h1>
        </div>

        {acceptStatus ? (
          <p className="admin-notice">
            {acceptStatus === "setup-needed"
              ? `Application update needs D1 setup${detail ? `: ${detail}` : ""}.`
              : `Application status: ${acceptStatus}.`}
          </p>
        ) : null}

        {setupError ? (
          <p className="admin-notice">
            D1 is not available in this environment yet.
          </p>
        ) : null}

        <div className="admin-queue" role="list">
          {applications.length ? (
            applications.map((application) => (
              <a
                className="admin-application-row"
                href={`/admin/applications/${application.id}`}
                key={application.id}
              >
                <span className={`admin-status admin-status-${application.applicationStatus}`}>
                  {application.applicationStatus.replace("_", " ")}
                </span>
                <strong>{application.name}</strong>
                <p>{application.instagramPlatform}</p>
                <small>
                  {application.reviewSubmittedAt
                    ? `Submitted ${formatDate(application.reviewSubmittedAt)}`
                    : `Created ${formatDate(application.createdAt)}`}
                </small>
              </a>
            ))
          ) : (
            <p className="admin-empty">No creator applications yet.</p>
          )}
        </div>
      </section>
    </main>
  );
}

async function AdminLocked() {
  const signInHref = await getAdminSignInHref("/admin/applications");

  return (
    <main className="admin-page">
      <section className="admin-shell admin-locked" aria-labelledby="locked-heading">
        <span>Admin</span>
        <h1 id="locked-heading">Sign in as {DEFAULT_ADMIN_EMAIL}</h1>
        <p>This application queue is only visible to the Take a Seat admin.</p>
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

function formatDate(value: string) {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat("en", {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(date);
}

export function CreatorProfileEditorAccess({
  adminSignInHref,
}: {
  adminSignInHref: string;
}) {
  return (
    <main className="admin-page">
      <section className="admin-shell admin-locked" aria-labelledby="locked-heading">
        <span>Admin preview</span>
        <h1 id="locked-heading">Sign in as the Take a Seat admin.</h1>
        <p>
          This preview is reserved for admin review. Accepted creators should use
          the creator dashboard.
        </p>
        <a className="creator-apply-primary" href={adminSignInHref}>
          Sign in
        </a>
        <a className="admin-back-link" href="/creators/dashboard">
          Creator dashboard
        </a>
      </section>
    </main>
  );
}

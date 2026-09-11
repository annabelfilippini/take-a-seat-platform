"use client";

type PageHeaderProps = {
  ctaLabel?: string;
  navLabel: string;
  searchQuery?: string;
  showCreatorSearch?: boolean;
};

export function PageHeader({
  ctaLabel = "Find a Seat",
  navLabel,
  searchQuery = "",
  showCreatorSearch = false,
}: PageHeaderProps) {
  return (
    <header className="about-topbar">
      <form action="/" className="nav-action-form" method="get">
        <button className="about-brand" type="submit" aria-label="Take a Seat home">
          Take a Seat
        </button>
      </form>
      <nav className="about-nav" aria-label={navLabel}>
        <form action="/creators/onboard" className="nav-action-form" method="get">
          <button type="submit">Apply to Inspire</button>
        </form>
        <form action="/about" className="nav-action-form" method="get">
          <button type="submit">Our Mission</button>
        </form>
        {showCreatorSearch ? (
          <form
            action="/take-a-seat"
            className={`nav-action-form hero-search-control header-search-control${
              searchQuery ? " header-search-control-active" : ""
            }`}
            method="get"
          >
            <span>Search creators</span>
            <input
              aria-label="Search creators"
              defaultValue={searchQuery}
              name="q"
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  event.preventDefault();
                  event.currentTarget.form?.requestSubmit();
                }
              }}
              placeholder="Search creators"
              type="search"
            />
          </form>
        ) : (
          <form action="/take-a-seat" className="nav-action-form" method="get">
            <button className="about-nav-button" type="submit">
              {ctaLabel}
            </button>
          </form>
        )}
        <form action="/sign-in" className="nav-action-form" method="get">
          <button className="nav-sign-in-button" type="submit">
            Sign In
          </button>
        </form>
      </nav>
    </header>
  );
}

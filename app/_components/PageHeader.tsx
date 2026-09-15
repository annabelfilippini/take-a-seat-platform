"use client";

import { useState } from "react";

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
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  // Route labels stay stable across SSR and history restoration in vinext.
  const navId = `page-nav-${navLabel.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`;

  return (
    <header className={`about-topbar${isMobileMenuOpen ? " mobile-nav-open" : ""}`}>
      <form action="/" className="nav-action-form" method="get">
        <button className="about-brand" type="submit" aria-label="Take a Seat home">
          Take a Seat
        </button>
      </form>
      <div className="page-header-mobile-actions">
        {showCreatorSearch ? <HeaderSearchForm searchQuery={searchQuery} /> : null}
        <button
          aria-controls={navId}
          aria-expanded={isMobileMenuOpen}
          aria-label="Open navigation"
          className="mobile-nav-toggle"
          onClick={() => setIsMobileMenuOpen((open) => !open)}
          type="button"
        >
          <span aria-hidden="true" />
          <span aria-hidden="true" />
          <span aria-hidden="true" />
        </button>
      </div>
      <nav className="about-nav" id={navId} aria-label={navLabel}>
        <form action="/creators/onboard" className="nav-action-form" method="get">
          <button type="submit">Apply to Inspire</button>
        </form>
        <form action="/about" className="nav-action-form" method="get">
          <button type="submit">Our Mission</button>
        </form>
        {showCreatorSearch ? (
          <HeaderSearchForm searchQuery={searchQuery} />
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

function HeaderSearchForm({ searchQuery }: { searchQuery: string }) {
  return (
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
  );
}

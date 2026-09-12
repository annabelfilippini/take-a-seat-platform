import { listPublicMarketplaceCreators } from "../_lib/creator-onboarding";
import type { Metadata } from "next";
import { CreatorDirectory } from "../_components/CreatorDirectory";
import { PageHeader } from "../_components/PageHeader";

export const metadata: Metadata = {
  title: "Take a Seat | Creators",
  description:
    "Choose a private seat with a Take a Seat creator.",
};

type TakeASeatPageProps = {
  searchParams?: Record<string, string | string[] | undefined>;
};

export const dynamic = "force-dynamic";

export default async function TakeASeatPage({ searchParams }: TakeASeatPageProps) {
  const searchQuery = getSearchQuery(searchParams?.q);

  return (
    <main className="seat-directory-page">
      <PageHeader
        navLabel="Take a Seat navigation"
        searchQuery={searchQuery}
        showCreatorSearch
      />

      <CreatorDirectory creators={await listPublicMarketplaceCreators()} initialQuery={searchQuery} showInlineSearch={false} />
    </main>
  );
}

function getSearchQuery(value: string | string[] | undefined) {
  if (typeof value === "string") {
    return value;
  }

  return value?.[0] ?? "";
}

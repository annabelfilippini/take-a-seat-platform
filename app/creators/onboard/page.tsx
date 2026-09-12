import type { Metadata } from "next";
import { PageHeader } from "../../_components/PageHeader";
import { CreatorOnboardingForm } from "./CreatorOnboardingForm";

export const metadata: Metadata = {
  title: "Apply to Inspire | Take a Seat",
  description:
    "Apply to join Take a Seat and share private advice with your audience.",
};

type CreatorOnboardingPageProps = {
  searchParams?: Record<string, string | string[] | undefined>;
};

export default function CreatorOnboardingPage({
  searchParams,
}: CreatorOnboardingPageProps) {
  return (
    <main className="creator-onboard-page">
      <PageHeader ctaLabel="Find a Seat" navLabel="Application navigation" />

      <CreatorOnboardingForm
        initialStatuses={{
          availability: getStatus(searchParams?.availability),
          calendar: getStatus(searchParams?.calendar),
          creatorEmail: getStatus(searchParams?.creatorEmail),
          creatorEmailDetail: getStatus(searchParams?.creatorEmailDetail),
          profile: getStatus(searchParams?.profile),
          stripe: getStatus(searchParams?.stripe),
        }}
      />
    </main>
  );
}

function getStatus(value: string | string[] | undefined) {
  return typeof value === "string" ? value : null;
}

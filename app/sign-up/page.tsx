import type { Metadata } from "next";
import { redirect } from "next/navigation";

export const metadata: Metadata = {
  title: "Phone Number | Take a Seat",
  description: "Phone number verification for Take a Seat.",
};

type SignUpPageProps = {
  searchParams?: Record<string, string | string[] | undefined>;
};

export default function SignUpPage({ searchParams }: SignUpPageProps) {
  const redirectUrl = getSafeRedirectUrl(searchParams?.redirect_url);
  redirect(redirectUrl ? `/sign-in?redirect_url=${encodeURIComponent(redirectUrl)}` : "/sign-in");
}

function getSafeRedirectUrl(value: string | string[] | undefined) {
  if (typeof value !== "string") {
    return undefined;
  }

  if (!value.startsWith("/") || value.startsWith("//")) {
    return undefined;
  }

  return value;
}

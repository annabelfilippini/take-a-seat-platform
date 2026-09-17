import type { Metadata } from "next";
import { ClerkAppProvider } from "./_components/ClerkAppProvider";
import { getClerkPublishableKey } from "./_lib/clerk-auth";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL("https://takeaseatwith.com"),
  title: "Take a Seat",
  description:
    "Meet your personal styling committee. Book a private seat with creators, tastemakers, and experts.",
  openGraph: {
    title: "Take a Seat",
    description:
      "Meet your personal styling committee. Book a private seat with creators, tastemakers, and experts.",
    images: [
      {
        url: "/homepage-social-preview-v1.png",
        width: 1200,
        height: 630,
        alt: "Meet Your Personal Styling Committee — the Take a Seat homepage, with a woman getting ready at her vanity with her hair in a towel.",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Take a Seat",
    description:
      "Meet your personal styling committee. Book a private seat with creators, tastemakers, and experts.",
    images: ["/homepage-social-preview-v1.png"],
  },
  icons: {
    icon: "/favicon.png",
    shortcut: "/favicon.png",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const clerkPublishableKey = getClerkPublishableKey();

  return (
    <html lang="en">
      <body>
        <ClerkAppProvider publishableKey={clerkPublishableKey}>
          {children}
        </ClerkAppProvider>
      </body>
    </html>
  );
}

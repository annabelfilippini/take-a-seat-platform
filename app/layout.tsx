import type { Metadata } from "next";
import { ClerkAppProvider } from "./_components/ClerkAppProvider";
import { getClerkPublishableKey } from "./_lib/clerk-auth";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL("https://takeaseatwith.com"),
  title: "Take a Seat",
  description:
    "Book private seats with rising creators, tastemakers, and experts.",
  openGraph: {
    title: "Take a Seat",
    description:
      "Book private seats with rising creators, tastemakers, and experts.",
    images: [
      {
        url: "/og.png",
        width: 1200,
        height: 630,
        alt: "Take a Seat social preview.",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Take a Seat",
    description:
      "Book private seats with rising creators, tastemakers, and experts.",
    images: ["/og.png"],
  },
  icons: {
    icon: "/favicon.svg",
    shortcut: "/favicon.svg",
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

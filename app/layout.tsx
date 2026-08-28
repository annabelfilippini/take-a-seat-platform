import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL("https://takeaseatwith.com"),
  title: "Take a Seat",
  description:
    "Take a seat with your favorite influencers and the people you trust most.",
  openGraph: {
    title: "Take a Seat",
    description:
      "Take a seat with your favorite influencers and the people you trust most.",
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
      "Take a seat with your favorite influencers and the people you trust most.",
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
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}

import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL("https://takeaseatwith.com"),
  title: "Take a Seat",
  description: "Personal Office Hours with people worth knowing.",
  openGraph: {
    title: "Take a Seat",
    description: "Personal Office Hours with people worth knowing.",
    images: [
      {
        url: "/og.png",
        width: 1200,
        height: 630,
        alt: "Take a Seat social preview with Amber Lowe's Buy It Once office hours.",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Take a Seat",
    description: "Personal Office Hours with people worth knowing.",
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

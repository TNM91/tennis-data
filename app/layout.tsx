import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import Script from "next/script";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: {
    default: "TenAceIQ",
    template: "%s | TenAceIQ",
  },
  description:
    "Track tennis ratings, rankings, matchup insights, and player trends across singles and doubles with TenAceIQ.",
  openGraph: {
    title: "TenAceIQ",
    description: "Smarter Tennis Ratings & Matchup Insights",
    url: "https://tenaceiq.com",
    siteName: "TenAceIQ",
    images: [
      {
        url: "/og-image.png",
        width: 1200,
        height: 630,
      },
    ],
    type: "website",
  },
  icons: {
    icon: "/favicon.ico",
    shortcut: "/favicon.ico",
    apple: "/favicon.ico",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable}`}
    >
      <body
        style={{
          margin: 0,
          minHeight: "100vh",
          display: "flex",
          flexDirection: "column",
          fontFamily: "var(--font-geist-sans), Arial, sans-serif",
          background:
            "radial-gradient(circle at top left, rgba(74,163,255,0.08), transparent 30%), radial-gradient(circle at top right, rgba(155,225,29,0.08), transparent 30%), #f8fafc",
          color: "#0f172a",
        }}
      >
        <Script
          id="google-adsense"
          async
          strategy="afterInteractive"
          src="https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=ca-pub-1351888380884789"
          crossOrigin="anonymous"
        />
        {children}
      </body>
    </html>
  );
}
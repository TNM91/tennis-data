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
  metadataBase: new URL("https://tenaceiq.com"),
  title: {
    default: "TenAceIQ",
    template: "%s | TenAceIQ",
  },
  description:
    "Know more. Plan better. Compete smarter. Player ratings, matchup insight, league context, and captain tools in one platform.",
  openGraph: {
    title: "TenAceIQ",
    description: "Know more. Plan better. Compete smarter.",
    url: "https://tenaceiq.com",
    siteName: "TenAceIQ",
    images: [
      {
        url: "/og-image.png",
        width: 1200,
        height: 630,
        alt: "TenAceIQ - Know more. Plan better. Compete smarter.",
      },
    ],
    locale: "en_US",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "TenAceIQ",
    description: "Know more. Plan better. Compete smarter.",
    images: ["/og-image.png"],
  },
  icons: {
    icon: [
      { url: "/favicon.ico" },
      { url: "/favicon-16x16.png", sizes: "16x16", type: "image/png" },
      { url: "/favicon-32x32.png", sizes: "32x32", type: "image/png" },
    ],
    shortcut: "/favicon.ico",
    apple: "/logo-app.png",
  },
  manifest: "/site.webmanifest",
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
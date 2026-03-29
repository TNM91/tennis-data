import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
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
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body
        style={{
          minHeight: "100vh",
          margin: 0,
          display: "flex",
          flexDirection: "column",
          background:
            "radial-gradient(circle at top left, rgba(74,163,255,0.08), transparent 28%), radial-gradient(circle at top right, rgba(155,225,29,0.08), transparent 24%), #f8fafc",
          color: "#0f172a",
        }}
      >
        {children}
      </body>
    </html>
  );
}
import type { Metadata } from 'next'
import { Geist, Geist_Mono } from 'next/font/google'
import Script from 'next/script'
import './globals.css'

const geistSans = Geist({
  variable: '--font-geist-sans',
  subsets: ['latin'],
})

const geistMono = Geist_Mono({
  variable: '--font-geist-mono',
  subsets: ['latin'],
})

export const metadata: Metadata = {
  metadataBase: new URL('https://tenaceiq.com'),
  title: {
    default: 'TenAceIQ',
    template: '%s | TenAceIQ',
  },
  description:
    'Know more. Plan better. Compete smarter. Player ratings, matchup insight, league context, and captain tools in one platform.',
  openGraph: {
    title: 'TenAceIQ',
    description: 'Know more. Plan better. Compete smarter.',
    url: 'https://tenaceiq.com',
    siteName: 'TenAceIQ',
    images: [
      {
        url: '/og-image.png',
        width: 1200,
        height: 630,
        alt: 'TenAceIQ - Know more. Plan better. Compete smarter.',
      },
    ],
    locale: 'en_US',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'TenAceIQ',
    description: 'Know more. Plan better. Compete smarter.',
    images: ['/og-image.png'],
  },
  icons: {
    icon: '/logo-icon.png',
    shortcut: '/logo-icon.png',
    apple: '/apple-touch-icon.png',
  },
  manifest: '/site.webmanifest',
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={`${geistSans.variable} ${geistMono.variable}`}
    >
      <head>
        <meta
          name="google-adsense-account"
          content="ca-pub-1351888380884789"
        />
      </head>

      <body className="min-h-screen bg-[var(--background)] text-[var(--foreground)] antialiased">
        <Script
          id="google-adsense"
          strategy="beforeInteractive"
          src="https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=ca-pub-1351888380884789"
          crossOrigin="anonymous"
        />

        <div className="site-bg" aria-hidden="true" />
        <div className="site-grid" aria-hidden="true" />

        <div className="relative flex min-h-screen flex-col">
          {children}
        </div>
      </body>
    </html>
  )
}
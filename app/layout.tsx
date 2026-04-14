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
  keywords: [
    'TenAceIQ',
    'tennis analytics',
    'tennis ratings',
    'tennis lineup builder',
    'captain tools',
    'tennis matchup analysis',
    'league tennis',
    'USTA lineup tools',
    'tennis team management',
    'tennis predictions',
  ],
  applicationName: 'TenAceIQ',
  authors: [{ name: 'TenAceIQ' }],
  creator: 'TenAceIQ',
  publisher: 'TenAceIQ',
  alternates: {
    canonical: '/',
  },
  other: {
    'google-adsense-account': 'ca-pub-1351888380884789',
  },
  robots: {
    index: true,
    follow: true,
  },
  openGraph: {
    type: 'website',
    locale: 'en_US',
    url: 'https://tenaceiq.com',
    siteName: 'TenAceIQ',
    title: 'TenAceIQ',
    description: 'Know more. Plan better. Compete smarter.',
    images: [
      {
        url: '/hero-tenaceiq-final.png',
        width: 1200,
        height: 630,
        alt: 'TenAceIQ',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'TenAceIQ',
    description: 'Know more. Plan better. Compete smarter.',
    images: ['/hero-tenaceiq-final.png'],
  },
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full bg-[#061120] text-white">
        {children}
        <Script
          id="google-adsense-loader"
          src="https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=ca-pub-1351888380884789"
          strategy="afterInteractive"
          crossOrigin="anonymous"
        />
      </body>
    </html>
  )
}

import type { Metadata, Viewport } from 'next'
import Script from 'next/script'
import { ThemeProvider } from '@/app/components/theme-provider'
import { PRODUCT_MOTTO } from '@/lib/product-story'
import './globals.css'

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
  themeColor: '#081a31',
  colorScheme: 'dark',
}

export const metadata: Metadata = {
  metadataBase: new URL('https://tenaceiq.com'),
  title: {
    default: `TenAceIQ | ${PRODUCT_MOTTO}`,
    template: '%s | TenAceIQ',
  },
  description:
    'More Tennis. Less Chaos. Explore tennis for free, then unlock Player, Captain, or TIQ League Coordinator tools for personalized prep, team decisions, and league operations.',
  keywords: [
    'TenAceIQ',
    'tennis analytics',
    'tennis ratings',
    'My Lab tennis',
    'tennis lineup builder',
    'captain tools',
    'tennis matchup analysis',
    'league tennis',
    'USTA lineup tools',
    'tennis team management',
    'tennis league coordinator',
    'tennis predictions',
  ],
  applicationName: 'TenAceIQ',
  authors: [{ name: 'TenAceIQ' }],
  creator: 'TenAceIQ',
  publisher: 'TenAceIQ',
  category: 'sports',
  alternates: {
    canonical: '/',
  },
  formatDetection: {
    telephone: false,
    address: false,
    email: false,
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: 'TenAceIQ',
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
    title: `TenAceIQ | ${PRODUCT_MOTTO}`,
    description:
      'More Tennis. Less Chaos. Choose the right TenAceIQ tier for free discovery, Player insight, Captain tools, or league operations.',
    images: [
      {
        url: '/og-image.png',
        width: 1200,
        height: 630,
        alt: 'TenAceIQ tennis intelligence for players, captains, and league coordinators',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: `TenAceIQ | ${PRODUCT_MOTTO}`,
    description:
      'More Tennis. Less Chaos. Choose the right TenAceIQ tier for free discovery, Player insight, Captain tools, or league operations.',
    images: ['/og-image.png'],
  },
  manifest: '/manifest.webmanifest',
  icons: {
    icon: [
      { url: '/favicon.ico?v=20260522', sizes: 'any', type: 'image/x-icon' },
      { url: '/favicon-32x32.png?v=20260522', sizes: '32x32', type: 'image/png' },
      { url: '/favicon-16x16.png?v=20260522', sizes: '16x16', type: 'image/png' },
    ],
    shortcut: '/favicon.ico?v=20260522',
    apple: '/apple-touch-icon.png?v=20260522',
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
      data-scroll-behavior="smooth"
      suppressHydrationWarning
      className="h-full antialiased"
    >
      <body className="min-h-full">
        <Script id="theme-init" strategy="beforeInteractive">{`
          (function () {
            try {
              document.documentElement.dataset.theme = 'dark';
              document.documentElement.style.colorScheme = 'dark';
            } catch (error) {
              document.documentElement.dataset.theme = 'dark';
              document.documentElement.style.colorScheme = 'dark';
            }
          })();
        `}</Script>
        <ThemeProvider>{children}</ThemeProvider>
        <script
          async
          src="https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=ca-pub-1351888380884789"
          crossOrigin="anonymous"
        />
      </body>
    </html>
  )
}

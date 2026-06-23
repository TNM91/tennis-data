import type { Metadata, Viewport } from 'next'
import Script from 'next/script'
import JsonLd from '@/app/components/json-ld'
import { ThemeProvider } from '@/app/components/theme-provider'
import { PLATFORM_POSITIONING, PRODUCT_MOTTO } from '@/lib/product-story'
import { buildOrganizationJsonLd, buildWebSiteJsonLd } from '@/lib/structured-data'
import './globals.css'

const SITE_DESCRIPTION = `${PRODUCT_MOTTO} ${PLATFORM_POSITIONING}`
const SOCIAL_BRAND_IMAGE = '/tenaceiq/logos/tenaceiq-brand-preview.png'

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
  description: SITE_DESCRIPTION,
  keywords: [
    'TenAceIQ',
    'tennis platform',
    'tennis resource hub',
    'tennis management platform',
    'tennis analytics',
    'tennis ratings',
    'My Lab tennis',
    'Coach Hub',
    'Team Hub',
    'Tournament Desk',
    'League Office',
    'tennis lineup builder',
    'tennis matchup analysis',
    'league tennis',
    'USTA lineup planning',
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
    description: SITE_DESCRIPTION,
    images: [
      {
        url: SOCIAL_BRAND_IMAGE,
        width: 1600,
        height: 1000,
        alt: 'TenAceIQ tennis intelligence for players, captains, and league coordinators',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: `TenAceIQ | ${PRODUCT_MOTTO}`,
    description: SITE_DESCRIPTION,
    images: [SOCIAL_BRAND_IMAGE],
  },
  manifest: '/manifest.webmanifest',
  icons: {
    icon: [
      { url: '/favicon.ico', sizes: 'any', type: 'image/x-icon' },
      { url: '/tenaceiq/logos/tenaceiq-app-icon.svg', sizes: '512x512', type: 'image/svg+xml' },
      { url: '/tenaceiq-icon-192.png', sizes: '192x192', type: 'image/png' },
      { url: '/tenaceiq-icon-512.png', sizes: '512x512', type: 'image/png' },
    ],
    shortcut: '/favicon.ico',
    apple: '/tenaceiq-icon-180.png',
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
      data-theme="dark"
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
        <JsonLd id="tenaceiq-organization-jsonld" data={buildOrganizationJsonLd()} />
        <JsonLd id="tenaceiq-website-jsonld" data={buildWebSiteJsonLd()} />
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

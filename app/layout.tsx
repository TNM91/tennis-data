import type { Metadata, Viewport } from 'next'
import { JetBrains_Mono, Manrope } from 'next/font/google'
import Script from 'next/script'
import { ThemeProvider } from '@/app/components/theme-provider'
import './globals.css'

const appSans = Manrope({
  variable: '--font-geist-sans',
  subsets: ['latin'],
  display: 'swap',
})

const appMono = JetBrains_Mono({
  variable: '--font-geist-mono',
  subsets: ['latin'],
  display: 'swap',
})

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
  themeColor: [
    { media: '(prefers-color-scheme: dark)', color: '#081a31' },
    { media: '(prefers-color-scheme: light)', color: '#f4f7fb' },
  ],
  colorScheme: 'dark light',
}

export const metadata: Metadata = {
  metadataBase: new URL('https://tenaceiq.com'),
  title: {
    default: 'TenAceIQ | Premium Tennis Intelligence',
    template: '%s | TenAceIQ',
  },
  description:
    'Explore tennis for free, then unlock Player, Captain, or TIQ League Coordinator tools for personalized prep, team decisions, and league operations.',
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
    title: 'TenAceIQ | Premium Tennis Intelligence',
    description:
      'Choose the right TenAceIQ tier for free discovery, Player insight, Captain tools, or league operations.',
    images: [
      {
        url: '/df190aef-4a8e-4587-bce8-7e2e22655646.png',
        width: 1200,
        height: 630,
        alt: 'TenAceIQ tennis intelligence for players, captains, and league coordinators',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'TenAceIQ | Premium Tennis Intelligence',
    description:
      'Choose the right TenAceIQ tier for free discovery, Player insight, Captain tools, or league operations.',
    images: ['/df190aef-4a8e-4587-bce8-7e2e22655646.png'],
  },
  manifest: '/manifest.webmanifest',
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
      className={`${appSans.variable} ${appMono.variable} h-full antialiased`}
    >
      <body className="min-h-full">
        <Script id="theme-init" strategy="beforeInteractive">{`
          (function () {
            try {
              var storedTheme = window.localStorage.getItem('tenaceiq-theme-mode');
              var resolvedTheme = storedTheme === 'light' || storedTheme === 'dark'
                ? storedTheme
                : (window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark');
              document.documentElement.dataset.theme = resolvedTheme;
              document.documentElement.style.colorScheme = resolvedTheme;
            } catch (error) {
              document.documentElement.dataset.theme = 'dark';
              document.documentElement.style.colorScheme = 'dark';
            }
          })();
        `}</Script>
        <ThemeProvider>{children}</ThemeProvider>
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

import type { MetadataRoute } from 'next'

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'TenAceIQ',
    short_name: 'TenAceIQ',
    description:
      'Explore tennis for free, then use Player, Captain, and TIQ League Coordinator tools to spend less time guessing and more time playing.',
    start_url: '/',
    scope: '/',
    display: 'standalone',
    orientation: 'portrait',
    background_color: '#08111d',
    theme_color: '#081a31',
    categories: ['sports', 'productivity', 'utilities'],
    shortcuts: [
      {
        name: 'Find tennis context',
        short_name: 'Find',
        description: 'Search players, teams, leagues, and rankings.',
        url: '/explore',
        icons: [{ src: '/android-chrome-192x192.png', sizes: '192x192', type: 'image/png' }],
      },
      {
        name: 'Open My Lab',
        short_name: 'My Lab',
        description: 'Open your player-linked tennis home.',
        url: '/mylab',
        icons: [{ src: '/android-chrome-192x192.png', sizes: '192x192', type: 'image/png' }],
      },
      {
        name: 'Captain tools',
        short_name: 'Captain',
        description: 'Run the team week with lineup and readiness tools.',
        url: '/captain',
        icons: [{ src: '/android-chrome-192x192.png', sizes: '192x192', type: 'image/png' }],
      },
      {
        name: 'League Coordinator',
        short_name: 'League',
        description: 'Open league setup, results, and season operations.',
        url: '/league-coordinator',
        icons: [{ src: '/android-chrome-192x192.png', sizes: '192x192', type: 'image/png' }],
      },
    ],
    icons: [
      {
        src: '/favicon.ico',
        sizes: 'any',
        type: 'image/x-icon',
      },
      {
        src: '/android-chrome-192x192.png',
        sizes: '192x192',
        type: 'image/png',
        purpose: 'any',
      },
      {
        src: '/android-chrome-512x512.png',
        sizes: '512x512',
        type: 'image/png',
        purpose: 'any',
      },
      {
        src: '/android-chrome-512x512.png',
        sizes: '512x512',
        type: 'image/png',
        purpose: 'maskable',
      },
      {
        src: '/favicon-32x32.png',
        sizes: '32x32',
        type: 'image/png',
      },
      {
        src: '/favicon-16x16.png',
        sizes: '16x16',
        type: 'image/png',
      },
    ],
    screenshots: [
      {
        src: '/og-image.png',
        sizes: '1200x630',
        type: 'image/png',
      },
    ],
  }
}

import type { MetadataRoute } from 'next'
import { PRODUCT_MOTTO } from '@/lib/product-story'

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'TenAceIQ',
    short_name: 'TenAceIQ',
    description:
      `${PRODUCT_MOTTO} Explore tennis for free, then use My Lab, Team Hub, League Office, and Full-Court workspaces.`,
    start_url: '/',
    scope: '/',
    display: 'standalone',
    orientation: 'portrait',
    background_color: '#08111d',
    theme_color: '#081a31',
    categories: ['sports', 'productivity', 'utilities'],
    shortcuts: [
      {
        name: 'Start Level Up drill',
        short_name: 'Level Up',
        description: 'Open the phone-first tennis drill flow.',
        url: '/level-up/relentless-competitor-4-0#level-up-flow',
        icons: [{ src: '/android-chrome-192x192.png', sizes: '192x192', type: 'image/png' }],
      },
      {
        name: 'Level Up tennis habits',
        short_name: 'Habits',
        description: 'Open tennis habit and development tools.',
        url: '/level-up',
        icons: [{ src: '/android-chrome-192x192.png', sizes: '192x192', type: 'image/png' }],
      },
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
        name: 'Team Hub',
        short_name: 'Captain',
        description: 'Run the team week with lineup and readiness actions.',
        url: '/captain',
        icons: [{ src: '/android-chrome-192x192.png', sizes: '192x192', type: 'image/png' }],
      },
      {
        name: 'League Office',
        short_name: 'League',
        description: 'Open league setup, results, and season operations.',
        url: '/league-coordinator',
        icons: [{ src: '/android-chrome-192x192.png', sizes: '192x192', type: 'image/png' }],
      },
    ],
    icons: [
      {
        src: '/favicon.ico?v=20260524',
        sizes: 'any',
        type: 'image/x-icon',
      },
      {
        src: '/android-chrome-192x192.png?v=20260524',
        sizes: '192x192',
        type: 'image/png',
        purpose: 'any',
      },
      {
        src: '/android-chrome-512x512.png?v=20260524',
        sizes: '512x512',
        type: 'image/png',
        purpose: 'any',
      },
      {
        src: '/android-chrome-512x512.png?v=20260524',
        sizes: '512x512',
        type: 'image/png',
        purpose: 'maskable',
      },
      {
        src: '/favicon-32x32.png?v=20260524',
        sizes: '32x32',
        type: 'image/png',
      },
      {
        src: '/favicon-16x16.png?v=20260524',
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

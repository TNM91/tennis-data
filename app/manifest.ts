import type { MetadataRoute } from 'next'
import { PRODUCT_LANGUAGE_SYSTEM, PRODUCT_MOTTO } from '@/lib/product-story'

const PWA_ICON = '/brand/icons/pwa-192.png'

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'TenAceIQ',
    short_name: 'TenAceIQ',
    description:
      `${PRODUCT_MOTTO} ${PRODUCT_LANGUAGE_SYSTEM.coreLine}`,
    start_url: '/',
    scope: '/',
    display: 'standalone',
    orientation: 'portrait',
    background_color: '#06172F',
    theme_color: '#06172F',
    categories: ['sports', 'productivity', 'utilities'],
    shortcuts: [
      {
        name: 'Open Team Room',
        short_name: 'Team Room',
        description: 'Open your default team conversation and match-week updates.',
        url: '/team-room',
        icons: [{ src: PWA_ICON, sizes: '192x192', type: 'image/png' }],
      },
      {
        name: 'Start Level Up drill',
        short_name: 'Level Up',
        description: 'Open the phone-first tennis drill flow.',
        url: '/level-up/relentless-competitor-4-0#level-up-flow',
        icons: [{ src: PWA_ICON, sizes: '192x192', type: 'image/png' }],
      },
      {
        name: 'Level Up tennis habits',
        short_name: 'Habits',
        description: 'Open tennis habit and development tools.',
        url: '/level-up',
        icons: [{ src: PWA_ICON, sizes: '192x192', type: 'image/png' }],
      },
      {
        name: 'Find tennis context',
        short_name: 'Find',
        description: 'Search players, teams, leagues, and rankings.',
        url: '/explore',
        icons: [{ src: PWA_ICON, sizes: '192x192', type: 'image/png' }],
      },
      {
        name: 'Open My Lab',
        short_name: 'My Lab',
        description: 'Open your player-linked tennis home.',
        url: '/mylab',
        icons: [{ src: PWA_ICON, sizes: '192x192', type: 'image/png' }],
      },
      {
        name: 'Team Hub',
        short_name: 'Captain',
        description: 'Run the team week with lineup and readiness actions.',
        url: '/captain',
        icons: [{ src: PWA_ICON, sizes: '192x192', type: 'image/png' }],
      },
      {
        name: 'League Office',
        short_name: 'League',
        description: 'Open league setup, results, and season operations.',
        url: '/league-coordinator',
        icons: [{ src: PWA_ICON, sizes: '192x192', type: 'image/png' }],
      },
    ],
    icons: [
      {
        src: '/brand/icons/favicon.ico',
        sizes: 'any',
        type: 'image/x-icon',
      },
      {
        src: PWA_ICON,
        sizes: '192x192',
        type: 'image/png',
        purpose: 'any',
      },
      {
        src: '/brand/icons/pwa-512.png',
        sizes: '512x512',
        type: 'image/png',
        purpose: 'any',
      },
    ],
    screenshots: [
      {
        src: '/brand/social/og-image-1200x630.png',
        sizes: '1200x630',
        type: 'image/png',
      },
    ],
  }
}

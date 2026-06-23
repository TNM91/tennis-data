import type { MetadataRoute } from 'next'
import { PRODUCT_LANGUAGE_SYSTEM, PRODUCT_MOTTO } from '@/lib/product-story'

const PWA_ICON = '/tenaceiq-icon-192.png'

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
    background_color: '#08111d',
    theme_color: '#081a31',
    categories: ['sports', 'productivity', 'utilities'],
    shortcuts: [
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
        src: '/favicon.ico',
        sizes: 'any',
        type: 'image/x-icon',
      },
      {
        src: '/tenaceiq/logos/tenaceiq-app-icon.svg',
        sizes: '512x512',
        type: 'image/svg+xml',
        purpose: 'any',
      },
      {
        src: PWA_ICON,
        sizes: '192x192',
        type: 'image/png',
        purpose: 'any',
      },
      {
        src: '/tenaceiq-icon-512.png',
        sizes: '512x512',
        type: 'image/png',
        purpose: 'any',
      },
      {
        src: '/tenaceiq-icon-512.png',
        sizes: '512x512',
        type: 'image/png',
        purpose: 'maskable',
      },
    ],
    screenshots: [
      {
        src: '/tenaceiq/logos/tenaceiq-brand-preview.png',
        sizes: '1600x1000',
        type: 'image/png',
      },
    ],
  }
}

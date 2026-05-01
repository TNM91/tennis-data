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
    icons: [
      {
        src: '/favicon.ico',
        sizes: 'any',
        type: 'image/x-icon',
      },
      {
        src: '/logo-icon.png',
        sizes: '512x512',
        type: 'image/png',
        purpose: 'any',
      },
      {
        src: '/logo-icon.png',
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

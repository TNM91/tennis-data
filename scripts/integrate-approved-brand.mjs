import { copyFile, mkdir } from 'node:fs/promises'
import { dirname } from 'node:path'

// Copy approved originals byte-for-byte. Never regenerate or transform artwork.
const aliases = {
  'TenAceIQ_Light_Transparent.png': ['public/brand/web/header-logo-transparent.png', 'public/brand/web/footer-logo-dark-bg.png', 'public/brand/logos/tenaceiq-full-transparent.png', 'public/brand/logos/tenaceiq-full-white.png'],
  'TenAceIQ_Dark_Transparent.png': ['public/brand/web/header-logo-light-bg.png', 'public/brand/web/footer-logo-light-bg.png', 'public/brand/logos/tenaceiq-full-for-light-bg.png', 'public/brand/logos/tenaceiq-full-black.png'],
  'TiQ_AppIcon_Approved.png': ['public/brand/icons/app-icon-1024.png', 'public/brand/web/header-iq-compact.png', 'public/brand/logos/tenaceiq-iq-for-light-bg.png'],
  'TiQ_White_Transparent_Refined.png': ['public/brand/web/home-watermark.png'],
  'TiQ_Navy_Transparent_Corrected.png': ['public/brand/web/header-iq-light-bg.png'],
  'TiQ_Icon_180.png': ['public/brand/icons/apple-touch-icon.png', 'public/apple-touch-icon.png', 'public/apple-touch-icon-180x180.png', 'public/apple-touch-icon-precomposed.png', 'app/apple-icon.png'],
  'TiQ_Icon_192.png': ['public/brand/icons/pwa-192.png', 'public/android-chrome-192x192.png'],
  'TiQ_Icon_512.png': ['public/brand/icons/pwa-512.png', 'public/android-chrome-512x512.png'],
  'TenAceIQ_favicon.ico': ['public/brand/icons/favicon.ico', 'app/favicon.ico'],
}

for (const [original, destinations] of Object.entries(aliases)) {
  for (const destination of destinations) {
    await mkdir(dirname(destination), { recursive: true })
    await copyFile(`public/brand/approved/${original}`, destination)
  }
}

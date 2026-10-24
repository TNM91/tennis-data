import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const layoutSource = readFileSync(join(process.cwd(), 'app/layout.tsx'), 'utf8')
const manifestSource = readFileSync(join(process.cwd(), 'app/manifest.ts'), 'utf8')

describe('bookmark and installed app branding', () => {
  it('uses the approved ICO for browser bookmarks', () => {
    expect(layoutSource).toContain("const BRAND_ICON_VERSION = '20261024-approved-v1'")
    expect(layoutSource).toContain('/favicon.ico')
    expect(layoutSource).not.toContain('/favicon-32x32.png')
    expect(layoutSource).not.toContain('/brand/icons/favicon-16.png')
    expect(readFileSync('app/favicon.ico')).toEqual(readFileSync('public/brand/approved/TenAceIQ_favicon.ico'))
    expect(readFileSync('app/apple-icon.png')).toEqual(readFileSync('public/brand/approved/TiQ_Icon_180.png'))
    expect(layoutSource).toContain("shortcut: `/favicon.ico?v=${BRAND_ICON_VERSION}`")
    expect(layoutSource).toContain('/apple-touch-icon.png')
    expect(existsSync(join(process.cwd(), 'app/favicon.ico'))).toBe(true)
    expect(existsSync(join(process.cwd(), 'app/apple-icon.png'))).toBe(true)
    expect(existsSync(join(process.cwd(), 'public/apple-touch-icon.png'))).toBe(true)
    expect(existsSync(join(process.cwd(), 'public/apple-touch-icon-precomposed.png'))).toBe(true)
  })

  it('uses the approved installed app icons without an unapproved maskable variant', () => {
    expect(manifestSource).toContain("const PWA_ICON_VERSION = '20261024-approved-v1'")
    expect(manifestSource).toContain('/brand/icons/pwa-192.png')
    expect(manifestSource).not.toContain('pwa-maskable-512.png')
    expect(manifestSource).toContain('/brand/icons/pwa-512.png')
    expect(existsSync(join(process.cwd(), 'public/android-chrome-192x192.png'))).toBe(true)
    expect(existsSync(join(process.cwd(), 'public/android-chrome-512x512.png'))).toBe(true)
    for (const size of [192, 512]) {
      expect(readFileSync(`public/brand/icons/pwa-${size}.png`)).toEqual(readFileSync(`public/brand/approved/TiQ_Icon_${size}.png`))
    }
  })
})

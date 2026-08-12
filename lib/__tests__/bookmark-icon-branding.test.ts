import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const layoutSource = readFileSync(join(process.cwd(), 'app/layout.tsx'), 'utf8')
const manifestSource = readFileSync(join(process.cwd(), 'app/manifest.ts'), 'utf8')

describe('bookmark and installed app branding', () => {
  it('uses the opaque navy iQ icon set for browser bookmarks', () => {
    expect(layoutSource).toContain("const BRAND_ICON_VERSION = '20260811-navy-iq'")
    expect(layoutSource).toContain('/brand/icons/favicon.ico')
    expect(layoutSource).toContain('/brand/icons/favicon-32.png')
    expect(layoutSource).toContain('/brand/icons/favicon-16.png')
    expect(layoutSource).toContain("shortcut: `/brand/icons/favicon.ico?v=${BRAND_ICON_VERSION}`")
    expect(existsSync(join(process.cwd(), 'app/favicon.ico'))).toBe(true)
  })

  it('keeps installed apps on opaque navy iQ assets', () => {
    expect(manifestSource).toContain("const PWA_ICON = '/brand/icons/pwa-192.png'")
    expect(manifestSource).toContain('/brand/icons/pwa-maskable-512.png')
    expect(manifestSource).toContain('/brand/icons/pwa-512.png')
  })
})

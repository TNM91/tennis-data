import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'
import { describe, expect, it } from 'vitest'

const root = process.cwd()

const sourceRoots = ['app', 'components', 'lib', 'public', 'docs']
const textFilePattern = /\.(css|html|json|md|mjs|ts|tsx|txt|webmanifest)$/i
const lockedAssets = [
  'public/tiq/courts/tiq-court-master.png',
  'public/brand/icons/app-icon-1024.png',
  'public/brand/icons/apple-touch-icon.png',
  'public/brand/icons/favicon-256.png',
  'public/brand/icons/favicon-512.png',
  'public/brand/icons/favicon-16.png',
  'public/brand/icons/favicon-32.png',
  'public/brand/icons/favicon.ico',
  'public/brand/icons/pwa-192.png',
  'public/brand/icons/pwa-512.png',
  'public/apple-touch-icon.png',
  'public/apple-touch-icon-precomposed.png',
  'public/android-chrome-192x192.png',
  'public/android-chrome-512x512.png',
  'public/brand/logos/tenaceiq-full-black.png',
  'public/brand/logos/tenaceiq-full-for-light-bg.png',
  'public/brand/logos/tenaceiq-full-navy.jpg',
  'public/brand/logos/tenaceiq-full-transparent.png',
  'public/brand/logos/tenaceiq-full-white.png',
  'public/brand/logos/tenaceiq-iq-black.png',
  'public/brand/logos/tenaceiq-iq-for-light-bg.png',
  'public/brand/logos/tenaceiq-iq-navy.jpg',
  'public/brand/logos/tenaceiq-iq-transparent.png',
  'public/brand/logos/tenaceiq-iq-white.png',
  'public/brand/social/og-image-1200x630.png',
  'public/brand/social/social-profile-1080.png',
  'public/brand/web/footer-logo-dark-bg.png',
  'public/brand/web/footer-logo-light-bg.png',
  'public/brand/web/header-iq-compact.png',
  'public/brand/web/header-logo-transparent.png',
  'public/brand/web/home-watermark.png',
]

function textFiles(dir: string): string[] {
  const files: string[] = []

  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name)

    if (entry.isDirectory()) {
      if (['.git', '.next', 'coverage', 'node_modules'].includes(entry.name)) continue
      files.push(...textFiles(path))
      continue
    }

    if (entry.isFile() && textFilePattern.test(entry.name)) files.push(path)
  }

  return files
}

function readSourceFiles() {
  return sourceRoots.flatMap((dir) => textFiles(join(root, dir)))
    .filter((path) => !path.endsWith('tiq-locked-assets.test.ts'))
    .map((path) => ({
      path: relative(root, path).replaceAll('\\', '/'),
      source: readFileSync(path, 'utf8'),
    }))
}

describe('TenAceIQ locked brand assets', () => {
  it('keeps every approved court and production brand asset present', () => {
    for (const asset of lockedAssets) {
      const path = join(root, asset)
      expect(existsSync(path), asset).toBe(true)
      expect(statSync(path).size, asset).toBeGreaterThan(0)
    }
  })

  it('renders the tactical board from the locked court image, not a recreated court', () => {
    const boardSource = readFileSync(join(root, 'components/tactical/TiqCourtBoard.tsx'), 'utf8')

    expect(boardSource).toContain('src="/tiq/courts/tiq-court-master.png"')
    expect(boardSource).toContain('className={styles.courtImage}')
    expect(boardSource).toContain('fill priority')
  })

  it('keeps obsolete TenAceIQ logo references out of source', () => {
    const offenders: string[] = []
    const retiredLogoPattern = /\/(?:tenaceiq\/logos|tiq\/logo)\/[^"'`\s),]+/g

    for (const file of readSourceFiles()) {
      const matches = file.source.match(retiredLogoPattern) ?? []
      for (const match of matches) {
        offenders.push(`${file.path}: ${match}`)
      }
    }

    expect(offenders).toEqual([])
  })

  it('keeps tactical UI on the approved production brand system', () => {
    const tacticalSources = [
      'components/tactical/TiqTacticalStudio.tsx',
      'components/tactical/TiqToolbar.tsx',
      'components/tactical/TiqTokens.tsx',
      'components/TiqLoader.tsx',
      'app/components/TiqLoader.tsx',
    ].map((path) => readFileSync(join(root, path), 'utf8')).join('\n')

    expect(tacticalSources).toContain('/brand/icons/app-icon-1024.png')
    expect(tacticalSources).toContain('/brand/web/header-logo-transparent.png')
    expect(tacticalSources).not.toContain('tenaceiq-q-icon.svg')
    expect(tacticalSources).not.toContain('tenaceiq-app-icon.svg')
  })

  it('uses the approved full header at every breakpoint plus compact, footer, and light variants', () => {
    const brandSource = readFileSync(join(root, 'app/components/brand-wordmark.tsx'), 'utf8')
    const headerSource = readFileSync(join(root, 'app/components/site-header.tsx'), 'utf8')
    const globalsSource = readFileSync(join(root, 'app/globals.css'), 'utf8')

    expect(brandSource).toContain('/brand/web/header-logo-transparent.png')
    expect(brandSource).toContain('/brand/web/header-iq-compact.png')
    expect(brandSource).toContain('/brand/web/footer-logo-dark-bg.png')
    expect(brandSource).toContain('/brand/web/footer-logo-light-bg.png')
    expect(brandSource).toContain('/brand/logos/tenaceiq-full-for-light-bg.png')
    expect(brandSource).toContain('/brand/logos/tenaceiq-iq-for-light-bg.png')
    expect(brandSource).toContain("objectFit: 'contain'")
    expect(brandSource).not.toMatch(/filter|rotate|skew|boxShadow|borderRadius/)
    expect(brandSource).toContain('src={BRAND_ASSETS.header.src}')
    expect(brandSource).toContain('sizes="(max-width: 819px) 150px, 168px"')
    expect(brandSource).not.toContain('getImageProps')
    expect(globalsSource).toMatch(/@media \(max-width: 819px\)[\s\S]*?\.site-header-brand-picture \{[\s\S]*?width: 150px;[\s\S]*?height: 48px;/)
    expect(headerSource).toContain('<BrandWordmark responsiveHeader />')
  })
})

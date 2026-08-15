import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'
import { describe, expect, it } from 'vitest'

const root = process.cwd()

const sourceRoots = ['app', 'components', 'lib', 'public', 'docs']
const textFilePattern = /\.(css|html|json|md|mjs|ts|tsx|txt|webmanifest)$/i
const approvedAssets = [
  'public/tiq/courts/tiq-court-master.png',
  'public/brand/web/header-logo-transparent.png',
  'public/tenaceiq-icon-192.png',
  'public/tenaceiq-icon-512.png',
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

describe('TenAceIQ approved production assets', () => {
  it('keeps every approved court and brand asset present', () => {
    for (const asset of approvedAssets) {
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

  it('keeps retired TenAceIQ logo-folder references out of production source', () => {
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

  it('keeps tactical UI on the refreshed TIQ logo system', () => {
    const tacticalSources = [
      'components/tactical/TiqTacticalStudio.tsx',
      'components/tactical/TiqToolbar.tsx',
      'components/tactical/TiqTokens.tsx',
      'components/TiqLoader.tsx',
      'app/components/TiqLoader.tsx',
    ].map((path) => readFileSync(join(root, path), 'utf8')).join('\n')

    expect(tacticalSources).toContain('/tenaceiq-icon-512.png')
    expect(tacticalSources).toContain('/brand/web/header-logo-transparent.png')
    expect(tacticalSources).not.toContain('tenaceiq-q-icon.svg')
    expect(tacticalSources).not.toContain('tenaceiq-app-icon.svg')
  })

  it('keeps the site header on the canonical brand source without stretching it', () => {
    const brandSource = readFileSync(join(root, 'app/components/brand-wordmark.tsx'), 'utf8')
    const headerSource = readFileSync(join(root, 'app/components/site-header.tsx'), 'utf8')

    expect(brandSource).toContain("src: '/brand/web/header-logo-transparent.png'")
    expect(brandSource).toContain('width: 6118')
    expect(brandSource).toContain('height: 1947')
    expect(headerSource).toContain('<BrandWordmark top compact={useCompactBrand} legacyNav siteHeaderCompact={useCompactHeader} />')
  })
})

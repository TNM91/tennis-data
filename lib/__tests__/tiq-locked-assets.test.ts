import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'
import { describe, expect, it } from 'vitest'

const root = process.cwd()

const sourceRoots = ['app', 'components', 'lib', 'public', 'docs']
const textFilePattern = /\.(css|html|json|md|mjs|ts|tsx|txt|webmanifest)$/i
const allowedLegacyLogoRefs = new Set([
  '/tenaceiq/logos/tenaceiq-brand-preview.png',
  '/tenaceiq/logos/tenaceiq-social-preview.png',
])

const lockedAssets = [
  'public/tiq/courts/tiq-court-master.png',
  'public/tiq/courts/tiq-court-master-v2.png',
  'public/tiq/logo/tiq-lockup-light.png',
  'public/tiq/logo/tiq-lockup-dark.png',
  'public/tiq/logo/tiq-q-icon-dark.png',
  'public/tiq/logo/tiq-app-icon.png',
  'public/tiq/logo/tiq-mark-dark.png',
  'public/tiq/logo/tiq-mark-light.png',
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

describe('TIQ locked tactical assets', () => {
  it('keeps every approved court and logo asset present in public/tiq', () => {
    for (const asset of lockedAssets) {
      const path = join(root, asset)
      expect(existsSync(path), asset).toBe(true)
      expect(statSync(path).size, asset).toBeGreaterThan(0)
    }
  })

  it('renders the tactical board from the locked court image, not a recreated court', () => {
    const boardSource = readFileSync(join(root, 'components/tactical/TiqCourtBoard.tsx'), 'utf8')

    expect(boardSource).toContain('src="/tiq/courts/tiq-court-master-v2.png"')
    expect(boardSource).toContain('className={styles.courtImage}')
    expect(boardSource).toContain('fill priority')
  })

  it('keeps legacy TenAceIQ logo-folder references out of source except social previews', () => {
    const offenders: string[] = []
    const legacyLogoPattern = /\/tenaceiq\/logos\/[^"'`\s),]+/g

    for (const file of readSourceFiles()) {
      const matches = file.source.match(legacyLogoPattern) ?? []
      for (const match of matches) {
        if (!allowedLegacyLogoRefs.has(match)) offenders.push(`${file.path}: ${match}`)
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

    expect(tacticalSources).toContain('/tiq/logo/tiq-app-icon.png')
    expect(tacticalSources).toContain('/tiq/logo/tiq-lockup-light.png')
    expect(tacticalSources).not.toContain('tenaceiq-q-icon.svg')
    expect(tacticalSources).not.toContain('tenaceiq-app-icon.svg')
  })
})

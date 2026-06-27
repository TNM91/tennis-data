import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const root = process.cwd()

function readAppFile(path: string) {
  return readFileSync(join(root, path), 'utf8')
}

function styleBlock(source: string, name: string) {
  const pattern = new RegExp(`const ${name}: CSSProperties = \\{([\\s\\S]*?)\\n\\}`)
  return source.match(pattern)?.[1] ?? ''
}

describe('route loading shells', () => {
  it('keeps high-priority workflow routes on branded loading states', () => {
    for (const file of [
      'app/captain/loading.tsx',
      'app/league-coordinator/loading.tsx',
      'app/league-coordinator/results/loading.tsx',
      'app/league-coordinator/individual-results/loading.tsx',
    ]) {
      const source = readAppFile(file)
      expect(source).toContain('RouteLoadingShell')
      expect(source).toContain('pattern="workflow"')
    }
  })

  it('keeps Data Assist on an upload-specific loading state', () => {
    const source = readAppFile('app/data-assist/loading.tsx')
    expect(source).toContain('Preparing Data Assist')
    expect(source).toContain('pattern="upload"')
  })

  it('uses polished preparing copy instead of raw Loading labels on route shells', () => {
    for (const file of [
      'app/admin/loading.tsx',
      'app/compete/loading.tsx',
      'app/data-assist/loading.tsx',
      'app/league-coordinator/loading.tsx',
      'app/league-coordinator/results/loading.tsx',
      'app/league-coordinator/individual-results/loading.tsx',
      'app/mylab/loading.tsx',
    ]) {
      const source = readAppFile(file)
      expect(source, file).toContain('Preparing')
      expect(source, file).not.toContain('label="Loading')
    }
  })

  it('avoids hard-coded white loader text so route loaders stay shell-readable', () => {
    expect(readAppFile('components/TiqLoader.tsx')).not.toContain('text-white/70')
    expect(readAppFile('app/components/TiqLoader.tsx')).not.toContain('text-white/70')
  })

  it('uses the supplied TenAceIQ Q and ball asset without an extra drawn loading badge', () => {
    for (const file of ['components/TiqLoader.tsx', 'app/components/TiqLoader.tsx']) {
      const source = readAppFile(file)
      expect(source).toContain('src="/tiq/logo/tiq-app-icon.png"')
      expect(source).toContain('objectFit: "contain"')
      expect(source).toContain('grid place-items-center')
      expect(source).not.toContain('rounded-[28%]')
      expect(source).not.toContain('border-[')
      expect(source).not.toContain('boxShadow')
    }
  })

  it('keeps the global desktop brand watermark fully on-screen and more readable', () => {
    const source = readAppFile('app/globals.css')

    expect(source).toContain('.brand-atmosphere-mark')
    expect(source).toContain('right: clamp(24px, 4vw, 72px);')
    expect(source).toContain('bottom: clamp(58px, 8vh, 120px);')
    expect(source).toContain('width: min(76vw, 980px);')
    expect(source).toContain('opacity: 0.17;')
    expect(source).toContain('right: clamp(20px, 3.6vw, 64px);')
    expect(source).toContain('opacity: 0.2;')
    expect(source).not.toContain('right: max(-300px, -16vw)')
    expect(source).not.toContain('bottom: max(-180px, -10vw)')
  })

  it('announces route loading shells as polite busy status regions', () => {
    const source = readAppFile('app/components/route-loading-shell.tsx')

    expect(source).toContain('role="status"')
    expect(source).toContain('aria-live="polite"')
    expect(source).toContain('aria-busy="true"')
  })

  it('keeps matchup loading rows shrink-safe on narrow screens', () => {
    const source = readAppFile('app/components/route-loading-shell.tsx')
    const matchupStyle = styleBlock(source, 'matchupStyle')
    const matchupCardStyle = styleBlock(source, 'matchupCardStyle')

    expect(matchupStyle).toContain("gridTemplateColumns: 'minmax(0, 1fr) minmax(0, auto) minmax(0, 1fr)'")
    expect(matchupStyle).toContain('minWidth: 0')
    expect(matchupStyle).toContain("overflowWrap: 'anywhere'")
    expect(matchupCardStyle).toContain('minWidth: 0')
    expect(source).not.toContain("gridTemplateColumns: 'minmax(0, 1fr) auto minmax(0, 1fr)'")
  })
})

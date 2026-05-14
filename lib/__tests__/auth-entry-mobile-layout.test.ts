import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const authEntryFiles = [
  'app/login/page.tsx',
  'app/join/page.tsx',
  'app/reset-password/page.tsx',
  'app/forget-password/page.tsx',
]

const sources = new Map(
  authEntryFiles.map((file) => [file, readFileSync(join(process.cwd(), file), 'utf8')]),
)

function styleBlock(source: string, styleName: string) {
  const pattern = new RegExp(`const ${styleName}: CSSProperties = ([\\s\\S]*?)(?=\\nconst |\\nfunction |\\nexport |$)`)
  const match = source.match(pattern)
  if (!match) throw new Error(`Missing style block: ${styleName}`)
  return match[0]
}

describe('auth entry mobile layout guards', () => {
  it('uses shrink-safe one-column grids on auth entry shells', () => {
    for (const [file, source] of sources) {
      expect(source, file).not.toContain("? '1fr'")
      expect(source, file).toContain("gridTemplateColumns: isTablet ? 'minmax(0, 1fr)'")
    }

    expect(sources.get('app/login/page.tsx')).toContain(
      "gridTemplateColumns: isSmallMobile ? 'minmax(0, 1fr)' : 'minmax(0, 1fr) auto'",
    )
    expect(sources.get('app/reset-password/page.tsx')).toContain(
      "gridTemplateColumns: isSmallMobile ? 'minmax(0, 1fr)' : 'repeat(2, minmax(0, 1fr))'",
    )
    expect(sources.get('app/forget-password/page.tsx')).toContain(
      "gridTemplateColumns: isSmallMobile ? 'minmax(0, 1fr)' : 'repeat(2, minmax(0, 1fr))'",
    )
  })

  it('keeps auth shell, panel, and form containers shrinkable', () => {
    for (const [file, source] of sources) {
      for (const styleName of ['heroShell', 'formCard']) {
        expect(styleBlock(source, styleName), `${file} ${styleName}`).toContain('minWidth: 0')
      }
    }

    for (const file of ['app/login/page.tsx', 'app/join/page.tsx']) {
      const source = sources.get(file)!
      expect(styleBlock(source, 'loginPanel')).toContain('minWidth: 0')
      expect(styleBlock(source, 'loginPanelInner')).toContain('minWidth: 0')
      expect(styleBlock(source, 'selectedPlanCardStyle')).toContain('minWidth: 0')
    }

    for (const file of ['app/reset-password/page.tsx', 'app/forget-password/page.tsx']) {
      const source = sources.get(file)!
      expect(styleBlock(source, 'formPanel')).toContain('minWidth: 0')
      expect(styleBlock(source, 'formPanelInner')).toContain('minWidth: 0')
      expect(styleBlock(source, 'panelCard')).toContain('minWidth: 0')
    }
  })

  it('wraps long auth labels, notices, and action text instead of forcing overflow', () => {
    for (const [file, source] of sources) {
      for (const styleName of ['heroTitle', 'heroText', 'formTitle', 'inputLabel', 'submitButton', 'successBanner', 'errorBanner', 'inlineLink']) {
        expect(styleBlock(source, styleName), `${file} ${styleName}`).toContain("overflowWrap: 'anywhere'")
      }
    }

    for (const file of ['app/login/page.tsx', 'app/join/page.tsx', 'app/reset-password/page.tsx', 'app/forget-password/page.tsx']) {
      const eyebrowBlock = styleBlock(sources.get(file)!, 'eyebrow')
      expect(eyebrowBlock).toContain("maxWidth: '100%'")
      expect(eyebrowBlock).toContain("whiteSpace: 'normal'")
      expect(eyebrowBlock).toContain("overflowWrap: 'anywhere'")
    }

    expect(styleBlock(sources.get('app/login/page.tsx')!, 'togglePasswordButton')).toContain(
      "overflowWrap: 'anywhere'",
    )
    expect(styleBlock(sources.get('app/login/page.tsx')!, 'inlineLinkMuted')).toContain(
      "overflowWrap: 'anywhere'",
    )
    expect(styleBlock(sources.get('app/join/page.tsx')!, 'identityCueStyle')).toContain(
      "overflowWrap: 'anywhere'",
    )
    expect(styleBlock(sources.get('app/reset-password/page.tsx')!, 'pillBase')).toContain(
      "overflowWrap: 'anywhere'",
    )
    expect(styleBlock(sources.get('app/reset-password/page.tsx')!, 'pillRow')).toContain('minWidth: 0')
    expect(styleBlock(sources.get('app/reset-password/page.tsx')!, 'pillBase')).toContain(
      "whiteSpace: 'normal'",
    )
    expect(styleBlock(sources.get('app/reset-password/page.tsx')!, 'helperRow')).toContain(
      "maxWidth: '100%'",
    )
    expect(styleBlock(sources.get('app/reset-password/page.tsx')!, 'inlineLinkMuted')).toContain(
      "overflowWrap: 'anywhere'",
    )
    expect(styleBlock(sources.get('app/forget-password/page.tsx')!, 'statusPill')).toContain(
      "overflowWrap: 'anywhere'",
    )
    expect(styleBlock(sources.get('app/forget-password/page.tsx')!, 'pillRow')).toContain('minWidth: 0')
    expect(styleBlock(sources.get('app/forget-password/page.tsx')!, 'pillBase')).toContain(
      "whiteSpace: 'normal'",
    )
    expect(styleBlock(sources.get('app/forget-password/page.tsx')!, 'panelHeader')).toContain('minWidth: 0')
    expect(styleBlock(sources.get('app/forget-password/page.tsx')!, 'helperRow')).toContain(
      "maxWidth: '100%'",
    )
    expect(styleBlock(sources.get('app/forget-password/page.tsx')!, 'inlineLinkMuted')).toContain(
      "overflowWrap: 'anywhere'",
    )
  })
})

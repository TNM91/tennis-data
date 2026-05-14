import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const source = readFileSync(join(process.cwd(), 'app/components/captain-subnav.tsx'), 'utf8')

function styleBlock(styleName: string) {
  const start = source.indexOf(`const ${styleName}`)
  expect(start, styleName).toBeGreaterThanOrEqual(0)
  const nextStyle = source.indexOf('\nconst ', start + 1)
  return source.slice(start, nextStyle === -1 ? undefined : nextStyle)
}

describe('Captain subnav mobile layout guards', () => {
  it('keeps captain workflow nav grids and links from forcing horizontal scroll', () => {
    for (const styleName of [
      'shellStyle',
      'headerStyle',
      'gridStyle',
      'linkStyle',
      'linkLabelStyle',
      'tierRowStyle',
      'moreToolsStyle',
      'secondaryGridStyle',
    ]) {
      expect(styleBlock(styleName), styleName).toContain('minWidth: 0')
    }

    expect(styleBlock('linkStyle')).toContain("gridTemplateColumns: '30px minmax(0, 1fr) auto'")
    expect(styleBlock('secondaryLinkStyle')).toContain("gridTemplateColumns: 'minmax(0, 1fr) auto'")
  })

  it('wraps long captain tier and tool labels inside their controls', () => {
    for (const styleName of [
      'titleStyle',
      'descriptionStyle',
      'linkStyle',
      'linkLabelStyle',
      'linkArrowStyle',
      'tierPillBase',
    ]) {
      expect(styleBlock(styleName), styleName).toContain("overflowWrap: 'anywhere'")
    }

    expect(styleBlock('linkArrowStyle')).toContain("whiteSpace: 'normal'")
    expect(styleBlock('tierPillBase')).toContain("maxWidth: '100%'")
    expect(styleBlock('tierPillBase')).toContain("whiteSpace: 'normal'")
  })
})

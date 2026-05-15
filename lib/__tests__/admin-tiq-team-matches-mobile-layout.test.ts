import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const source = readFileSync(join(process.cwd(), 'app/admin/tiq-team-matches/page.tsx'), 'utf8')

function styleBlock(styleName: string) {
  const start = source.indexOf(`const ${styleName}`)
  expect(start).toBeGreaterThanOrEqual(0)
  const nextStyle = source.indexOf('\nconst ', start + 1)
  return source.slice(start, nextStyle === -1 ? undefined : nextStyle)
}

describe('Admin TIQ team matches mobile layout guards', () => {
  it('keeps event cards, forms, and line rows from forcing horizontal scroll', () => {
    for (const styleName of [
      'card',
      'row',
      'actionRow',
      'cardHeaderRow',
      'lineCardHeaderRow',
      'fieldWrap',
      'lineGrid',
      'lineCard',
    ]) {
      expect(styleBlock(styleName), styleName).toContain('minWidth: 0')
    }

    expect(styleBlock('fieldWrap')).toContain("flex: '1 1 min(100%, 180px)'")
    expect(styleBlock('label')).toContain("overflowWrap: 'anywhere'")
    expect(styleBlock('pill')).toContain("whiteSpace: 'normal'")
    expect(styleBlock('pill')).toContain("overflowWrap: 'anywhere'")
  })

  it('keeps admin team match actions readable in dark and light shells', () => {
    for (const styleName of ['btnPrimary', 'btnDanger', 'btnSecondary']) {
      const block = styleBlock(styleName)
      expect(block).toContain("whiteSpace: 'normal'")
      expect(block).toContain("maxWidth: '100%'")
      expect(block).toContain("overflowWrap: 'anywhere'")
    }

    expect(styleBlock('btnPrimary')).toContain("color: 'var(--foreground-strong)'")
    expect(styleBlock('btnPrimary')).not.toContain("color: '#0a0a0a'")
  })
})

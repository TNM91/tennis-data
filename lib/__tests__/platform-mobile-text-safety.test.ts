import fs from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'

const root = process.cwd()

function read(relativePath: string) {
  return fs.readFileSync(path.join(root, relativePath), 'utf8')
}

describe('platform mobile text safety', () => {
  it('keeps ordinary mobile labels from breaking inside words', () => {
    const css = read('app/globals.css')

    expect(css).toContain("#main-content :is(button, a, label, [role='button'])")
    expect(css).toContain('overflow-wrap: normal;')
    expect(css).toContain('word-break: normal;')
    expect(css).toContain('hyphens: none;')
  })

  it('gives dense mobile summary labels enough horizontal room', () => {
    const players = read('app/players/page.tsx')
    const captain = read('app/captain/captain-mobile-command.module.css')
    const trust = read('app/components/data-trust-panel.tsx')
    const pricing = read('app/pricing/page.tsx')

    expect(players).toContain("isSmallMobile\n      ? 'repeat(2, minmax(0, 1fr))'")
    expect(captain).toContain('.pulse:last-child:nth-child(odd)')
    expect(trust).toContain('flexShrink: 0')
    expect(pricing).toContain("gridColumn: '1 / -1'")
    expect(pricing).toContain("overflowWrap: 'normal'")
  })
})

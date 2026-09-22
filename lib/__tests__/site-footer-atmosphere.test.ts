import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const source = readFileSync(join(process.cwd(), 'app', 'components', 'site-footer.tsx'), 'utf8')

describe('Site footer atmosphere boundary', () => {
  it('keeps shell-level decorative visuals behind an opaque footer surface', () => {
    expect(source).toContain("isolation: 'isolate'")
    expect(source).toContain("background: 'var(--footer-bg)'")
    expect(source.indexOf("background: 'var(--footer-bg)'")).toBeLessThan(source.indexOf('data-site-footer-content="true"'))
  })
})

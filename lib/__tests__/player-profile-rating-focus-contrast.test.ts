import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const source = readFileSync(join(process.cwd(), 'app/players/[id]/page.tsx'), 'utf8')

describe('player profile rating focus contrast', () => {
  it('uses the shared dark selected treatment with readable accent type', () => {
    expect(source).toContain("...(accent ? { color: 'var(--brand-lime)' } : {})")
    expect(source).toContain("...(accent ? { color: 'var(--foreground-strong)' } : {})")
    expect(source).toContain("background: 'color-mix(in srgb, var(--brand-blue-2) 8%, var(--shell-chip-bg) 92%)'")
    expect(source).not.toContain("background: 'color-mix(in srgb, var(--brand-green) 22%, var(--shell-chip-bg) 78%)'")
    expect(source).not.toContain("...(accent ? { color: '#07111d' } : {})")
  })
})

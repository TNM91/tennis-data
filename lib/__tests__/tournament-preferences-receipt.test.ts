import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

describe('tournament alert preference receipt', () => {
  it('confirms alert status, tournament scope, and STOP control after save', () => {
    const source = readFileSync(join(process.cwd(), 'app/tournaments/[id]/preferences/page.tsx'), 'utf8')

    expect(source).toContain('preferenceReceipt')
    expect(source).toContain('Tournament alerts are on')
    expect(source).toContain('Tournament alerts are off')
    expect(source).toContain('Reply STOP anytime')
    expect(source).toContain('This tournament')
    expect(source).toContain('receiptGridStyle')
  })
})

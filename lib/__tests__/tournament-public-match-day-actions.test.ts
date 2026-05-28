import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

describe('public tournament match-day actions', () => {
  it('keeps participant actions compact and status-driven', () => {
    const source = readFileSync(join(process.cwd(), 'app/tournaments/[id]/page.tsx'), 'utf8')

    expect(source).toContain('matchDayActions')
    expect(source).toContain('Match-day actions')
    expect(source).toContain('playerRailCopyStyle')
    expect(source).toContain('Court alerts')
    expect(source).toContain('Find yours')
    expect(source).toContain('results')
    expect(source).not.toContain('Manage tournament texts.')
    expect(source).not.toContain('Self-rated players show with an S until verified.')
    expect(source).not.toContain('Awards appear after the finish.')
  })
})

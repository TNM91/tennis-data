import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const source = readFileSync(join(process.cwd(), 'app/players/[id]/page.tsx'), 'utf8')

describe('per-match TiQ checkpoints', () => {
  it('shows the post-match TiQ checkpoint in mobile and desktop history', () => {
    expect(source).toContain('<span>TiQ after</span>')
    expect(source).toContain('<th style={tableHead}>TiQ after</th>')
    expect(source).toContain('formatTiqRating(snap.dynamic_rating, player, canViewExactTiqRating)')
  })

  it('uses the processed match snapshot rather than inventing a rating', () => {
    expect(source).toContain('const snap = snapshotByMatchId.get(`${match.id}:${match.matchType}`)')
    expect(source).toContain('snapshotByMatchId.get(`${match.id}:overall`)')
  })
})

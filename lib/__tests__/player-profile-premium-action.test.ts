import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const source = readFileSync(join(process.cwd(), 'app/players/[id]/page.tsx'), 'utf8')

describe('Player profile premium action', () => {
  it('explains the Player membership value where exact TIQ is gated', () => {
    expect(source).toContain('Player member view')
    expect(source).toContain('Exact TIQ and match context')
    expect(source).toContain('See your exact rating, match-by-match movement, and the full path into My Lab.')
    expect(source).toContain('See exact TIQ, opponent context, and the match impact behind this player’s results.')
    expect(source).toContain('Unlock Player')
  })
})

import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const source = readFileSync(join(process.cwd(), 'app/players/[id]/page.tsx'), 'utf8')

describe('player season review', () => {
  it('builds the review from the newest season with recorded player matches', () => {
    expect(source).toContain('const seasonReview = useMemo(')
    expect(source).toContain('match.date.startsWith(season)')
    expect(source).toContain('largestLift')
    expect(source).toContain('biggestSwing')
  })

  it('offers a compact premium season story without exposing detailed context for free', () => {
    expect(source).toContain('SeasonReviewPanel')
    expect(source).toContain('Next match focus')
    expect(source).toContain('Unlock your full season read with Player')
  })
})

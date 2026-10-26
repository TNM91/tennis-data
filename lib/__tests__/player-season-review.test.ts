import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const shared = readFileSync(join(process.cwd(), 'app/components/player-season-review.tsx'), 'utf8')
const source = readFileSync(join(process.cwd(), 'app/players/[id]/page.tsx'), 'utf8')

describe('player season review', () => {
  it('builds the review from the newest season with recorded player matches', () => {
    expect(source).toContain('const seasonReview = useMemo(')
    expect(source).toContain('playerSeasonReview(matches, snapshotByMatchId)')
    expect(source).toContain('largestLift')
    expect(source).toContain('biggestSwing')
  })

  it('offers a compact premium season story without exposing detailed context for free', () => {
    expect(source).toContain('SeasonReviewPanel')
    expect(shared).toContain("personal?'Your next match focus':'Competitive signal'")
    expect(source).toContain('Unlock your full season read with Player')
  })

  it('keeps the season language and exact swing evidence appropriate to the viewer', () => {
    expect(shared).toContain("personal?'Your season':'Season snapshot'")
    expect(shared).toContain("personal?'season check-in.':'at a glance.'")
    expect(source).toContain("personal={hasPersonalPlayerExperience}")
    expect(source).toContain('const hasExactSeasonDetail = canViewDetailed && (!isOwnProfile || hasPersonalPlayerExperience)')
    expect(source).toContain("highlight.snap.delta >= 0 ? 'Up' : 'Down'")
    expect(source).toContain('Unlock season analysis with Player')
  })
})

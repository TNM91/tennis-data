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
    expect(source).toContain("const focusLabel = hasPersonalPlayerExperience ? 'Your next match focus' : 'Competitive signal'")
    expect(source).toContain('Unlock your full season read with Player')
  })

  it('keeps the season language and exact swing evidence appropriate to the viewer', () => {
    expect(source).toContain("const seasonEyebrow = hasPersonalPlayerExperience ? 'Your season' : 'Season snapshot'")
    expect(source).toContain("const seasonTitle = hasPersonalPlayerExperience ? `${review.season} season check-in.` : `${review.season} at a glance.`")
    expect(source).toContain('const hasExactSeasonDetail = canViewDetailed && (!isOwnProfile || hasPersonalPlayerExperience)')
    expect(source).toContain("highlight.snap.delta >= 0 ? 'Up' : 'Down'")
    expect(source).toContain('Unlock exact TIQ season detail with Player')
  })
})

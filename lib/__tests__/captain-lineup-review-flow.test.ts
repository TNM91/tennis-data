import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const read = (path: string) => readFileSync(join(process.cwd(), path), 'utf8').replace(/\r\n/g, '\n')
const builder = read('app/captain/lineup-builder/page.tsx')
const reviewClient = read('app/lineup-review/[token]/lineup-review-client.tsx')
const reviewCss = read('app/lineup-review/[token]/lineup-review.module.css')
const publicApi = read('app/api/lineup-reviews/[token]/route.ts')
const captainApi = read('app/api/captain/lineup-reviews/[token]/route.ts')

describe('co-captain lineup review flow', () => {
  it('keeps the review action visible in the primary phone controls', () => {
    expect(builder).toContain("'Ask co-captain'")
    expect(builder).toContain('Private review link ready')
    expect(builder).toContain('Text co-captain')
    expect(builder).toContain('They can move players and text a proposed version back.')
  })

  it('loads a suggestion as a draft and requires a later save', () => {
    expect(builder).toContain('Use suggested version')
    expect(builder).toContain('Your saved lineup stays unchanged until you load this suggestion and save it.')
    expect(builder).toContain('Co-captain suggestion loaded into your draft. Review it, then update the saved version')
    expect(builder).toContain('setTeamSlots(cloneSlots(incomingCoCaptainReview.proposedSlots))')
  })

  it('lets the co-captain edit from the roster and return the proposal by text', () => {
    expect(reviewClient).toContain('Move players if you see a better plan.')
    expect(reviewClient).toContain('Text proposal back')
    expect(reviewClient).toContain('Save & text back')
    expect(reviewClient).toContain('Your edits create a separate suggestion.')
  })

  it('uses phone-safe controls and a compact sticky submit action', () => {
    expect(reviewCss).toContain('grid-template-columns: repeat(auto-fit, minmax(min(100%, 210px), 1fr))')
    expect(reviewCss).toContain('font-size: 16px')
    expect(reviewCss).toContain('position: fixed')
    expect(reviewCss).toContain('env(safe-area-inset-bottom)')
  })

  it('keeps public edits token-scoped and captain acceptance owner-scoped', () => {
    expect(publicApi).toContain(".eq('review_token', token)")
    expect(publicApi).toContain('validateCaptainLineupReviewProposal')
    expect(publicApi).toContain("status: 'submitted'")
    expect(captainApi).toContain('data.created_by !== auth.userId')
    expect(captainApi).toContain('Only the captain who requested this review can apply it.')
  })
})

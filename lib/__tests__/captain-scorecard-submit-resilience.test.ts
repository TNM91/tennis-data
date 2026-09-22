import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const source = (path: string) => readFileSync(join(process.cwd(), path), 'utf8')

describe('Captain scorecard submission resilience', () => {
  it('returns after the durable save instead of waiting for a full rating rebuild', () => {
    const route = source('app/api/captain/match-results/route.ts')

    expect(route).not.toContain('await recalculateDynamicRatings(undefined, service)')
    expect(route).toContain("scheduleRatingRefresh(service, 'Captain scorecard')")
    expect(route).toContain("rating_processed_at: input.lines[index].resultType === 'played' ? null : observedAt")
    expect(route).toContain('ratingsRefreshing: completedLineIds.length > 0')
    expect(route).toContain("console.info('[api/captain/match-results] save completed'")
  })

  it('explains an unconfirmed timeout without blaming the captain connection', () => {
    const page = source('app/captain/record-result/page.tsx')

    expect(page).toContain('SCORECARD_CONFIRMATION_TIMEOUT_MESSAGE')
    expect(page).toContain('Your courts may already be saved')
    expect(page).toContain('TiQ will not create duplicates')
    expect(page).not.toContain('The scorecard could not be saved. Check your connection and try again.')
    expect(page).toContain('Your scorecard is saved. TiQ ratings are refreshing in the background.')
  })

  it('opens Messages directly without waiting on a native share promise', () => {
    const page = source('app/captain/record-result/page.tsx')

    expect(page).toContain('window.location.href = buildSmsHref([], message, navigator.userAgent)')
    expect(page).not.toContain('await navigator.share')
    expect(page).toContain('Opening Messages with the final result ready to send.')
  })

  it('shows a timestamped durable receipt after the result is saved', () => {
    const route = source('app/api/captain/match-results/route.ts')
    const page = source('app/captain/record-result/page.tsx')

    expect(route).toContain('savedAt: observedAt')
    expect(page).toContain('aria-label="Saved result receipt"')
    expect(page).toContain('Result saved')
    expect(page).toContain('Safe to close')
  })
})

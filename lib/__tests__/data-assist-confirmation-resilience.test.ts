import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const source = (path: string) => readFileSync(join(process.cwd(), path), 'utf8')

describe('Data Assist scorecard confirmation resilience', () => {
  it('keeps the confirmed scorecard ahead of the ratings refresh', () => {
    const runner = source('lib/data-assist-import-runner.ts')
    const refresh = source('lib/data-assist-rating-refresh.ts')
    const importRoute = source('app/api/data-assist/import/route.ts')
    const reviewRoute = source('app/api/data-assist/review/route.ts')
    const ocrRoute = source('app/api/data-assist/ocr/route.ts')

    expect(runner).toContain('deferRatingRecalculation?: boolean')
    expect(runner).toContain('if (!input.deferRatingRecalculation)')
    expect(refresh).toContain('waitUntil(')
    expect(refresh).toContain('replaceSnapshots: false')
    for (const route of [importRoute, reviewRoute, ocrRoute]) {
      expect(route).toContain('scheduleDataAssistRatingRefresh(supabase)')
    }
  })

  it('does not leave a phone waiting forever or replace newer History data with an older refresh', () => {
    const page = source('app/data-assist/page.tsx')

    expect(page).toContain('const DATA_ASSIST_CONFIRM_TIMEOUT_MS = 45_000')
    expect(page).toContain('const submissionsRefreshRef = useRef(0)')
    expect(page).toContain('if (refreshId !== submissionsRefreshRef.current) return')
    expect(page).toContain("action === 'commit' ? DATA_ASSIST_CONFIRM_TIMEOUT_MS : 30_000")
    expect(page).toContain("filterDataAssistSubmissions(submissions, 'needs_review').length")
    expect(page).not.toContain('contributorStats?.pendingReviewCount ??')
  })
})

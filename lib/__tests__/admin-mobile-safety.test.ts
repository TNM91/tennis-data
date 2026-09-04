import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const read = (file: string) => readFileSync(join(process.cwd(), file), 'utf8')
const sharedFrame = read('app/admin/_components/admin-review-ui.tsx')
const globalStyles = read('app/globals.css')
const scorecardReview = read('app/admin/import/_components/scorecard-review-panel.tsx')
const promotions = read('app/admin/promotions/page.tsx')
const tennisRecord = read('app/admin/tennisrecord/page.tsx')

const adminRoutes = [
  'access', 'add-match', 'anomalies', 'backups', 'clubs', 'data-assist', 'deduplicate',
  'growth', 'import-queue', 'import', 'lineup-availability', 'manage-matches',
  'manage-players', 'match-reports', 'missing-scorecards', 'product-events', 'promotions',
  'tennisrecord', 'tiq-team-matches', 'upgrade-requests',
]

describe('Admin mobile text safety', () => {
  it('places every Admin work route inside the shared responsive frame', () => {
    expect(sharedFrame).toContain('className="admin-review-frame"')
    for (const route of adminRoutes) {
      expect(read(`app/admin/${route}/page.tsx`)).toContain('<AdminReviewFrame>')
    }
  })

  it('shrinks the shared frame and protects controls and copy below tablet width', () => {
    expect(globalStyles).toContain('.admin-review-frame {')
    expect(globalStyles).toContain('padding: 14px 0 30px !important;')
    expect(globalStyles).toContain('.admin-review-frame :is(input, select, textarea)')
    expect(globalStyles).toContain('min-inline-size: 0 !important;')
    expect(globalStyles).toContain('.admin-review-frame :is(.metric-value, strong, .metric-label, .subtle-text)')
    expect(globalStyles).toContain('overflow-wrap: anywhere;')
  })

  it('collapses the few operational desktop splits before labels become cramped', () => {
    expect(scorecardReview).toContain('className="admin-review-split-grid"')
    expect(promotions).toContain('className="admin-promotion-code-row"')
    expect(globalStyles).toContain('.admin-review-split-grid,')
    expect(globalStyles).toContain('.admin-promotion-code-row {')
    expect(tennisRecord).toContain("width: 'min(100%, 280px)'")
    expect(tennisRecord).not.toContain("minWidth: 280, flex: '1 1 280px'")
  })
})

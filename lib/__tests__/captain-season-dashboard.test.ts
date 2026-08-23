import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const source = readFileSync(join(process.cwd(), 'app/captain/season-dashboard/page.tsx'), 'utf8')

describe('Captain Season Dashboard', () => {
  it('keeps the dashboard behind shared Captain access', () => {
    expect(source).toContain("import { useAuth } from '@/app/components/auth-provider'")
    expect(source).toContain('const { role, entitlements, authResolved } = useAuth()')
    expect(source).toContain('buildProductAccessState(role, entitlements)')
    expect(source).toContain('if (!access.canUseCaptainWorkflow)')
    expect(source).toContain('<LockedPlanPage')
  })

  it('loads only the saved team, league, and flight context', () => {
    expect(source).toContain('escapePostgrestValue')
    expect(source).toContain(".is('line_number', null)")
    expect(source).toContain("inventoryQuery = inventoryQuery.eq('league_name', league)")
    expect(source).toContain("inventoryQuery = inventoryQuery.eq('flight', flight)")
    expect(source).toContain('Promise.all([inventoryQuery, upcomingQuery])')
  })

  it('connects saved Match Week work instead of fabricated season metrics', () => {
    expect(source).toContain("const WEEKLY_LINEUPS_STORAGE_KEY = 'tenaceiq_weekly_lineups'")
    expect(source).toContain("const WEEKLY_AVAILABILITY_STORAGE_KEY = 'tenaceiq_weekly_availability'")
    expect(source).toContain("const WEEKLY_RESPONSES_STORAGE_KEY = 'tenaceiq_weekly_responses'")
    expect(source).toContain('Based on your saved team plan')
    expect(source).toContain('buildCaptainScopedHref')
    expect(source).toContain("lastTool: 'season-dashboard'")
  })
})

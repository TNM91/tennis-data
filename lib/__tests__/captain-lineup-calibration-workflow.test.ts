import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

const root = process.cwd()
const migration = readFileSync(join(root, 'supabase/migrations/20260913000100_create_captain_lineup_calibration.sql'), 'utf8')
const resultRoute = readFileSync(join(root, 'app/api/captain/match-results/route.ts'), 'utf8')
const historyRoute = readFileSync(join(root, 'app/api/captain/lineup-calibrations/route.ts'), 'utf8')
const resultPage = readFileSync(join(root, 'app/captain/record-result/page.tsx'), 'utf8')
const reportPage = readFileSync(join(root, 'app/captain/calibration/page.tsx'), 'utf8')
const lineupBuilderPage = readFileSync(join(root, 'app/captain/lineup-builder/page.tsx'), 'utf8')

describe('captain lineup calibration workflow', () => {
  it('stores private prediction snapshots and owner-scoped calibrations', () => {
    expect(migration).toContain('create table if not exists public.lineup_prediction_snapshots')
    expect(migration).toContain('create table if not exists public.captain_lineup_calibrations')
    expect(migration).toContain('constraint captain_lineup_calibrations_owner_match_unique unique (user_id, external_match_id)')
    expect(migration).toContain('alter table public.captain_lineup_calibrations enable row level security')
    expect(migration).toContain('user_id = (select auth.uid())')
  })

  it('reconciles the latest scoped snapshot when a verified scorecard is saved', () => {
    expect(resultRoute).toContain(".from('lineup_prediction_snapshots')")
    expect(resultRoute).toContain('buildCaptainLineupCalibration(prediction, input)')
    expect(resultRoute).toContain(".from('captain_lineup_calibrations')")
    expect(resultRoute).toContain("onConflict: 'user_id,external_match_id'")
  })

  it('exposes a protected history report and an immediate post-match explanation', () => {
    expect(historyRoute).toContain('getCaptainApiAuth(request)')
    expect(historyRoute).toContain(".eq('user_id', auth.userId)")
    expect(resultPage).toContain('What TiQ learned')
    expect(resultPage).toContain('View prediction report')
    expect(reportPage).toContain('Is the lineup model earning your trust?')
    expect(reportPage).toContain('more verified match')
  })

  it('carries known USTA defaults from lineup planning through scorecard calibration', () => {
    expect(migration).toContain('known_defaults_json jsonb')
    expect(lineupBuilderPage).toContain('Known USTA defaults')
    expect(lineupBuilderPage).toContain('known_defaults_json: knownCourtDefaults')
    expect(resultRoute).toContain("update({ rating_eligible: false })")
    expect(resultPage).toContain('When was the default known?')
  })

  it('keeps in-match retirements separate from completed matches and pre-play defaults', () => {
    expect(resultPage).toContain('Retired')
    expect(resultPage).toContain('Score when play stopped')
    expect(resultPage).toContain('Who retired?')
    expect(resultPage).toContain("resultType: retirementDetected ? 'retired' as const : 'played' as const")
    expect(resultRoute).toContain("line.resultType === 'default' || line.resultType === 'retired'")
  })
})

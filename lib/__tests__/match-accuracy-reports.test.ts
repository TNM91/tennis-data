import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { getIssueTypeLabel, getReportStatusLabel, getUploaderTrustLabel } from '../match-accuracy-reports'

const migrationSource = readFileSync(
  join(process.cwd(), 'supabase/migrations/20260512131000_create_match_accuracy_reports.sql'),
  'utf8',
)
const apiSource = readFileSync(join(process.cwd(), 'app/api/match-accuracy-reports/route.ts'), 'utf8')
const adminSource = readFileSync(join(process.cwd(), 'app/admin/match-reports/page.tsx'), 'utf8')
const dataAssistSource = readFileSync(join(process.cwd(), 'app/data-assist/page.tsx'), 'utf8')
const adminHomeSource = readFileSync(join(process.cwd(), 'app/admin/page.tsx'), 'utf8')

describe('match accuracy reporting foundation', () => {
  it('creates a report queue tied to source uploader trust', () => {
    expect(migrationSource).toContain('create table if not exists public.match_accuracy_reports')
    expect(migrationSource).toContain('source_uploader_user_id uuid null references public.profiles')
    expect(migrationSource).toContain('can_upload_scorecards boolean not null default true')
    expect(migrationSource).toContain('requested_import_type <> \'scorecard\'')
    expect(migrationSource).toContain('stats.can_upload_scorecards')
  })

  it('keeps the API responsible for uploader attribution and trust actions', () => {
    expect(apiSource).toContain("from('data_assist_drafts')")
    expect(apiSource).toContain('source_uploader_user_id')
    expect(apiSource).toContain('uploaderCanUploadScorecards')
    expect(apiSource).toContain("from('data_assist_contributor_stats')")
  })

  it('exposes an admin action queue and Data Assist enforcement copy', () => {
    expect(adminHomeSource).toContain('Match Accuracy Reports')
    expect(adminSource).toContain('Pause uploader scorecards')
    expect(adminSource).toContain('Restore uploader scorecards')
    expect(dataAssistSource).toContain('scorecardUploadsPaused')
    expect(dataAssistSource).toContain('Scorecard uploads are paused while admins review recent match accuracy reports.')
  })

  it('labels report states and uploader trust plainly', () => {
    expect(getIssueTypeLabel('wrong_score')).toBe('Wrong score')
    expect(getReportStatusLabel('reviewing')).toBe('Reviewing')
    expect(getUploaderTrustLabel({ canUploadScorecards: true, uploadSuspensionReason: '' })).toBe('Scorecard uploads enabled')
    expect(getUploaderTrustLabel({ canUploadScorecards: false, uploadSuspensionReason: 'Too many bad scorecards' })).toBe('Too many bad scorecards')
  })
})

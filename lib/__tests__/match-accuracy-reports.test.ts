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
const helperSource = readFileSync(join(process.cwd(), 'lib/match-accuracy-reports.ts'), 'utf8')
const myLabSource = readFileSync(join(process.cwd(), 'app/mylab/page.tsx'), 'utf8')

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
    expect(apiSource).toContain('loadUploaderTrusts')
    expect(apiSource).toContain('can_upload_scorecards, upload_suspension_reason')
  })

  it('exposes an admin action queue and Data Assist enforcement copy', () => {
    expect(adminHomeSource).toContain('Match Accuracy Reports')
    expect(adminSource).toContain('Pause uploader scorecards')
    expect(adminSource).toContain('Restore uploader scorecards')
    expect(dataAssistSource).toContain('scorecardUploadsPaused')
    expect(dataAssistSource).toContain('scorecardUploadBlocked')
    expect(dataAssistSource).toContain('ScorecardUploadPausedPanel')
    expect(dataAssistSource).toContain('disabled={scorecardUploadBlocked}')
    expect(dataAssistSource).toContain('Contact support')
    expect(dataAssistSource).toContain('Scorecard uploads are paused while admins review recent match accuracy reports.')
  })

  it('shows uploader report history and trust state for admin review', () => {
    expect(helperSource).toContain('export type DataAssistUploaderTrustMap')
    expect(helperSource).toContain('uploaderTrusts: toUploaderTrustMap')
    expect(adminSource).toContain('selectedUploaderReports')
    expect(adminSource).toContain('selectedUploaderStats')
    expect(adminSource).toContain('Uploader trust')
    expect(adminSource).toContain('Uploads paused')
  })

  it('requires action summaries before final report decisions', () => {
    expect(apiSource).toContain("status === 'resolved' || status === 'rejected'")
    expect(apiSource).toContain('actionSummary.length < 8')
    expect(apiSource).toContain('Add an action summary before resolving or rejecting this report.')
    expect(adminSource).toContain('resolutionNeedsSummary')
    expect(adminSource).toContain('actionSummary.trim().length >= 8')
    expect(adminSource).toContain('Players see this in My Lab.')
    expect(adminSource).toContain('disabled={saveDisabled}')
  })

  it('labels report states and uploader trust plainly', () => {
    expect(getIssueTypeLabel('wrong_score')).toBe('Wrong score')
    expect(getReportStatusLabel('reviewing')).toBe('Reviewing')
    expect(getUploaderTrustLabel({ canUploadScorecards: true, uploadSuspensionReason: '' })).toBe('Scorecard uploads enabled')
    expect(getUploaderTrustLabel({ canUploadScorecards: false, uploadSuspensionReason: 'Too many bad scorecards' })).toBe('Too many bad scorecards')
  })

  it('lets players see their submitted report status in My Lab', () => {
    expect(apiSource).toContain("url.searchParams.get('scope') === 'mine'")
    expect(apiSource).toContain(".eq('reporter_user_id', user.userId)")
    expect(helperSource).toContain('export async function listMyMatchAccuracyReports')
    expect(helperSource).toContain('/api/match-accuracy-reports?scope=mine')
    expect(myLabSource).toContain('id="match-report-status"')
    expect(myLabSource).toContain('Match issues you sent')
    expect(myLabSource).toContain('getReportStatusLabel(report.status)')
  })
})

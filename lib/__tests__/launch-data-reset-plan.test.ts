import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const scriptSource = readFileSync(join(process.cwd(), 'scripts/launch-data-reset-plan.mjs'), 'utf8')
const packageJson = readFileSync(join(process.cwd(), 'package.json'), 'utf8')

describe('launch data reset plan', () => {
  it('stays non-destructive and owner-confirmed by default', () => {
    expect(packageJson).toContain('"qa:data-reset-plan": "node scripts/launch-data-reset-plan.mjs"')
    expect(scriptSource).toContain('This script is non-destructive. It prints the SQL plan only.')
    expect(scriptSource).toContain('Owner confirmation required before running.')
    expect(scriptSource).not.toContain('createClient(')
    expect(scriptSource).not.toContain('SUPABASE_SERVICE_ROLE_KEY')
    expect(scriptSource).not.toContain('await ')
  })

  it('backs up and resets the imported tennis data dependency chain', () => {
    for (const table of [
      'public.data_assist_ocr_jobs',
      'public.data_assist_drafts',
      'public.data_assist_screenshots',
      'public.data_assist_batches',
      'public.import_queue',
      'public.rating_snapshots',
      'public.match_accuracy_reports',
      'public.team_roster_members',
      'public.match_players',
      'public.team_summary_teams',
      'public.matches',
      'public.players',
    ]) {
      expect(scriptSource).toContain(table)
    }

    expect(scriptSource.indexOf('public.match_players')).toBeLessThan(scriptSource.indexOf('public.matches'))
    expect(scriptSource.indexOf('public.matches')).toBeLessThan(scriptSource.indexOf('public.players'))
    expect(scriptSource).toContain('linked_player_id = null')
    expect(scriptSource).toContain("update public.coach_player_links set player_id = ''")
    expect(scriptSource).toContain('update public.tiq_player_league_entries set player_id = null')
    expect(scriptSource).toContain('Run rating recalculation after scorecards commit.')
  })
})

import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const competeSource = readFileSync(join(process.cwd(), 'app/compete/schedule/page.tsx'), 'utf8')
const myLabSource = readFileSync(join(process.cwd(), 'app/mylab/page.tsx'), 'utf8')
const routeSource = readFileSync(join(process.cwd(), 'app/api/player/competition-schedule-response/route.ts'), 'utf8')
const migrationSource = readFileSync(join(process.cwd(), 'supabase/migrations/20260809000900_add_player_schedule_responses.sql'), 'utf8')

describe('player schedule response flow', () => {
  it('gives players one-touch answers in Compete and My Lab', () => {
    expect(competeSource).toContain("'/api/player/competition-schedule-response'")
    expect(competeSource).toContain('The schedule changed. Please answer again.')
    expect(competeSource).toContain('Available sent to the organizer.')
    expect(competeSource).toContain('Can’t play sent to the organizer.')
    expect(myLabSource).toContain('onRespondToCompetition')
    expect(myLabSource).toContain('Schedule changed — answer again')
    expect(myLabSource).toContain('Can’t play')
  })

  it('validates event ownership and alerts the organizer', () => {
    expect(routeSource).toContain('loadPlayerCompetitionSchedule(auth.supabase, auth.userId)')
    expect(routeSource).toContain(".from('player_schedule_responses')")
    expect(routeSource).toContain(".from('internal_notifications')")
    expect(routeSource).toContain("notification_type: 'schedule'")
  })

  it('notifies approved entrants when directors post or change schedules', () => {
    expect(migrationSource).toContain('create table if not exists public.player_schedule_responses')
    expect(migrationSource).toContain('notify_tiq_league_schedule_change')
    expect(migrationSource).toContain('after insert or update on public.tiq_league_schedule_items')
    expect(migrationSource).toContain('notify_tiq_tournament_schedule_change')
    expect(migrationSource).toContain('Tournament schedule changed')
    expect(migrationSource).toContain('League match changed')
  })
})

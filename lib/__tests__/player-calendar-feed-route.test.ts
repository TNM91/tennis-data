import { afterEach, describe, expect, it, vi } from 'vitest'

let tokenUpdated = false
let tokenQueryFilters: Array<[string, unknown]> = []

vi.mock('@supabase/supabase-js', () => ({
  createClient: vi.fn(() => ({
    from(table: string) {
      if (table === 'calendar_feed_tokens') {
        return {
          select() {
            return this
          },
          update() {
            tokenUpdated = true
            return this
          },
          eq(field: string, value: unknown) {
            tokenQueryFilters.push([field, value])
            return this
          },
          async maybeSingle() {
            return {
              data: {
                id: 'token-1',
                scope_id: 'player-1',
                status: 'active',
              },
              error: null,
            }
          },
          then(resolve: (value: { data: null; error: null }) => void) {
            resolve({ data: null, error: null })
          },
        }
      }

      if (table === 'player_calendar_items') {
        return {
          select() {
            return this
          },
          eq() {
            return this
          },
          order() {
            return this
          },
          limit() {
            return this
          },
          then(resolve: (value: { data: Array<Record<string, unknown>>; error: null }) => void) {
            resolve({
              data: [
                {
                  id: 'item-1',
                  player_user_id: 'player-1',
                  title: 'Serve reps',
                  scheduled_date: '2026-06-12',
                  scheduled_time: '16:30',
                  kind: 'practice',
                  created_at: '2026-06-10T12:00:00.000Z',
                  updated_at: '2026-06-10T12:00:00.000Z',
                },
              ],
              error: null,
            })
          },
        }
      }

      if (table === 'coach_player_links') {
        return {
          select() {
            return this
          },
          eq() {
            return this
          },
          limit() {
            return this
          },
          then(resolve: (value: { data: Array<Record<string, unknown>>; error: null }) => void) {
            resolve({
              data: [
                {
                  id: 'student-1',
                  coach_user_id: 'coach-1',
                  player_user_id: 'player-1',
                  player_id: null,
                  player_name: 'Taylor Player',
                  identity_slug: 'relentless-competitor-4-0',
                  level_label: '4.0',
                  player_email: '',
                  player_phone: '',
                  contact_preference: 'in_app',
                  setup_status: 'linked',
                  status: 'active',
                  notes: '',
                  updated_at: '2026-06-09T12:00:00.000Z',
                },
              ],
              error: null,
            })
          },
        }
      }

      return {
        select() {
          return this
        },
        in() {
          return this
        },
        order() {
          return this
        },
        limit() {
          return this
        },
        then(resolve: (value: { data: Array<Record<string, unknown>>; error: null }) => void) {
          resolve({
            data: [
              {
                id: 'assignment-1',
                student_link_id: 'student-1',
                title: 'Return plan',
                focus: 'Return depth',
                due_date: '2026-06-14',
                status: 'assigned',
                assignment_json: {
                  lessonDateTime: '2026-06-13T09:00',
                  lessonFocus: 'Return targets',
                },
                updated_at: '2026-06-09T12:00:00.000Z',
              },
            ],
            error: null,
          })
        },
      }
    },
  })),
}))

vi.mock('@/lib/calendar-feed-tokens', async () => {
  return await import('../calendar-feed-tokens')
})

vi.mock('@/lib/coach-calendar', async () => {
  return await import('../coach-calendar')
})

vi.mock('@/lib/coach-storage', async () => {
  return await import('../coach-storage')
})

vi.mock('@/lib/player-calendar-items', async () => {
  return await import('../player-calendar-items')
})

vi.mock('@/lib/tiq-league-schedule-calendar', async () => {
  return await import('../tiq-league-schedule-calendar')
})

vi.mock('@/lib/supabase', () => ({
  supabaseUrl: 'https://supabase.test',
}))

describe('player calendar feed route', () => {
  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it('returns personal calendar items and shared coach lesson events from a valid player token', async () => {
    tokenUpdated = false
    tokenQueryFilters = []
    vi.stubEnv('SUPABASE_SERVICE_ROLE_KEY', 'service-key')

    const route = await import('../../app/api/calendar/player/[userId]/calendar.ics/route')
    const response = await route.GET(
      new Request('https://tenaceiq.com/api/calendar/player/player-1/calendar.ics?token=private-token'),
      { params: Promise.resolve({ userId: 'player-1' }) },
    )
    const body = await response.text()

    expect(response.status).toBe(200)
    expect(response.headers.get('content-type')).toContain('text/calendar')
    expect(response.headers.get('cache-control')).toContain('private')
    expect(response.headers.get('content-disposition')).toBe('inline; filename="tenaceiq-my-calendar.ics"')
    expect(body).toContain('X-WR-CALNAME:TenAceIQ My Calendar')
    expect(body).toContain('SUMMARY:Serve reps')
    expect(body).toContain('DTSTART;TZID=America/Chicago:20260612T163000')
    expect(body).toContain('SUMMARY:Lesson: Taylor Player')
    expect(body).toContain('SUMMARY:Coach assignment due: Return plan')
    expect(body).toContain('URL:https://tenaceiq.com/mylab#coach-assignments')
    expect(tokenQueryFilters).toEqual(expect.arrayContaining([
      ['scope_type', 'player_calendar'],
      ['scope_id', 'player-1'],
      ['status', 'active'],
    ]))
    expect(tokenUpdated).toBe(true)
  })
})

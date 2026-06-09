import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const myLabSource = readFileSync(join(process.cwd(), 'app/mylab/page.tsx'), 'utf8')
const playerCoachAssignmentsApiSource = readFileSync(join(process.cwd(), 'app/api/player/coach-assignments/route.ts'), 'utf8')

describe('My Lab coach check-in guide', () => {
  it('keeps Player+ assignment recaps tied to the coach evidence target', () => {
    expect(myLabSource).toContain('Player+ recap guide')
    expect(myLabSource).toContain('buildPlayerAssignmentCheckInDraft')
    expect(myLabSource).toContain('id="coach-assignments"')
    expect(myLabSource).toContain('Use guided draft')
    expect(myLabSource).toContain('summary?.expectedEvidence')
    expect(myLabSource).toContain('Question for coach')
    expect(myLabSource).toContain('/api/player/calendar-links')
    expect(myLabSource).toContain('Coach lesson calendar')
    expect(myLabSource).toContain('Subscribe link')
    expect(myLabSource).toContain('buildPlayerCoachLessonEvents')
    expect(myLabSource).toContain('MyLabCalendarPanel')
    expect(myLabSource).toContain('LOCAL_PERSONAL_CALENDAR_KEY')
    expect(myLabSource).toContain('Your tennis week, plus shared coach dates.')
    expect(myLabSource).toContain('Add personal reminders here while coach lessons and assignment due dates flow in from Coach Hub.')
  })

  it('only syncs player assignment status for assignments linked to that player', () => {
    expect(playerCoachAssignmentsApiSource).toContain(".from('coach_player_links')")
    expect(playerCoachAssignmentsApiSource).toContain(".eq('id', existing.studentLinkId)")
    expect(playerCoachAssignmentsApiSource).toContain(".eq('player_user_id', auth.userId)")
    expect(playerCoachAssignmentsApiSource).toContain(".eq('student_link_id', existing.studentLinkId)")
  })
})

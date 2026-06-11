import { readFileSync } from 'node:fs'
import { join } from 'node:path'

import { describe, expect, it } from 'vitest'

const myLabSource = readFileSync(join(process.cwd(), 'app/mylab/page.tsx'), 'utf8')
const messagesSource = readFileSync(join(process.cwd(), 'app/messages/page.tsx'), 'utf8')

describe('calendar scheduling UX', () => {
  it('keeps My Lab calendar editing, recurrence, availability, and feed audit controls visible', () => {
    expect(myLabSource).toContain('editingItemId')
    expect(myLabSource).toContain('FREQ=WEEKLY')
    expect(myLabSource).toContain('Availability overlay')
    expect(myLabSource).toContain('calendarAuditGridStyle')
    expect(myLabSource).toContain('Conflict')
  })

  it('keeps Messages calendar quick-add wired to the player calendar endpoint', () => {
    expect(messagesSource).toContain('detectCalendarQuickAddCandidate')
    expect(messagesSource).toContain('addScheduleEventToCalendar')
    expect(messagesSource).toContain('message-schedule-')
    expect(messagesSource).toContain('/api/player/calendar-items')
    expect(messagesSource).toContain('Calendar suggestion')
    expect(messagesSource).toContain('Add to My Calendar')
  })
})

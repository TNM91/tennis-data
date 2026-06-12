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
    expect(messagesSource).toContain('buildCalendarQuickAddItemId')
    expect(messagesSource).toContain('messageCalendarCandidates')
    expect(messagesSource).toContain('messageCalendarActionStyle')
    expect(messagesSource).toContain('calendarQuickAddedItemIds')
    expect(messagesSource).toContain('conversationCalendarQuickAddCandidate')
    expect(messagesSource).toContain('conversationHasCalendarOpportunity')
    expect(messagesSource).toContain("if (filter === 'calendar') return conversationHasCalendarOpportunity(conversation)")
    expect(messagesSource).toContain('Calendar cue')
    expect(messagesSource).toContain('selectedThreadCalendarCue')
    expect(messagesSource).toContain('selectedThreadCalendarCueStyle')
    expect(messagesSource).toContain('selectedThreadCalendarCueActionStyle')
    expect(messagesSource).toContain('handleSelectedThreadCalendarCueAction')
    expect(messagesSource).toContain('Ready to save')
    expect(messagesSource).toContain('Saved to My Calendar')
    expect(messagesSource).toContain('Save to My Calendar')
    expect(messagesSource).toContain('PlayerCalendarItemsResponse')
    expect(messagesSource).toContain("id.startsWith('message-calendar-') || id.startsWith('message-schedule-')")
    expect(messagesSource).toContain('candidate.availabilityStatus')
    expect(messagesSource).toContain('candidate.recurrenceRule')
    expect(messagesSource).toContain('quickAddRecurrenceLabel')
    expect(messagesSource).toContain('addScheduleEventToCalendar')
    expect(messagesSource).toContain('removeMessageCalendarItem')
    expect(messagesSource).toContain("method: 'DELETE'")
    expect(messagesSource).toContain('Removed from My Calendar.')
    expect(messagesSource).toContain('message-schedule-')
    expect(messagesSource).toContain('calendarQuickAddedItemIds.has(`message-schedule-${selectedScheduleEvent.id}`)')
    expect(messagesSource).toContain('/api/player/calendar-items')
    expect(messagesSource).toContain('Calendar suggestion')
    expect(messagesSource).toContain('Add to My Calendar')
    expect(messagesSource).toContain('Removing...')
    expect(messagesSource).toContain('Remove')
    expect(messagesSource).toContain('View My Calendar')
    expect(messagesSource).toContain('/mylab#my-calendar')
  })
})

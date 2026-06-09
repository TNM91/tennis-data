import type { CoachAssignment, CoachStudentLink } from './coach-storage'
import type { TennisCalendarEvent } from './tiq-league-schedule-calendar'

function cleanText(value: unknown) {
  return typeof value === 'string' ? value.trim() : ''
}

function splitDateTime(value: unknown) {
  const text = cleanText(value)
  const match = text.match(/^(\d{4}-\d{2}-\d{2})(?:T(\d{2}:\d{2}))?/)
  if (!match) return null

  return {
    date: match[1],
    time: match[2] || '',
  }
}

function lessonFocus(assignment: CoachAssignment) {
  return cleanText(assignment.assignment.lessonFocus) || assignment.focus || assignment.title
}

export function buildCoachStudentCalendarEvents(
  assignments: CoachAssignment[],
  student: Pick<CoachStudentLink, 'id' | 'playerName'>,
): TennisCalendarEvent[] {
  const events: TennisCalendarEvent[] = []

  for (const assignment of assignments) {
    if (assignment.status === 'archived' || assignment.status === 'draft') continue

    const lessonDateTime = splitDateTime(assignment.assignment.lessonDateTime)
    if (lessonDateTime) {
      events.push({
        id: `coach-lesson-${assignment.id}`,
        title: `Lesson: ${student.playerName}`,
        date: lessonDateTime.date,
        time: lessonDateTime.time,
        description: [
          `Coach/student lesson for ${student.playerName}.`,
          lessonFocus(assignment) ? `Focus: ${lessonFocus(assignment)}` : '',
          assignment.title ? `Follow-up: ${assignment.title}` : '',
        ].filter(Boolean).join('\n'),
        url: `/coach#coach-lesson-frame`,
        durationMinutes: 60,
      })
    }

    if (assignment.dueDate) {
      events.push({
        id: `coach-assignment-${assignment.id}`,
        title: `Coach assignment due: ${assignment.title}`,
        date: assignment.dueDate,
        description: [
          `Student: ${student.playerName}`,
          assignment.focus ? `Focus: ${assignment.focus}` : '',
          `Status: ${assignment.status}`,
        ].filter(Boolean).join('\n'),
        url: `/mylab#coach-assignments`,
      })
    }
  }

  return events
}

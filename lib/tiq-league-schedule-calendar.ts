import type { TiqLeagueScheduleItem } from '@/lib/tiq-league-schedule-service'

export type ScheduleCalendarDay = {
  date: string
  label: string
  dayLabel: string
  items: TiqLeagueScheduleItem[]
}

function formatScheduleDateLabel(value: string) {
  const parsed = value ? new Date(`${value}T12:00:00`) : null
  if (!parsed || Number.isNaN(parsed.getTime())) return value || 'Date TBD'

  return parsed.toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
  })
}

function formatScheduleDayLabel(value: string) {
  const parsed = value ? new Date(`${value}T12:00:00`) : null
  if (!parsed || Number.isNaN(parsed.getTime())) return 'TBD'

  return parsed.toLocaleDateString(undefined, {
    weekday: 'short',
  })
}

export function buildScheduleCalendarDays(items: TiqLeagueScheduleItem[]): ScheduleCalendarDay[] {
  const days = new Map<string, TiqLeagueScheduleItem[]>()

  for (const item of items) {
    const dateKey = item.scheduledDate || 'unscheduled'
    days.set(dateKey, [...(days.get(dateKey) || []), item])
  }

  return Array.from(days.entries())
    .sort(([leftDate], [rightDate]) => {
      const leftKey = leftDate === 'unscheduled' ? '9999-12-31' : leftDate
      const rightKey = rightDate === 'unscheduled' ? '9999-12-31' : rightDate
      return leftKey.localeCompare(rightKey)
    })
    .map(([date, dayItems]) => ({
      date,
      label: date === 'unscheduled' ? 'Date TBD' : formatScheduleDateLabel(date),
      dayLabel: date === 'unscheduled' ? 'TBD' : formatScheduleDayLabel(date),
      items: dayItems,
    }))
}

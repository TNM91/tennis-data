function cleanText(value: string | null | undefined) {
  return (value || '').trim().replace(/\s+/g, ' ')
}

export function formatCaptainPracticeDate(value: string) {
  const date = new Date(`${value}T12:00:00`)
  if (!value || Number.isNaN(date.getTime())) return value || 'Date to be confirmed'
  return new Intl.DateTimeFormat('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  }).format(date)
}

export function formatCaptainPracticeTime(value: string) {
  const match = /^(\d{1,2}):(\d{2})$/.exec(cleanText(value))
  if (!match) return cleanText(value)
  const hour = Number(match[1])
  const minute = match[2]
  if (!Number.isInteger(hour) || hour < 0 || hour > 23) return cleanText(value)
  const period = hour >= 12 ? 'PM' : 'AM'
  const displayHour = hour % 12 || 12
  return `${displayHour}:${minute} ${period}`
}

export function buildCaptainPracticeInviteText(input: {
  teamName: string
  scheduledDate: string
  scheduledTime?: string | null
  facility?: string | null
  practiceFocus?: string | null
  capacity?: number | null
  responseUrl: string
}) {
  const when = [
    formatCaptainPracticeDate(input.scheduledDate),
    formatCaptainPracticeTime(input.scheduledTime || ''),
  ].filter(Boolean).join(' at ')
  const details = [
    `${cleanText(input.teamName) || 'Team'} practice`,
    when,
    cleanText(input.facility) ? `Where: ${cleanText(input.facility)}` : '',
    input.capacity ? `Spots: ${input.capacity} (waitlist opens when full)` : '',
    cleanText(input.practiceFocus) ? `Focus: ${cleanText(input.practiceFocus)}` : '',
  ].filter(Boolean)
  return `${details.join('\n')}\n\nRSVP In, Out, or Maybe and see who's coming: ${input.responseUrl}`
}

export function buildCaptainPracticeSmsHref(inviteText: string) {
  return `sms:?&body=${encodeURIComponent(inviteText)}`
}

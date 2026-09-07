import type { TeamScheduleCalendarItem } from './team-schedule-calendar'

export type SeasonCalendarDestination = 'tiq' | 'apple' | 'google'

// A network request cannot be part of the native-calendar click: Safari may
// discard user activation while it runs. Prepare first, then render real links.
export async function saveSeasonCalendarItems(
  items: TeamScheduleCalendarItem[], accessToken: string,
  onProgress: (saved: number) => void, request: typeof fetch = fetch,
) {
  if (!accessToken) throw new Error('Sign in again to save your season.')
  if (!items.length) throw new Error('Choose at least one match.')
  for (let offset = 0; offset < items.length; offset += 100) {
    const batch = items.slice(offset, offset + 100)
    const response = await request('/api/player/calendar-items', {
      method: 'POST',
      headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ items: batch }), signal: AbortSignal.timeout(30000),
    })
    const result = await response.json().catch(() => null)
    if (!response.ok || !result?.ok || result.savedCount !== batch.length || result.skippedCount > 0) {
      throw new Error(response.status === 401 ? 'Your sign-in expired. Sign in again, then retry.' : result?.message || 'Some matches could not be saved. Retry safely to finish; saved matches will not be duplicated.')
    }
    onProgress(Math.min(offset + batch.length, items.length))
  }
}

export async function createSeasonCalendarLink(accessToken: string, request: typeof fetch = fetch) {
  const response = await request('/api/player/personal-calendar-link', {
    method: 'POST', headers: { Authorization: `Bearer ${accessToken}` }, signal: AbortSignal.timeout(30000),
  })
  const result = await response.json().catch(() => null)
  if (!response.ok || !result?.ok || !result.calendarUrl) throw new Error('Your matches are saved to TiQ, but the calendar link could not be prepared. Try again.')
  const url = new URL(result.calendarUrl)
  if (!['https:', 'http:'].includes(url.protocol)) throw new Error('The calendar link could not be opened. Try again.')
  return url.toString()
}

export function appleSubscriptionUrl(feedUrl: string) {
  const url = new URL(feedUrl)
  if (!['https:', 'http:'].includes(url.protocol)) return ''
  // URL.protocol cannot switch a special scheme (https) to a non-special
  // scheme (webcal); the setter silently leaves it as https in browsers.
  return url.toString().replace(/^https?:/, 'webcal:')
}

export function googleMatchCalendarUrl(item: TeamScheduleCalendarItem, timeZone = 'America/Chicago') {
  const date = item.date.replaceAll('-', '')
  const end = new Date(`${item.date}T${item.time || '00:00'}:00Z`)
  end.setUTCMinutes(end.getUTCMinutes() + (item.time ? 120 : 1440))
  const endStamp = end.toISOString().replace(/[-:]/g, '').slice(0, item.time ? 15 : 8)
  const startStamp = item.time ? `${date}T${item.time.replace(':', '')}00` : date
  const params = new URLSearchParams({ action: 'TEMPLATE', text: item.title, dates: `${startStamp}/${endStamp}`, ctz: timeZone, location: item.location, details: 'Team match from TenAceIQ. Adding this event does not confirm your availability. This one-time copy does not sync later schedule changes.' })
  return `https://calendar.google.com/calendar/render?${params}`
}

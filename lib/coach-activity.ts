import {coachId} from './native-coach-contract'
import {updateId} from './native-updates-contract'

export const coachActivityKinds = ['assignment', 'checkin', 'feedback'] as const
export const coachActivityHeader = 'x-tiq-coach-activity'
export const coachActivityVersion = '1'
export type CoachActivity = {kind: typeof coachActivityKinds[number]; student: string; assignment: string}
export function coachActivityHref(activity: CoachActivity) {
  const params = new URLSearchParams({student: coachId(activity.student), assignment: coachId(activity.assignment), activity: activity.kind})
  return '/coach?' + params + '#coach-workspace'
}
export function readCoachActivityHref(href: string): CoachActivity | null {
  if (!href.startsWith('/coach?') || href.length > 700 || /[\u0000-\u0020\\]/.test(href)) return null
  try {
    const url = new URL(href, 'https://www.tenaceiq.com'), kind = url.searchParams.get('activity')
    if (url.origin !== 'https://www.tenaceiq.com' || url.pathname !== '/coach' || url.hash !== '#coach-workspace' ||
      [...url.searchParams.keys()].some(k => !['student', 'assignment', 'activity'].includes(k) || url.searchParams.getAll(k).length !== 1) ||
      !coachActivityKinds.some(k => k === kind)) return null
    return {kind: kind as CoachActivity['kind'], student: coachId(url.searchParams.get('student')), assignment: coachId(url.searchParams.get('assignment'))}
  } catch { return null }
}
export function coachActivityPushHref(notice: string) {
  if (!updateId(notice)) throw Error('Invalid coaching update')
  return '/mylab?coachActivityNotice=' + notice
}
export function readCoachActivityPush(data: unknown, owner: string): string | null {
  const row = data && typeof data === 'object' ? data as Record<string, unknown> : {}
  if (!updateId(owner) || row.recipient !== owner || typeof row.href !== 'string') return null
  const match = /^\/mylab\?coachActivityNotice=([a-f0-9-]{36})$/i.exec(row.href)
  return match && updateId(match[1]) ? match[1] : null
}

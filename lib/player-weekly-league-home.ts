export type PlayerWeeklyLeagueNotification = {
  id: string
  title: string
  body: string
  href: string
  createdAt: string
}

export type PlayerWeeklyLeagueAction = {
  notificationId: string
  href: string
  eyebrow: string
  title: string
  detail: string
  cta: string
  stage: 'availability' | 'courts' | 'recap'
}

const WEEKLY_LEAGUE_HREF = /^\/league-week\/[a-z0-9_-]+(?:[?#].*)?$/i
const ACTIVE_WINDOW_MS = 10 * 24 * 60 * 60 * 1000

export function buildPlayerWeeklyLeagueAction(
  notifications: PlayerWeeklyLeagueNotification[],
  now = new Date(),
): PlayerWeeklyLeagueAction | null {
  const newest = notifications
    .filter((notification) => WEEKLY_LEAGUE_HREF.test(notification.href.trim()))
    .map((notification) => ({ notification, createdAt: Date.parse(notification.createdAt) }))
    .filter(({ createdAt }) => Number.isFinite(createdAt) && now.getTime() - createdAt <= ACTIVE_WINDOW_MS && createdAt <= now.getTime() + 60_000)
    .sort((left, right) => right.createdAt - left.createdAt)[0]?.notification

  if (!newest) return null

  const title = newest.title.trim()
  const body = newest.body.trim()
  if (/in or out for/i.test(title)) {
    return {
      notificationId: newest.id,
      href: newest.href,
      eyebrow: 'League week',
      title,
      detail: body || 'Tell the league whether you can play this week.',
      cta: 'Reply in or out',
      stage: 'availability',
    }
  }

  if (/weekly court plan is ready/i.test(title)) {
    return {
      notificationId: newest.id,
      href: newest.href,
      eyebrow: 'League week',
      title: 'Your court is ready.',
      detail: body || 'See your start time, court, group, and weekly scorecard.',
      cta: 'Open court & scores',
      stage: 'courts',
    }
  }

  return {
    notificationId: newest.id,
    href: newest.href,
    eyebrow: 'League recap',
    title: title || 'This week’s league recap is ready.',
    detail: body || 'See the scores, moments, and stories from this week.',
    cta: 'Read recap',
    stage: 'recap',
  }
}

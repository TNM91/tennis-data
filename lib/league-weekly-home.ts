export type LeagueWeeklyHomeSnapshot = {
  leagueId: string
  playOn: string
  status: 'collecting' | 'roster_confirmed' | 'published' | 'completed'
  inCount: number
  outCount: number
  rosterCount: number
  courtCount: number
  acceptedSetCount: number
  expectedSetCount: number
  storyCount: number
  recapSent: boolean
}

export type LeagueWeeklyHomeProgressItem = {
  label: string
  complete: boolean
  current?: boolean
}

export type LeagueWeeklyHomeView = {
  href: string
  label: string
  title: string
  detail: string
  cta: string
  pulseValue: string
  pulseDetail: string
  progress: LeagueWeeklyHomeProgressItem[]
}

function formatPlayDate(playOn: string) {
  const date = new Date(`${playOn}T12:00:00`)
  if (Number.isNaN(date.getTime())) return 'this week'
  return new Intl.DateTimeFormat('en-US', {
    weekday: 'long',
    month: 'short',
    day: 'numeric',
  }).format(date)
}

function withCurrentStage(items: Array<Omit<LeagueWeeklyHomeProgressItem, 'current'>>) {
  const firstIncomplete = items.findIndex((item) => !item.complete)
  const currentIndex = firstIncomplete < 0 ? items.length - 1 : firstIncomplete
  return items.map((item, index) => ({ ...item, current: index === currentIndex }))
}

export function buildLeagueWeeklyHomeView(
  leagueId: string,
  snapshot: LeagueWeeklyHomeSnapshot | null,
): LeagueWeeklyHomeView {
  const baseHref = `/league-coordinator/weekly?leagueId=${encodeURIComponent(leagueId)}`

  if (!snapshot) {
    return {
      href: baseHref,
      label: 'Weekly play',
      title: 'Open this week’s replies',
      detail: 'Create the player link, collect in-or-out replies, then confirm the roster and courts.',
      cta: 'Run weekly play',
      pulseValue: 'Ready to open',
      pulseDetail: 'Start the next player reply window',
      progress: withCurrentStage([
        { label: 'Replies', complete: false },
        { label: 'Roster', complete: false },
        { label: 'Courts', complete: false },
        { label: 'Scores', complete: false },
        { label: 'Recap', complete: false },
      ]),
    }
  }

  const href = `${baseHref}&playOn=${encodeURIComponent(snapshot.playOn)}`
  const playDate = formatPlayDate(snapshot.playOn)
  const courtsPublished = snapshot.courtCount > 0 || snapshot.status === 'published' || snapshot.status === 'completed'
  const rosterConfirmed = courtsPublished || snapshot.status === 'roster_confirmed'
  const scoresComplete = snapshot.expectedSetCount > 0 && snapshot.acceptedSetCount >= snapshot.expectedSetCount
  const repliesComplete = rosterConfirmed
  const rosterComplete = snapshot.rosterCount > 0 && rosterConfirmed
  const progress = withCurrentStage([
    { label: 'Replies', complete: repliesComplete },
    { label: 'Roster', complete: rosterComplete },
    { label: 'Courts', complete: courtsPublished },
    { label: 'Scores', complete: scoresComplete },
    { label: 'Recap', complete: snapshot.recapSent },
  ])

  if (rosterConfirmed && !courtsPublished) {
    return {
      href,
      label: playDate,
      title: 'Publish this week’s courts',
      detail: `${snapshot.rosterCount} players are confirmed. Build the court groups and staggered start waves.`,
      cta: 'Build courts',
      pulseValue: `${snapshot.rosterCount} confirmed`,
      pulseDetail: 'Court assignments are next',
      progress,
    }
  }

  if (!courtsPublished) {
    const responseTotal = snapshot.inCount + snapshot.outCount
    return {
      href,
      label: playDate,
      title: responseTotal ? `Review ${responseTotal} player ${responseTotal === 1 ? 'reply' : 'replies'}` : 'Share the player reply link',
      detail: `${snapshot.inCount} in · ${snapshot.outCount} out. Confirm the roster when the reply window is ready to close.`,
      cta: 'Review replies',
      pulseValue: `${snapshot.inCount} in`,
      pulseDetail: `${snapshot.outCount} out · roster not published`,
      progress,
    }
  }

  if (!scoresComplete) {
    const missingSets = Math.max(0, snapshot.expectedSetCount - snapshot.acceptedSetCount)
    return {
      href,
      label: playDate,
      title: missingSets ? `Collect ${missingSets} missing ${missingSets === 1 ? 'set' : 'sets'}` : 'Review this week’s scores',
      detail: `${snapshot.courtCount} ${snapshot.courtCount === 1 ? 'court' : 'courts'} published · ${snapshot.acceptedSetCount} of ${snapshot.expectedSetCount} sets accepted.`,
      cta: 'Review scores',
      pulseValue: `${snapshot.rosterCount} playing`,
      pulseDetail: `${snapshot.courtCount} ${snapshot.courtCount === 1 ? 'court' : 'courts'} · ${missingSets} sets missing`,
      progress,
    }
  }

  if (!snapshot.recapSent) {
    return {
      href,
      label: playDate,
      title: 'Prepare the weekly recap',
      detail: `${snapshot.acceptedSetCount} sets are complete${snapshot.storyCount ? ` with ${snapshot.storyCount} player ${snapshot.storyCount === 1 ? 'moment' : 'moments'} to review` : ''}.`,
      cta: 'Build recap',
      pulseValue: 'Scores complete',
      pulseDetail: snapshot.storyCount ? `${snapshot.storyCount} player ${snapshot.storyCount === 1 ? 'moment' : 'moments'} ready` : 'Recap is ready to prepare',
      progress,
    }
  }

  return {
    href,
    label: playDate,
    title: 'This league week is complete',
    detail: 'Courts, accepted scores, and the player recap are all published.',
    cta: 'Review week',
    pulseValue: 'Recap sent',
    pulseDetail: `${snapshot.rosterCount} players · ${snapshot.acceptedSetCount} accepted sets`,
    progress,
  }
}

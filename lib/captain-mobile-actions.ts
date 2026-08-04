export type CaptainMobileActionId = 'availability' | 'lineup' | 'chat' | 'scorecard'

export type CaptainMobileMatchPhase = 'setup' | 'upcoming' | 'match_day' | 'past'

type CaptainMobileActionLayoutInput = {
  matchDate?: string | null
  todayDate?: string | null
  pendingAvailabilityCount: number
  hasAvailabilityReplies: boolean
  lineupReady: boolean
}

export function getCaptainLocalDateKey(date = new Date()) {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

export function getCaptainMobileMatchPhase(matchDate?: string | null, todayDate?: string | null): CaptainMobileMatchPhase {
  const matchDateKey = matchDate?.slice(0, 10) || ''
  const todayDateKey = todayDate?.slice(0, 10) || ''
  if (!/^\d{4}-\d{2}-\d{2}$/.test(matchDateKey) || !/^\d{4}-\d{2}-\d{2}$/.test(todayDateKey)) return 'setup'
  if (matchDateKey === todayDateKey) return 'match_day'
  return matchDateKey < todayDateKey ? 'past' : 'upcoming'
}

export function getCaptainMobileActionLayout(input: CaptainMobileActionLayoutInput): {
  phase: CaptainMobileMatchPhase
  visible: CaptainMobileActionId[]
  overflow: CaptainMobileActionId[]
} {
  const phase = getCaptainMobileMatchPhase(input.matchDate, input.todayDate)

  if (phase === 'match_day') {
    return {
      phase,
      visible: ['lineup', 'chat', 'scorecard'],
      overflow: ['availability'],
    }
  }

  if (phase === 'past') {
    return {
      phase,
      visible: ['scorecard', 'chat'],
      overflow: ['availability', 'lineup'],
    }
  }

  const availabilityComplete = input.hasAvailabilityReplies && input.pendingAvailabilityCount === 0
  if (availabilityComplete) {
    return {
      phase,
      visible: input.lineupReady ? ['chat', 'lineup'] : ['lineup', 'chat'],
      overflow: ['availability', 'scorecard'],
    }
  }

  return {
    phase,
    visible: ['availability', 'lineup', 'chat'],
    overflow: ['scorecard'],
  }
}

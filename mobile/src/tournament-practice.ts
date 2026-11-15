import { nativeTournamentPlan } from '../../lib/native-tournament-draw-plan'
import type { TournamentPlan, TournamentPlanWrite, TournamentSlot } from '../../lib/native-tournament-plan-contract'
import { tournamentTitleContenders } from '../../lib/native-tournament-trophy'
import type { TournamentTrophy, TournamentTrophyPreview, TournamentTrophyWrite } from '../../lib/native-tournament-trophy-contract'

type PracticeResult = { winner: string; sideA: string; sideB: string; score: string; outcome: string }

export function createTournamentPractice() {
  const event = crypto.randomUUID()
  const division = {
    id: 'tiq-native-division-' + crypto.randomUUID(),
    name: 'Practice Singles',
    format: 'single_elimination',
    status: 'open',
    entrants: ['Avery Ace', 'Casey Court', 'Morgan Serve', 'Riley Return'],
    pending: 0,
    schedule: {} as Record<string, TournamentSlot>,
    results: {} as Record<string, PracticeResult>,
  }
  const data = {
    id: 'tiq-native-event-' + event,
    name: 'Practice Tournament',
    date: new Date(Date.now() + 86_400_000).toISOString().slice(0, 10),
    zone: 'America/Chicago',
    revision: crypto.randomUUID().replaceAll('-', ''),
    divisions: [division],
  }
  let award: TournamentTrophy | null = null

  function plan(selection?: string, write?: TournamentPlanWrite): TournamentPlan {
    const checked = nativeTournamentPlan(data, write?.division ?? selection, write)
    if (checked.code) throw Error(checked.code)
    if (!write || checked.unchanged) return checked.plan

    switch (write.action) {
      case 'publish':
        division.status = 'scheduled'
        break
      case 'slot':
        if (write.slot) division.schedule[write.match] = write.slot
        else delete division.schedule[write.match]
        break
      case 'result': {
        if (!checked.change) throw Error('not_ready')
        const { result, complete } = checked.change
        if (award && division.results[write.match]?.winner !== result.winner) throw Error('trophy_locked')
        division.results[write.match] = result
        division.status = complete ? 'completed' : 'scheduled'
        break
      }
    }
    data.revision = crypto.randomUUID().replaceAll('-', '')
    return plan(selection)
  }

  function trophy(write?: TournamentTrophyWrite): TournamentTrophyPreview {
    const contenders = tournamentTitleContenders(division)
    if (write?.action === 'award') {
      if (write.revision !== data.revision || award && award.champion !== write.champion) throw Error('stale')
      if (!contenders.includes(write.champion)) throw Error('not_ready')
      award ??= { id: crypto.randomUUID(), champion: write.champion, paired: false, partnerClaimed: false, partnerCode: null }
    } else if (write?.action === 'withdraw') {
      if (award && award.id !== write.awardId) throw Error('stale')
      award = null
    }
    return { eventName: data.name, division: division.id, divisionName: division.name,
      contenders, tied: contenders.length > 1, revision: data.revision, award }
  }

  return { event, plan, trophy }
}

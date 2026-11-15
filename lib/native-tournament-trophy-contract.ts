import { nativeTournamentPublicationId, tournamentDraftRevision } from './native-tournament-draft-contract'
import { tournamentPlanRevision } from './native-tournament-plan-contract'

export type TournamentTrophy = { id: string; champion: string; paired: boolean; partnerClaimed: boolean; partnerCode: string | null }
export type TournamentTrophyPreview = {
  eventName: string
  division: string
  divisionName: string
  revision: string
  contenders: string[]
  tied: boolean
  award: TournamentTrophy | null
}
export type TournamentTrophyWrite =
  | { action: 'award'; revision: string; champion: string }
  | { action: 'withdraw'; awardId: string }

const name = (value: unknown): value is string => typeof value === 'string' && !!value.trim() && value.length <= 256
const record = (value: unknown): Record<string, unknown> => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw Error('Trophy unavailable')
  return value as Record<string, unknown>
}

export function readTournamentTrophy(value: unknown): TournamentTrophy | null {
  if (value === null) return null
  const row = record(value)
  if (!tournamentDraftRevision(row.id) || !name(row.champion) ||
      typeof row.paired !== 'boolean' || typeof row.partnerClaimed !== 'boolean' ||
      (row.paired && !row.partnerClaimed ? !tournamentDraftRevision(row.partnerCode) : row.partnerCode !== null) ||
      !row.paired && row.partnerClaimed) throw Error('Trophy unavailable')
  return { id: row.id, champion: row.champion, paired: row.paired,
    partnerClaimed: row.partnerClaimed, partnerCode: row.partnerCode as string | null }
}

export function readTournamentTrophyPreview(value: unknown): TournamentTrophyPreview {
  const row = record(value)
  if (!name(row.eventName) || !nativeTournamentPublicationId(row.division, 'division') ||
      !name(row.divisionName) || !tournamentPlanRevision(row.revision) || !Array.isArray(row.contenders) ||
      row.contenders.length > 64 || !row.contenders.every(name) || new Set(row.contenders).size !== row.contenders.length ||
      typeof row.tied !== 'boolean' || row.tied !== (row.contenders.length > 1)) throw Error('Trophy unavailable')
  return { eventName: row.eventName, division: row.division, divisionName: row.divisionName, revision: row.revision,
    contenders: row.contenders, tied: row.tied, award: readTournamentTrophy(row.award) }
}

export function readTournamentTrophyWrite(value: unknown): TournamentTrophyWrite {
  const data = record(value)
  if (data.action === 'award' && Object.keys(data).length === 3 && name(data.champion) && tournamentPlanRevision(data.revision)) {
    return { action: 'award', champion: data.champion, revision: data.revision }
  }
  if (data.action === 'withdraw' && Object.keys(data).length === 2 && tournamentDraftRevision(data.awardId)) {
    return { action: 'withdraw', awardId: data.awardId }
  }
  throw Error('Check the trophy selection')
}

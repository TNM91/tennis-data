import type { TiqIndividualLeagueResultRecord } from '@/lib/tiq-individual-results-service'
import type { TiqLeagueRecord } from '@/lib/tiq-league-registry'
import type { TiqPlayerParticipationRecord } from '@/lib/tiq-league-service'
import type { LeagueWeeklyPlayerRecord } from '@/lib/league-weekly-player-records'

export type PlayerLeagueCard = {
  leagueId: string
  leagueName: string
  seasonLabel: string
  status: 'active' | 'upcoming' | 'past'
  statusLabel: string
  formatLabel: string
  scheduleLabel: string
  locationLabel: string
  playerRecord: string
  resultLabel: string
  leaderLabel: string
  href: string
  cta: string
  weeklyPulse: {
    winPercentage: number
    gameDifferential: number
    currentStreak: { outcome: 'W' | 'L'; count: number } | null
    recentForm: Array<'W' | 'L'>
    bestPartner: { playerName: string; wins: number; losses: number; setsPlayed: number } | null
    latestWeek: { playOn: string; wins: number; losses: number; courtNumbers: number[] } | null
  } | null
}

export type PlayerLeagueHomeView = {
  active: PlayerLeagueCard[]
  past: PlayerLeagueCard[]
}

type BuildPlayerLeagueHomeInput = {
  participations: TiqPlayerParticipationRecord[]
  leagues: TiqLeagueRecord[]
  results: TiqIndividualLeagueResultRecord[]
  weeklyRecords?: LeagueWeeklyPlayerRecord[]
  playerId: string
  playerName: string
  today?: string
}

function normalize(value: string | null | undefined) {
  return (value || '').trim().toLowerCase()
}

function participationBelongsToPlayer(
  participation: TiqPlayerParticipationRecord,
  playerId: string,
  playerName: string,
) {
  const entryId = normalize(participation.playerId)
  const linkedId = normalize(playerId)
  if (linkedId && entryId) return linkedId === entryId
  return Boolean(normalize(playerName) && normalize(participation.playerName) === normalize(playerName))
}

function resultBelongsToPlayer(result: TiqIndividualLeagueResultRecord, playerId: string, playerName: string) {
  const linkedId = normalize(playerId)
  const resultIds = [result.playerAId, result.playerBId].map(normalize).filter(Boolean)
  if (linkedId && resultIds.length) return resultIds.includes(linkedId)
  const linkedName = normalize(playerName)
  return Boolean(linkedName && [result.playerAName, result.playerBName].some((name) => normalize(name) === linkedName))
}

function playerWon(result: TiqIndividualLeagueResultRecord, playerId: string, playerName: string) {
  const linkedId = normalize(playerId)
  if (linkedId && normalize(result.winnerPlayerId)) return normalize(result.winnerPlayerId) === linkedId
  return normalize(result.winnerPlayerName) === normalize(playerName)
}

function getFormatLabel(league: TiqLeagueRecord) {
  if (league.weeklySettings.enabled) return 'Weekly doubles'
  if (league.individualCompetitionFormat === 'round_robin') return 'Round robin'
  if (league.individualCompetitionFormat === 'ladder') return 'Ladder'
  if (league.individualCompetitionFormat === 'challenge') return 'Challenge league'
  return 'Player league'
}

function getScheduleLabel(league: TiqLeagueRecord) {
  if (league.weeklySettings.enabled) {
    return [league.defaultMatchDay || 'Weekly play', league.defaultMatchTime].filter(Boolean).join(' · ')
  }
  if (league.startsOn && league.endsOn) return `${league.startsOn} – ${league.endsOn}`
  return league.startsOn || league.endsOn || 'Season schedule'
}

function getStatus(league: TiqLeagueRecord, today: string): Pick<PlayerLeagueCard, 'status' | 'statusLabel' | 'cta'> {
  if (league.seasonStatus === 'completed' || league.seasonStatus === 'archived' || (league.endsOn && league.endsOn < today)) {
    return { status: 'past', statusLabel: 'Past season', cta: 'View season' }
  }
  if (league.seasonStatus === 'draft' || (league.startsOn && league.startsOn > today)) {
    return { status: 'upcoming', statusLabel: 'Upcoming', cta: 'Open league' }
  }
  return { status: 'active', statusLabel: 'Active', cta: 'Open league' }
}

function buildCard(
  participation: TiqPlayerParticipationRecord,
  league: TiqLeagueRecord,
  results: TiqIndividualLeagueResultRecord[],
  playerId: string,
  playerName: string,
  today: string,
  weeklyRecord?: LeagueWeeklyPlayerRecord,
): PlayerLeagueCard {
  const leagueResults = results.filter((result) => result.leagueId === league.id)
  const playerResults = leagueResults.filter((result) => resultBelongsToPlayer(result, playerId, playerName))
  const wins = playerResults.filter((result) => playerWon(result, playerId, playerName)).length
  const losses = playerResults.length - wins
  const records = new Map<string, { wins: number; losses: number }>()
  for (const result of leagueResults) {
    const winner = result.winnerPlayerName
    const loser = normalize(winner) === normalize(result.playerAName) ? result.playerBName : result.playerAName
    const winnerRecord = records.get(winner) || { wins: 0, losses: 0 }
    winnerRecord.wins += 1
    records.set(winner, winnerRecord)
    const loserRecord = records.get(loser) || { wins: 0, losses: 0 }
    loserRecord.losses += 1
    records.set(loser, loserRecord)
  }
  const leader = [...records.entries()].sort((left, right) => (
    right[1].wins - left[1].wins || left[1].losses - right[1].losses || left[0].localeCompare(right[0])
  ))[0]
  const status = getStatus(league, today)

  return {
    leagueId: league.id,
    leagueName: league.leagueName || participation.leagueName || 'Player league',
    seasonLabel: league.seasonLabel || participation.seasonLabel || 'Current season',
    ...status,
    formatLabel: getFormatLabel(league),
    scheduleLabel: getScheduleLabel(league),
    locationLabel: league.defaultFacility || league.locationLabel || participation.locationLabel || 'Location pending',
    playerRecord: weeklyRecord ? `${weeklyRecord.wins}-${weeklyRecord.losses}` : playerResults.length ? `${wins}-${losses}` : 'New',
    resultLabel: weeklyRecord
      ? `${weeklyRecord.leagueSetCount} confirmed ${weeklyRecord.leagueSetCount === 1 ? 'set' : 'sets'}`
      : leagueResults.length ? `${leagueResults.length} ${leagueResults.length === 1 ? 'result' : 'results'}` : 'Results building',
    leaderLabel: league.weeklySettings.enabled && league.weeklySettings.showRankings === false
      ? 'Player stats · no competitive rankings'
      : weeklyRecord
      ? weeklyRecord.leaderName ? `${weeklyRecord.leaderName} leads ${weeklyRecord.leaderWins}-${weeklyRecord.leaderLosses}` : 'Player stats'
      : leader ? `${leader[0]} leads ${leader[1].wins}-${leader[1].losses}` : 'Standings building',
    href: `/explore/leagues/tiq/${encodeURIComponent(league.id)}`,
    cta: status.cta,
    weeklyPulse: weeklyRecord ? {
      winPercentage: weeklyRecord.winPercentage,
      gameDifferential: weeklyRecord.gameDifferential,
      currentStreak: weeklyRecord.currentStreak,
      recentForm: weeklyRecord.recentForm,
      bestPartner: weeklyRecord.bestPartner ? {
        playerName: weeklyRecord.bestPartner.playerName,
        wins: weeklyRecord.bestPartner.wins,
        losses: weeklyRecord.bestPartner.losses,
        setsPlayed: weeklyRecord.bestPartner.setsPlayed,
      } : null,
      latestWeek: weeklyRecord.latestWeek ? {
        playOn: weeklyRecord.latestWeek.playOn,
        wins: weeklyRecord.latestWeek.wins,
        losses: weeklyRecord.latestWeek.losses,
        courtNumbers: weeklyRecord.latestWeek.courtNumbers,
      } : null,
    } : null,
  }
}

export function buildPlayerLeagueHome(input: BuildPlayerLeagueHomeInput): PlayerLeagueHomeView {
  const today = input.today || new Date().toISOString().slice(0, 10)
  const leaguesById = new Map(input.leagues.map((league) => [league.id, league]))
  const seenLeagueIds = new Set<string>()
  const weeklyRecordsByLeagueId = new Map((input.weeklyRecords || []).map((record) => [record.leagueId, record]))
  const cards = input.participations.flatMap((participation) => {
    if (!participationBelongsToPlayer(participation, input.playerId, input.playerName)) return []
    if (seenLeagueIds.has(participation.leagueId)) return []
    const league = leaguesById.get(participation.leagueId)
    if (!league || league.leagueFormat !== 'individual') return []
    seenLeagueIds.add(participation.leagueId)
    return [buildCard(participation, league, input.results, input.playerId, participation.playerName || input.playerName, today, weeklyRecordsByLeagueId.get(league.id))]
  })

  return {
    active: cards
      .filter((card) => card.status !== 'past')
      .sort((left, right) => Number(left.status === 'upcoming') - Number(right.status === 'upcoming') || left.leagueName.localeCompare(right.leagueName)),
    past: cards
      .filter((card) => card.status === 'past')
      .sort((left, right) => right.seasonLabel.localeCompare(left.seasonLabel) || left.leagueName.localeCompare(right.leagueName)),
  }
}

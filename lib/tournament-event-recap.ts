import { buildRoundRobinStandings, buildSingleEliminationPreview, buildTournamentPreview, type TiqTournamentRecord, type TiqTournamentMatchResult } from './tiq-tournament-registry'
import { formatTournamentEventDate } from './tournament-event-presentation'

export function buildEventDivisionRecap(division: TiqTournamentRecord) {
  let draw = buildTournamentPreview(division)
  if (division.format === 'single_elimination') {
    const accepted: Record<string, TiqTournamentMatchResult> = {}
    for (let pass = 0; pass < division.entrants.length; pass++) {
      for (const match of buildSingleEliminationPreview(division.entrants, accepted)) {
        const result = division.results[match.id]
        if (!result || !division.entrants.includes(match.sideA) || !division.entrants.includes(match.sideB)
          || ![match.sideA, match.sideB].includes(result.winner)
          || result.sideA && result.sideA !== match.sideA || result.sideB && result.sideB !== match.sideB) continue
        accepted[match.id] = result
      }
    }
    draw = buildSingleEliminationPreview(division.entrants, accepted)
  }
  const playable = draw.filter(match => match.sideA !== 'Bye' && match.sideB !== 'Bye')
  const posted = playable.filter(match => match.result && division.entrants.includes(match.sideA) && division.entrants.includes(match.sideB)
    && [match.sideA, match.sideB].includes(match.result.winner)
    && (!match.result.sideA || match.result.sideA === match.sideA) && (!match.result.sideB || match.result.sideB === match.sideB))
  let champion = '', runnerUp = '', score = '', detail = 'Title still to be decided'
  if (division.format === 'round_robin') {
    if (playable.length && posted.length === playable.length) {
      const rows = buildRoundRobinStandings(division)
      if (rows.length && rows.filter(row => row.wins === rows[0].wins).length === 1) {
        champion = rows[0].entrant; detail = `${rows[0].wins} wins`
      } else detail = 'Tied standings · director review'
    }
  } else {
    const final = draw.at(-1)
    if (final && posted.some(match => match.id === final.id)) {
      champion = final.result!.winner
      runnerUp = champion === final.sideA ? final.sideB : final.sideA
      score = final.result!.score || ''
      detail = `${final.sideA} vs ${final.sideB}`
    }
  }
  if (division.entrants.length < 2) detail = 'Confirmed field pending'
  return { id: division.id, name: division.name, champion, runnerUp, score, detail, posted: posted.length, total: playable.length }
}

export function buildTournamentEventRecap(event: TiqTournamentRecord, divisions: TiqTournamentRecord[]) {
  const rows = divisions.filter(division => division.eventId === event.id).map(buildEventDivisionRecap)
  const confirmed = rows.filter(row => row.champion).length
  const lines = [event.name, formatTournamentEventDate(event.startsOn), event.eventDetails?.venueName || event.locationLabel, '',
    ...rows.flatMap(row => [row.name, row.champion ? `Champion: ${row.champion}` : row.detail,
      ...(row.runnerUp ? [`Runner-up: ${row.runnerUp}`] : []),
      ...(row.score ? [`Final: ${row.detail} — ${row.score} (score in the order shown)`] : row.champion ? [row.detail] : []),
      `${row.posted}/${row.total} match results posted`, '']),
    confirmed === rows.length && rows.length ? 'Division winners confirmed. Thank you to everyone who played!' : 'Results so far. Remaining titles will be updated after results are posted.',
    ...(event.isPublic ? [`https://www.tenaceiq.com/tournaments/${encodeURIComponent(event.id)}`] : [])]
  return { rows, confirmed, message: lines.filter(line => line !== undefined).join('\n') }
}

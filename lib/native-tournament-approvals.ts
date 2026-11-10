import { readReviewedRevisions, reviewedRevisionDigest } from './first-party-revisions'

export const nativeTournamentSummaryColumns = 'id,event_id,is_event,name,format,entrant_type,status,starts_on,location_label,event_details,updated_at,is_public'
export const nativeTournamentDrawColumns = nativeTournamentSummaryColumns + ',entrants,results,schedule'

export function tournamentRevisionDigest(row: Record<string, unknown>, full = false) {
  const columns = full ? nativeTournamentDrawColumns : nativeTournamentSummaryColumns
  return reviewedRevisionDigest(columns.split(',').map(column => row[column]))
}

export function readTournamentApprovals(config: string | undefined) {
  return readReviewedRevisions(config, 'draw')
}

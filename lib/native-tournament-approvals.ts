import { readReviewedRevisions, reviewedRevisionDigest } from './first-party-revisions'
import { nativeTournamentPublicationId } from './native-tournament-draft-contract'

export const nativeTournamentSummaryColumns = 'id,event_id,is_event,name,format,entrant_type,status,starts_on,location_label,event_details,updated_at,is_public'
export const nativeTournamentDrawColumns = nativeTournamentSummaryColumns + ',entrants,results,schedule'
// Entry receipts survive draw changes. The published draw still requires its own approval.
export const nativeTournamentEntryColumns = 'id,event_id,is_event,name,format,entrant_type,status,starts_on,location_label,event_details,is_public,registration_email'

export const publishedNativeTournamentId = (id: string) =>
  nativeTournamentPublicationId(id, 'event') || nativeTournamentPublicationId(id, 'division')

export function isPublishedNativeTournament(row: Record<string, unknown>) {
  if (row.is_public !== true) return false
  return row.is_event === true
    ? nativeTournamentPublicationId(row.id, 'event') && row.event_id === null
    : row.is_event === false && nativeTournamentPublicationId(row.id, 'division') &&
      nativeTournamentPublicationId(row.event_id, 'event')
}

export function tournamentEntryPublication(row: Record<string, unknown>) {
  return Object.fromEntries(nativeTournamentEntryColumns.split(',').map(column => [column, row[column]]))
}

export function tournamentEntryDigest(row: Record<string, unknown>) {
  const publication = tournamentEntryPublication(row)
  // A tournament can move from open to scheduled to completed without changing its identity.
  delete publication.status
  return reviewedRevisionDigest(publication)
}

export function readTournamentEntryApprovals(config = process.env.TIQ_FIRST_PARTY_TOURNAMENT_APPROVALS) {
  const published = readTournamentApprovals(config)
  if (!published.size) return new Map<string, string>()
  const entries: Record<string, { entry?: unknown }> = JSON.parse(config ?? '{}')
  const approved = new Map<string, string>()
  for (const id of published.keys()) {
    const digest = entries[id].entry
    if (digest === undefined) continue
    if (typeof digest !== 'string' || !/^[a-f0-9]{64}$/.test(digest)) throw Error('Invalid tournament entry approval')
    approved.set(id, digest)
  }
  return approved
}

export function tournamentRevisionDigest(row: Record<string, unknown>, full = false) {
  const columns = full ? nativeTournamentDrawColumns : nativeTournamentSummaryColumns
  return reviewedRevisionDigest(columns.split(',').map(column => row[column]))
}

export function readTournamentApprovals(config: string | undefined) {
  return readReviewedRevisions(config, 'draw')
}

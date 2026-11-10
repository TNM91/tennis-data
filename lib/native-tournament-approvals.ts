import { createHash } from 'node:crypto'

export const nativeTournamentSummaryColumns = 'id,event_id,is_event,name,format,entrant_type,status,starts_on,location_label,event_details,updated_at,is_public'
export const nativeTournamentDrawColumns = nativeTournamentSummaryColumns + ',entrants,results,schedule'

type Approval = { summary: string; draw: string }
const validId = /^[a-zA-Z0-9_-]{1,80}$/
const validDigest = /^[a-f0-9]{64}$/
const maxApprovedRecords = 50

export function tournamentRevisionDigest(row: Record<string, unknown>, full = false) {
  const columns = full ? nativeTournamentDrawColumns : nativeTournamentSummaryColumns
  const values = columns.split(',').map(column => row[column])
  const canonical = JSON.stringify(values, (_key, value: unknown) => {
    if (!value || typeof value !== 'object' || Array.isArray(value)) return value
    const record = value as Record<string, unknown>
    return Object.fromEntries(Object.keys(record).sort().map(key => [key, record[key]]))
  })
  return createHash('sha256').update(canonical).digest('hex')
}

export function readTournamentApprovals(config: string | undefined): ReadonlyMap<string, Approval> {
  if (!config?.trim()) return new Map()
  const value: unknown = JSON.parse(config)
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw Error('Invalid first-party tournament approval list')
  }

  const entries = Object.entries(value) as [string, unknown][]
  if (entries.length > maxApprovedRecords) throw Error('Too many first-party tournament approvals')

  const approvals = new Map<string, Approval>()
  for (const [id, entry] of entries) {
    if (!validId.test(id) || !entry || typeof entry !== 'object' || Array.isArray(entry)) {
      throw Error('Invalid first-party tournament approval')
    }
    const { summary, draw } = entry as Record<string, unknown>
    if (typeof summary !== 'string' || typeof draw !== 'string' ||
        !validDigest.test(summary) || !validDigest.test(draw)) {
      throw Error('Invalid first-party tournament revision')
    }
    approvals.set(id, { summary, draw })
  }
  return approvals
}

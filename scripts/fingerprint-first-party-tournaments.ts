import { readFileSync } from 'node:fs'
import {
  nativeTournamentDrawColumns,
  nativeTournamentEntryColumns,
  readTournamentApprovals,
  readTournamentEntryApprovals,
  tournamentEntryDigest,
  tournamentRevisionDigest,
} from '../lib/native-tournament-approvals'

const file = process.argv[2]
if (!file) throw Error('Provide a JSON file containing reviewed tournament rows.')
const rows: unknown = JSON.parse(readFileSync(file, 'utf8'))
if (!Array.isArray(rows)) throw Error('Expected an array of reviewed tournament rows.')

const allowEntry = process.argv.includes('--entry')
const approvals = new Map<string, { summary: string; draw: string; entry?: string }>()
for (const row of rows as Record<string, unknown>[]) {
  if (!row || typeof row !== 'object' || typeof row.id !== 'string' || approvals.has(row.id) ||
      row.is_public !== true || !['open', 'scheduled', 'completed'].includes(String(row.status)) ||
      nativeTournamentDrawColumns.split(',').some(column => !Object.hasOwn(row, column))) {
    throw Error('Each reviewed row must be distinct, published, and include all required columns.')
  }
  approvals.set(row.id, {
    summary: tournamentRevisionDigest(row),
    draw: tournamentRevisionDigest(row, true),
    ...(allowEntry ? { entry: tournamentEntryDigest(row) } : {}),
  })
  if (allowEntry && nativeTournamentEntryColumns.split(',').some(column => !Object.hasOwn(row, column))) {
    throw Error('Entry approval requires all registration metadata, including registration_email.')
  }
}

const config = JSON.stringify(Object.fromEntries(approvals))
readTournamentApprovals(config)
readTournamentEntryApprovals(config)
console.log(config)

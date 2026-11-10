import { readFileSync } from 'node:fs'
import { readReviewedRevisions, reviewedRevisionDigest } from '../lib/first-party-revisions'
import { readCompetitionSnapshot } from '../lib/native-competitions-contract'

const files = process.argv.slice(2)
if (!files.length) throw Error('Provide JSON files containing reviewed public league responses.')

const approvals = new Map<string, { summary: string; detail: string }>()
for (const file of files) {
  const raw = JSON.parse(readFileSync(file, 'utf8'))
  const id = raw?.detail?.league?.id
  if (typeof id !== 'string' || approvals.has(id) || typeof raw.owner !== 'string' ||
      typeof raw.query !== 'string' || raw.connections?.length !== 0) {
    throw Error('Each response must contain one distinct public league with no private connections.')
  }
  const { leagues, detail } = readCompetitionSnapshot(raw, raw.owner, 'discover', raw.query, id)
  if (!detail || leagues.length !== 1 ||
      reviewedRevisionDigest(leagues[0]) !== reviewedRevisionDigest(detail.league)) {
    throw Error('League summary and detail must match.')
  }
  approvals.set(id, {
    summary: reviewedRevisionDigest(detail.league),
    detail: reviewedRevisionDigest(detail),
  })
}

const config = JSON.stringify(Object.fromEntries(approvals))
readReviewedRevisions(config, 'detail')
console.log(config)

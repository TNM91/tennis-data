/** Read-only, paginated source replay. Report files contain no service credentials. */
import { createClient } from '@supabase/supabase-js'
import { mkdir, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { parseTennisRecordMatchPage } from '../lib/tennisrecord/parser'
import { canonicalTennisRecordFingerprint } from '../lib/tennisrecord/reconcile'
import { supabaseUrl } from '../lib/supabase'

const key = process.env.SUPABASE_SERVICE_ROLE_KEY
if (!key) throw new Error('SUPABASE_SERVICE_ROLE_KEY required')
const db = createClient(supabaseUrl, key, { auth: { persistSession: false, autoRefreshToken: false } })
const out = resolve(process.argv.find(a => a.startsWith('--out='))?.slice(6) || 'artifacts/result-integrity-20260905/audit.json')

async function all(table: string, columns = '*') {
  const rows: Record<string, unknown>[] = []
  const order = table === 'tennisrecord_canonical_matches' ? 'fingerprint' : 'id'
  let cursor: unknown = null
  for (;;) {
    let query = db.from(table).select(columns).order(order).limit(1000)
    if (cursor) query = query.gt(order, cursor)
    const { data, error } = await query
    if (error) throw new Error(`${table}: ${error.message}`)
    rows.push(...data as unknown as Record<string, unknown>[])
    if (rows.length % 10000 === 0) console.log(`Reading ${table}: ${rows.length}`)
    if (data.length < 1000) break
    cursor = rows.at(-1)?.[order]
  }
  console.log(`${table}: ${rows.length}`)
  return rows
}

async function main() {
  const matches = await all('matches', 'id,external_match_id,source,match_date,match_type,line_number,home_team,away_team,league_name,flight,score,winner_side,rating_eligible,public_history_eligible,status')
  const staged = await all('tennisrecord_staged_matches')
  const canonicals = await all('tennisrecord_canonical_matches')
  const observations = await all('tennisrecord_match_observations')
  const stagedByFp = new Map([...staged].sort((a,b) => Number(a.parser_revision) - Number(b.parser_revision) || String(a.last_seen_at).localeCompare(String(b.last_seen_at))).map(s => [s.fingerprint, s]))
  const canonicalByFp = new Map(canonicals.map(c => [c.fingerprint, c]))
  const observationsByFp = new Map<unknown, typeof observations>()
  for (const o of observations) observationsByFp.set(o.fingerprint, [...(observationsByFp.get(o.fingerprint) || []), o])
  const matchesByFp = new Map<string, typeof matches>()
  for (const m of matches) {
    const fp = String(m.external_match_id || '').match(/^tennisrecord:(trm_[a-f0-9]+)(?:::line:\d+)?$/)?.[1]
    if (fp) matchesByFp.set(fp, [...(matchesByFp.get(fp) || []), m])
  }
  const pageIds = [...new Set([...matchesByFp.keys()].map(fp => stagedByFp.get(fp)?.page_id).filter(Boolean))]
  const parsedByFp = new Map<string, ReturnType<typeof parseTennisRecordMatchPage>['matches'][number]>()
  for (let i = 0; i < pageIds.length; i += 60) {
    const responses = await Promise.all([0,15,30,45].filter(n => i+n < pageIds.length).map(n => db.from('tennisrecord_source_pages').select('id,source_url,raw_html').in('id', pageIds.slice(i+n, i+n+15))))
    for (const response of responses) if (response.error) throw new Error(response.error.message)
    for (const page of responses.flatMap(r => r.data || [])) {
      for (const match of parseTennisRecordMatchPage(page.raw_html || '', page.source_url).matches) parsedByFp.set(canonicalTennisRecordFingerprint(match), match)
    }
    if (i % 600 === 0) console.log(`Replayed ${Math.min(i + 60, pageIds.length)}/${pageIds.length} saved pages`)
  }
  const results = [...matchesByFp].map(([fingerprint, records]) => {
    const source = stagedByFp.get(fingerprint)
    const parsed = parsedByFp.get(fingerprint)
    const obs = observationsByFp.get(fingerprint) || []
    const stale = obs.filter(o => o.source === 'tenaceiq' && (o.raw as {source?: string})?.source === 'tennisrecord' && records.some(m => m.id === o.source_record_id && m.source === 'tennisrecord'))
    const protectedEvidence = obs.filter(o => o.source !== 'tennisrecord' && !stale.includes(o))
    const winnerMismatches = records.filter(m => parsed?.winnerSide && m.winner_side !== parsed.winnerSide)
    const scoreMismatches = records.filter(m => parsed && m.score !== parsed.scoreText)
    return { fingerprint, source, parsed, records, canonical: canonicalByFp.get(fingerprint), observations: obs, staleObservationIds: stale.map(o => o.id), protectedEvidenceIds: protectedEvidence.map(o => o.id), winnerMismatchIds: winnerMismatches.map(m => m.id), scoreMismatchIds: scoreMismatches.map(m => m.id) }
  })
  const changed = results.filter(r => r.winnerMismatchIds.length || r.scoreMismatchIds.length || r.staleObservationIds.length)
  const summary = {
    allMatchRows: matches.length, sourceMatchRows: [...matchesByFp.values()].flat().length, sourceFingerprints: results.length,
    savedPages: pageIds.length, replayedFingerprints: results.filter(r => r.parsed).length,
    winnerMismatchRows: results.reduce((n, r) => n + r.winnerMismatchIds.length, 0),
    winnerMismatchCourts: results.reduce((n, r) => n + r.records.filter(m => m.match_type && r.winnerMismatchIds.includes(m.id)).length, 0),
    staleObservations: results.reduce((n, r) => n + r.staleObservationIds.length, 0),
    protectedGroups: changed.filter(r => r.protectedEvidenceIds.length || r.records.some(m => m.source !== 'tennisrecord')).length,
    scoreMismatchRows: results.reduce((n, r) => n + r.scoreMismatchIds.length, 0),
    missingEvidence: results.filter(r => !r.parsed || !r.parsed.winnerSide).length,
  }
  await mkdir(resolve(out, '..'), { recursive: true })
  // Raw observations can embed whole source payloads. Keep the repair manifest
  // bounded; exact pre-write row backups are captured separately by the repair.
  const actionable = results.filter(r => r.winnerMismatchIds.length || r.scoreMismatchIds.length || r.staleObservationIds.length || !r.parsed?.winnerSide).map(r => ({
    ...r,
    source: r.source ? { ...r.source, raw: undefined } : undefined,
    observations: r.observations.map(o => ({ ...o, raw: { source: (o.raw as {source?: string})?.source } })),
  }))
  await writeFile(out, JSON.stringify({ generatedAt: new Date().toISOString(), summary, results: actionable }), { flag: 'wx' })
  console.log(JSON.stringify(summary, null, 2))
  console.log(`Audit saved: ${out}`)
}
main().catch(error => { console.error(error); process.exitCode = 1 })

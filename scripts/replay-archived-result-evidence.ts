/** Read only: finish an integrity audit using our private saved-page archive. */
import { createClient } from '@supabase/supabase-js'
import { readFile, writeFile, appendFile } from 'node:fs/promises'
import { parseTennisRecordMatchPage } from '../lib/tennisrecord/parser'
import { canonicalTennisRecordFingerprint } from '../lib/tennisrecord/reconcile'
import { supabaseUrl } from '../lib/supabase'

type Row = Record<string, unknown>
type Parsed = ReturnType<typeof parseTennisRecordMatchPage>['matches'][number]
type Group = { fingerprint: string; source?: Row; parsed?: Parsed; evidenceKind?: string; records: Row[]; observations: Row[]; staleObservationIds: string[]; protectedEvidenceIds: string[]; winnerMismatchIds: unknown[]; scoreMismatchIds: unknown[] }
const dir = 'artifacts/result-integrity-20260905'
const db = createClient(supabaseUrl, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false, autoRefreshToken: false } })
async function main() {
  const audit = JSON.parse(await readFile(`${dir}/audit.json`, 'utf8')) as { summary: Record<string, number>; results: Group[] }
  // Current validated source records that already agree with every production
  // row need no repair or redundant archive download. Older parser revisions,
  // disagreements and synthetic authority still require a fresh source replay.
  let validatedCurrentSource = 0
  for (const r of audit.results) {
    const s = r.source
    if (r.parsed || !s || Number(s.parser_revision) < 7 || s.parse_status !== 'valid' || !['A','B'].includes(String(s.winner_side)) ||
      r.staleObservationIds.length || r.protectedEvidenceIds.length || !r.records.every(m => m.winner_side === s.winner_side && m.score === s.score_text)) continue
    const parsed = { sourceMatchKey:s.source_match_key,sourceUrl:s.source_url,playedOn:s.played_on,leagueName:s.league_name,flight:s.flight || '',homeTeam:s.home_team,awayTeam:s.away_team,discipline:s.discipline,courtNumber:s.court_number,scoreText:s.score_text,winnerSide:s.winner_side,participants:s.participants } as Parsed
    if (canonicalTennisRecordFingerprint(parsed) !== r.fingerprint) continue
    r.parsed = parsed
    r.evidenceKind = 'consistent-current-validated-staging'
    validatedCurrentSource++
  }
  const cacheFile = `${dir}/archive-replay.jsonl`
  const cached = await readFile(cacheFile, 'utf8').catch(() => '')
  const done = new Set<string>()
  const byFp = new Map<string, Parsed>()
  for (const line of cached.split('\n').filter(Boolean)) {
    const entry = JSON.parse(line) as { id: string; matches: Parsed[] }
    done.add(entry.id)
    for (const m of entry.matches) byFp.set(canonicalTennisRecordFingerprint(m), m)
  }
  const ids = [...new Set(audit.results.filter(r => !r.parsed).map(r => r.source?.page_id).filter((v): v is string => typeof v === 'string'))].filter(id => !done.has(id))
  for (let i = 0; i < ids.length; i += 96) {
    const { data, error } = await db.from('tennisrecord_source_pages').select('id,source_url,raw_html,raw_html_storage_path').in('id', ids.slice(i, i + 96))
    if (error) throw new Error(error.message)
    for (let j = 0; j < (data || []).length; j += 16) {
      const entries = await Promise.all(data!.slice(j, j + 16).map(async page => {
        let html = page.raw_html as string | null
        if (!html && page.raw_html_storage_path) {
          let download = await db.storage.from('tennisrecord-source-pages').download(page.raw_html_storage_path)
          for (let retry = 0; download.error && /timeout|gateway|fetch|temporar/i.test(download.error.message) && retry < 3; retry++) {
            await new Promise(resolve => setTimeout(resolve, 1000 * (retry + 1)))
            download = await db.storage.from('tennisrecord-source-pages').download(page.raw_html_storage_path)
          }
          if (download.error) throw new Error(`Archive ${page.id}: ${download.error.message}`)
          html = await download.data.text()
        }
        const matches = parseTennisRecordMatchPage(html || '', page.source_url).matches
        for (const m of matches) byFp.set(canonicalTennisRecordFingerprint(m), m)
        return { id: page.id, matches }
      }))
      await appendFile(cacheFile, entries.map(e => JSON.stringify(e)).join('\n') + '\n')
    }
    if (i % 960 === 0) console.log(`Archive replay ${Math.min(i+96, ids.length)}/${ids.length}; ${done.size} pages resumed`)
  }
  let recovered = 0
  for (const r of audit.results) {
    if (!r.parsed && byFp.has(r.fingerprint)) { r.parsed = byFp.get(r.fingerprint); recovered++ }
    r.winnerMismatchIds = r.records.filter(m => r.parsed?.winnerSide && m.winner_side !== r.parsed.winnerSide).map(m => m.id)
    r.scoreMismatchIds = r.records.filter(m => r.parsed && m.score !== r.parsed.scoreText).map(m => m.id)
  }
  const summary = { ...audit.summary,
    replayedFingerprints: audit.summary.replayedFingerprints + recovered,
    validatedCurrentSourceFingerprints: validatedCurrentSource,
    winnerMismatchRows: audit.results.reduce((n,r) => n+r.winnerMismatchIds.length,0),
    winnerMismatchCourts: audit.results.reduce((n,r) => n+r.records.filter(m => m.match_type && r.winnerMismatchIds.includes(m.id)).length,0),
    scoreMismatchRows: audit.results.reduce((n,r) => n+r.scoreMismatchIds.length,0),
    missingEvidence: audit.results.filter(r => !r.parsed?.winnerSide).length,
  }
  await writeFile(`${dir}/complete-audit.json`, JSON.stringify({ generatedAt: new Date().toISOString(), summary, results: audit.results.filter(r => r.winnerMismatchIds.length || r.scoreMismatchIds.length || r.staleObservationIds.length || !r.parsed?.winnerSide) }), { flag: 'wx' })
  console.log(JSON.stringify(summary, null, 2))
}
main().catch(e => { console.error(e); process.exitCode = 1 })

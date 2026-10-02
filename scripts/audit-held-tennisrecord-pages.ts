import { createClient } from '@supabase/supabase-js'
import { mkdir, writeFile } from 'node:fs/promises'
import { parseTennisRecordMatchPage } from '../lib/tennisrecord/parser'

async function main() {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!key) throw new Error('SUPABASE_SERVICE_ROLE_KEY required')
  const db = createClient('https://pwxppfazbyourjrsutgx.supabase.co', key, { auth: { persistSession: false, autoRefreshToken: false } })
  const { data: queue, error } = await db.from('tennisrecord_crawl_queue').select('id,source_url,failure_reason').eq('status', 'review').eq('refresh_season', new Date().getUTCFullYear()).order('id').limit(1000)
  if (error) throw error
  const results = []
  for (const row of queue) {
    if (!/No complete.*court/i.test(row.failure_reason)) { results.push({ ...row, classification: 'identity_or_winner_hold' }); continue }
    const { data: pages, error: pageError } = await db.from('tennisrecord_source_pages').select('id,raw_html,raw_html_storage_path,http_status,captured_at').eq('source_url', row.source_url).order('captured_at', { ascending: false }).limit(1)
    if (pageError) throw pageError
    const page = pages[0]
    if (!page || page.http_status < 200 || page.http_status >= 300) { results.push({ ...row, classification: 'no_successful_source' }); continue }
    let html = page.raw_html as string | null
    if (!html && page.raw_html_storage_path) {
      const stored = await db.storage.from('tennisrecord-source-pages').download(page.raw_html_storage_path)
      if (stored.error) throw stored.error
      html = await stored.data.text()
    }
    const parsed = parseTennisRecordMatchPage(html || '', row.source_url)
    results.push({ ...row, sourcePageId: page.id, capturedAt: page.captured_at, courts: parsed.matches.length,
      classification: parsed.reviewReason ? 'source_event_review' : parsed.matches.some(m => !m.winnerSide) ? 'winner_review' : parsed.matches.length ? 'parseable_requires_reconciliation_review' : 'no_complete_courts_in_retained_source',
    })
  }
  const counts: Record<string, number> = {}
  for (const row of results) counts[row.classification] = (counts[row.classification] || 0) + 1
  console.log(JSON.stringify({ reviewed: results.length, counts, truncated: queue.length === 1000, productionWrites: 0 }, null, 2))
  const out = process.argv.find(arg => arg.startsWith('--out='))?.slice(6) || 'artifacts/rating-evidence'
  await mkdir(out, { recursive: true })
  await writeFile(`${out}/held-page-audit.json`, JSON.stringify({ capturedAt: new Date().toISOString(), truncated: queue.length === 1000, counts, results }, null, 2))
}
main().catch(error => { console.error(error); process.exitCode = 1 })

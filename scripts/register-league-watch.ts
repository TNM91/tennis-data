/** Register an exact source league from retained roster evidence. Dry-run by default.
 * Usage: npx tsx --env-file=.env.local scripts/register-league-watch.ts --team-url=<URL> [--apply]
 * No requests to TennisRecord, canonical writes, guessed aliases or hold resets.
 */
import { createClient } from '@supabase/supabase-js'
import { createHash } from 'node:crypto'
import { mkdirSync, writeFileSync } from 'node:fs'
import { parseTennisRecordMatchPage, tennisRecordRecordPageKind } from '../lib/tennisrecord/parser'
import { leagueWatchCaptureFacts } from '../lib/tennisrecord/league-coverage'
import { activeChampionshipYears } from '../lib/tennisrecord/current-refresh'

const service = createClient('https://pwxppfazbyourjrsutgx.supabase.co', process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } })
const teamUrl = process.argv.find(a => a.startsWith('--team-url='))?.slice(11)
const apply = process.argv.includes('--apply')
const now = new Date()
async function capture(url: string) {
  const result = await service.from('tennisrecord_source_pages').select('id,source_url,captured_at,raw_html,raw_html_storage_path')
    .eq('source_url', url).eq('blocked', false).gte('http_status', 200).lt('http_status', 300).order('captured_at', { ascending: false }).limit(1).maybeSingle()
  if (result.error) throw result.error
  if (!result.data) return null
  let html = result.data.raw_html as string | null
  if (!html && result.data.raw_html_storage_path) {
    const file = await service.storage.from('tennisrecord-source-pages').download(result.data.raw_html_storage_path)
    if (file.error) throw file.error
    html = await file.data.text()
  }
  if (!html) return null
  const parsed = parseTennisRecordMatchPage(html, url)
  const facts = leagueWatchCaptureFacts(parsed, url, now, html)
  return { pageId: result.data.id as string, capturedAt: result.data.captured_at as string, parsed, facts }
}
async function main() {
  if (!teamUrl || tennisRecordRecordPageKind(teamUrl) !== 'team') throw Error('An exact --team-url is required')
  const seed = await capture(teamUrl)
  if (!seed?.facts || !seed.parsed.teamMembers.length) throw Error('A retained source roster is required')
  const members = seed.parsed.teamMembers
  const leagueUrl = members[0].leagueSourceUrl
  const year = members[0].seasonYear
  if (!leagueUrl || !year || !activeChampionshipYears(now).includes(year)
    || members.some(m => m.sourceUrl !== teamUrl || m.leagueSourceUrl !== leagueUrl || m.seasonYear !== year || !m.leagueName || !m.flight)) throw Error('The roster does not establish a single active league scope')
  const label = `${members[0].leagueName} · ${members[0].flight}`
  const teamUrls = new Set([teamUrl])
  for (let offset = 0; ; offset += 500) {
    const rows = await service.from('tennisrecord_staged_team_memberships').select('source_url')
      .eq('raw->>leagueSourceUrl', leagueUrl).order('id').range(offset, offset + 499)
    if (rows.error) throw rows.error
    for (const row of rows.data || []) teamUrls.add(row.source_url)
    if ((rows.data?.length || 0) < 500) break
  }
  if (teamUrls.size > 60) throw Error('Review large league scope before registration')
  const pages = new Map<string, { kind: string; pageId?: string; capturedAt?: string; facts?: NonNullable<ReturnType<typeof leagueWatchCaptureFacts>> }>()
  pages.set(leagueUrl, { kind: 'league' })
  for (const url of teamUrls) {
    const source = url === teamUrl ? seed : await capture(url)
    if (!source?.facts || !source.parsed.teamMembers.length || source.parsed.teamMembers.some(m => m.leagueSourceUrl !== leagueUrl || m.seasonYear !== year || m.sourceUrl !== url)) throw Error('Retained roster scope mismatch: ' + url)
    pages.set(url, { kind: 'team', ...source, facts: source.facts })
    for (const link of source.facts.links.filter(l => l.kind === 'match')) pages.set(link.url, { kind: 'match' })
  }
  if (pages.size > 1000) throw Error('Review large scorecard frontier before registration')
  for (const [url, page] of pages) {
    if (page.pageId) continue
    const source = await capture(url)
    if (source?.facts) pages.set(url, { kind: page.kind, pageId: source.pageId, capturedAt: source.capturedAt, facts: source.facts })
  }
  const plan = { leagueUrl, year, label, teams: teamUrls.size, pages: [...pages].map(([url, p]) => ({ url, kind: p.kind, pageId: p.pageId, capturedAt: p.capturedAt, facts: p.facts })) }
  const hash = createHash('sha256').update(JSON.stringify(plan)).digest('hex')
  mkdirSync('.codex-audit/league-watches', { recursive: true })
  writeFileSync(`.codex-audit/league-watches/${hash}.json`, JSON.stringify(plan, null, 2))
  if (apply) {
    const watch = await service.from('tennisrecord_league_watches').upsert({ source_url: leagueUrl, label, season_year: year }, { onConflict: 'source_url', ignoreDuplicates: true })
    if (watch.error) throw watch.error
    const registered = await service.from('tennisrecord_league_watch_pages').upsert(plan.pages.map(p => ({ league_url: leagueUrl, source_url: p.url, page_kind: p.kind })), { onConflict: 'league_url,source_url', ignoreDuplicates: true })
    if (registered.error) throw registered.error
    for (const page of plan.pages) {
      if (!page.pageId || !page.facts) continue
      const saved = await service.rpc('record_tennisrecord_watch_capture', { p_source_url: page.url, p_page_id: page.pageId, p_count: page.facts.count, p_pending: page.facts.pending, p_links: page.facts.links })
      if (saved.error) throw saved.error
      if (page.facts.pending) {
        const released = await service.rpc('release_tennisrecord_unposted_scorecard', { p_source_url: page.url, p_page_id: page.pageId })
        if (released.error) throw released.error
      }
    }
  }
  console.log(JSON.stringify({ apply, hash, label, teams: plan.teams, pages: pages.size, retainedCaptures: plan.pages.filter(p => p.pageId).length, sourceHttpRequests: 0, canonicalWrites: 0 }))
}
main().catch(error => { console.error(error.message); process.exitCode = 1 })

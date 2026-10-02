import { readFile, writeFile } from 'node:fs/promises'
import { createClient } from '@supabase/supabase-js'
import { recoverCapturedComputerPrior } from '../lib/tiq-rating-prior-evidence'
async function main() {
  const arg = (name: string) => process.argv.find(v => v.startsWith(`--${name}=`))?.slice(name.length + 3)
  const input = arg('report'), out = arg('out'), key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!input || !out || !key) throw new Error('--report, --out and SUPABASE_SERVICE_ROLE_KEY required')
  const report = JSON.parse(await readFile(input, 'utf8')) as { season: number; missingTargetPriors: { id: string; name: string }[] }
  const db = createClient('https://pwxppfazbyourjrsutgx.supabase.co', key, { auth: { persistSession: false, autoRefreshToken: false } })
  const recovered = [], unresolved = []
  for (const player of report.missingTargetPriors) {
    const identities = await db.from('tennisrecord_player_identities').select('staged_player_id').eq('canonical_player_id', player.id).eq('status', 'matched')
    if (identities.error) throw new Error(identities.error.message)
    if (identities.data.length !== 1) { unresolved.push({ ...player, reason: 'missing_or_nonunique_matched_identity' }); continue }
    const staged = await db.from('tennisrecord_staged_players').select('name,source_url').eq('id', identities.data[0].staged_player_id).single()
    if (staged.error) throw new Error(staged.error.message)
    const sources = await db.from('tennisrecord_source_pages').select('id,http_status,blocked,captured_at,raw_html,raw_html_storage_path').eq('source_url', staged.data.source_url).order('captured_at', { ascending: false }).limit(1)
    if (sources.error) throw new Error(sources.error.message)
    const source = sources.data[0]
    if (!source || source.http_status !== 200 || source.blocked) { unresolved.push({ ...player, reason: 'no_successful_captured_profile' }); continue }
    let html = source.raw_html as string | null
    if (!html && source.raw_html_storage_path) {
      const stored = await db.storage.from('tennisrecord-source-pages').download(source.raw_html_storage_path)
      if (stored.error) throw new Error(stored.error.message)
      html = await stored.data.text()
    }
    const prior = recoverCapturedComputerPrior({ playerId: player.id, name: staged.data.name, profileUrl: staged.data.source_url, sourcePageId: source.id, capturedAt: source.captured_at, html: html || '', season: report.season - 1 })
    if (prior) recovered.push(prior)
    else unresolved.push({ ...player, reason: 'no_matching_dated_prior_computer_label' })
  }
  await writeFile(out, JSON.stringify({ generatedAt: new Date().toISOString(), productionWrites: 0, priors: recovered, unresolved }, null, 2))
  console.log(JSON.stringify({ recovered: recovered.length, unresolved, out, productionWrites: 0 }, null, 2))
}
main().catch(error => { console.error(error instanceof Error ? error.message : String(error)); process.exitCode = 1 })

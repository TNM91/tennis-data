import { mkdir, writeFile } from 'node:fs/promises'
const key = process.env.SUPABASE_SERVICE_ROLE_KEY
if (!key) throw new Error('Service role required')
const playerId = 'ba687267-2f42-4a5c-9052-518de1f8b495'
const root = process.argv.find(a => a.startsWith('--out='))?.slice(6) || 'artifacts/rating-evidence/official-usta'
const base = 'https://pwxppfazbyourjrsutgx.supabase.co/rest/v1/'
async function query(table, params) {
 const url = new URL(table, base); url.search = new URLSearchParams(params)
 const r = await fetch(url, {headers:{apikey:key,Authorization:`Bearer ${key}`},signal:AbortSignal.timeout(30000)})
 if (!r.ok) throw new Error(`${table} ${r.status}: ${await r.text()}`)
 return r.json()
}
const links = await query('match_players',{select:'match_id',player_id:`eq.${playerId}`,limit:'1000'})
if(links.length===1000)throw new Error('Target links truncated')
const ids=[...new Set(links.map(r=>r.match_id))], matches=[]
for(let i=0;i<ids.length;i+=100) matches.push(...await query('matches',{select:'id,match_date,match_type,score,winner_side,rating_eligible,source,external_match_id,league_name,match_players(player_id,side)',id:`in.(${ids.slice(i,i+100).join(',')})`,match_date:'gte.2026-01-01',limit:'1000'}))
const pids=[...new Set(matches.flatMap(m=>m.match_players.map(p=>p.player_id)))], names=[]
for(let i=0;i<pids.length;i+=100) names.push(...await query('players',{select:'id,name',id:`in.(${pids.slice(i,i+100).join(',')})`,limit:'1000'}))
const extraPlayers=await query('players',{select:'id,name',name:'ilike.Trevor%Neale',limit:'100'}); console.log(JSON.stringify({extraPlayers}));
const [player] = await query('players',{select:'id,name,overall_rating,overall_dynamic_rating,singles_dynamic_rating,doubles_dynamic_rating',id:`eq.${playerId}`})
const sourceUrl = 'https://www.tennisrecord.com/adult/matchhistory.aspx?playername=Nathan+Meinert&year=2026'
const histories=await query('tennisrecord_source_pages',{select:'id,source_url,captured_at,http_status,blocked,raw_html_storage_path',source_url:`eq.${sourceUrl}`,order:'captured_at.desc',limit:'2'})
const queue=await query('tennisrecord_crawl_queue',{select:'id,source_url,status,page_kind,refresh_due_at,current_refreshed_at,failure_reason',source_url:`eq.${sourceUrl}`,limit:'10'})
await mkdir(root,{recursive:true})
const report={capturedAt:new Date().toISOString(),productionWrites:0,player,matches,names,histories,queue}
await writeFile(`${root}/nathan-live-canonical.json`,JSON.stringify(report,null,2))
console.log(JSON.stringify({player,courts:matches.filter(m=>['singles','doubles'].includes(m.match_type)).length,recent:matches.filter(m=>m.match_date>='2026-09-01').map(({id,match_date,match_type,score,rating_eligible})=>({id,match_date,match_type,score,rating_eligible})),histories,queue},null,2))


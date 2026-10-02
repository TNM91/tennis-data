import {readFile,writeFile,mkdir} from 'node:fs/promises'
const arg=n=>process.argv.find(a=>a.startsWith(`--${n}=`))?.slice(n.length+3)
const graphPath=arg('graph'), evidence=arg('evidence-dir'), mapPath=arg('identity-map'), out=arg('out')
if(!graphPath||!evidence||!mapPath||!out)throw new Error('--graph --evidence-dir --identity-map --out required')
const graph=JSON.parse(await readFile(graphPath,'utf8')), reviewed=JSON.parse(await readFile(mapPath,'utf8')), ratings=JSON.parse(await readFile(`${evidence}/st-louis-2026.json`,'utf8'))
if(graph.season!==2026||graph.cutoff<'2026-09-30')throw new Error('Reviewed 2026 window required')
const norm=s=>s.toLowerCase().replace(/[^a-z0-9]/g,'')
const official=[]
for(const p of reviewed){
 if(p.reviewed!==true||!p.playerId||!p.corroboration)throw new Error('Explicit reviewed identity mapping required')
 const found=ratings.rows.filter(r=>{const parts=r.cells[0].split(',');return norm(`${parts[1]} ${parts[0]}`)===norm(p.name)})
 if(found.length!==1)throw new Error(`Nonunique official label: ${p.name}`)
 const row=found[0], existing=graph.names.filter(n=>n.id===p.playerId)
 if(existing.some(n=>norm(n.name)!==norm(p.name)))throw new Error('Canonical identity mismatch')
 if(row.cells[5]!=='12/31/2025'||row.cells[6]!=='C')throw new Error('Explicit 2025 computer level required')
 const url=new URL(row.playerUrl);if(url.hostname!=='tennislink.usta.com'||url.protocol!=='https:')throw new Error('Official USTA URL required')
 official.push({playerId:p.playerId,season:2025,level:Number(row.cells[4]),designation:'computer',sourceUrl:row.playerUrl,verified:true,capturedAt:ratings.capturedAt,effectiveDate:'2025-12-31',corroboration:p.corroboration})
 if(!existing.length)graph.names.push({id:p.playerId,name:p.name})
}
// Narrow reviewed court changes, retaining original evidence for audit. No production writes.
const reconciliation=JSON.parse(await readFile(`${evidence}/nathan-reconciliation.json`,'utf8'))
const changes=[]
for(const court of reconciliation.results.filter(r=>r.status==='date_difference')){
 if(court.matches.length!==1)throw new Error('Ambiguous date')
 const match=graph.matches.find(m=>m.id===court.matches[0].id)
 if(!match||match.match_date!==court.matches[0].canonicalDate)throw new Error('Frozen date changed')
 changes.push({matchId:match.id,originalDate:match.match_date,officialDate:court.playedOn,officialTeamMatchId:court.officialTeamMatchId})
 match.match_date=court.playedOn
}
const missing=reconciliation.results.filter(r=>r.status==='missing')
if(missing.length!==1||missing[0].officialTeamMatchId!=='1012101435'||missing[0].playedOn!=='2026-09-30')throw new Error('Unreviewed missing court')
if(norm(missing[0].winningPlayers)!==norm('CHRISTOPHER KRIEGER Nathan Meinert')||norm(missing[0].opponents)!==norm('Trevor Neale Eric Abramson')||missing[0].court!=='#1 Doubles')throw new Error('Official court participants changed')
if(graph.matches.some(m=>m.external_match_id==='1012101435::line:1'))throw new Error('Court already present')
const idFor=name=>{const found=reviewed.filter(p=>norm(p.name)===norm(name));if(found.length!==1)throw new Error('Reviewed participant mapping missing');return found[0].playerId}
const participants=[{playerId:idFor('CHRISTOPHER KRIEGER'),side:'A'},{playerId:idFor('Nathan Meinert'),side:'A'},{playerId:idFor('Trevor Neale'),side:'B'},{playerId:idFor('Eric Abramson'),side:'B'}]
graph.matches.push({id:'official-usta:1012101435::line:1',match_date:'2026-09-30',match_type:'doubles',score:missing[0].score,winner_side:'A',match_source:'usta',rating_eligible:true,league_name:'2026 STL Tri-Level 18 & Over',source:'official-usta-captured-record',external_match_id:'1012101435::line:1',participants,match_players:participants.map(p=>({player_id:p.playerId,side:p.side})),ustaEligible:false,eligibilityPolicy:'2026-trilevel-policy-unconfirmed',scoreOrientation:'side-a',scoreEvidenceId:'official-usta:1012101435::line:1'})
graph.officialEvidenceOverlay={capturedAt:ratings.capturedAt,changes,addedCourt:'official-usta:1012101435::line:1',productionWrites:0}
await mkdir(out,{recursive:true});await writeFile(`${out}/input.json`,JSON.stringify(graph));await writeFile(`${out}/official-priors.json`,JSON.stringify(official,null,2));await writeFile(`${out}/overlay-audit.json`,JSON.stringify(graph.officialEvidenceOverlay,null,2));console.log(JSON.stringify({officialPriors:official.length,...graph.officialEvidenceOverlay}))


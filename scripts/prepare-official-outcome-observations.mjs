import {readFile,writeFile} from 'node:fs/promises'
const root=process.argv.find(a=>a.startsWith('--input-dir='))?.slice(12)
if(!root)throw new Error('--input-dir required')
const capture=JSON.parse(await readFile(`${root}/st-louis-2026.json`,'utf8'))
const labels=capture.rows.map(r=>{
 const [name,gender,city,state,level,effectiveDate,designation]=r.cells
 const url=new URL(r.playerUrl);if(url.hostname!=='tennislink.usta.com'||url.protocol!=='https:')throw new Error('Official source required')
 return {officialPlayerUrl:r.playerUrl,name,gender,city,state,level:Number(level),effectiveDate,designation,capturedAt:capture.capturedAt,canonicalPlayerId:null,identityStatus:'unreviewed',historicalOutcome:effectiveDate==='12/31/2025'&&designation==='C',historicalStartingLevel:null}
})
const report={capturedAt:capture.capturedAt,source:'official-usta',participationYear:capture.championshipYear,reportRows:labels.length,possibleReportLimit:labels.length===2000,verifiedCanonicalPairs:0,releaseEligible:false,productionWrites:0,designationCounts:labels.reduce((out,r)=>({...out,[r.designation]:(out[r.designation]||0)+1}),{}),dated2025ComputerObservations:labels.filter(r=>r.historicalOutcome).length,limitations:['Published observations are not historical as-of snapshots.','Canonical identity and prior annual level remain unverified.','Current district participation filter is not a complete historical outcome population.'],labels}
await writeFile(`${root}/official-outcome-observations.json`,JSON.stringify(report,null,2));console.log(JSON.stringify({...report,labels:undefined},null,2))

import {readFile,writeFile} from 'node:fs/promises'
import {reconcileOfficialCourts} from '../lib/usta-evidence-reconciliation'
async function main(){
 const root=process.argv.find(a=>a.startsWith('--input-dir='))?.slice(12)
 if(!root)throw new Error('--input-dir required')
 const read=async(name:string)=>JSON.parse(await readFile(`${root}/${name}`,'utf8'))
 const live=await read('nathan-live-canonical.json'), rows=[]
 for(const year of [2026,2027]){const official=await read(`nathan-${year}-courts.json`);rows.push(...official.rows.map((cells:string[])=>({championshipYear:year,cells})))}
 const results=reconcileOfficialCourts(rows,live.matches,new Map(live.names.map((p:{id:string;name:string})=>[p.id,p.name])),2026)
 const report={generatedAt:new Date().toISOString(),productionWrites:0,officialCourts:results.length,statusCounts:results.reduce((counts:Record<string,number>,r)=>({...counts,[r.status]:(counts[r.status]||0)+1}),{}),results}
 await writeFile(`${root}/nathan-reconciliation.json`,JSON.stringify(report,null,2));console.log(JSON.stringify({...report,results:results.filter(r=>r.status!=='matched')},null,2))
}
main().catch(error=>{console.error(error instanceof Error?error.message:String(error));process.exitCode=1})

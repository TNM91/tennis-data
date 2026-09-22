/** Upload reviewed evidence only; this never updates matches or ratings. */
import { readFile } from 'node:fs/promises'
import { createHash } from 'node:crypto'
import { createClient } from '@supabase/supabase-js'
import { supabaseUrl } from '../lib/supabase'
async function main() {
  if (!process.argv.includes('--apply')) throw new Error('Review repair-plan.json, then pass --apply to upload its evidence.')
  const { run, hash, rows } = JSON.parse(await readFile('artifacts/result-integrity-20260905/repair-evidence.json','utf8')) as {run:string;hash:string;rows:Array<{fingerprint:string}>}
  if (createHash('sha256').update(JSON.stringify(rows)).digest('hex') !== hash) throw new Error('Manifest hash mismatch')
  const db = createClient(supabaseUrl,process.env.SUPABASE_SERVICE_ROLE_KEY!,{auth:{persistSession:false,autoRefreshToken:false}})
  for (let i=0;i<rows.length;i+=100) {
    const {error}=await db.from('tennisrecord_result_repair_evidence').upsert(rows.slice(i,i+100).map(payload=>({run_id:run,fingerprint:payload.fingerprint,payload})),{onConflict:'run_id,fingerprint'})
    if(error) throw new Error(error.message)
  }
  const {count,error}=await db.from('tennisrecord_result_repair_evidence').select('fingerprint',{count:'exact',head:true}).eq('run_id',run)
  if(error||count!==rows.length) throw new Error(error?.message||'Uploaded manifest is incomplete')
  console.log(JSON.stringify({run,uploadedEvidence:count,matchWrites:0}))
}
main().catch(e=>{console.error(e);process.exitCode=1})

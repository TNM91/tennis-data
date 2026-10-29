import {createHash} from 'node:crypto'
import type {SupabaseClient} from '@supabase/supabase-js'
import {runDataAssistScorecardImportAction,runDataAssistTeamSummaryImportAction} from './data-assist-import-runner'
import type {DataAssistScorecardParsedDraft} from './data-assist-ocr'
import type {DataAssistTeamSummaryParsedDraft} from './data-assist-team-summary-parser'
import type {ImportReviewImpact} from './data-assist-review-impact'

export const stableReviewValue=(value:unknown)=>JSON.stringify(value,(_key,item)=>item&&typeof item==='object'&&!Array.isArray(item)?Object.fromEntries(Object.keys(item).sort().map(k=>[k,item[k]])):item)
type ReadResult={data:unknown;error:unknown}
type Chain=Record<string,(...args:unknown[])=>Chain>&PromiseLike<ReadResult>
/** Fail closed even where the legacy importer tolerates read errors. Mutations cannot pass. */
export function createImportPreviewReader(client:SupabaseClient){
 const evidence:string[]=[],deadline=Date.now()+30000;let queries=0,parentExists=false
 const allowed=new Set(['select','eq','in','like','ilike','or','order','limit','maybeSingle','single','is','not','neq'])
 const caps:Record<string,number>={players:500,matches:10,match_players:40,team_roster_members:500,captain_roster_contacts:500}
 const from=(table:string)=>{
  if(!Object.hasOwn(caps,table))throw Error('This import cannot be previewed safely.')
  let chain=client.from(table) as unknown as Chain,selected='',scan=false,filters=false
  const proxy=new Proxy({}, {get(_target,key){
   if(key==='then')return (resolve:(value:ReadResult)=>unknown,reject:(cause:unknown)=>unknown)=>{
    const run=async()=>{
     if(++queries>120||Date.now()>=deadline)throw Error('The preview took too long. Try again shortly.')
     const result=await (chain as unknown as {abortSignal:(signal:AbortSignal)=>PromiseLike<ReadResult>}).abortSignal(AbortSignal.timeout(Math.min(12000,deadline-Date.now())))
     if(result.error)throw Error('Current records could not be compared. Try previewing again.')
     const rows=Array.isArray(result.data)?result.data:result.data?[result.data]:[]
     if(!scan&&rows.length>caps[table])throw Error('This import is too large to compare here. Open Data Assist.')
     if(table==='matches'&&selected.includes('home_team')&&rows.length)parentExists=true
     // The legacy 5,000-player matching sample is not evidence about unrelated records.
     if(!scan)evidence.push(stableReviewValue({table,selected,rows:rows.map(stableReviewValue).sort()}))
     return result
    }
    return run().then(resolve,reject)
   }
   if(typeof key!=='string'||!allowed.has(key))throw Error('The import preview is read-only.')
   return (...args:unknown[])=>{
    if(key==='select'){selected=String(args[0]);scan=table==='players'&&selected.replace(/\s/g,'')==='id,name,normalized_name';chain=chain.select(...args).limit(scan?5000:caps[table]+1)}
    else if(key==='limit'){chain=chain.limit(Math.min(Number(args[0]),scan?5000:caps[table]+1))}
    else {if(['eq','in','like','ilike','or'].includes(key))filters=true;chain=chain[key](...args)}
    // Keep the scan flag tied to the exact legacy unfiltered player lookup.
    if(scan&&filters)scan=false
    return proxy
   }
  }})
  return proxy
 }
 return {client:{from} as unknown as SupabaseClient,evidence,parentExists:()=>parentExists}
}
export async function previewImportReview(input:{supabase:SupabaseClient;parsedDraft:DataAssistScorecardParsedDraft|DataAssistTeamSummaryParsedDraft;batchId:string;draftId:string;reviewedBy:string}):Promise<ImportReviewImpact>{
 const reader=createImportPreviewReader(input.supabase),args={...input,supabase:reader.client,action:'preview' as const}
 let impact:Omit<ImportReviewImpact,'revision'>
 if('draftKind' in input.parsedDraft&&input.parsedDraft.draftKind==='team_summary'){
  const result=await runDataAssistTeamSummaryImportAction({...args,parsedDraft:input.parsedDraft})
  const counts=result.importResult?.result
  if(!result.ok||!counts||counts.failedCount||counts.totalPlayers!==input.parsedDraft.players.length)throw Error('The roster could not be validated. Check its details and try previewing again.')
  impact={kind:'team_summary',newCount:counts.createdCount,updateCount:counts.updatedCount,duplicateCount:0,courtCount:0,preservedPlayers:result.refreshComparison?.preservedPlayerNames.length||0,preservedDetails:result.refreshComparison?.preservedDetailCount||0,playerMatches:[]}
 }else{
  const result=await runDataAssistScorecardImportAction({...args,parsedDraft:input.parsedDraft as DataAssistScorecardParsedDraft})
  const preview=result.importPreview
  if(!result.ok||!preview||preview.unresolvedWinnerCount||result.importResult?.result.failedCount)throw Error('The scorecard could not be validated. Check its details and try previewing again.')
  const duplicate=preview.duplicateMatch?.hasChanges===false,existing=reader.parentExists()
  impact={kind:'scorecard',newCount:!existing?1:0,updateCount:existing&&!duplicate?1:0,duplicateCount:duplicate?1:0,courtCount:preview.row.lines.length,preservedPlayers:0,preservedDetails:0,playerMatches:preview.playerMappings.filter(m=>m.status!=='unknown'&&m.name!==m.matchedPlayerName).map(m=>({entered:m.name,recorded:m.matchedPlayerName}))}
  // Include resolved identities without time-varying reviewed_at/capture fields.
  reader.evidence.push(stableReviewValue(preview.playerMappings))
 }
 return {...impact,revision:createHash('sha256').update(stableReviewValue({owner:input.reviewedBy,batch:input.batchId,draft:input.draftId,parsed:input.parsedDraft,impact,evidence:reader.evidence.sort()})).digest('hex')}
}

import type {SupabaseClient} from '@supabase/supabase-js'
import {buildDataAssistScorecardImportRow} from './data-assist-import'
import type {DataAssistScorecardParsedDraft} from './data-assist-ocr'
import type {ImportCourtReviewIssue} from './data-assist-court-review-issue'
export class ImportCourtCoverageError extends Error{
 constructor(readonly issue:ImportCourtReviewIssue){super('Complete the saved courts before importing. Check each court against your source file.')}
}
/** The legacy importer replaces every child court. An incomplete read must not remove saved courts. */
export async function assertScorecardCourtCoverage(client:SupabaseClient,draft:DataAssistScorecardParsedDraft){
 if(!/^\d{10}$/.test(draft.externalMatchId))throw Error('Check the scorecard match ID.')
 const prefix=draft.externalMatchId+'::line:',incoming=buildDataAssistScorecardImportRow(draft).row.lines
 const result=await client.from('matches').select('id,external_match_id,line_number,match_type').like('external_match_id',prefix+'%').limit(11)
 if(result.error||!Array.isArray(result.data)||result.data.length>10)throw Error('Saved courts could not be compared safely.')
 const seen=new Set<number>(),courts:ImportCourtReviewIssue['courts']=[]
 for(const row of result.data){
  const number=Number(row?.line_number)
  if(!row||typeof row.external_match_id!=='string'||row.external_match_id!==prefix+number||!Number.isInteger(number)||number<1||number>10||seen.has(number)||!['singles','doubles'].includes(row.match_type))throw Error('Saved courts could not be compared safely.')
  seen.add(number)
  const found=incoming.find(line=>line.lineNumber===number)
  if(!found||found.matchType!==row.match_type)courts.push({number,type:row.match_type,reason:found?'type_changed':'missing'})
 }
 if(courts.length)throw new ImportCourtCoverageError({courts:courts.sort((a,b)=>a.number-b.number)})
}

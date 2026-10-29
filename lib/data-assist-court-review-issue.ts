/** Court identities only. Never include source text, player names or private records. */
export type ImportCourtReviewIssue={courts:Array<{number:number;type:'singles'|'doubles';reason:'missing'|'type_changed'}>}
export function readImportCourtReviewIssue(value:unknown):ImportCourtReviewIssue|null{
 if(!value||typeof value!=='object'||!('courts' in value)||!Array.isArray(value.courts)||value.courts.length<1||value.courts.length>10)return null
 const courts:ImportCourtReviewIssue['courts']=[],seen=new Set<number>()
 for(const row of value.courts){
  if(!row||typeof row!=='object'||!Number.isInteger(row.number)||row.number<1||row.number>10||seen.has(row.number)||!['singles','doubles'].includes(row.type)||!['missing','type_changed'].includes(row.reason))return null
  seen.add(row.number);courts.push({number:row.number,type:row.type,reason:row.reason})
 }
 return {courts:courts.sort((a,b)=>a.number-b.number)}
}

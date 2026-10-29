/** Safe, bounded preview receipt shared with the bundled app. No contacts or raw source. */
export type ImportReviewImpact={kind:'scorecard'|'team_summary';revision:string;newCount:number;updateCount:number;duplicateCount:number;courtCount:number;preservedPlayers:number;preservedDetails:number;playerMatches:Array<{entered:string;recorded:string}>}
export function readImportReviewImpact(value:unknown):ImportReviewImpact{
 const p=value as ImportReviewImpact
 if(!p||!['scorecard','team_summary'].includes(p.kind)||! /^[a-f0-9]{64}$/.test(p.revision)||!['newCount','updateCount','duplicateCount','courtCount','preservedPlayers','preservedDetails'].every(k=>Number.isSafeInteger(p[k as keyof ImportReviewImpact])&&Number(p[k as keyof ImportReviewImpact])>=0&&Number(p[k as keyof ImportReviewImpact])<=500)||!Array.isArray(p.playerMatches)||p.playerMatches.length>40||p.playerMatches.some(m=>!m||typeof m.entered!=='string'||typeof m.recorded!=='string'||m.entered.length>160||m.recorded.length>200))throw Error('The import preview could not be confirmed. Try previewing again.')
 return {kind:p.kind,revision:p.revision,newCount:p.newCount,updateCount:p.updateCount,duplicateCount:p.duplicateCount,courtCount:p.courtCount,preservedPlayers:p.preservedPlayers,preservedDetails:p.preservedDetails,playerMatches:p.playerMatches.map(m=>({entered:m.entered,recorded:m.recorded}))}
}

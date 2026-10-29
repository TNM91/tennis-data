import type {ImportCourtReviewIssue} from '../../lib/data-assist-court-review-issue'
import {importReviewValues,type ImportReviewSource,type ImportReviewEdits,type ImportReviewAddedRows} from '../../lib/data-assist-review-corrections'
/** Prefill identities only; the user supplies players, scores and winners from their file. */
export function missingCourtRows(issue:ImportCourtReviewIssue,base:ImportReviewSource,edits:ImportReviewEdits,added:ImportReviewAddedRows):ImportReviewAddedRows{
 if(base.kind!=='scorecard'||issue.courts.some(c=>c.reason==='type_changed'))return []
 const values=importReviewValues(base,edits,added),numbers=new Set(values.rows.map(row=>Number(/^(\d+)/.exec(row.lineLabel)?.[1])))
 const missing=issue.courts.filter(c=>c.reason==='missing'&&!numbers.has(c.number))
 if(values.rows.length+missing.length>10)return []
 return missing.map(c=>({lineLabel:c.number+' '+(c.type==='singles'?'Singles':'Doubles'),homePlayers:'',awayPlayers:'',score:'',winner:''}))
}
export function importCourtIssueHtml(issue:ImportCourtReviewIssue,canAdd:boolean){
 const changed=issue.courts.some(c=>c.reason==='type_changed')
 return '<section class="import-impact"><h3 tabindex="-1" data-import-impact-heading>Complete the saved courts</h3><p>Saved results have not changed. Check these courts against your original file.</p><ul>'+issue.courts.map(c=>'<li>Court '+c.number+' · '+(c.type==='singles'?'Singles':'Doubles')+' — '+(c.reason==='missing'?'missing from this read':'different court type in this read')+'</li>').join('')+'</ul>'+(changed?'<p>The court types differ from saved results. Open Data Assist below to finish this scorecard before importing.</p>':'<p>Fill in the missing courts with the players, scores and winners from your file, then preview again.</p>')+(canAdd?'<button type="button" class="secondary" data-import-missing-courts>Add missing court details</button>':'')+'</section>'
}

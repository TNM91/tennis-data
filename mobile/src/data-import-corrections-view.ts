import {importReviewProblem,importReviewValues,type ImportReviewSource,type ImportReviewEdits} from '../../lib/data-assist-review-corrections'
import {html} from './match-details'
const names:Record<string,string>={externalMatchId:'Match ID',matchDate:'Match date',homeTeam:'Home team',awayTeam:'Visiting team',rosterTeamName:'Roster team',leagueName:'League',flight:'Flight',name:'Player name',teamName:'Player team',ntrp:'Recorded NTRP',homePlayers:'Home players',awayPlayers:'Visiting players',score:'Court score',winner:'Winning team'}
function dateInput(value:string){const m=/^(\d{1,2})\/(\d{1,2})\/(20\d{2})$/.exec(value);return m?`${m[3]}-${m[1].padStart(2,'0')}-${m[2].padStart(2,'0')}`:value}
function control(key:string,value:string,base:ImportReviewSource){
 const field=key.split('.').at(-1)!,label=names[field]||field,attr=' data-review-field="'+key+'"'
 let input:string
 if(field==='winner')input='<select'+attr+'><option value="">Choose winner</option>'+['home','away'].map(side=>'<option value="'+side+'" '+(side===value?'selected':'')+'>'+html((side==='home'?'Home · ':'Visiting · ')+(base.fields[side==='home'?'homeTeam':'awayTeam']||'Team'))+'</option>').join('')+'</select>'
 else if(field==='ntrp')input='<select'+attr+'><option value="">Choose NTRP</option>'+Array.from({length:13},(_,i)=>1+i*.5).map(n=>'<option value="'+n+'" '+(String(n)===value?'selected':'')+'>'+n.toFixed(1)+'</option>').join('')+'</select>'
 else if(field.endsWith('Players'))input='<textarea rows="2" maxlength="321"'+attr+'>'+html(value)+'</textarea><small>One player per line.</small>'
 else input='<input'+attr+' type="'+(field==='matchDate'?'date':'text')+'" '+(field==='matchDate'?'min="2000-01-01" max="2099-12-31"':field==='externalMatchId'?'inputmode="numeric" maxlength="10"':'maxlength="'+(field==='score'||field==='name'?160:500)+'"')+' value="'+html(field==='matchDate'?dateInput(value):value)+'">'
 return '<label>'+label+input+'</label>'
}
function valueTeam(base:ImportReviewSource,edits:ImportReviewEdits,key:string){return edits[key]||base.fields[key]}
export function importCorrectionChanges(base:ImportReviewSource,edits:ImportReviewEdits){
 const changes:string[]=[]
 for(const [key,v] of Object.entries(edits)){
  const match=/^rows\.(\d+)\.([a-zA-Z]+)$/.exec(key),before=match?base.rows[Number(match[1])][match[2]]:base.fields[key]
  if(v.trim()===before.trim())continue
  const title=(match?(base.kind==='scorecard'?base.rows[Number(match[1])].lineLabel:'Player '+(Number(match[1])+1))+' · ':'')+(names[match?.[2]||key]||key)
  const show=(text:string)=>match?.[2]==='winner'?(text==='home'?'Home · '+valueTeam(base,edits,'homeTeam'):text==='away'?'Visiting · '+valueTeam(base,edits,'awayTeam'):'Not confirmed'):text||'Not recorded'
  changes.push('<li><strong>'+html(title)+'</strong><span>'+html(show(before))+' → '+html(show(v))+'</span></li>')
 }
 return changes.length?'<h4>Changes to confirm</h4><ul>'+changes.join('')+'</ul>':'<p>No corrections made.</p>'
}
export function importCorrectionsHtml(base:ImportReviewSource,edits:ImportReviewEdits={}){
 const value=importReviewValues(base,edits),problem=importReviewProblem(base,edits)
 return '<section class="import-corrections"><h3 tabindex="-1" data-review-heading>Check '+(base.kind==='scorecard'?'scorecard':'roster')+' details</h3><p>Correct only what differs from your original file. Changes stay here until you confirm the import. Refreshing or closing discards them.</p>'+(base.kind==='team_summary'?'<p>Recorded NTRP comes from your roster. Corrected ratings are marked self-rated; TIQ ratings are calculated separately. Contact details stay private.</p>':'<p>Keep scores in the source file’s order and choose the winning team for each court.</p>')+'<fieldset><legend>'+(base.kind==='scorecard'?'Match':'Team')+'</legend>'+Object.entries(value.fields).map(([key,v])=>control(key,v,base)).join('')+'</fieldset>'+value.rows.map((row,i)=>'<details class="import-correction-row"><summary>'+html(base.kind==='scorecard'?row.lineLabel:row.name||'Player '+(i+1))+'</summary><fieldset><legend>'+(base.kind==='scorecard'?'Court details':'Player details')+'</legend>'+Object.entries(row).filter(([key])=>key!=='lineLabel').map(([key,v])=>control('rows.'+i+'.'+key,v,base)).join('')+'</fieldset></details>').join('')+'<div data-review-changes>'+importCorrectionChanges(base,edits)+'</div><p role="status" data-review-status>'+html(problem||'Details are ready. Check the source file, then confirm below.')+'</p><button type="button" class="secondary" data-review-reset>Reset corrections</button></section>'
}
export function wireImportCorrections(host:HTMLElement,base:ImportReviewSource,edits:ImportReviewEdits){
 host.querySelectorAll<HTMLInputElement|HTMLTextAreaElement|HTMLSelectElement>('[data-review-field]').forEach(input=>{
  const key=input.dataset.reviewField!,match=/^rows\.(\d+)\.([a-zA-Z]+)$/.exec(key),original=match?base.rows[Number(match[1])][match[2]]:base.fields[key]
  input.addEventListener('input',()=>{
   if(input.value===(key==='matchDate'?dateInput(original):original))delete edits[key];else edits[key]=input.value
   const consent=host.querySelector<HTMLInputElement>('[data-import-consent]');if(consent)consent.checked=false
   host.querySelectorAll<HTMLButtonElement>('[data-import-action=confirmed]').forEach(b=>b.disabled=true)
   const problem=importReviewProblem(base,edits),status=host.querySelector('[data-review-status]'),changes=host.querySelector('[data-review-changes]')
   if(status)status.textContent=problem||'Details are ready. Check the source file, then confirm below.'
   if(changes)changes.innerHTML=importCorrectionChanges(base,edits)
  })
 })
}

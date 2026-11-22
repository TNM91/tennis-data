import type {SupabaseClient} from '@supabase/supabase-js'
import type {NativeCoachStudent, NativeCoachSnapshot} from '../../lib/native-coach-contract'
import {readCoachCreate} from '../../lib/native-coach-contract'
import type {CoachAssessment} from '../../lib/native-coach-assessment-contract'
import type {TiqHistory} from '../../lib/tiq-self-assessment'
import {tiqSkills, tiqSkillLevels} from '../../lib/tiq-assessment-skills'
import type {PracticeBlock} from '../../lib/tiq-growth'
import {loadTiqAccount} from './tiq-account-data'
import {loadCoachAssessments} from './coach-assessments-data'
import {assignCoachPractice, type CoachSend} from './coach-workspace-data'
import {bindPracticeSkill, defaultPracticeBlock, practiceBlockDraft, practiceBlockFields, practiceBlockFrom} from './tiq-growth-view'
import {html} from './match-details'
import {tiqAssessmentChoiceLabel} from './tiq-assessment-label'
import {coachAssessmentChoiceLabel} from './coach-assessment-label'

export function openTiqCoachAlignment(client: SupabaseClient, owner: string, current: () => boolean, trigger: HTMLElement,
  options: {student?: NativeCoachStudent; assigned?: (snapshot:NativeCoachSnapshot)=>void}, send?: CoachSend) {
  const dialog=document.createElement('dialog');dialog.className='captain-lineup-dialog coach-workspace-dialog tiq-alignment-dialog';dialog.setAttribute('aria-label','Player and coach view')
  let disposed=false,busy=false,dirty=false,leaving=false,attempted=false,notice='',lastHeading='',history:TiqHistory|null=null,observations:CoachAssessment[]=[],selfId='',coachId=''
  let view:'compare'|'plan'|'confirm'='compare',block:PracticeBlock=defaultPracticeBlock(),draft:Extract<ReturnType<typeof readCoachCreate>,{kind:'assignment'}>|null=null,latest:NativeCoachSnapshot|null=null
  const blockNames=['skill','target','sessions','reviewDate'] as const
  let blockValues:Record<string,string>|null=null,blockFocus:typeof blockNames[number]|null=null
  const active=()=>!disposed&&current()
  function clearBlock(){block=defaultPracticeBlock();blockValues=null;blockFocus=null;draft=null}
  function restoreBlockFocus(){if(!active())return;const selector=view==='plan'?'[data-block] [name="'+(blockFocus??'target')+'"]':view==='confirm'?'[data-assign]':'[data-plan]';const target=dialog.querySelector<HTMLElement>(selector);target?.focus({preventScroll:true});target?.scrollIntoView({block:'nearest'})}
  function keepEditing(){if(!active()||busy)return;leaving=false;render();restoreBlockFocus()}
  function dispose(){if(disposed)return;disposed=true;history=null;observations=[];clearBlock();dialog.close();dialog.remove();if(current()&&trigger.isConnected)trigger.focus();if(current()&&latest)options.assigned?.(latest)}
  function back(){if(!active()||busy)return true;if(leaving){keepEditing();return true}if(dirty){leaving=true;render();return true}if(view!=='compare'){view='compare';clearBlock();render();restoreBlockFocus();return true}dispose();return true}
  async function load(){if(busy)return;busy=true;history=null;observations=[];notice='Loading shared assessments…';render()
    try{const [page,rows]=await Promise.all([loadTiqAccount(client,owner,active,{student:options.student?.id},send),loadCoachAssessments(client,owner,active,options.student?.id??null,send)]);if(!active())return;history=page;observations=rows;selfId=page.items.some(x=>x.id===selfId)?selfId:page.items[0]?.id??'';coachId=rows.some(x=>x.id===coachId)?coachId:rows[0]?.id??'';notice=''}
    catch{history=null;observations=[];notice='Assessments couldn’t load. Refresh to check the current coach connection.'}finally{if(active()){busy=false;render()}}}
  async function assign(){if(!active()||!draft||busy)return;busy=true;attempted=true;notice='Assigning practice block…';render();try{latest=await assignCoachPractice(client,owner,active,draft,send);if(active()){dirty=false;attempted=false;clearBlock();view='compare';notice='Practice block assigned. The player can adopt it in My improvement plan.'}}catch(error){notice=(error instanceof Error?error.message:'Assignment wasn’t confirmed.')+' Retry this same block to check it.'}finally{if(active()){busy=false;render()}}}
  function render(){if(!active())return
    const assessments=history?.items??[]
    const self=assessments.find(row=>row.id===selfId),coach=observations.find(row=>row.id===coachId),student=options.student
    let body=''
    if(leaving)body='<p>Your unsent practice block will be discarded. If you already tried assigning it, refresh the student’s assignments to check whether it saved.</p><button type="button" data-keep>Keep editing</button><button type="button" class="secondary" data-discard>Discard edits</button>'
    else if(view==='plan')body=`<p>Give ${html(student?.name??'your player')} one measurable focus. Their assessment and practice logs remain private unless they share them.</p><form data-block>${practiceBlockFields(block)}<button type="submit">Review practice block</button></form>`
    else if(view==='confirm'&&draft)body=`<h3>${html(draft.title)}</h3><p>${html(draft.tiqGrowth!.target)}</p><p>${draft.tiqGrowth!.sessions} practices · Review ${html(draft.dueDate!)}</p><p>Shares this assignment with ${html(student?.name??'your player')}. It does not change their TiQ.</p><button type="button" data-assign ${busy?'disabled':''}>${notice?'Retry same practice block':'Assign practice block'}</button>`
    else body=`<p>Compare how the player sees their game with what a coach observed. Different dates and court situations can explain different answers.</p>${history?`
      <label>Player self-assessment<select data-self ${self?'aria-describedby="tiq-alignment-player-context"':''} ${busy?'disabled':''}><option value="">${student?'No shared self-assessment':'No saved self-assessment'}</option>${assessments.map(row=>`<option value="${row.id}" ${row.id===selfId?'selected':''}>${html(tiqAssessmentChoiceLabel(row,assessments))}</option>`).join('')}</select></label>
      ${student?'<p>Only assessments the player has shared with you appear here.</p>':''}
      <label>Coach observation<select data-coach ${coach?'aria-describedby="tiq-alignment-coach-context"':''} ${busy?'disabled':''}><option value="">No shared coach observation</option>${observations.map(row=>`<option value="${row.id}" ${row.id===coachId?'selected':''}>${html(coachAssessmentChoiceLabel(row,observations))}</option>`).join('')}</select></label>
      ${self||coach?`<p class="tiq-alignment-context">${self?`<span id="tiq-alignment-player-context"><strong>Player:</strong> ${html(tiqAssessmentChoiceLabel(self,assessments))}<br>Saved ${html(new Date(self.createdAt).toLocaleString())}</span>`:''}${self&&coach?'<br>':''}${coach?`<span id="tiq-alignment-coach-context"><strong>Coach observation:</strong> ${html(coachAssessmentChoiceLabel(coach,observations))}<br>Recorded ${html(new Date(coach.createdAt).toLocaleString())}</span>`:''}</p>`:''}
      ${self&&coach?`<div class="tiq-alignment-table" role="table" aria-label="Player and coach skill comparison"><div role="row"><span role="columnheader">Skill</span><span role="columnheader">Player</span><span role="columnheader">Coach</span></div>${tiqSkills.map(skill=>{const observed=coach.observation.skills[skill.id];return `<div role="row"><strong role="rowheader">${skill.skill}</strong><span role="cell">${tiqSkillLevels[self.answers[skill.id]]}</span><span role="cell">${observed===undefined?'Not observed':tiqSkillLevels[observed]}</span></div>`}).join('')}</div>
        <p>${tiqSkills.filter(s=>coach.observation.skills[s.id]===self.answers[s.id]).length} matching · ${tiqSkills.filter(s=>coach.observation.skills[s.id]!==undefined&&coach.observation.skills[s.id]!==self.answers[s.id]).length} different · ${tiqSkills.filter(s=>coach.observation.skills[s.id]===undefined).length} not observed</p><p>These are observations, not a verified rating. Discuss a difference and use a court check to choose what to practise.</p>`:'<p>Select a player assessment and a coach observation to compare the six skills.</p>'}
      ${coach?.observation.note?`<p class="coach-written">${html(coach.observation.note)}</p>`:''}
      ${coach?.observation.focus?`<p><strong>Coach’s practice priority:</strong> ${html(tiqSkills.find(s=>s.id===coach.observation.focus)!.skill)}</p>`:''}
      ${student?.linked&&student.status!=='paused'?'<button type="button" data-plan>Plan practice block</button>':''}
      ${history.next?'<button type="button" class="secondary" data-earlier>Load earlier self-assessments</button>':''}<p>Coach observations show the latest 12 shared assessments.</p>`:''}`
    dialog.innerHTML=`<header class="coach-workspace-header"><small>${student?html(student.name):'Your TiQ'}</small><h2 tabindex="-1">${leaving?'Leave practice block?':view==='compare'?'Player & coach view':view==='plan'?'Plan practice block':'Review practice block'}</h2><button type="button" class="secondary" data-close ${busy?'disabled':''}>Close</button></header>${body}<p role="status">${html(notice)}</p>${view==='compare'&&!leaving?`<button type="button" class="secondary" data-refresh ${busy?'disabled':''}>Refresh shared assessments</button>`:!leaving?`<button type="button" class="secondary" data-back ${busy||attempted?'disabled':''}>Back</button>`:''}`
    const on=(selector:string,fn:()=>void)=>dialog.querySelector(selector)?.addEventListener('click',()=>{if(active())fn()})
    on('[data-close]',back);on('[data-back]',()=>{if(busy||attempted)return;if(draft){draft=null;view='plan';render();restoreBlockFocus()}else back()});on('[data-keep]',keepEditing);on('[data-discard]',()=>{if(busy)return;dirty=false;leaving=false;attempted=false;clearBlock();view='compare';notice='';render();restoreBlockFocus()})
    on('[data-refresh]',()=>{void load()});on('[data-assign]',()=>{void assign()})
    for(const [selector,change] of [['[data-self]',(v:string)=>{selfId=v}],['[data-coach]',(v:string)=>{coachId=v}]] as const){const select=dialog.querySelector<HTMLSelectElement>(selector);if(select)select.onchange=()=>{change(select.value);render();dialog.querySelector<HTMLElement>(selector)?.focus()}}
    on('[data-plan]',()=>{if(busy)return;clearBlock();const skill=tiqSkills.find(s=>s.id===coach?.observation.focus);if(skill)block={...block,skill:skill.id,target:skill.target};view='plan';notice='';render()})
    const form=dialog.querySelector<HTMLFormElement>('[data-block]');if(form){
      const control=(name:typeof blockNames[number])=>form.querySelector<HTMLInputElement|HTMLTextAreaElement|HTMLSelectElement>('[name="'+name+'"]')!
      if(blockValues)for(const name of blockNames)control(name).value=blockValues[name]
      form.addEventListener('focusin',event=>{if(!active())return;const target=event.target;if(target instanceof HTMLInputElement||target instanceof HTMLTextAreaElement||target instanceof HTMLSelectElement){const name=blockNames.find(name=>name===target.name);if(name)blockFocus=name}})
      const capture=()=>{if(!active()||busy||leaving)return;blockValues=Object.fromEntries(blockNames.map(name=>[name,control(name).value]));dirty=true;block=practiceBlockDraft(form)}
      form.oninput=capture;form.onchange=capture
      form.onsubmit=e=>{e.preventDefault();if(!active()||busy||leaving||!student)return;capture();try{block=practiceBlockFrom(form);const skill=tiqSkills.find(s=>s.id===block.skill)!;const parsed=readCoachCreate({kind:'assignment',id:crypto.randomUUID(),student:student.id,expectedUpdatedAt:student.updatedAt,title:skill.skill+' practice block',focus:skill.skill,dueDate:block.reviewDate,instructions:block.target,evidence:'Bring your practice count and court results.',status:'assigned',assessmentDrill:skill.id,tiqGrowth:block});if(parsed.kind==='assignment'){draft=parsed;dirty=true;view='confirm';notice='';render()}}catch(error){notice=(error as Error).message;dialog.querySelector('[role=status]')!.textContent=notice}}
    }
    on('[data-earlier]',()=>{if(!history?.next||busy)return;busy=true;render();void loadTiqAccount(client,owner,active,{student:student?.id,cursor:history.next},send).then(page=>{if(active()&&history)history={...history,items:[...history.items,...page.items.filter(row=>!history!.items.some(old=>old.id===row.id))],next:page.next}}).catch(()=>{notice='Earlier assessments couldn’t load.'}).finally(()=>{if(active()){busy=false;render()}})})
    if(form)bindPracticeSkill(form)
    const heading=dialog.querySelector<HTMLElement>('h2')!;if(dialog.open&&heading.textContent!==lastHeading){lastHeading=heading.textContent??'';dialog.scrollTop=0;heading.focus({preventScroll:true})}
  }
  dialog.oncancel=e=>{e.preventDefault();back()};document.body.append(dialog);dialog.showModal();void load()
  return {dispose,back,isOpen:()=>!disposed}
}

import type {SupabaseClient} from '@supabase/supabase-js'
import {growthCheckIn, growthReady, growthReminderCalendar, readGrowthWrite, readPracticeBlock, type GrowthSnapshot, type GrowthWrite, type PracticeBlock} from '../../lib/tiq-growth'
import {tiqSkills, tiqSkillLevels} from '../../lib/tiq-assessment-skills'
import type {TiqHistory} from '../../lib/tiq-self-assessment'
import type {CoachSend} from './coach-workspace-data'
import {loadTiqAccount} from './tiq-account-data'
import {clearGrowth, GrowthError, loadGrowth, pendingGrowth, rememberGrowth, writeGrowth} from './tiq-growth-data'
import {growthDay} from './coach-growth-overview'
import {html} from './match-details'
import {cancelCoachFile, exportCoachFile} from './native-coach-files'
import {loadTrainingCoachWork, type TrainingCoachWork} from './training-inbox-data'
import {openCoachCheckIn} from './coach-check-in-view'

export function practiceBlockFields(block: PracticeBlock) {
  return `<label>Skill<select name="skill">${tiqSkills.map(skill => `<option value="${skill.id}" ${block.skill === skill.id ? 'selected' : ''}>${skill.skill}</option>`).join('')}</select></label>
    <label>Measurable target<textarea name="target" rows="3" maxlength="240" required>${html(block.target)}</textarea></label>
    <div class="tiq-growth-fields"><label>Practices<input name="sessions" type="number" min="1" max="12" value="${block.sessions}" required></label><label>Review date<input name="reviewDate" type="date" value="${block.reviewDate}" required></label></div>`
}
export function defaultPracticeBlock(): PracticeBlock {
  const date = new Date(); date.setDate(date.getDate()+7)
  return {version:1, skill:'serve', target:tiqSkills[0].target, sessions:3, reviewDate:growthDay(date)}
}
export function practiceBlockFrom(form: HTMLFormElement) {
  return readPracticeBlock(practiceBlockDraft(form))
}
export function practiceBlockDraft(form: HTMLFormElement): PracticeBlock {
  const data = new FormData(form)
  return {version:1, skill:String(data.get('skill')) as PracticeBlock['skill'], target:String(data.get('target')), sessions:Number(data.get('sessions')), reviewDate:String(data.get('reviewDate'))}
}
export function bindPracticeSkill(form: HTMLFormElement) {
  const select=form.querySelector<HTMLSelectElement>('[name=skill]')!,target=form.querySelector<HTMLTextAreaElement>('[name=target]')!
  let previous=select.value
  select.addEventListener('change',()=>{
    if(target.value===tiqSkills.find(s=>s.id===previous)?.target){target.value=tiqSkills.find(s=>s.id===select.value)!.target;target.dispatchEvent(new Event('input',{bubbles:true}))}
    previous=select.value
  })
}
export function openGrowthPlan(client: SupabaseClient, owner: string, current: () => boolean, trigger: HTMLElement,
  options: {retake: () => void; drill: (id: string) => void}, send?: CoachSend) {
  const dialog = document.createElement('dialog'); dialog.className = 'captain-lineup-dialog coach-workspace-dialog tiq-growth-dialog'; dialog.setAttribute('aria-label','My improvement plan')
  let disposed = false, busy = false, dirty = false, leaving = false, view: 'plan'|'new'|'confirm' = 'plan', notice = '', generation = 0
  let snapshot: GrowthSnapshot | null = null, ratings: TiqHistory | null = null, work: TrainingCoachWork | null = null, workError = false
  let draft: GrowthWrite | null = null, pending: GrowthWrite | null = null, fields = defaultPracticeBlock(), baseline = '', source: string | null = null
  let checkIn: ReturnType<typeof openCoachCheckIn> | null = null
  let logDate=growthDay(),logNote=''
  let lastHeading=''
  let leaveAction:(()=>void)|null=null
  let pendingCorrupt=false
  const active = () => !disposed && current()
  function dispose() {if(disposed)return; disposed=true; generation++; checkIn?.dispose(); void cancelCoachFile(owner); snapshot=null;ratings=null;work=null;draft=null;pending=null;dialog.close();dialog.remove();if(current()&&trigger.isConnected)trigger.focus({preventScroll:true})}
  function back() {
    if (checkIn?.isOpen()) {checkIn.back(); return true}
    if(busy)return true
    if(leaving){leaving=false;leaveAction=null;render();return true}
    if(dirty||view==='confirm'){leaving=true;render();return true}
    if(view==='new'){view='plan';render();return true}
    dispose();return true
  }
  async function load(id: string | null = null) {
    if(busy||!active())return
    const visit=++generation;busy=true;snapshot=null;ratings=null;work=null;workError=false;notice='Loading your plan…';render()
    try {
      pendingCorrupt=false
      const [plan, history, saved] = await Promise.all([loadGrowth(client,owner,active,id,send),loadTiqAccount(client,owner,active,{},send),pendingGrowth(owner).catch(()=>{pendingCorrupt=true;return null})])
      if(!active()||visit!==generation)return
      snapshot=plan;ratings=history;pending=saved;notice=saved?'An update needs confirmation. Retry it before changing this plan.':pendingCorrupt?'Device retry details couldn’t load. Discard those retry details and refresh your account plan before editing.':''
      baseline=history.head?.id??''
      try {work=await loadTrainingCoachWork(client,owner,active,send?o=>send('GET',o):undefined)} catch {workError=true}
    } catch(error) {snapshot=null;ratings=null;notice=error instanceof Error?error.message:'Your plan couldn’t load.'}
    finally {if(active()&&visit===generation){busy=false;render()}}
  }
  async function save() {
    const write=pending??draft
    if(!write||busy||!active())return
    busy=true;notice='Saving your plan…';render()
    try {
      await rememberGrowth(owner,write);pending=write
      await writeGrowth(client,owner,active,write,send)
      if(!active())return
      await clearGrowth(owner);pending=null;draft=null;dirty=false;logNote='';logDate=growthDay();view='plan';busy=false
      await load(write.id)
    } catch(error) {if(active()){busy=false;notice=(error instanceof GrowthError?error.message:'Save wasn’t confirmed.')+' Retry the same update to check it.';render()}}
  }
  const selectWrite = (write: GrowthWrite) => {draft=readGrowthWrite(write);view='confirm';dirty=true;notice='';render()}
  async function sendCheckIn() {
    const plan=snapshot?.selected;if(!plan?.sourceAssignment||busy)return
    busy=true;notice='Checking your coach assignment…';render()
    try {
      const fresh=await loadTrainingCoachWork(client,owner,active,send?o=>send('GET',o):undefined)
      if(!active())return
      const assignment=fresh.assignments.find(a=>a.id===plan.sourceAssignment&&a.status==='assigned'),link=fresh.links.find(l=>l.id===assignment?.studentLinkId&&l.status!=='paused')
      if(!assignment||!link)throw Error('This assignment is no longer open. Your private plan is still saved.')
      busy=false;notice='';render()
      checkIn=openCoachCheckIn(client,owner,active,assignment,link,()=>{if(active())void load(plan.id)},undefined,growthCheckIn(plan))
    }catch(error){if(active()){busy=false;notice=error instanceof Error?error.message:'Coach assignment unavailable.';render()}}
  }
  function render() {
    if(!active())return
    const proposed=draft?.kind==='new'?draft.block:null
    const plan=snapshot?.selected, skill=tiqSkills.find(s=>s.id===plan?.skill), locked=busy||Boolean(pending)||pendingCorrupt
    let body=''
    if(leaving)body='<p>Your unsaved edits will be discarded. An update already sent may still be saved in your account.</p><button type="button" data-keep>Keep editing</button><button type="button" class="secondary" data-leave>Leave plan</button>'
    else if(view==='new')body=`<p>Choose one skill, a court target and when to review it. Only you can see this plan.</p>${source?'<p>Using your coach’s practice block. Your assessment and practice logs stay private.</p>':''}
      <form data-new><label>Starting assessment<select name="baseline" required>${ratings?.items.map(row=>`<option value="${row.id}" ${baseline===row.id?'selected':''}>Self-assessment · ${html(row.date)}</option>`).join('')}</select></label>
      ${practiceBlockFields(fields)}<button type="submit" ${locked?'disabled':''}>Review plan</button></form>`
    else if(view==='confirm'&&draft)body=draft.kind==='new'?`<h3>${html(tiqSkills.find(s=>s.id===proposed?.skill)?.skill??'Practice')}</h3><p>${html(draft.block.target)}</p><p>${draft.block.sessions} practices · Review ${html(draft.block.reviewDate)}</p><p>Your baseline and logs stay private. Practice completion does not change your TiQ.</p><button type="button" data-save ${busy?'disabled':''}>Save improvement plan</button>`
      :`<p>${draft.kind==='log'?`Log practice on ${html(draft.session.date)}?` : draft.kind==='archive'?'Archive this plan? Your saved practice history stays in your account.':'Finish this plan with the selected new self-assessment? Practice alone does not increase your TiQ.'}</p>${draft.kind==='log'?`<p class="coach-written">${html(draft.session.note)}</p>`:''}<button type="button" data-save ${busy?'disabled':''}>Confirm ${draft.kind==='log'?'practice':draft.kind==='archive'?'archive':'review'}</button>`
    else if(snapshot) {
      const activePlan=snapshot.plans.find(row=>row.state==='active')
      body=`${plan&&skill?`<section class="tiq-growth-focus"><small class="stat-eyebrow">${plan.state==='active'?'Your practice focus':plan.state==='reviewed'?'Reviewed plan':'Archived plan'}</small><h3>${skill.skill}</h3><p>${html(plan.target)}</p><p><strong>${plan.logs.length} / ${plan.sessions}</strong> practices · Review ${html(plan.reviewDate)}</p><progress max="${plan.sessions}" value="${Math.min(plan.logs.length,plan.sessions)}" aria-label="Planned practices completed"></progress>
        <p>Baseline · ${snapshot.baseline?`${html(snapshot.baseline.date)} · ${tiqSkillLevels[snapshot.baseline.answers[plan.skill]]}`:'Assessment removed'}</p>
        ${snapshot.reassessment?`<p>Review · ${html(snapshot.reassessment.date)} · ${tiqSkillLevels[snapshot.reassessment.answers[plan.skill]]}</p>`:''}
        ${growthReady(plan,growthDay())?'<p class="tiq-growth-due">Ready to review your progress. Retake the assessment after trying your court check.</p>':''}
        <button type="button" data-drill ${busy?'disabled':''}>Open ${skill.drill.title}</button></section>
        ${plan.state==='active'?`<form data-log><h3>Log a practice</h3><label>Practice date<input type="date" name="date" value="${growthDay()}" required></label><label>What happened on court?<textarea name="note" maxlength="160" rows="2" placeholder="For example: 7 of 10 second serves in"></textarea></label><button type="submit" ${locked||plan.logs.length>=24?'disabled':''}>Review practice log</button></form>
          <section><h3>Review your progress</h3><button type="button" class="secondary" data-retake ${locked?'disabled':''}>Retake self-assessment</button>
          <form data-review><label>New self-assessment<select name="assessment" required><option value="">Choose a new assessment</option>${ratings?.items.filter(row=>row.id!==plan.baseline&&Date.parse(row.createdAt)>Date.parse(plan.createdAt)).map(row=>`<option value="${row.id}">${html(row.date)}</option>`).join('')}</select></label><button type="submit" ${locked?'disabled':''}>Review completed plan</button></form></section>
          <details><summary>Review reminder</summary><p>Add one review to your calendar. Your calendar controls its alert.</p><label>Time<input type="time" data-time value="18:00"></label><button type="button" class="secondary" data-remind ${locked?'disabled':''}>Add review to calendar</button></details>
          ${plan.sourceAssignment?`<p>Your coach sees only the check-in you choose to send.</p><button type="button" class="secondary" data-checkin ${locked?'disabled':''}>Prepare coach check-in</button>`:''}
          <button type="button" class="secondary" data-archive ${locked?'disabled':''}>Archive plan</button>`:''}
        <details><summary>Practice history (${plan.logs.length})</summary>${plan.logs.map(log=>`<p><strong>${html(log.date)}</strong> · ${html(log.note||'Practice completed')}</p>`).join('')||'<p>No practices logged yet.</p>'}</details>`:'<p>Make your next practice count. Start with a saved assessment and one measurable court target.</p>'}
        ${!activePlan?`<button type="button" data-create ${locked||!ratings?.items.length?'disabled':''}>Create improvement plan</button>${!ratings?.items.length?'<button type="button" class="secondary" data-retake>Save a self-assessment first</button>':''}`:activePlan.id!==plan?.id?`<button type="button" class="secondary" data-select="${activePlan.id}">Open active plan</button>`:''}
        ${!activePlan&&work?`<details><summary>Coach practice blocks</summary>${work.assignments.filter(a=>a.status==='assigned'&&a.assignment.tiqGrowth&&work!.links.some(l=>l.id===a.studentLinkId&&l.status!=='paused')).map(a=>`<button type="button" class="secondary" data-adopt="${html(a.id)}">Use ${html(a.title)}</button>`).join('')||'<p>No open practice blocks from your coaches.</p>'}</details>`:''}
        ${workError?'<p>Coach practice blocks couldn’t load. Refresh to check them.</p>':''}
        <details><summary>Saved plans (${snapshot.plans.length}${snapshot.more?'+':''})</summary>${snapshot.plans.map(row=>`<button type="button" class="secondary" data-select="${row.id}">${html(tiqSkills.find(s=>s.id===row.skill)?.skill??'Practice')} · ${html(row.reviewDate)} · ${row.state} · ${row.completed} practices</button>`).join('')}${snapshot.more?'<p>Showing your latest 25 plans.</p>':''}</details>
        ${ratings?.next?'<button type="button" class="secondary" data-earlier>Load earlier self-assessments</button>':''}`
    }
    const heading=leaving?'Leave plan?':view==='new'?'Create improvement plan':view==='confirm'?'Review improvement plan':'My improvement plan'
    dialog.innerHTML=`<header class="coach-workspace-header"><small>Your TiQ</small><h2 tabindex="-1">${heading}</h2><button type="button" class="secondary" data-close ${busy?'disabled':''}>Close</button></header>${body}<p role="status">${html(notice)}</p>
      ${pending?`<button type="button" data-retry ${busy?'disabled':''}>Retry pending update</button>`:''}${pending||pendingCorrupt?`<button type="button" class="secondary" data-forget ${busy?'disabled':''}>Discard retry and refresh</button>`:''}${!leaving&&view==='plan'?`<button type="button" class="secondary" data-refresh ${busy?'disabled':''}>Refresh plan</button>`:!leaving?'<button type="button" class="secondary" data-edit>Back to plan</button>':''}`
    const button=(selector:string,action:()=>void)=>{dialog.querySelector(selector)?.addEventListener('click',action)}
    if(dirty&&view==='plan')dialog.querySelectorAll<HTMLButtonElement>('[data-drill],[data-retake],[data-refresh],[data-remind],[data-checkin],[data-archive],[data-select],[data-earlier]').forEach(b=>b.disabled=true)
    button('[data-close]',back);button('[data-keep]',()=>{leaving=false;leaveAction=null;render()});button('[data-leave]',()=>{const action=leaveAction;dispose();if(current())action?.()})
    button('[data-refresh]',()=>{void load(plan?.id??null)});button('[data-save]',()=>{void save()});button('[data-retry]',()=>{void save()})
    button('[data-forget]',()=>{void clearGrowth(owner).then(()=>{if(active()){pending=null;draft=null;dirty=false;view='plan';void load()}}).catch(()=>{notice='Retry details couldn’t be cleared.';render()})})
    button('[data-edit]',()=>{draft=null;dirty=false;view='plan';render()})
    button('[data-create]',()=>{fields=defaultPracticeBlock();source=null;view='new';render()})
    button('[data-retake]',()=>{dispose();options.retake()});button('[data-drill]',()=>{if(skill){dispose();options.drill(skill.drill.id)}})
    button('[data-checkin]',()=>{void sendCheckIn()})
    button('[data-archive]',()=>{if(plan)selectWrite({kind:'archive',id:plan.id,operation:crypto.randomUUID(),expected:plan.revision})})
    button('[data-remind]',()=>{if(!plan||busy)return;const time=dialog.querySelector<HTMLInputElement>('[data-time]')!.value;busy=true;notice='Preparing calendar review…';render();void Promise.resolve().then(()=>growthReminderCalendar(plan,time,owner)).then(ics=>exportCoachFile(owner,active,new Blob([ics],{type:'text/calendar'}),'tiq-progress-review.ics')).then(()=>{notice='Finish adding the review in your calendar. Your calendar controls the alert.'}).catch(error=>{notice=error instanceof Error?error.message:'Calendar export unavailable.'}).finally(()=>{if(active()){busy=false;render()}})})
    dialog.querySelectorAll<HTMLButtonElement>('[data-select]').forEach(b=>b.onclick=()=>{if(!busy&&!dirty)void load(b.dataset.select)})
    dialog.querySelectorAll<HTMLButtonElement>('[data-adopt]').forEach(b=>b.onclick=()=>{if(locked||!ratings?.items.length)return;const a=work?.assignments.find(a=>a.id===b.dataset.adopt);try{fields=readPracticeBlock(a?.assignment.tiqGrowth);source=a!.id;view='new';render();const form=dialog.querySelector<HTMLFormElement>('[data-new]')!;form.querySelectorAll<HTMLInputElement|HTMLTextAreaElement|HTMLSelectElement>('[name]:not([name=baseline])').forEach(el=>el.disabled=true)}catch{notice='This practice block is unavailable.';render()}})
    const form=dialog.querySelector<HTMLFormElement>('[data-new]')
    if(form)bindPracticeSkill(form)
    if(form){form.oninput=()=>{dirty=true;baseline=String(new FormData(form).get('baseline')??baseline);if(!source){const data=new FormData(form);fields={...fields,skill:String(data.get('skill')) as PracticeBlock['skill'],target:String(data.get('target')),sessions:Number(data.get('sessions')),reviewDate:String(data.get('reviewDate'))}}};form.onsubmit=e=>{e.preventDefault();try{selectWrite({kind:'new',id:crypto.randomUUID(),operation:crypto.randomUUID(),expected:null,baseline:String(new FormData(form).get('baseline')),sourceAssignment:source,block:source?fields:practiceBlockFrom(form)})}catch(error){notice=(error as Error).message;dialog.querySelector('[role=status]')!.textContent=notice}}}
    const log=dialog.querySelector<HTMLFormElement>('[data-log]');if(log){log.querySelector<HTMLInputElement>('[name=date]')!.value=logDate;log.querySelector<HTMLTextAreaElement>('[name=note]')!.value=logNote;log.oninput=()=>{dirty=true;const data=new FormData(log);logDate=String(data.get('date'));logNote=String(data.get('note'))};log.onsubmit=e=>{e.preventDefault();if(!plan)return;const data=new FormData(log);try{selectWrite({kind:'log',id:plan.id,operation:crypto.randomUUID(),expected:plan.revision,session:{id:crypto.randomUUID(),date:String(data.get('date')),note:String(data.get('note')).trim()}})}catch(error){notice=(error as Error).message;dialog.querySelector('[role=status]')!.textContent=notice}}}
    const review=dialog.querySelector<HTMLFormElement>('[data-review]');if(review)review.onsubmit=e=>{e.preventDefault();if(plan)selectWrite({kind:'review',id:plan.id,operation:crypto.randomUUID(),expected:plan.revision,assessment:String(new FormData(review).get('assessment'))})}
    button('[data-earlier]',()=>{if(!ratings?.next||busy)return;busy=true;render();void loadTiqAccount(client,owner,active,{cursor:ratings.next},send).then(page=>{if(active()&&ratings){ratings={...ratings,items:[...ratings.items,...page.items.filter(a=>!ratings!.items.some(b=>b.id===a.id))],next:page.next};notice='Earlier assessments loaded.'}}).catch(()=>{notice='Earlier assessments couldn’t load.'}).finally(()=>{if(active()){busy=false;render()}})})
    if(dialog.open&&heading!==lastHeading){lastHeading=heading;dialog.scrollTop=0;dialog.querySelector<HTMLElement>('h2')?.focus({preventScroll:true})}
  }
  dialog.oncancel=e=>{e.preventDefault();back()};document.body.append(dialog);dialog.showModal();void load()
  return {dispose,back,isOpen:()=>!disposed,requestLeave:(action?:()=>void)=>{
    if(busy)return
    if(checkIn?.isOpen()){checkIn.back();return}
    if(dirty||view==='confirm'){leaving=true;leaveAction=action??null;render()}else{dispose();action?.()}
  }}
}

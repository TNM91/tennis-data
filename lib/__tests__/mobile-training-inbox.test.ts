import {describe,it,expect,vi} from 'vitest'
import type {SupabaseClient} from '@supabase/supabase-js'
import {parseTrainingPlans,parseTrainingCoachWork,loadTrainingPlans,loadTrainingCoachWork,trainingCoachFeedback,type TrainingInboxSend} from '../../mobile/src/training-inbox-data'
import {trainingInboxLaunches,trainingPlansHtml,trainingCoachWorkHtml} from '../../mobile/src/training-inbox-view'
const owner='owner',date='2026-10-25T06:00:00Z',identity='relentless-competitor-4-0'
const rep=(id='r1',focusId='split-step-rhythm')=>({id,kind:'repeat',focusId,identitySlug:identity,label:'Repeat',title:'Split-step rhythm',detail:'Recover after contact.',href:'/level-up/'+identity+'?focus='+focusId,completedAt:null})
const plan=()=>({version:1,id:'week',identitySlug:identity,weekStart:'2026-10-19',summary:'Keep your feet active.',strongestFocus:'Recovery',reps:[rep()],sharedWithCoach:false,coachUserId:null,studentLinkId:null,coachResponse:null,createdAt:date,updatedAt:date})
const work=()=>({ok:true,coachLinks:[{id:'link',playerUserId:owner,identitySlug:identity,status:'active'}],assignments:[{id:'assignment',studentLinkId:'link',title:'Recover before judging',focus:'Movement',dueDate:'2026-10-24',status:'assigned',assignment:{cardId:'split-step-rhythm',detail:'Keep the first step quiet.',expectedEvidence:'One repeatable cue.'},updatedAt:date}]})
const client=(id=owner)=>({auth:{getSession:async()=>({data:{session:{user:{id},access_token:'synthetic'}},error:null})}} as unknown as SupabaseClient)
const response=(data:unknown,status=200)=>({data,status,headers:{},url:''})
describe('native training inbox',()=>{
 it('distinguishes valid empty account results from malformed responses',()=>{expect(parseTrainingPlans({ok:true,plans:[]})).toEqual([]);expect(parseTrainingCoachWork({ok:true,coachLinks:[],assignments:[]},owner)).toEqual({links:[],assignments:[]});for(const r of [{ok:false,plans:[]},{ok:true},{ok:true,plans:[null]}])expect(()=>parseTrainingPlans(r)).toThrow()})
 it('rejects duplicate, oversized, malformed and partially valid weekly plans',()=>{const p=plan();for(const plans of [[p,p],Array(13).fill(p),[{...p,weekStart:'2026-02-30'}],[{...p,reps:[rep(),{...rep('r2'),kind:'invented'}]}],[{...p,reps:[rep(),rep()]}],[{...p,createdAt:'yesterday'}],[{...p,reps:[{...rep(),completedAt:'later'}]}]])expect(()=>parseTrainingPlans({ok:true,plans})).toThrow()})
 it('withholds a nested weekly reply belonging to another account',()=>{const p={...plan(),coachResponse:{action:'acknowledged',note:'Ready',coachUserId:'coach',updatedAt:date,playerReply:{action:'question',message:'Private reply',playerUserId:'other',updatedAt:date}}};expect(()=>parseTrainingPlans({ok:true,plans:[p]},owner)).toThrow()})
 it('withholds coach records for a wrong owner, missing link, duplicates, invalid status or due date',()=>{const w=work();for(const value of [{...w,coachLinks:[{...w.coachLinks[0],playerUserId:'other'}]},{...w,coachLinks:[]},{...w,assignments:[w.assignments[0],w.assignments[0]]},{...w,assignments:[{...w.assignments[0],status:'draft'}]},{...w,assignments:[{...w.assignments[0],dueDate:'2026-02-30'}]}])expect(()=>parseTrainingCoachWork(value,owner)).toThrow()})
 it('uses coach replacement reps and never guesses a card from a title or external URL',()=>{const p={...plan(),coachResponse:{action:'replaced',note:'Reset first.',targetRepId:'r1',replacementRep:rep('new','double-fault-reset'),coachUserId:'coach',updatedAt:date,playerReply:null}};const plans=parseTrainingPlans({ok:true,plans:[p]});expect(trainingInboxLaunches(plans,null)[0].cardId).toBe('double-fault-reset');const unknown=parseTrainingPlans({ok:true,plans:[{...plan(),reps:[{...rep('r2','unknown'),title:'Split-Step Rhythm'}]}]});expect(trainingInboxLaunches(unknown,null)).toEqual([]);expect(trainingPlansHtml(unknown)).toContain('no exact matching drill card')})
 it('keeps recorded check-ins and coach notes in history without mutating account work',()=>{const w=work();Object.assign(w.assignments[0].assignment,{coachReview:{note:'<script>Keep moving',nextFocus:'Return depth',reviewedAt:date},playerCheckIn:{recap:'Feet stayed quiet',evidence:'3/5 proof',completedAt:date}});const parsed=parseTrainingCoachWork(w,owner),before=JSON.stringify(parsed),view=trainingCoachWorkHtml(parsed,new Date('2026-10-25T12:00:00'));expect(view).toContain('Checked in');expect(view).toContain('Completed work and check-ins (1)');expect(view).not.toContain('data-coach-checkin');expect(view).toContain('&lt;script&gt;');expect(view).not.toContain('<script>');expect(view).toContain('Feet stayed quiet');expect(view).toContain('does not complete an assignment');expect(JSON.stringify(parsed)).toBe(before)})
 it('carries an adjustment only into its exact weekly rep even when the drill repeats',()=>{
  const response={action:'adjusted',note:'Recover first.',targetRepId:'r2',replacementRep:null,coachUserId:'coach',updatedAt:date,playerReply:null}
  const raw={...plan(),reps:[rep(),{...rep('r2'),title:'Recover on the next ball'}],coachResponse:response}
  const adjusted=parseTrainingPlans({ok:true,plans:[raw]},owner)
  expect(trainingInboxLaunches(adjusted,null).map(launch=>launch.coachCue)).toEqual([undefined,'Recover first.'])
  expect(trainingPlansHtml(adjusted)).toContain('For Recover on the next ball')
  const answered=parseTrainingPlans({ok:true,plans:[{...raw,coachResponse:{...response,action:'answered'}}]},owner)
  expect(trainingInboxLaunches(answered,null).every(launch=>!launch.coachCue)).toBe(true)
 })
 it('highlights overdue work ahead of later assignments regardless of the API order',()=>{
  const raw=work(),overdue=raw.assignments[0]
  raw.assignments.unshift({...overdue,id:'tomorrow',title:'Second serves',dueDate:'2026-10-26'})
  const view=trainingCoachWorkHtml(parseTrainingCoachWork(raw,owner),new Date('2026-10-25T12:00:00'))
  expect(view).toContain('Up next')
  expect(view).toContain('Overdue 1d')
  expect(view).toContain('More assigned work (1)')
  expect(view.indexOf(overdue.title)).toBeLessThan(view.indexOf('Second serves'))
 })
 it('opens the requested assignment even if priorities change, and explains when it is no longer open',()=>{
  const raw=work(),now=new Date('2026-10-25T12:00:00')
  raw.assignments.push({...raw.assignments[0],id:'tomorrow',title:'Second serves',dueDate:'2026-10-26'})
  const parsed=parseTrainingCoachWork(raw,owner)
  const selected=trainingCoachWorkHtml(parsed,now,'tomorrow')
  expect(selected.indexOf('Second serves')).toBeLessThan(selected.indexOf('Recover before judging'))
  expect(selected).not.toContain('no longer open')
  parsed.assignments[1].status='completed'
  const latest=trainingCoachWorkHtml(parsed,now,'tomorrow')
  expect(latest).toContain('That assignment is no longer open')
  expect(latest).toContain('Completed work and check-ins (1)')
  expect(latest).not.toContain('data-coach-checkin="tomorrow"')
 })
 it('features the newest recorded review and opens requested feedback by exact assignment',()=>{
  const raw=work(),assignment=raw.assignments[0]
  raw.assignments.push(
   {...assignment,id:'older',title:'First-step review',status:'completed',updatedAt:'2026-10-26T00:00:00Z',assignment:Object.assign({...assignment.assignment},{coachReview:{note:'<img src=x>',nextFocus:'Recover first.',reviewedAt:'2026-10-23T00:00:00Z'}})},
   {...assignment,id:'latest',title:'Serve review',status:'completed',assignment:Object.assign({...assignment.assignment,cardId:'unknown'},{coachReview:{note:'Start deeper.',nextFocus:'Split-Step Rhythm',reviewedAt:date}})},
  )
  Object.assign(assignment.assignment,{coachReview:{note:'In progress',nextFocus:'Stay balanced.',reviewedAt:'2026-10-27T00:00:00Z'}})
  const parsed=parseTrainingCoachWork(raw,owner)
  expect(trainingCoachFeedback(parsed)?.assignment.id).toBe('latest')
  expect(trainingCoachWorkHtml(parsed)).not.toContain('Revisit Split-Step Rhythm')
  const opened=trainingCoachWorkHtml(parsed,new Date(),undefined,'older')
  expect(opened).toContain('Revisit Split-Step Rhythm')
  expect(opened).toContain('&lt;img src=x&gt;')
  expect(opened).not.toContain('<img src=x>')
  expect(trainingInboxLaunches([],parsed,'older').find(launch=>launch.coachCue)).toMatchObject({cardId:'split-step-rhythm',coachCue:'Recover first.'})
  expect(trainingCoachWorkHtml({links:[],assignments:[]},new Date(),undefined,'removed')).toContain('That coach feedback is unavailable.')
 })
 it('leads with the unfinished pack drill and keeps repeated cards separately launchable within the display limit',()=>{
  const w=work(),items=Array.from({length:31},(_,slot)=>({
   cardId:slot===2?'retired-drill':'split-step-rhythm',title:`Split step ${slot+1}`,proof:'Land quietly.',status:slot===0?'completed':'assigned',
  }))
  Object.assign(w.assignments[0].assignment,{tracker:['Record your balance.','Split step 2: Land quietly.'],levelUpPack:{id:'pack',title:'Movement block',focus:'Move',items}})
  const parsed=parseTrainingCoachWork(w,owner)
  const launches=trainingInboxLaunches([],parsed)
  expect(launches).toHaveLength(29)
  expect(launches.slice(0,2).map(launch=>JSON.parse(launch.key))).toEqual([
   ['coach','assignment','split-step-rhythm',0],['coach','assignment','split-step-rhythm',1],
  ])
  const view=trainingCoachWorkHtml(parsed)
  expect(view).toMatch(/data-pack-next[\s\S]*?Next drill · 2 of 31[\s\S]*?Split step 2</)
  expect(view).toContain('Other drills (29)')
  expect(view).toContain('Record your balance.')
  expect(view).not.toContain('Split step 2: Land quietly.')
  expect(view).toContain('Split step 3')
  expect(view).not.toContain('Practice privately<span class="sr-only"> Split step 3</span>')
  expect(view).not.toContain('Split step 31')
 })
 it('does not mark historical weekly reps complete or expose arbitrary navigation links',()=>{const plans=parseTrainingPlans({ok:true,plans:[{...plan(),reps:[{...rep(),title:'<img src=x>',href:'/level-up/unknown?redirect=https://example.com'}]}]});const view=trainingPlansHtml(plans);expect(view).toContain('0 of 1 rep complete');expect(view).toContain('&lt;img');expect(view).not.toContain('href=');expect(view).not.toContain('https://example.com');expect(plans[0].reps[0].completedAt).toBeNull()})
 it('shows confirmed practice on the exact rep even when two reps use the same drill',()=>{
  const first={...rep('r1'),title:'First split'},second={...rep('r2'),title:'Second split'}
  const plans=parseTrainingPlans({ok:true,plans:[{...plan(),reps:[first,second]}]})
  const receipt={key:JSON.stringify(['plan','week','r2']),cardId:second.focusId,rating:4,elapsedSeconds:75}
  const view=trainingPlansHtml(plans,true,undefined,receipt)
  expect(view).toContain('0 of 2 reps complete')
  const [,firstCard,secondCard]=view.split('<article class="training-week-rep')
  expect(firstCard).toContain('First split')
  expect(firstCard).not.toContain('Practice saved')
  expect(secondCard).toContain('Practice saved')
  expect(secondCard).toContain('Self-rated proof 4 / 5 · 1m 15s timed')
  expect(secondCard.indexOf('Mark rep done')).toBeLessThan(secondCard.indexOf('Practice privately'))
  const readOnly=trainingPlansHtml(plans,false,undefined,receipt)
  expect(readOnly).toContain('Practice saved')
  expect(readOnly).not.toContain('data-week-mark')
  const changed=parseTrainingPlans({ok:true,plans:[{...plan(),reps:[first,{...second,focusId:'double-fault-reset'}]}]})
  expect(trainingPlansHtml(changed,true,undefined,receipt)).not.toContain('Practice saved')
 })
 it('shows a fully completed week with its reps still available to review',()=>{
  const plans=parseTrainingPlans({ok:true,plans:[{...plan(),reps:[{...rep(),completedAt:date}]}]})
  const view=trainingPlansHtml(plans,true)
  expect(view).toContain('1 of 1 rep complete')
  expect(view).toContain('data-week-complete')
  expect(view).toContain('Completed reps (1)')
  expect(view).toContain('Reopen rep')
  expect(view).not.toContain('training-week-rep-next')
 })
 it('makes bounded read-only, uncached, non-redirecting requests to the existing player APIs',async()=>{const send=vi.fn<TrainingInboxSend>(async()=>response({ok:true,plans:[]}));await loadTrainingPlans(client(),owner,()=>true,send);expect(send).toHaveBeenCalledTimes(1);expect(send.mock.calls[0][0]).toMatchObject({url:'https://www.tenaceiq.com/api/player/level-up-weekly-plan',disableRedirects:true,headers:{Authorization:'Bearer synthetic','Cache-Control':'no-store'},webFetchExtra:{cache:'no-store'}});expect(send.mock.calls[0][0]).not.toHaveProperty('data');const coachSend=vi.fn(async()=>response(work()));expect((await loadTrainingCoachWork(client(),owner,()=>true,coachSend)).assignments).toHaveLength(1)})
 it('sends no request after close or account change and rejects late responses',async()=>{const send=vi.fn<TrainingInboxSend>(async()=>response({ok:true,plans:[]}));await expect(loadTrainingPlans(client('other'),owner,()=>true,send)).rejects.toThrow();await expect(loadTrainingPlans(client(),owner,()=>false,send)).rejects.toThrow();expect(send).not.toHaveBeenCalled();let active=true;await expect(loadTrainingPlans(client(),owner,()=>active,async()=>{active=false;return response({ok:true,plans:[]})})).rejects.toThrow()})
 it('does not turn access or network errors into empty history',async()=>{for(const status of [401,403,500])await expect(loadTrainingPlans(client(),owner,()=>true,async()=>response({ok:true,plans:[]},status))).rejects.toThrow();await expect(loadTrainingCoachWork(client(),owner,()=>true,async()=>{throw Error('offline')})).rejects.toThrow()})
})

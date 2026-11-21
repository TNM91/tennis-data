import {expect,it} from 'vitest'
import {growthCheckIn,type GrowthPlan} from '../tiq-growth'
import {growthCoachContext,growthCoachHtml,growthCoachFollowup,growthCoachFollowupHtml} from '../../mobile/src/tiq-growth-coach'
import type {TrainingCoachWork} from '../../mobile/src/training-inbox-data'

const plan:GrowthPlan={version:1,id:'plan',baseline:'private-baseline',sourceAssignment:'serve-block',state:'active',skill:'serve',target:'8 of 10 second serves in',sessions:3,reviewDate:'2026-11-27',
  logs:[{id:'one',date:'2026-11-20',note:'Private note'},{id:'two',date:'2026-11-21',note:'8/10 in'}],assessment:null,revision:'revision',createdAt:'2026-11-20T12:00:00Z',updatedAt:'2026-11-21T12:00:00Z'}
const block={version:1,skill:plan.skill,target:plan.target,sessions:plan.sessions,reviewDate:plan.reviewDate}
const work:TrainingCoachWork={links:[{id:'student',identitySlug:'',status:'active'}],assignments:[{id:'serve-block',studentLinkId:'student',title:'Serve practice block',focus:'Second serve',status:'assigned',dueDate:plan.reviewDate,updatedAt:plan.createdAt,assignment:{tiqGrowth:block}}]}
const changed=(assignment:Record<string,unknown>,status:'assigned'|'completed'='assigned'):TrainingCoachWork=>({...work,assignments:[{...work.assignments[0],status,assignment}]})

it('shares a count and target by default and includes only deliberately selected practice notes',()=>{
  const before=JSON.stringify(plan),summary=growthCheckIn(plan)
  expect(summary).toEqual({recap:'2 of 3 planned practices completed. Target: 8 of 10 second serves in',evidence:''})
  expect(growthCheckIn(plan,['two']).evidence).toBe('2026-11-21: 8/10 in')
  expect(JSON.stringify(summary)).not.toContain('private-baseline');expect(JSON.stringify(summary)).not.toContain('Private note')
  expect(JSON.stringify(plan)).toBe(before)
})
it('keeps complete selected notes for the length check and rejects stale or duplicate selections',()=>{
  const long={...plan,logs:plan.logs.map(log=>({...log,note:'🎾'.repeat(80)}))}
  expect(growthCheckIn(long,['one','two']).evidence.length).toBeGreaterThan(300)
  expect(growthCheckIn(long,['one','two']).evidence.endsWith('🎾'.repeat(80))).toBe(true)
  expect(()=>growthCheckIn(plan,['missing'])).toThrow();expect(()=>growthCheckIn(plan,['one','one'])).toThrow()
})
it('requires the exact current assignment block and active coach connection',()=>{
  expect(growthCoachContext(plan,work).state).toBe('ready')
  for(const field of [{target:'New target'},{sessions:4},{reviewDate:'2026-11-28'},{skill:'return'}])expect(growthCoachContext(plan,changed({tiqGrowth:{...block,...field}})).state).toBe('changed')
  expect(growthCoachContext(plan,changed({})).state).toBe('changed')
  expect(growthCoachContext({...plan,state:'archived'},work).state).toBe('closed')
  expect(growthCoachContext(plan,{...work,links:[{...work.links[0],status:'paused'}]}).state).toBe('unavailable')
  expect(growthCoachContext({...plan,sourceAssignment:'another'},work).state).toBe('unavailable')
  expect(growthCoachContext(plan,null).state).toBe('unavailable')
})
it('shows sent and reviewed work without offering to send another completion',()=>{
  const checkIn={recap:'My serve target',evidence:'8/10',completedAt:plan.updatedAt},review={note:'Smooth finish',nextFocus:'Try it under pressure',reviewedAt:plan.updatedAt}
  expect(growthCoachContext(plan,changed({tiqGrowth:block,playerCheckIn:checkIn})).state).toBe('waiting')
  expect(growthCoachHtml(plan,changed({tiqGrowth:block,playerCheckIn:checkIn},'completed'),false)).toContain('Awaiting coach feedback')
  const output=growthCoachHtml(plan,changed({tiqGrowth:block,playerCheckIn:checkIn,coachReview:review},'completed'),false)
  expect(output).toContain('Smooth finish');expect(output).toContain('Try it under pressure');expect(output).toContain('<time')
  expect(output).not.toContain('data-checkin')
})
it('escapes feedback and removes the coaching surface when it does not belong to the plan',()=>{
  const reviewed=changed({coachReview:{note:'<img src=x>',nextFocus:'<script>',reviewedAt:'invalid'}},'completed')
  const output=growthCoachHtml(plan,reviewed,false)
  expect(output).toContain('&lt;img');expect(output).not.toContain('<img');expect(output).not.toContain('<script>');expect(output).not.toContain('<time')
  expect(growthCoachHtml({...plan,sourceAssignment:null},reviewed,false)).toBe('')
  expect(growthCoachHtml(plan,{...reviewed,links:[]},false)).not.toContain('&lt;img')
})

it('prepares a private follow-up from dated feedback after a plan is finished without copying assessment or practice records',()=>{
  const finished={...plan,state:'reviewed' as const},review={note:'Smooth finish',nextFocus:'8 of 10 serves deep',reviewedAt:plan.updatedAt},reviewed=changed({tiqGrowth:block,coachReview:review},'completed')
  const before=JSON.stringify(finished),seed=growthCoachFollowup(finished,reviewed)
  expect(seed).toEqual({skill:'serve',cue:review.nextFocus,target:review.nextFocus,reviewedAt:review.reviewedAt,title:'Serve practice block',label:'Coach’s next focus'})
  expect(JSON.stringify(seed)).not.toContain('private-baseline');expect(JSON.stringify(seed)).not.toContain('Private note');expect(JSON.stringify(finished)).toBe(before)
  expect(growthCoachHtml(finished,reviewed,false,true)).toContain('Plan next practice');expect(growthCoachHtml(finished,reviewed,false,false)).not.toContain('data-coach-followup')
  expect(growthCoachFollowup({...plan,state:'archived'},reviewed)).not.toBeNull();expect(growthCoachFollowup(plan,reviewed)).toBeNull()
})
it('preserves a long cue in full while requiring an editable shorter target, and safely renders note-only feedback',()=>{
  const finished={...plan,state:'reviewed' as const},cue='a'.repeat(239)+'🎾',reviewed=changed({coachReview:{note:'<img src=x>',nextFocus:cue,reviewedAt:plan.updatedAt}},'completed')
  const seed=growthCoachFollowup(finished,reviewed)!
  expect(seed.target).toBe('');expect(seed.cue).toBe(cue);expect(growthCoachFollowupHtml(seed)).toContain(cue)
  const fallback=growthCoachFollowup(finished,changed({coachReview:{note:'<img src=x>',nextFocus:'',reviewedAt:plan.updatedAt}},'completed'))!
  expect(fallback.label).toBe('Coach feedback');expect(fallback.target).toBe('<img src=x>');expect(growthCoachFollowupHtml(fallback)).toContain('&lt;img');expect(growthCoachFollowupHtml(fallback)).not.toContain('<img')
})
it('does not seed a follow-up from unavailable, paused or undated coach feedback',()=>{
  const finished={...plan,state:'reviewed' as const},reviewed=changed({coachReview:{note:'Try a deep serve',nextFocus:'',reviewedAt:plan.updatedAt}},'completed')
  expect(growthCoachFollowup(finished,null)).toBeNull();expect(growthCoachFollowup({...finished,sourceAssignment:'another'},reviewed)).toBeNull()
  expect(growthCoachFollowup(finished,{...reviewed,links:[{...work.links[0],status:'paused'}]})).toBeNull()
  expect(growthCoachFollowup(finished,changed({coachReview:{note:'Try a deep serve',reviewedAt:'invalid'}},'completed'))).toBeNull()
})

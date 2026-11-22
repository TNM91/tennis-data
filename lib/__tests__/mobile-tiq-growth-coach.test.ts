import {expect,it} from 'vitest'
import {growthCheckIn,type GrowthPlan} from '../tiq-growth'
import {growthCoachContext,growthCoachHtml,growthCoachFollowup,growthCoachFollowupHtml,growthCoachBlocks,growthCoachBlocksHtml} from '../../mobile/src/tiq-growth-coach'
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

it('offers only open coach blocks from available links without recorded check-ins',()=>{
  const row=work.assignments[0],check={recap:'Practice complete',evidence:'8/10',completedAt:plan.updatedAt}
  const incoming:TrainingCoachWork={links:[...work.links,{...work.links[0],id:'paused',status:'paused'}],assignments:[row,{...row,id:'done',status:'completed'},{...row,id:'checked',assignment:{tiqGrowth:block,playerCheckIn:check}},{...row,id:'paused',studentLinkId:'paused'},{...row,id:'missing-link',studentLinkId:'missing'}]}
  expect(growthCoachBlocks(incoming).map(row=>row.assignment.id)).toEqual(['serve-block'])
})
it('withholds malformed blocks instead of presenting an unusable practice target',()=>{
  const row=work.assignments[0],malformed=[undefined,{...block,sessions:0},{...block,reviewDate:'2026-02-30'},{...block,skill:'unknown'},{...block,target:''}]
  expect(growthCoachBlocks({...work,assignments:malformed.map((tiqGrowth,index)=>({...row,id:String(index),assignment:{tiqGrowth}}))})).toEqual([])
  expect(growthCoachBlocks(null)).toEqual([])
})
it('keeps incoming record order and excludes the assignment already used by the active plan',()=>{
  const first={...work.assignments[0],id:'next'},last={...work.assignments[0],id:'later'},incoming={...work,assignments:[first,...work.assignments,last]}
  expect(growthCoachBlocks(incoming,plan.sourceAssignment).map(row=>row.assignment.id)).toEqual(['next','later'])
  expect(growthCoachBlocks(incoming).map(row=>row.assignment.id)).toEqual(['next','serve-block','later'])
})
it('does not modify coach work while preparing validated previews',()=>{
  const incoming={links:work.links.map(link=>Object.freeze({...link})),assignments:work.assignments.map(row=>Object.freeze({...row,assignment:Object.freeze({tiqGrowth:Object.freeze({...block})})}))}
  Object.freeze(incoming.links);Object.freeze(incoming.assignments);Object.freeze(incoming)
  const before=JSON.stringify(incoming);expect(growthCoachBlocks(incoming)[0].block).toEqual(block);expect(JSON.stringify(incoming)).toBe(before)
})
it('renders escaped preview details with a calendar date and single-practice wording',()=>{
  const incoming={...work,assignments:[{...work.assignments[0],title:'<img src=x>',assignment:{tiqGrowth:{...block,target:'Keep <the finish> high.',sessions:1}}}]}
  const output=growthCoachBlocksHtml(incoming,undefined,false,true)
  expect(output).toContain('1 coach practice block ready');expect(output).toContain('1 practice · Review');expect(output).toContain('datetime="2026-11-27"');expect(output).toContain('November 27, 2026')
  expect(output).toContain('&lt;img');expect(output).toContain('&lt;the finish&gt;');expect(output).not.toContain('<img');expect(output).toContain('data-adopt="serve-block"')
})
it('guides players to their active plan without offering to replace it or exposing private records',()=>{
  const active={...plan,completed:plan.logs.length,sourceAssignment:'another-block'},output=growthCoachBlocksHtml(work,active,false,true)
  expect(output).toContain('Finish or archive your current plan');expect(output).toContain('data-open-current');expect(output).not.toContain('data-adopt')
  expect(output).not.toContain('private-baseline');expect(output).not.toContain('Private note');expect(output).not.toContain('revision')
})
it('disables starting work during recovery or before an assessment exists',()=>{
  expect(growthCoachBlocksHtml(work,undefined,true,true)).toMatch(/data-adopt="serve-block" disabled/)
  const unassessed=growthCoachBlocksHtml(work,undefined,false,false);expect(unassessed).toContain('Save a self-assessment');expect(unassessed).toMatch(/data-adopt="serve-block" disabled/)
  expect(growthCoachBlocksHtml(work,{...plan,completed:plan.logs.length,sourceAssignment:null},true,true)).toMatch(/data-open-current disabled/)
})
it('keeps empty incoming work quiet beside an active plan and distinguishes unavailable work',()=>{
  expect(growthCoachBlocksHtml(null,undefined,false,true)).toBe('')
  expect(growthCoachBlocksHtml(work,{...plan,completed:plan.logs.length},false,true)).toBe('')
  expect(growthCoachBlocksHtml({...work,assignments:[]},undefined,false,true)).toContain('No open practice blocks from your coaches.')
})

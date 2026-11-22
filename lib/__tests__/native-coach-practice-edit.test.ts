import {afterEach,beforeEach,expect,it,vi} from 'vitest'
import {readCoachEdit} from '../native-coach-contract'
import {editNativeCoach} from '../native-coach'
import {tiqSkills} from '../tiq-assessment-skills'
import {coachDb} from '../../tests/fixtures/coach-db'
import {coachOwner,coachRevision} from '../../tests/fixtures/native-coach'

const before={version:1,skill:'return',target:'8 of 10 returns deep.',sessions:3,reviewDate:'2026-11-20'}
const block={...before,target:'9 of 10 returns beyond the service line.',sessions:4,reviewDate:'2026-12-06'}
const write={kind:'edit-assignment',id:'practice-one',student:'student-one',expectedUpdatedAt:coachRevision,title:'Return practice block',focus:'Return',dueDate:block.reviewDate,instructions:block.target,evidence:'Bring court results.',status:'assigned',tiqGrowth:block}
function database(){return coachDb({coach_player_links:[{id:'student-one',coach_user_id:coachOwner,player_user_id:'player',player_name:'Alex',identity_slug:'',level_label:'Developing',status:'active',notes:'',updated_at:coachRevision}],coach_assignments:[{id:write.id,coach_user_id:coachOwner,student_link_id:write.student,title:write.title,focus:write.focus,due_date:before.reviewDate,status:'assigned',assignment_json:{cardId:tiqSkills.find(s=>s.id==='return')!.drill.id,tiqGrowth:before,detail:before.target,expectedEvidence:write.evidence,future:{keep:true},lessonLocation:'Court 4'},updated_at:coachRevision}],my_lab_goals:[{user_id:'player',payload:{target:before.target,logs:['Private note']}}]})}
beforeEach(()=>{vi.useFakeTimers();vi.setSystemTime(new Date('2026-11-22T12:00:00Z'))})
afterEach(()=>vi.useRealTimers())

it('edits the existing shared block, summary and date together while retaining its identity and private work',async()=>{
 const db=database(),privateWork=structuredClone(db.tables.my_lab_goals)
 const saved=await editNativeCoach(db.client,coachOwner,readCoachEdit(write))
 expect(saved.detail!.assignments).toHaveLength(1);expect(saved.detail!.assignments[0]).toMatchObject({id:write.id,dueDate:block.reviewDate,assignment:{tiqGrowth:block,detail:block.target,future:{keep:true},lessonLocation:'Court 4'}})
 expect(saved.detail!.assignments[0].updatedAt).not.toBe(coachRevision);expect(db.tables.my_lab_goals).toEqual(privateWork)
 expect(db.calls.filter(c=>c.operation==='update').map(c=>c.table)).toEqual(['coach_assignments']);expect(db.calls.some(c=>c.table==='my_lab_goals')).toBe(false)
})
it('rejects injected or inconsistent practice-block edits before transport',()=>{
 for(const patch of [{dueDate:'2026-12-07'},{instructions:'Another target'},{status:'completed'},{tiqGrowth:null},{tiqGrowth:{...block,sessions:13}},{tiqGrowth:{...block,owner:'someone'}},{assignment:{tiqGrowth:block}}])expect(()=>readCoachEdit({...write,...patch})).toThrow()
})
it.each(['completed','archived'])('keeps %s practice evidence closed',async status=>{
 const db=database();db.tables.coach_assignments[0].status=status;const original=structuredClone(db.tables.coach_assignments)
 await expect(editNativeCoach(db.client,coachOwner,readCoachEdit(write))).rejects.toMatchObject({status:409});expect(db.tables.coach_assignments).toEqual(original)
})
it.each(['playerCheckIn','coachReview'])('preserves existing %s evidence even when a legacy row says assigned',async key=>{
 const db=database(),json=db.tables.coach_assignments[0].assignment_json as Record<string,unknown>
 json[key]=key==='playerCheckIn'?{recap:'Finished',evidence:'9/10',completedAt:coachRevision}:{note:'Good depth',nextFocus:'Movement',reviewedAt:coachRevision}
 const original=structuredClone(db.tables.coach_assignments);await expect(editNativeCoach(db.client,coachOwner,readCoachEdit(write))).rejects.toMatchObject({status:409});expect(db.tables.coach_assignments).toEqual(original)
})
it.each(['paused','unlinked'])('withholds block edits for a %s connection',async mode=>{
 const db=database();if(mode==='paused')db.tables.coach_player_links[0].status='paused';else db.tables.coach_player_links[0].player_user_id=null
 await expect(editNativeCoach(db.client,coachOwner,readCoachEdit(write))).rejects.toMatchObject({status:409});expect(db.calls.filter(c=>c.operation==='update')).toHaveLength(0)
})
it.each(['2026-11-20','2027-11-24'])('rejects an unusable review date %s on the server',async reviewDate=>{
 const db=database();await expect(editNativeCoach(db.client,coachOwner,readCoachEdit({...write,dueDate:reviewDate,tiqGrowth:{...block,reviewDate}}))).rejects.toMatchObject({status:409});expect(db.calls.filter(c=>c.operation==='update')).toHaveLength(0)
})
it.each(['2026-11-21','2027-11-23'])('accepts the existing inclusive date boundary %s',async reviewDate=>{
 const db=database();await editNativeCoach(db.client,coachOwner,readCoachEdit({...write,dueDate:reviewDate,tiqGrowth:{...block,reviewDate}}));expect(db.tables.coach_assignments[0].due_date).toBe(reviewDate)
})
it('does not convert generic practice or switch the assigned skill',async()=>{
 for(const mode of ['generic','different-skill','wrong-card']){const db=database(),json=db.tables.coach_assignments[0].assignment_json as Record<string,unknown>;if(mode==='generic')delete json.tiqGrowth;if(mode==='wrong-card')json.cardId='other';const input=mode==='different-skill'?{...write,tiqGrowth:{...block,skill:'serve'}}:write
 await expect(editNativeCoach(db.client,coachOwner,readCoachEdit(input))).rejects.toMatchObject({status:409});expect(db.calls.filter(c=>c.operation==='update')).toHaveLength(0)}
})
it('does not read or change another coach’s assignment or an assignment belonging to another student',async()=>{
 for(const patch of [{coach_user_id:'other'},{student_link_id:'other-student'}]){const db=database();Object.assign(db.tables.coach_assignments[0],patch);await expect(editNativeCoach(db.client,coachOwner,readCoachEdit(write))).rejects.toMatchObject({status:404});expect(db.calls.filter(c=>c.operation==='update')).toHaveLength(0)}
})
it('protects a player check-in that arrives between the read and conditional write',async()=>{
 const db=database();db.hooks.beforeWrite=table=>{if(table==='coach_assignments'){const a=db.tables.coach_assignments[0];a.status='completed';a.updated_at='2026-11-22T12:00:01.000Z';a.assignment_json={...a.assignment_json as object,playerCheckIn:{recap:'Finished',evidence:'9/10',completedAt:'2026-11-22T12:00:01.000Z'}}}}
 await expect(editNativeCoach(db.client,coachOwner,readCoachEdit(write))).rejects.toMatchObject({status:409});expect(db.tables.coach_assignments[0]).toMatchObject({status:'completed',assignment_json:{tiqGrowth:before,playerCheckIn:{recap:'Finished'}}})
})
it('rejects a stale revision without writing',async()=>{
 const db=database();db.tables.coach_assignments[0].updated_at='2026-11-22T12:00:01.000Z';await expect(editNativeCoach(db.client,coachOwner,readCoachEdit(write))).rejects.toMatchObject({status:409});expect(db.calls.filter(c=>c.operation==='update')).toHaveLength(0)
})
it('keeps an older client’s date edit consistent with the embedded block without changing its practice count',async()=>{
 const db=database(),{tiqGrowth:_block,...legacy}=write;void _block;await editNativeCoach(db.client,coachOwner,readCoachEdit({...legacy,dueDate:block.reviewDate,instructions:before.target}));expect(db.tables.coach_assignments[0]).toMatchObject({due_date:block.reviewDate,assignment_json:{tiqGrowth:{...before,reviewDate:block.reviewDate},detail:before.target}})
})
it('keeps an older client’s target edit consistent while preserving the block’s skill and review date',async()=>{
 const db=database(),{tiqGrowth:_block,...legacy}=write;void _block;const current={...before,reviewDate:'2026-11-29'},row=db.tables.coach_assignments[0];row.due_date=current.reviewDate;(row.assignment_json as Record<string,unknown>).tiqGrowth=current
 await editNativeCoach(db.client,coachOwner,readCoachEdit({...legacy,dueDate:current.reviewDate,instructions:block.target}));expect(row).toMatchObject({due_date:current.reviewDate,assignment_json:{tiqGrowth:{...current,target:block.target},detail:block.target}})
})
it('does not let an older client rewrite a completed block or store an invalid target or date',async()=>{
 for(const mode of ['completed','no-date','long-target']){const db=database(),{tiqGrowth:_block,...legacy}=write;void _block;if(mode==='completed')db.tables.coach_assignments[0].status='completed';const original=structuredClone(db.tables.coach_assignments),input={...legacy,status:mode==='completed'?'completed':'assigned',dueDate:mode==='no-date'?null:block.reviewDate,instructions:mode==='long-target'?'x'.repeat(241):block.target};await expect(editNativeCoach(db.client,coachOwner,readCoachEdit(input))).rejects.toMatchObject({status:mode==='completed'?409:400});expect(db.tables.coach_assignments).toEqual(original)}
})
it('still lets an older client archive a block without rewriting its evidence or date',async()=>{
 const db=database(),{tiqGrowth:_block,...legacy}=write;void _block;await editNativeCoach(db.client,coachOwner,readCoachEdit({...legacy,dueDate:before.reviewDate,instructions:before.target,status:'archived'}));expect(db.tables.coach_assignments[0]).toMatchObject({status:'archived',due_date:before.reviewDate,assignment_json:{tiqGrowth:before,future:{keep:true}}})
})

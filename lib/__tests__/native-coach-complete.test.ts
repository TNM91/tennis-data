import {expect,it} from 'vitest'
import {buildCoachLessonRecipe,readCoachLessonRecipe,type CoachLessonRecipe} from '../coach-lesson-recipe'
import {COACH_ASSIGNMENT_TEMPLATES} from '../coach-assignment-templates'
import {COACH_SESSION_PRESETS} from '../coach-workspace'
import {COACH_LEVEL_UP_HANDOFF_PACKS} from '../coach-practice-packs'
import {PLAYER_DEVELOPMENT_IDENTITIES} from '../player-development'
import {LEVEL_UP_CARDS} from '../level-up/level-up-cards'
import {readCoachCreate,readCoachEdit} from '../native-coach-contract'
import {createNativeCoach,editNativeCoach} from '../native-coach'
import {coachDb} from '../../tests/fixtures/coach-db'
import {coachAssignmentDraft,coachOwner,coachRevision} from '../../tests/fixtures/native-coach'
const recipe:CoachLessonRecipe={source:'custom',key:'',week:1,lessonDateTime:'2026-11-08T14:30',lessonLocation:'Court 4',lessonFocus:'Return depth'}
it('uses every existing session, template, pack, assignable card and identity lesson without website navigation',()=>{
 const cases:CoachLessonRecipe[]=[...COACH_SESSION_PRESETS.map(p=>({...recipe,source:'session' as const,key:p.id})),...COACH_ASSIGNMENT_TEMPLATES.map(p=>({...recipe,source:'template' as const,key:p.id})),...COACH_LEVEL_UP_HANDOFF_PACKS.map(p=>({...recipe,source:'pack' as const,key:p.id})),...LEVEL_UP_CARDS.filter(c=>c.assignable).map(c=>({...recipe,source:'card' as const,key:c.id})),...PLAYER_DEVELOPMENT_IDENTITIES.flatMap(i=>i.coachLessons.map(l=>({...recipe,source:'identity' as const,key:i.slug,week:l.week})))]
 for(const r of cases){const plan=buildCoachLessonRecipe(readCoachLessonRecipe(r));expect(plan.title).toBeTruthy();expect(plan.instructions).toBeTruthy();expect(plan.assignment.lessonDateTime).toBe(recipe.lessonDateTime);expect(plan.assignment.lessonLocation).toBe('Court 4')}
 expect(cases.length).toBeGreaterThan(100)
})
it('rejects unknown source IDs, injected JSON and invalid lesson dates',()=>{for(const r of [{...recipe,source:'script'},{...recipe,source:'card',key:'missing'},{...recipe,lessonDateTime:'2026-02-30T14:30'},{...recipe,lessonDateTime:'2026-11-08T24:30'},{...recipe,coachUserId:'other'}])expect(()=>readCoachLessonRecipe(r)).toThrow()})
it('creates a real assignment containing pack proof and calendar metadata, with insert-only identity',async()=>{
 const db=coachDb({coach_player_links:[{id:'student-one',coach_user_id:coachOwner,player_user_id:'player',player_name:'Alex',identity_slug:'relentless-competitor-4-0',level_label:'4.0',status:'active',notes:'',updated_at:coachRevision}],coach_assignments:[]})
 const intent=readCoachCreate({...coachAssignmentDraft,recipe:{...recipe,source:'pack',key:'doubles-readiness'}})
 await createNativeCoach(db.client,coachOwner,intent)
 const row=db.tables.coach_assignments[0],json=row.assignment_json as Record<string,unknown>
 expect(json.lessonDateTime).toBe(recipe.lessonDateTime);expect(json.levelUpPackId).toBe('doubles-readiness');expect((json.levelUpPack as {items:unknown[]}).items).toHaveLength(3);expect(row.coach_user_id).toBe(coachOwner)
 await expect(createNativeCoach(db.client,coachOwner,intent)).rejects.toMatchObject({status:409})
})
it('edits selected contact details without replacing the account connection or setup status, and archives without erasing proof',async()=>{
 const db=coachDb({coach_player_links:[{id:'student-one',coach_user_id:coachOwner,player_user_id:'player',player_id:'record',setup_status:'linked',player_name:'Alex',identity_slug:'relentless-competitor-4-0',level_label:'4.0',status:'active',notes:'',updated_at:coachRevision}],coach_assignments:[{id:'assignment-one',coach_user_id:coachOwner,student_link_id:'student-one',title:'Returns',focus:'Depth',due_date:null,status:'completed',assignment_json:{future:'keep',playerCheckIn:{recap:'8/10',evidence:'Eight deep returns',completedAt:coachRevision}},updated_at:coachRevision}]})
 await editNativeCoach(db.client,coachOwner,readCoachEdit({kind:'edit-student',id:'student-one',expectedUpdatedAt:coachRevision,name:'Alex',level:'4.0',notes:'',status:'active',identity:'doubles-commander-4-0-to-4-5',email:'alex@example.test',phone:'555-0100',contactPreference:'both'}))
 expect(db.tables.coach_player_links[0]).toMatchObject({player_user_id:'player',player_id:'record',setup_status:'linked',player_email:'alex@example.test',player_phone:'555-0100',contact_preference:'both'})
 const proof=structuredClone(db.tables.coach_assignments[0].assignment_json)
 await editNativeCoach(db.client,coachOwner,readCoachEdit({kind:'edit-assignment',id:'assignment-one',student:'student-one',expectedUpdatedAt:coachRevision,title:'Returns',focus:'Depth',dueDate:null,instructions:'',evidence:'',status:'archived'}))
 expect(db.tables.coach_assignments[0].status).toBe('archived');expect(db.tables.coach_assignments[0].assignment_json).toMatchObject(proof as object)
})

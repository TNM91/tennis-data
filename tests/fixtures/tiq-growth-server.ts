import {PGlite} from '@electric-sql/pglite'
import {readFile} from 'node:fs/promises'
import {readCoachCreate,readCoachReview,readCoachEdit,coachRecord} from '../../lib/native-coach-contract'
import {editNativeCoach,NativeCoachFault} from '../../lib/native-coach'
import {coachDb} from './coach-db'
import {tiqSkills} from '../../lib/tiq-assessment-skills'
import type {TiqAnswers} from '../../lib/tiq-self-assessment'
export const growthPlayer='11111111-1111-4111-8111-111111111111',growthPeer='22222222-2222-4222-8222-222222222222'
export const growthId=(n:number)=>'aaaaaaaa-aaaa-4aaa-8aaa-'+String(n).padStart(12,'0')
export type GrowthRequest={owner:string;method:string;url:string;write:unknown}
export async function growthServer(){
  const db=new PGlite(),revision='2026-11-20T12:00:00.000Z'
  let loseReply=false,loseTrainingReply=false,loseCheckInReply=false,revoked=false,failRead=false,hold=false,connected=false,release:(()=>void)|null=null
  let planReads=0,holdPlanReply=false,planReplyHeld=false
  const practices=new Map<string,Record<string,unknown>>()
  await db.exec(`create role anon;create role authenticated;create role service_role;create schema auth;create schema private;
    create table auth.users(id uuid primary key);
    create table coach_player_links(id text primary key,coach_user_id uuid,player_user_id uuid,updated_at timestamptz,status text,player_name text);
    create table coach_assignments(id text primary key,coach_user_id uuid,student_link_id text,title text,focus text,due_date date,status text,assignment_json jsonb,updated_at timestamptz);
    create table my_lab_goals(user_id uuid references auth.users(id) on delete cascade,player_id text,goal_id text,payload jsonb,edited_at timestamptz,primary key(user_id,player_id,goal_id));
    create function private.native_player_chat_account(owner uuid) returns boolean language sql as $$select exists(select 1 from auth.users where id=owner)$$;
    create function private.native_player_chat_unblocked(a uuid,b uuid) returns boolean language sql as $$select true$$;
    create function private.native_player_chat_name(owner uuid) returns text language sql as $$select 'Morgan Courts'::text$$;
    insert into auth.users values('${growthPlayer}'),('${growthPeer}');
    insert into coach_player_links values('student-one','${growthPlayer}','${growthPeer}','${revision}','active','Alex Rivera');`)
  for(const file of ['20261120000100_native_tiq_account_history.sql','20261120000200_native_tiq_growth.sql'])await db.exec(await readFile('supabase/migrations/'+file,'utf8'))
  const day=(await db.query<{d:string}>('select current_date::text d')).rows[0].d
  const answers={serve:2,return:1,rally:2,movement:2,net:1,points:2}
  async function assess(owner=growthPlayer,n=1,changes:Partial<TiqAnswers>={}){
    const head=(await db.query<{id:string}>('select id from private.tiq_self_assessments where owner_id=$1 order by assessed_on desc,created_at desc,id desc limit 1',[owner])).rows[0]?.id??null
    return (await db.query('select write_native_tiq_assessment($1,$2)',[owner,JSON.stringify({kind:'save',id:growthId(n),date:day,answers:{...answers,...changes},version:1,expectedHead:head})])).rows
  }
  await assess();await assess(growthPeer,2)
  await db.query('select write_native_tiq_assessment($1,$2)',[growthPeer,JSON.stringify({kind:'share',id:growthId(2),student:'student-one',linkUpdatedAt:revision,operation:growthId(9),expected:null})])
  async function work(owner:string){const links=(await db.query<{id:string;player_user_id:string;status:string}>('select * from coach_player_links where player_user_id=$1',[owner])).rows
    const rows=(await db.query<Record<string,unknown>>('select a.* from coach_assignments a join coach_player_links l on l.id=a.student_link_id where l.player_user_id=$1',[owner])).rows
    return {ok:true,coachLinks:links.map(l=>({id:l.id,playerUserId:l.player_user_id,status:l.status,identitySlug:''})),assignments:rows.map(assignment)}
  }
  function assignment(row:Record<string,unknown>){return {id:row.id,studentLinkId:row.student_link_id,title:row.title,focus:row.focus??'',dueDate:row.due_date?new Date(row.due_date as string).toISOString().slice(0,10):null,status:row.status,assignment:row.assignment_json,updatedAt:row.updated_at instanceof Date?row.updated_at.toISOString():row.updated_at}}
  async function workspace(owner:string,student:string){
    const links=(await db.query<{id:string;player_name:string;status:string;player_user_id:string|null;updated_at:string|Date}>('select * from coach_player_links where coach_user_id=$1',[owner])).rows
    const students=links.map(row=>({id:row.id,name:row.player_name,level:'Developing',identity:'',status:row.status,linked:Boolean(row.player_user_id),notes:'',updatedAt:row.updated_at instanceof Date?row.updated_at.toISOString():row.updated_at}))
    const s=students.find(row=>row.id===student)
    const rows=(await db.query<Record<string,unknown>>('select * from coach_assignments where coach_user_id=$1',[owner])).rows
    return {ok:true,owner,checkedAt:new Date().toISOString(),students,moreStudents:false,detail:s?{student:s,assignments:rows.filter(row=>row.student_link_id===s.id).map(assignment),moreAssignments:false}:null}
  }
  async function request(r:GrowthRequest){
    const url=new URL(r.url),response=(body:unknown,status=200)=>({body,status})
    if(hold){hold=false;await new Promise<void>(resolve=>{release=resolve})}
    if(failRead&&r.method==='GET')return response({ok:false},503)
    if(revoked&&(url.searchParams.has('student')||url.pathname==='/api/mobile/coach/assessments'))return response({ok:false},403)
    if(url.pathname==='/api/player/level-up-sessions'){
      if(r.method==='POST'){const session=(r.write as {session:Record<string,unknown>}).session;const saved={...session,playerUserId:r.owner,sessionJson:{cardId:session.cardId}};practices.set(r.owner+':'+session.id,saved);if(loseTrainingReply){loseTrainingReply=false;return response({ok:false},503)}return response({ok:true,session:saved})}
      return response({ok:true,sessions:[...practices.values()].filter(row=>row.playerUserId===r.owner)})
    }
    if(url.pathname==='/api/mobile/coach/connection'){
      if((r.write as {action:string}).action==='accept')connected=true
      return response({ok:true,owner:r.owner,name:'Alex Rivera',level:'Developing',message:'Let’s work on your second serve.',expiresAt:null,state:connected?'connected':'ready',revision:'a'.repeat(64)})
    }
    if(url.pathname==='/api/mobile/first-party/tiq/plans'){
      if(r.method==='GET'){
        planReads++
        const payload={...((await db.query<{v:Record<string,unknown>}>('select native_tiq_growth_read($1,$2) v',[r.owner,url.searchParams.get('id')])).rows[0].v),releaseScope:'first-party'}
        if(holdPlanReply){holdPlanReply=false;planReplyHeld=true;await new Promise<void>(resolve=>{release=resolve});planReplyHeld=false}
        return response(payload)
      }
      const w=r.write as {id:string;operation:string},status=(await db.query<{s:number}>('select write_native_tiq_growth($1,$2) s',[r.owner,JSON.stringify(w)])).rows[0].s
      if(loseReply&&status===200){loseReply=false;return response({ok:false},503)}
      return response({ok:status===200,owner:r.owner,id:w.id,operation:w.operation,releaseScope:'first-party'},status)
    }
    if(url.pathname==='/api/mobile/first-party/tiq'){
      if(r.method==='POST'){const status=(await db.query<{s:number}>('select write_native_tiq_assessment($1,$2) s',[r.owner,JSON.stringify(r.write)])).rows[0].s;return response({ok:status===200,owner:r.owner,id:(r.write as {id:string}).id,releaseScope:'first-party'},status)}
      return response({...((await db.query<{v:Record<string,unknown>}>('select native_tiq_assessment_history($1,$2,$3) v',[r.owner,url.searchParams.get('cursor'),url.searchParams.get('student')])).rows[0].v),releaseScope:'first-party'})
    }
    if(url.pathname==='/api/mobile/coach/overview')return response((await db.query<{v:unknown}>('select native_coach_growth_overview($1,$2) v',[r.owner,url.searchParams.get('day')])).rows[0].v)
    if(url.pathname==='/api/mobile/coach/assessments')return response({ok:true,owner:r.owner,student:url.searchParams.get('student'),assessments:[{id:growthId(8),coach:'Morgan Courts',createdAt:revision,observation:{context:'drill',skills:{serve:3,return:1,rally:2},focus:'serve',note:'Try your second serve target under pressure.'}}]})
    if(url.pathname==='/api/mobile/coach'){
      if(r.method==='PATCH'){
        if('kind' in coachRecord(r.write)){
          const edit=readCoachEdit(r.write);if(edit.kind!=='edit-assignment')return response({ok:false},400)
          const links=(await db.query<Record<string,unknown>>('select * from coach_player_links')).rows
          const rows=(await db.query<Record<string,unknown>>('select *,updated_at::text original_revision from coach_assignments')).rows
          const stamp=(value:unknown)=>value instanceof Date?value.toISOString():value
          const adapter=coachDb({coach_player_links:links.map(row=>({...row,updated_at:stamp(row.updated_at),identity_slug:'',level_label:'Developing',notes:''})),coach_assignments:rows.map(row=>({...row,updated_at:stamp(row.updated_at),due_date:row.due_date?new Date(row.due_date as string).toISOString().slice(0,10):null}))})
          try{await editNativeCoach(adapter.client,r.owner,edit)}catch(error){if(error instanceof NativeCoachFault)return response({ok:false,message:error.message},error.status);throw error}
          const saved=adapter.tables.coach_assignments.find(row=>row.id===edit.id)!,original=rows.find(row=>row.id===edit.id)!
          const result=await db.query('update coach_assignments set title=$4,focus=$5,due_date=$6,status=$7,assignment_json=$8::jsonb,updated_at=$9 where id=$1 and coach_user_id=$2 and student_link_id=$3 and updated_at=$10::timestamptz returning id',[edit.id,r.owner,edit.student,saved.title,saved.focus,saved.due_date,saved.status,JSON.stringify(saved.assignment_json),saved.updated_at,original.original_revision])
          if(!result.rows.length)return response({ok:false},409)
          return response(await workspace(r.owner,edit.student))
        }
        const review=readCoachReview(r.write)
        await db.query("update coach_assignments set assignment_json=assignment_json||$3::jsonb,updated_at=now() where id=$1 and coach_user_id=$2",[review.id,r.owner,JSON.stringify({coachReview:{note:review.note,nextFocus:review.nextFocus,reviewedAt:new Date().toISOString()}})])
        return response(await workspace(r.owner,review.student))
      }
      if(r.method==='POST'){
        const w=readCoachCreate(r.write);if(w.kind!=='assignment')return response({ok:false},400)
        const existing=await db.query('select id from coach_assignments where id=$1',[w.id])
        if(!existing.rows.length)await db.query('insert into coach_assignments values($1,$2,$3,$4,$5,$6,$7,$8,now())',[w.id,r.owner,w.student,w.title,w.focus,w.dueDate,w.status,JSON.stringify({cardId:tiqSkills.find(s=>s.id===w.assessmentDrill)?.drill.id,tiqGrowth:w.tiqGrowth,detail:w.instructions,expectedEvidence:w.evidence})])
        return response(await workspace(r.owner,w.student))
      }
      return response(await workspace(r.owner,url.searchParams.get('student')??''))
    }
    if(url.pathname==='/api/player/coach-assignments'){
      if(r.method==='PATCH'){const w=r.write as {assignmentId:string;recap:string;evidence:string};await db.query("update coach_assignments set status='completed',assignment_json=assignment_json||$2::jsonb where id=$1",[w.assignmentId,JSON.stringify({playerCheckIn:{recap:w.recap,evidence:w.evidence,completedAt:new Date().toISOString()}})]);if(loseCheckInReply){loseCheckInReply=false;return response({ok:false},503)}const result=await work(r.owner);return response({ok:true,assignment:result.assignments.find(a=>a.id===w.assignmentId)})}
      return response(await work(r.owner))
    }
    return response({ok:false},404)
  }
  return {db,day,request,assess,close:()=>db.close(),get planReads(){return planReads},get planReplyHeld(){return planReplyHeld},set holdPlanReply(value:boolean){holdPlanReply=value},set loseReply(value:boolean){loseReply=value},set loseTrainingReply(value:boolean){loseTrainingReply=value},set loseCheckInReply(value:boolean){loseCheckInReply=value},set revoked(value:boolean){revoked=value},set failRead(value:boolean){failRead=value},set hold(value:boolean){hold=value},release:()=>release?.()}
}

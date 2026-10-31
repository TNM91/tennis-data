import {competitionOwner} from './competitions-data'
export const updateCoachStudent='99999999-9999-4999-8999-999999999991',updateCoachThread='99999999-9999-4999-8999-999999999992'
type Row={id:string;recipient_profile_id:string;notification_type:string;title:string;body:string;href:string;conversation_id:string|null;schedule_event_id:null;read_at:string|null;created_at:string}
export const updatesFixture={
  failList:false,failCount:false,loseWrite:false,deferList:false,release:()=>{},
  queries:[] as {table:string;method:string;ids:string[];owner:string|null}[],
  rows:Array.from({length:31},(_,i):Row=>({id:'aaaa0000-0000-4000-8000-'+String(i+1).padStart(12,'0'),recipient_profile_id:competitionOwner,notification_type:i%4===0?'system':i%4===1?'schedule':'message',title:i===1?'Your league season is ready':i===2?'Tournament entry approved':i===3?'Taylor sent a coaching note':i===4?'A safe text preview':'Tennis update '+(i+1),body:i===4?'<img src=x onerror=alert(1)> A long preview '+('Tennis'.repeat(30)):'Review your next match, practice or team update.',href:i===1?'/explore/leagues/tiq/league-one':i===2?'/tournaments/event-one':i===3?'/messages?thread='+updateCoachThread:i===4?'https://outside.invalid/track':'/mylab',conversation_id:i===3?updateCoachThread:null,schedule_event_id:null,read_at:i%4===0?'2026-10-31T13:00:00Z':null,created_at:new Date(Date.UTC(2026,9,31,12,0)-i*60000).toISOString()})),
}
export function updatesQuery(table:string){
  const eq=new Map<string,unknown>(),sets=new Map<string,unknown[]>();let head=false,unread=false,limit=100,mutation:Record<string,unknown>|null=null,cursor='',single=false
  const q:Record<string,unknown>={}
  q.select=(_columns:string,options?:{head?:boolean})=>{head=options?.head===true;return q}
  q.eq=(key:string,value:unknown)=>{eq.set(key,value);return q}
  q.in=(key:string,values:unknown[])=>{sets.set(key,values);return q}
  q.is=()=>{unread=true;return q};q.order=()=>q;q.limit=(n:number)=>{limit=n;return q};q.or=(value:string)=>{cursor=value;return q}
  q.abortSignal=()=>q;q.setHeader=()=>q;q.update=(value:Record<string,unknown>)=>{mutation=value;return q};q.maybeSingle=()=>{single=true;return q}
  const execute=async()=>{
    updatesFixture.queries.push({table,method:mutation?'PATCH':head?'HEAD':'GET',ids:(sets.get('id')||[]) as string[],owner:eq.get('recipient_profile_id') as string||null})
    if(table==='internal_conversations')return {data:eq.get('id')===updateCoachThread?{id:updateCoachThread,conversation_type:'direct',related_entity_type:'coach_student',related_entity_id:updateCoachStudent}:null,error:null}
    let rows=updatesFixture.rows.filter(row=>[...eq].every(([key,value])=>row[key as keyof Row]===value)&&[...sets].every(([key,values])=>values.includes(row[key as keyof Row]))&&(!unread||!row.read_at))
    if(head)return updatesFixture.failCount?{data:null,count:null,error:{message:'Synthetic count unavailable'}}:{data:null,count:rows.length,error:null}
    if(mutation){for(const row of rows)row.read_at=String(mutation.read_at);if(updatesFixture.loseWrite){updatesFixture.loseWrite=false;return {data:null,error:{message:'Synthetic reply interrupted'}}}return {data:null,error:null}}
    if(updatesFixture.failList){updatesFixture.failList=false;return {data:null,error:{message:'Synthetic offline read'}}}
    if(cursor){const match=cursor.match(/^created_at.lt.([^,]+),and\(created_at.eq.[^,]+,id.lt.([^)]+)\)$/);if(match)rows=rows.filter(row=>row.created_at<match[1]||row.created_at===match[1]&&row.id<match[2])}
    rows=[...rows].sort((a,b)=>b.created_at.localeCompare(a.created_at)||b.id.localeCompare(a.id)).slice(0,limit)
    const reply={data:single?rows[0]||null:structuredClone(rows),error:null}
    if(updatesFixture.deferList){updatesFixture.deferList=false;await new Promise<void>(resolve=>{updatesFixture.release=resolve})}
    return reply
  }
  q.then=(resolve:(value:unknown)=>void,reject:(error:unknown)=>void)=>execute().then(resolve,reject)
  return q
}

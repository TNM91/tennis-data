import {readTiqWrite, type TiqAssessment, type TiqAnswers, type TiqShare} from '../../lib/tiq-self-assessment'
export const tiqPlayer='11111111-1111-4111-8111-111111111111', tiqStudent='22222222-2222-4222-8222-222222222222'
export const tiqAnswers={serve:2,return:2,rally:2,movement:2,net:2,points:2} as const
export type TiqFixtureRequest={owner:string;method:string;student:string|null;cursor:string|null;write:unknown}
export function tiqAccountServer(){
  const rows=new Map<string,TiqAssessment[]>(),shares:TiqShare[]=[]
  let sequence=0,reads=0,loseSaveReply=false,connected=true,holdRead=false,release:(()=>void)|null=null
  const ordered=(owner:string)=>(rows.get(owner)??[]).slice().sort((a,b)=>b.date.localeCompare(a.date)||b.createdAt.localeCompare(a.createdAt)||b.id.localeCompare(a.id))
  const add=(owner=tiqPlayer,answers:TiqAnswers=tiqAnswers,date='2026-11-19',id=crypto.randomUUID())=>{
    const entry:TiqAssessment={id,date,answers,version:1,createdAt:new Date(Date.UTC(2026,10,20,12,0,++sequence)).toISOString()}
    rows.set(owner,[...(rows.get(owner)??[]),entry]);return entry
  }
  const response=(body:unknown,status=200)=>({body,status})
  const reply=(owner:string,id:string)=>response({ok:true,owner,id,releaseScope:'first-party'})
  const request=async(r:TiqFixtureRequest)=>{
    if(r.method==='GET'){
      reads++
      if(holdRead){holdRead=false;await new Promise<void>(resolve=>{release=resolve})}
      if(r.student&&(!connected||r.owner!==tiqPlayer||r.student!=='student-one'))return response({ok:false},403)
      const all=r.student?ordered(tiqStudent).filter(row=>shares.some(s=>s.assessment===row.id&&s.student===r.student&&s.shared)):ordered(r.owner)
      const start=r.cursor?all.findIndex(row=>row.id===JSON.parse(r.cursor!).id)+1:0
      const items=all.slice(start,start+25),last=items.at(-1)
      return response({ok:true,owner:r.owner,student:r.student,head:all[0]??null,items,
        next:start+25<all.length&&last?{id:last.id,date:last.date,createdAt:last.createdAt}:null,
        coaches:r.student||!connected?[]:[{id:'coach-one',name:'Morgan Courts',updatedAt:'2026-11-18T12:00:00Z'}],moreCoaches:false,
        shares:r.student?[]:shares.filter(s=>items.some(row=>row.id===s.assessment)).map(s=>({...s,active:s.shared&&connected})),releaseScope:'first-party'})
    }
    const w=readTiqWrite(r.write),mine=ordered(r.owner)
    if(w.kind==='save'){
      const existing=mine.find(row=>row.id===w.id)
      if(existing)return reply(r.owner,w.id)
      if((mine[0]?.id??null)!==w.expectedHead)return response({ok:false},409)
      add(r.owner,w.answers,w.date,w.id)
      if(loseSaveReply){loseSaveReply=false;return response({ok:false},503)}
      return reply(r.owner,w.id)
    }
    if(w.kind==='delete'){
      rows.set(r.owner,mine.filter(row=>row.id!==w.id))
      for(let i=shares.length-1;i>=0;i--)if(shares[i].assessment===w.id)shares.splice(i,1)
      return reply(r.owner,w.id)
    }
    if(!mine.some(row=>row.id===w.id))return response({ok:false},404)
    const existing=shares.find(s=>s.assessment===w.id&&s.student===w.student)
    if(existing?.operation===w.operation)return reply(r.owner,w.id)
    if((existing?.operation??null)!==w.expected)return response({ok:false},409)
    if(w.kind==='share'&&!connected)return response({ok:false},409)
    const saved={assessment:w.id,student:w.student,name:'Morgan Courts',operation:w.operation,shared:w.kind==='share',active:w.kind==='share'}
    if(existing)Object.assign(existing,saved);else shares.push(saved)
    return reply(r.owner,w.id)
  }
  return {rows,shares,ordered,add,request,get reads(){return reads},set loseSaveReply(value:boolean){loseSaveReply=value},
    set connected(value:boolean){connected=value},set holdRead(value:boolean){holdRead=value},releaseRead(){release?.();release=null}}
}

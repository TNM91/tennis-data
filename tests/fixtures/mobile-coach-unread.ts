const owner='11111111-1111-4111-8111-111111111111',first='44444444-4444-4444-8444-444444444444',second='55555555-5555-4555-8555-555555555555'
export const coachUnreadFixture={enabled:false,unavailable:false,readFail:false,longHistory:false,newAfterRead:false,holdRead:false,releaseRead:()=>{},counts:{'student-one':2,'student-two':1} as Record<string,number>,reads:[] as {student:string;message:string}[]}
export function coachUnreadCounts(who:string){return who!==owner?{available:true,total:0,connections:[]}:coachUnreadFixture.unavailable?{available:false,total:0,connections:[]}:{available:true,total:Math.min(100,Object.values(coachUnreadFixture.counts).reduce((a,b)=>a+b,0)),connections:Object.entries(coachUnreadFixture.counts).map(([id,unread])=>({id,unread}))}}
export async function coachUnreadMessages(who:string,method:string,url:URL,raw?:BodyInit|null){
 if(!coachUnreadFixture.enabled||!url.searchParams.has('student'))return null
 const student=url.searchParams.get('student')!
 if(method==='PATCH'){
  const body=JSON.parse(String(raw)) as {message:string};coachUnreadFixture.reads.push({student,message:body.message})
  if(coachUnreadFixture.holdRead)await new Promise<void>(resolve=>{coachUnreadFixture.releaseRead=resolve})
  if(coachUnreadFixture.readFail)return Response.json({ok:false},{status:503})
  coachUnreadFixture.counts[student]=coachUnreadFixture.newAfterRead?1:0
  return Response.json({ok:true,owner:who,student,through:body.message})
 }
 if(method!=='GET')return Response.json({ok:false},{status:400})
 const messages=coachUnreadFixture.longHistory?Array.from({length:35},(_,i)=>({id:'66666666-6666-4666-8666-'+String(i).padStart(12,'0'),mine:false,body:'Return practice note '+i+'. Split, recover and hit through your target.',createdAt:'2026-10-31T11:00:00Z'})):[]
 messages.push({id:student==='student-one'?first:second,mine:false,body:'Latest private note for '+student+'.',createdAt:'2026-10-31T12:00:00.123456Z'})
 return Response.json({ok:true,owner:who,student,messages,more:false,checked:null})
}

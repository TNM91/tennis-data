export const coachChatFixture={enabled:false,fail:false,removed:false,teamFail:false,loseSend:false,requests:[] as {method:string;student:string;message:string}[],messages:[] as {id:string;mine:boolean;body:string;createdAt:string}[]}
export function coachChatPreview(owner:string,method:string,url:URL,body:BodyInit|null|undefined){
 if(!coachChatFixture.enabled)return null
 const student=url.searchParams.get('student')||'',message=url.searchParams.get('message')||'';coachChatFixture.requests.push({method,student,message})
 if(coachChatFixture.fail)return Response.json({ok:false},{status:503})
 if(!student)return Response.json({ok:true,owner,connections:[...(!coachChatFixture.removed?[{id:'student-one',name:'Alex Rivera <img src=x>',role:'coach'}]:[]),{id:'student-two',name:'Jordan Lee',role:'player'}],more:false})
 if(coachChatFixture.removed&&student==='student-one')return Response.json({ok:false},{status:404})
 if(method==='POST'){
  const value=JSON.parse(String(body)) as {id:string;body:string}
  if(!coachChatFixture.messages.some(message=>message.id===value.id))coachChatFixture.messages.push({...value,mine:true,createdAt:'2026-10-31T12:30:00Z'})
  if(coachChatFixture.loseSend){coachChatFixture.loseSend=false;return Response.json({ok:false},{status:503})}
 }
 return Response.json({ok:true,owner,student,messages:[{id:'note-'+student,mine:false,body:student==='student-one'?'Bring your return notes.':'Ready for our lesson.',createdAt:'2026-10-31T12:00:00Z'},...coachChatFixture.messages],more:false,checked:coachChatFixture.messages.find(value=>value.id===message)||null})
}

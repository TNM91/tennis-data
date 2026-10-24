import {GET as getTeamRoom} from '../route'
export const runtime='nodejs'
export async function GET(request:Request){
 try{const incoming=new URL(request.url),url=new URL(request.url);url.search='';for(const key of ['team','league','flight','message','view']){const value=incoming.searchParams.get(key);if(value!==null)url.searchParams.set(key,value)}url.searchParams.set('chatUpdates','1');url.searchParams.set('chatMessage','1');url.searchParams.set('read','0');const response=await getTeamRoom(new Request(url,{headers:request.headers,signal:request.signal}));response.headers.set('Cache-Control','private, no-store');return response}
 catch{return Response.json({ok:false,message:'Message unavailable.'},{status:503,headers:{'Cache-Control':'private, no-store'}})}
}

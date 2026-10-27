import type {SupabaseClient} from '@supabase/supabase-js'
export type NamedChatRoom={id:string;name:string;parentId:string;teamMuted:boolean}
export const namedChatRoomId=(value:unknown):value is string=>typeof value==='string'&&/^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i.test(value)
export const namedChatRoomName=(value:unknown):value is string=>typeof value==='string'&&value===value.trim()&&Array.from(value).length>=1&&Array.from(value).length<=48&&!/[\u0000-\u001f\u007f]/.test(value)&&value.replace(/\s+/g,' ').toLowerCase()!=='general'
export type NamedRoomReply={ok:false;status:number}|{ok:true;status:200;namedRooms:1;parentId:string;teamMuted:boolean;generalUnread:number;canCreate:boolean;rooms:{id:string;name:string;unread:number;muted:boolean}[]}|{ok:true;status:200;namedRooms:1;parentId:string;teamMuted:boolean;id:string;name:string;replayed:boolean}
export async function namedTeamChatRooms(service:SupabaseClient,owner:string,scope:{teamName:string;leagueName:string;flight:string},action:'list'|'open'|'create'|'lookup',id?:unknown,name?:unknown):Promise<NamedRoomReply>{
 if(action!=='list'&&!namedChatRoomId(id)||['create','lookup'].includes(action)&&!namedChatRoomName(name))return {ok:false as const,status:400}
 try{
 const result=await service.rpc('native_team_chat_rooms',{p_owner:owner,p_team:scope.teamName,p_league:scope.leagueName,p_flight:scope.flight,p_action:action,p_id:action==='list'?null:id,p_name:['create','lookup'].includes(action)?name:null})
 const row=result.data
 if(result.error||!row||typeof row.ok!=='boolean')return {ok:false as const,status:503}
 if(!row.ok)return {ok:false as const,status:[400,403,404,409].includes(row.status)?row.status:503}
 if(row.namedRooms!==1||!namedChatRoomId(row.parentId)||typeof row.teamMuted!=='boolean')return {ok:false as const,status:503}
 if(action==='list'){
  if(!Number.isInteger(row.generalUnread)||row.generalUnread<0||row.generalUnread>100||typeof row.canCreate!=='boolean'||!Array.isArray(row.rooms)||row.rooms.length>12||row.rooms.some((item:{id:string;name:string;unread:number;muted:boolean})=>!item||!namedChatRoomId(item.id)||!namedChatRoomName(item.name)||!Number.isInteger(item.unread)||item.unread<0||item.unread>100||typeof item.muted!=='boolean')||new Set(row.rooms.map((item:NamedChatRoom)=>item.id)).size!==row.rooms.length)return {ok:false as const,status:503}
  return {ok:true as const,status:200,namedRooms:1,parentId:row.parentId,teamMuted:row.teamMuted,generalUnread:row.generalUnread,canCreate:row.canCreate,rooms:row.rooms.map((item:{id:string;name:string;unread:number;muted:boolean})=>({id:item.id,name:item.name,unread:item.unread,muted:item.muted}))}
 }
 if(row.id!==id||!namedChatRoomName(row.name)||['create','lookup'].includes(action)&&row.name!==name)return {ok:false as const,status:503}
 return {ok:true as const,status:200,namedRooms:1,parentId:row.parentId,teamMuted:row.teamMuted,id:row.id as string,name:row.name as string,replayed:row.replayed===true}
 }catch{return {ok:false,status:503}}
}

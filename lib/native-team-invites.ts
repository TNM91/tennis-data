import {createClient,type SupabaseClient} from '@supabase/supabase-js'
import {supabaseKey,supabaseUrl} from './supabase'
import {nativeInviteToken,nativeInviteReview} from './native-team-invite-contract'
export async function nativeInviteAuth(request:Request){
 const header=request.headers.get('authorization')||'',token=/^Bearer /i.test(header)?header.slice(7).trim():''
 if(!token)return {ok:false as const,status:401}
 const auth=createClient(supabaseUrl,supabaseKey,{auth:{persistSession:false,autoRefreshToken:false}})
 const result=await auth.auth.getUser(token)
 if(result.error || !result.data.user)return {ok:false as const,status:401}
 if(!process.env.SUPABASE_SERVICE_ROLE_KEY)return {ok:false as const,status:503}
 return {ok:true as const,owner:result.data.user.id,service:createClient(supabaseUrl,process.env.SUPABASE_SERVICE_ROLE_KEY,{auth:{persistSession:false,autoRefreshToken:false}})}
}
export async function nativeInviteBody(request:Request){
 const reader=request.body?.getReader();if(!reader)throw Error('Missing invite')
 let size=0;const chunks:Uint8Array[]=[]
 try{while(true){const item=await reader.read();if(item.done)break;size+=item.value.length;if(size>4096){await reader.cancel();throw Error('Invite too large')}chunks.push(item.value)}}finally{reader.releaseLock()}
 const body=JSON.parse(Buffer.concat(chunks).toString('utf8'));if(!body || typeof body!=='object' || Array.isArray(body))throw Error('Invalid invite');return body as Record<string,unknown>
}
export async function actOnNativeInvite(service:SupabaseClient,owner:string,body:Record<string,unknown>){
 const token=nativeInviteToken(body.token),join=body.action==='join'
 if(!token || !['preview','join'].includes(String(body.action)) || join && (!body.expected || typeof body.expected!=='object' || Array.isArray(body.expected)))return {ok:false,status:400,message:'Paste a TenAceIQ team invite and review it before joining.'}
 const result=await service.rpc('native_team_invite',{p_owner:owner,p_token:token,p_join:join,p_expected:join?body.expected:null})
 if(result.error || !result.data || typeof result.data!=='object')return {ok:false,status:503,message:'Team invites are unavailable. Retry when your connection is ready.'}
 const data=result.data
 if(data.ok!==true)return {ok:false,status:[403,404,409,503].includes(data.status)?data.status:503,message:typeof data.message==='string'?data.message.slice(0,240):'This invite is unavailable.'}
 if(data.nativeTeamInvite!==1 || data.status!==200)return {ok:false,status:503,message:'This invite could not be confirmed.'}
 if(!join){nativeInviteReview(data.review);return {ok:true,status:200,nativeTeamInvite:1,review:data.review}}
 const scope=data.scope
 if(data.joined!==true || !scope || data.roomId!==(body.expected as {invite?:{roomId?:unknown}}).invite?.roomId || ['teamName','leagueName','flight'].some(key=>scope[key]!==((body.expected as {invite?:Record<string,unknown>}).invite || {})[key]))return {ok:false,status:503,message:'Joining could not be confirmed. Retry the same invite.'}
 return {ok:true,status:200,nativeTeamInvite:1,joined:true,alreadyJoined:data.alreadyJoined===true,roomId:data.roomId,scope}
}

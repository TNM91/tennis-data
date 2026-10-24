import type {SupabaseClient} from '@supabase/supabase-js'
export async function teamRoomJoinExclusion(service:SupabaseClient,owner:string,roomId:string){
 const result=await service.from('team_room_member_removals').select('profile_id').eq('conversation_id',roomId).eq('profile_id',owner).maybeSingle()
 if(result.error)return Response.json({ok:false,message:'Your team access could not be checked. Try again later.'},{status:503,headers:{'Cache-Control':'private, no-store'}})
 if(result.data)return Response.json({ok:false,message:'Your captain must restore your team chat access before you can use this invite.'},{status:403,headers:{'Cache-Control':'private, no-store'}})
 return null
}

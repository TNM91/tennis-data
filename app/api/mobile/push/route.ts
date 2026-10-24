import {createClient} from '@supabase/supabase-js'
import {supabaseKey,supabaseUrl} from '@/lib/supabase'
import {bindPushDevice} from '@/lib/mobile-push-device'
import {nativePushConfigured} from '@/lib/native-chat-push-server'
export const runtime='nodejs'
async function authenticate(request:Request){
 const token=request.headers.get('authorization')?.match(/^Bearer\s+(.+)$/i)?.[1]
 if(!token)return null
 const client=createClient(supabaseUrl,supabaseKey,{auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false}})
 const {data,error}=await client.auth.getUser(token)
 return error?null:data.user?.id || null
}
export async function GET(request:Request){
 if(!await authenticate(request))return Response.json({ok:false},{status:401})
 return Response.json({ok:true,available:nativePushConfigured()},{headers:{'Cache-Control':'private, no-store'}})
}
export async function POST(request:Request){
 const userId=await authenticate(request)
 if(!userId)return Response.json({ok:false},{status:401})
 if(Number(request.headers.get('content-length') || 0)>2048)return Response.json({ok:false},{status:413})
 let body:unknown
 try{const text=await request.text();if(text.length>2048)return Response.json({ok:false},{status:413});body=JSON.parse(text)}catch{return Response.json({ok:false},{status:400})}
 // Revocation must keep working when delivery is disabled or a key is unavailable.
 if((body as {enabled?:unknown})?.enabled===true && !nativePushConfigured())return Response.json({ok:false},{status:503})
 const key=process.env.SUPABASE_SERVICE_ROLE_KEY?.trim()
 if(!key)return Response.json({ok:false},{status:503})
 const service=createClient(supabaseUrl,key,{auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false}})
 const result=await bindPushDevice(service,userId,body)
 return Response.json({ok:result.ok},{status:result.status,headers:{'Cache-Control':'private, no-store'}})
}

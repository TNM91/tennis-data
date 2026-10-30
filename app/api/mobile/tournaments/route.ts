import {getSignedInPlayerApiAuth} from '@/lib/player-api-auth'
import {loadNativeTournaments} from '@/lib/native-tournaments'
import {tournamentInput} from '@/lib/native-tournaments-contract'
export const runtime='nodejs'
export const maxDuration=30
const json=(data:unknown,status:number)=>Response.json(data,{status,headers:{'Cache-Control':'private, no-store','Referrer-Policy':'no-referrer'}})
export async function GET(request:Request){
 const auth=await getSignedInPlayerApiAuth(request)
 if(!auth.ok){auth.response.headers.set('Cache-Control','private, no-store');return auth.response}
 const p=new URL(request.url).searchParams
 let input:ReturnType<typeof tournamentInput>
 try{if([...p.keys()].some(k=>!['q','tournament','division'].includes(k)||p.getAll(k).length!==1))throw Error('Invalid parameters');input=tournamentInput(p.get('q')||'',p.get('tournament')||'',p.get('division')||'')}catch{return json({ok:false,message:'Choose a tournament or use a shorter search.'},400)}
 try{return json({ok:true,...await loadNativeTournaments(auth.supabase,auth.userId,input.query,input.selected,input.division)},200)}catch{return json({ok:false,message:'Tournaments are unavailable. Refresh to try again.'},503)}
}

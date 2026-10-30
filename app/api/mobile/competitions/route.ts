import {getSignedInPlayerApiAuth} from '@/lib/player-api-auth'
import {loadNativeCompetitions} from '@/lib/native-competitions'
import {competitionInput} from '@/lib/native-competitions-contract'
export const runtime='nodejs'
export const maxDuration=30
const json=(data:unknown,status:number)=>Response.json(data,{status,headers:{'Cache-Control':'private, no-store','Referrer-Policy':'no-referrer'}})
export async function GET(request:Request){
 const auth=await getSignedInPlayerApiAuth(request)
 if(!auth.ok){auth.response.headers.set('Cache-Control','private, no-store');return auth.response}
 const p=new URL(request.url).searchParams
 let input:ReturnType<typeof competitionInput>
 try{if([...p.keys()].some(k=>!['scope','q','league'].includes(k)||p.getAll(k).length!==1))throw Error('Invalid parameters');input=competitionInput(p.get('scope')||'discover',p.get('q')||'',p.get('league')||'')}catch{return json({ok:false,message:'Choose a league or use a shorter search.'},400)}
 try{return json({ok:true,...await loadNativeCompetitions(auth.supabase,auth.userId,input.scope,input.query,input.selected)},200)}catch{return json({ok:false,message:'Competitions are unavailable. Refresh to try again.'},503)}
}

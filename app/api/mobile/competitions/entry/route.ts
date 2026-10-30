import {getSignedInPlayerApiAuth} from '@/lib/player-api-auth'
import {loadNativeLeagueEntry,submitNativeLeagueEntry,answerNativeLeagueInformation} from '@/lib/native-league-entry'
import {entryLeague} from '@/lib/native-league-entry-contract'
import {lineupRecord} from '@/lib/native-captain-lineup-contract'
export const runtime='nodejs'
export const maxDuration=60
const json=(data:unknown,status:number)=>Response.json(data,{status,headers:{'Cache-Control':'private, no-store','Referrer-Policy':'no-referrer'}})
export async function GET(request:Request){
 const auth=await getSignedInPlayerApiAuth(request);if(!auth.ok){auth.response.headers.set('Cache-Control','private, no-store');return auth.response}
 let league:string;try{const p=new URL(request.url).searchParams;if([...p.keys()].some(k=>k!=='league')||p.getAll('league').length!==1)throw Error();league=entryLeague(p.get('league'))}catch{return json({ok:false,message:'Choose a league.'},400)}
 try{return json({ok:true,...await loadNativeLeagueEntry(auth.supabase,auth.userId,league)},200)}catch{return json({ok:false,message:'Entry status is unavailable. Refresh to try again.'},503)}
}
export async function POST(request:Request){
 const auth=await getSignedInPlayerApiAuth(request);if(!auth.ok){auth.response.headers.set('Cache-Control','private, no-store');return auth.response}
 let body:Record<string,unknown>;try{
  if(new URL(request.url).search||!request.headers.get('content-type')?.startsWith('application/json'))throw Error()
  const reader=request.body?.getReader();if(!reader)throw Error();let raw='',size=0;const decoder=new TextDecoder();try{while(true){const r=await reader.read();if(r.done)break;size+=r.value.byteLength;if(size>4096){await reader.cancel();return json({ok:false,message:'Entry details are too large.'},413)}raw+=decoder.decode(r.value,{stream:true})}raw+=decoder.decode()}finally{reader.releaseLock()}
  const parsed=JSON.parse(raw);if(!parsed||typeof parsed!=='object'||Array.isArray(parsed))throw Error();body=lineupRecord(parsed)
 }catch{return json({ok:false,message:'Check the entry details.'},400)}
 try{const r=await (body.information===true?answerNativeLeagueInformation:submitNativeLeagueEntry)(auth.supabase,auth.userId,body);return json(r,r.status)}catch{return json({ok:false,message:'Your request could not be confirmed. Check entry status before trying again.'},503)}
}

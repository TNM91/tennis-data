import {getSignedInPlayerApiAuth} from './player-api-auth'
import {loadNativeLeagueEntry,submitNativeLeagueEntry,answerNativeLeagueInformation} from './native-league-entry'
import {entryLeague} from './native-league-entry-contract'
import {lineupRecord} from './native-captain-lineup-contract'
const entryResponse=(firstParty:boolean)=>(data:object,status:number)=>Response.json(firstParty?{...data,releaseScope:'first-party'}:data,{status,headers:{'Cache-Control':'private, no-store','Referrer-Policy':'no-referrer'}})
export async function getNativeLeagueEntry(request:Request,firstParty=false){
 const json=entryResponse(firstParty)
 const auth=await getSignedInPlayerApiAuth(request);if(!auth.ok){if(firstParty)return json({ok:false,message:'Sign in to use league entries.'},auth.response.status);auth.response.headers.set('Cache-Control','private, no-store');return auth.response}
 let league:string;try{const p=new URL(request.url).searchParams;if([...p.keys()].some(k=>k!=='league')||p.getAll('league').length!==1)throw Error();league=entryLeague(p.get('league'))}catch{return json({ok:false,message:'Choose a league.'},400)}
 try{return json({ok:true,...await loadNativeLeagueEntry(auth.supabase,auth.userId,league,...(firstParty?[true] as const:[] as const))},200)}catch{return json({ok:false,message:'Entry status is unavailable. Refresh to try again.'},503)}
}
export async function postNativeLeagueEntry(request:Request,firstParty=false){
 const json=entryResponse(firstParty)
 const auth=await getSignedInPlayerApiAuth(request);if(!auth.ok){if(firstParty)return json({ok:false,message:'Sign in to use league entries.'},auth.response.status);auth.response.headers.set('Cache-Control','private, no-store');return auth.response}
 let body:Record<string,unknown>;try{
  if(new URL(request.url).search||!request.headers.get('content-type')?.startsWith('application/json'))throw Error()
  const reader=request.body?.getReader();if(!reader)throw Error();let raw='',size=0;const decoder=new TextDecoder();try{while(true){const r=await reader.read();if(r.done)break;size+=r.value.byteLength;if(size>4096){await reader.cancel();return json({ok:false,message:'Entry details are too large.'},413)}raw+=decoder.decode(r.value,{stream:true})}raw+=decoder.decode()}finally{reader.releaseLock()}
  const parsed=JSON.parse(raw);if(!parsed||typeof parsed!=='object'||Array.isArray(parsed))throw Error();body=lineupRecord(parsed)
 }catch{return json({ok:false,message:'Check the entry details.'},400)}
 try{const r=await (body.information===true?answerNativeLeagueInformation:submitNativeLeagueEntry)(auth.supabase,auth.userId,body,...(firstParty?[true] as const:[] as const));return json(r,r.status)}catch{return json({ok:false,message:'Your request could not be confirmed. Check entry status before trying again.'},503)}
}

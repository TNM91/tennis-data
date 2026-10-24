import {CapacitorHttp} from '@capacitor/core'
import type {SupabaseClient} from '@supabase/supabase-js'
import type {TeamScope} from './team-room-data'
import {fixtureId,fixtureDate,type TeamFixture,type TeamFixtures} from '../../lib/team-fixtures-contract'
import {fixtureWindow} from '../../lib/team-fixtures-contract'
const record=(value:unknown):Record<string,unknown>=>value&&typeof value==='object'&&!Array.isArray(value)?value as Record<string,unknown>:{}
export function parseTeamFixture(value:unknown,scope:TeamScope):TeamFixture{
 const row=record(value);if(!fixtureId(row.id)||!fixtureDate(row.date)||typeof row.home!=='string'||typeof row.away!=='string'||!row.home.trim()||!row.away.trim()||row.home===row.away||row.home!==scope.teamName&&row.away!==scope.teamName||row.home.length>160||row.away.length>160)throw Error('Fixture unavailable.')
 for(const [key,max] of [['time',80],['facility',240],['status',80],['score',160]] as const)if(typeof row[key]!=='string'||(row[key] as string).length>max)throw Error('Fixture unavailable.')
 return {id:row.id,date:row.date,home:row.home,away:row.away,time:row.time as string,facility:row.facility as string,status:row.status as string,score:row.score as string}
}
function envelope(value:unknown,scope:TeamScope):Record<string,unknown>&{today:string;from:string;until:string}{const row=record(value),returned=record(row.scope);if(row.ok!==true||row.teamFixtures!==1||returned.teamName!==scope.teamName||returned.leagueName!==scope.leagueName||returned.flight!==scope.flight||!fixtureDate(row.today))throw Error('Team schedule could not be confirmed.');const window=fixtureWindow(row.today);if(row.from!==window.from||row.until!==window.until)throw Error('Schedule dates could not be confirmed.');return {...row,today:row.today,from:window.from,until:window.until}}
export function parseTeamFixtures(value:unknown,scope:TeamScope):TeamFixtures{
 const row=envelope(value,scope);if(!Array.isArray(row.upcoming)||!Array.isArray(row.earlier)||row.upcoming.length>40||row.earlier.length>40||typeof row.moreUpcoming!=='boolean'||typeof row.moreEarlier!=='boolean')throw Error('Team schedule unavailable.')
 const seen=new Set<string>(),read=(items:unknown[],older:boolean)=>items.map(value=>{const item=parseTeamFixture(value,scope);if(seen.has(item.id)||item.date<row.from||item.date>row.until||(older?item.date>=row.today:item.date<row.today))throw Error('Schedule section mismatch.');seen.add(item.id);return item}).sort((a,b)=>(older?b.date.localeCompare(a.date):a.date.localeCompare(b.date))||a.id.localeCompare(b.id))
 return {scope:{...scope},today:row.today,from:row.from,until:row.until,upcoming:read(row.upcoming,false),earlier:read(row.earlier,true),moreUpcoming:row.moreUpcoming,moreEarlier:row.moreEarlier}
}
export function parseFixtureDetail(value:unknown,scope:TeamScope,id:string){const row=envelope(value,scope),item=parseTeamFixture(row.fixture,scope);if(row.requestedId!==id||item.id!==id||item.date<row.from||item.date>row.until)throw Error('This fixture is unavailable.');return item}
export async function readTeamFixtures(client:SupabaseClient,owner:string,current:()=>boolean,scope:TeamScope,id='',send:typeof CapacitorHttp.get=options=>CapacitorHttp.get(options)){
 if(id&&!fixtureId(id))throw Error('Fixture unavailable.');const {data,error}=await client.auth.getSession();if(error||data.session?.user.id!==owner||!current())throw Error('Sign in again to open your team schedule.')
 const url=new URL('https://www.tenaceiq.com/api/team-rooms/fixtures');for(const [key,value] of Object.entries({team:scope.teamName,league:scope.leagueName,flight:scope.flight}))url.searchParams.set(key,value);if(id)url.searchParams.set('fixture',id)
 const response=await send({url:url.href,headers:{Authorization:'Bearer '+data.session.access_token},responseType:'json',disableRedirects:true,connectTimeout:12000,readTimeout:12000});if(!current())throw Error('This team is no longer open.');if(response.status!==200)throw Error('Team schedule unavailable. Check your team access and connection.');return response.data as unknown
}

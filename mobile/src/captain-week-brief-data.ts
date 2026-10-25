import type {SupabaseClient} from '@supabase/supabase-js'
import type {TeamScope} from './team-room-data'
import {loadCaptainData,type CaptainMatch} from './captain-data'
import {loadPractices,type NativePractice,type PracticeSnapshot} from './captain-practices-data'
import {readTeamFixtures,parseTeamFixtures} from './team-fixtures-data'
import {fixtureDate,fixtureCancelled,fixtureOpponent,fixtureSignature,type TeamFixture,type TeamFixtures} from '../../lib/team-fixtures-contract'
import {loadMatchCenter,type MatchCenter} from './captain-match-center-data'
import {scenarioOwner} from './captain-scenarios-data'
export type CaptainWeekBrief={scope:TeamScope;today:string;through:string;checkedAt:string;matches:TeamFixture[];moreMatches:boolean;excluded:number;practices:NativePractice[];practiceState:'ready'|'unavailable';morePractices:boolean}
export function briefWindow(today:string){if(!fixtureDate(today))throw Error('Week dates unavailable.');const end=new Date(today+'T12:00:00Z');end.setUTCDate(end.getUTCDate()+6);return {today,through:end.toISOString().slice(0,10)}}
export function briefFixtures(schedule:TeamFixtures){const dates=briefWindow(schedule.today),rows=schedule.upcoming.filter(f=>f.date>=dates.today&&f.date<=dates.through),active=rows.filter(f=>!fixtureCancelled(f)&&!/^(completed?|final|played)$/i.test(f.status)).sort((a,b)=>a.date.localeCompare(b.date)||a.id.localeCompare(b.id));return {...dates,matches:active.slice(0,8),moreMatches:active.length>8||schedule.moreUpcoming,excluded:rows.length-active.length}}
export function briefPractices(snapshot:PracticeSnapshot,owner:string,today:string){const {through}=briefWindow(today),all=snapshot.practices.filter(p=>{if(p.owner!==owner||!fixtureDate(p.date))throw Error('Practice owner or date changed.');return p.date>=today&&p.date<=through&&['proposed','confirmed'].includes(p.status)}).sort((a,b)=>a.date.localeCompare(b.date)||a.time.localeCompare(b.time)||a.id.localeCompare(b.id));return {practices:all.slice(0,8),morePractices:all.length>8||snapshot.more}}
export async function loadCaptainWeekBrief(client:SupabaseClient,owner:string,current:()=>boolean,scope:TeamScope,read={workspace:loadCaptainData,schedule:readTeamFixtures,practices:loadPractices}):Promise<CaptainWeekBrief>{
 await scenarioOwner(client,owner,current);const workspace=await read.workspace(client,owner,current,scope);await scenarioOwner(client,owner,current);if(workspace.scope.teamName!==scope.teamName||workspace.scope.leagueName!==scope.leagueName||workspace.scope.flight!==scope.flight)throw Error('Captain scope changed.')
 const [scheduleResult,practiceResult]=await Promise.allSettled([read.schedule(client,owner,current,scope),read.practices(client,owner,current,scope)]);await scenarioOwner(client,owner,current);if(scheduleResult.status!=='fulfilled')throw Error('Team week unavailable.')
 const schedule=parseTeamFixtures(scheduleResult.value,scope),fixtures=briefFixtures(schedule);let practices:NativePractice[]=[],morePractices=false,practiceState:'ready'|'unavailable'='unavailable'
 if(practiceResult.status==='fulfilled'){const result=briefPractices(practiceResult.value,owner,schedule.today);practices=result.practices;morePractices=result.morePractices;practiceState='ready'}
 return {scope:{...scope},...fixtures,checkedAt:new Date().toISOString(),practices,morePractices,practiceState}
}
export const briefMatch=(scope:TeamScope,fixture:TeamFixture):CaptainMatch=>({id:fixture.id,date:fixture.date,time:fixture.time,facility:fixture.facility,opponent:fixtureOpponent(fixture,scope)})
export async function checkBriefMatch(client:SupabaseClient,owner:string,current:()=>boolean,scope:TeamScope,selected:TeamFixture,read:typeof loadMatchCenter=loadMatchCenter):Promise<MatchCenter>{await scenarioOwner(client,owner,current);const result=await read(client,owner,current,scope,briefMatch(scope,selected));await scenarioOwner(client,owner,current);if(fixtureSignature(result.fixture)!==fixtureSignature(selected))throw Error('This fixture changed. Refresh your week brief.');return result}

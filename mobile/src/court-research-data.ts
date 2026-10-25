import type {SupabaseClient} from '@supabase/supabase-js'
import type {TeamScope} from './team-room-data'
import type {TeamFixture} from '../../lib/team-fixtures-contract'
import {loadCaptainData,type CaptainData} from './captain-data'
import {loadPostMatchReview,resultCourtSignature,type ReviewedCourt} from './post-match-data'
import {loadRosterScout,readRosterPlayers,readRosterPlayer,type RosterPlayer} from './captain-roster-scout-data'
import {loadComparison,type ComparedPlayer} from './comparison-data'
import {loadPartnership,readPartnershipCourts,type Partnership} from './doubles-partnership-data'
export type CourtResearch={players:ComparedPlayer[];partnership:Partnership|null;checkedAt:string}
export const courtResearchSignature=(c:ReviewedCourt)=>JSON.stringify([resultCourtSignature(c.court),c.result,...[c.team,c.opponents].map(people=>people.map(p=>[p.id,p.name]).sort((a,b)=>a[0].localeCompare(b[0])))])
export function courtRosterSelection(workspace:CaptainData,court:ReviewedCourt,ids:string[],pair:boolean):RosterPlayer[]{
 if(ids.length!==(pair?2:1)||new Set(ids).size!==ids.length||ids.some(id=>court.team.filter(p=>p.id===id).length!==1)||pair&&(court.court.type!=='doubles'||court.team.length!==2))throw Error('Choose a confirmed player or doubles pair from your side.')
 return ids.map(id=>{const matches=workspace.roster.filter(p=>p.playerId===id);if(matches.length!==1||!matches[0].id||workspace.roster.filter(p=>p.id===matches[0].id).length!==1)throw Error('These players are not uniquely linked to your current roster.');return matches[0]})
}
export async function loadCourtResearch(client:SupabaseClient,owner:string,scope:TeamScope,fixture:TeamFixture,expected:ReviewedCourt,ids:string[],pair:boolean,current:()=>boolean,readContext:(current:()=>boolean)=>Promise<{fixture:TeamFixture;today:string}>,read={workspace:loadCaptainData,review:loadPostMatchReview,scout:loadRosterScout,partnership:loadPartnership}):Promise<CourtResearch>{
 if(!current())throw Error('This court is no longer open.');const workspace=await read.workspace(client,owner,current,scope);if(!current())throw Error('This court is no longer open.')
 const fresh=await read.review(client,scope,fixture,current,readContext);if(!current())throw Error('This court is no longer open.');const courts=fresh.courts.filter(c=>c.court.id===expected.court.id);if(courts.length!==1||courtResearchSignature(courts[0])!==courtResearchSignature(expected))throw Error('This recorded court changed. Refresh court results.');const chosen=courtRosterSelection(workspace,courts[0],ids,pair)
 // Reuse the workspace authorized within this action, not a second private read.
 const players=await read.scout(client,owner,current,scope,chosen,{workspace:async()=>workspace,players:readRosterPlayers,one:readRosterPlayer,compare:loadComparison});if(!current())throw Error('This court is no longer open.')
 const partnership=pair?await read.partnership(client,owner,current,scope,chosen,{scout:async()=>players,courts:readPartnershipCourts}):null;if(!current())throw Error('This court is no longer open.');return {players,partnership,checkedAt:new Date().toISOString()}
}

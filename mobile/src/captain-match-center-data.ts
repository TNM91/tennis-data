import {readTeamFixtures,parseFixtureDetail} from './team-fixtures-data'
import {fixtureOpponent,fixtureSignature,type TeamFixture} from '../../lib/team-fixtures-contract'
import type {SupabaseClient} from '@supabase/supabase-js'
import type {LineupEditorData} from '../../lib/native-captain-lineup-contract'
import type {CaptainMatch,CaptainReplies} from './captain-data'
import {loadCaptainReplies} from './captain-data'
import {loadLineupEditor} from './captain-lineup-data'
import {loadPublicationReview,type PublicationReview} from './captain-publication-data'
import {loadReplacementReview,type ReplacementReview} from './captain-replacement-data'
import {loadTeamChatUpdate,type TeamScope,type TeamMessage} from './team-room-data'
import {lineupReadiness} from './lineup-readiness'
export type MatchCenter={fixture:TeamFixture;today:string;lineup:LineupEditorData;replies:CaptainReplies;publication:PublicationReview;checkedAt:string}
const sameScope=(a:TeamScope,b:TeamScope)=>a.teamName===b.teamName&&a.leagueName===b.leagueName&&a.flight===b.flight
export function matchCenterContext(scope:TeamScope,match:CaptainMatch,lineup:LineupEditorData,publication:PublicationReview){if(!sameScope(scope,lineup.scope)||!sameScope(scope,publication.scope)||lineup.match.id!==match.id||lineup.match.date!==match.date||lineup.match.opponent!==match.opponent||publication.fixtureId!==match.id||publication.matchDate!==match.date||publication.opponent!==match.opponent||publication.draftVersion!==lineup.version)throw Error('The fixture or working plan changed. Refresh Match Center.')}
export async function readCenterFixture(client:SupabaseClient,owner:string,current:()=>boolean,scope:TeamScope,id:string){const value=await readTeamFixtures(client,owner,current,scope,id);return {fixture:parseFixtureDetail(value,scope,id),today:(value as {today:string}).today}}
export function matchCenterFixture(scope:TeamScope,match:CaptainMatch,fixture:TeamFixture){if(fixture.id!==match.id||fixture.date!==match.date||fixtureOpponent(fixture,scope)!==match.opponent)throw Error('The fixture changed. Refresh your Captain matches.')}
export async function loadMatchCenter(client:SupabaseClient,owner:string,current:()=>boolean,scope:TeamScope,match:CaptainMatch,read={lineup:loadLineupEditor,replies:loadCaptainReplies,publication:loadPublicationReview,fixture:readCenterFixture}):Promise<MatchCenter>{
 if(!current())throw Error('This match is no longer open.')
 const [lineup,replies,publication,fixture]=await Promise.all([read.lineup(client,owner,current,scope,match.id),read.replies(client,owner,current,scope,match),read.publication(client,owner,current,scope,match),read.fixture(client,owner,current,scope,match.id)])
 if(!current())throw Error('This match is no longer open.');matchCenterContext(scope,match,lineup,publication);matchCenterFixture(scope,match,fixture.fixture);return {...fixture,lineup,replies,publication,checkedAt:new Date().toISOString()}
}
const courtShape=(courts:{label:string;players:string[];defaulted?:boolean}[])=>JSON.stringify(courts.map(c=>[c.label,c.defaulted===true,c.players]))
export function workingCourtsMatchShared(data:MatchCenter){if(!data.publication.shared.active)return false;return courtShape(data.lineup.plan.courts.map(c=>({label:c.label,defaulted:c.defaulted,players:c.defaulted?[]:c.players.map(key=>data.lineup.roster.find(p=>p.key===key)?.name||'')})))===courtShape(data.publication.shared.lineup)}
export function matchCenterNext(data:MatchCenter):{action:'plan'|'publish'|'day';label:string;reason:string}{
 const pub=data.publication,ready=lineupReadiness(data.lineup.plan,data.lineup.roster,data.replies)
 if(pub.shared.pendingFinal)return {action:'publish',label:'Review pending final update',reason:'Check the existing delivery before sending another update.'}
 if(pub.shared.alreadyFinal)return {action:'day',label:'Check match-day status',reason:'The final lineup is recorded as sent. Check replacements and arrival updates.'}
 if(!data.lineup.version||ready.openSeats||ready.duplicates||ready.attention.length)return {action:'plan',label:'Review working lineup',reason:ready.openSeats?'Fill the open playing seats before publishing.':ready.attention.length?'Review selected players who are unavailable, uncertain or waiting.':'Save a private working lineup before sharing.'}
 if(pub.shared.active)return {action:'publish',label:pub.shared.canFinalize?'Review final lineup':'Check court confirmations',reason:pub.shared.canFinalize?'Review the confirmed shared courts before sending the final lineup.':'Some shared courts still need replies or captain attention.'}
 return {action:'publish',label:'Review team publishing',reason:pub.proposal.canShare?'Review the saved courts before posting the proposal to your team.':pub.proposal.reason||'Check the saved court plan before publishing.'}
}
export type ArrivalSnapshot={available:boolean;reason:string;here:number;onMyWay:number;runningLate:number;people:{profileId:string;name:string;court:string;status:'here'|'on_my_way'|'running_late'}[]}
export function matchCenterArrivals(publication:PublicationReview,messages:TeamMessage[]):ArrivalSnapshot{
 const empty=(reason:string):ArrivalSnapshot=>({available:false,reason,here:0,onMyWay:0,runningLate:0,people:[]}),shared=publication.shared
 if(!shared.active||!shared.messageId||!shared.alreadyFinal)return empty('A delivered final lineup is required before using arrival updates.')
 const matches=messages.filter(m=>m.id===shared.messageId);if(matches.length!==1)return empty('The exact shared card is not in the latest conversation page. Refresh the team or check Match day.')
 const message=matches[0],card=message.card;if(message.deletedAt||!card||card.cardType!=='projected_lineup'||card.completed||!['active','upcoming'].includes(card.state)||card.matchDate!==publication.matchDate||card.opponent!==publication.opponent||!card.published||courtShape(card.lineup)!==courtShape(shared.lineup))return empty('The shared card changed or is not a current published plan. Refresh Match Center.')
 if(new Set(shared.lineup.map(c=>c.label)).size!==shared.lineup.length)return empty('Court labels are ambiguous. Refresh the shared plan.')
 const seen=new Set<string>(),people:ArrivalSnapshot['people']=[]
 for(const row of card.arrivals||[]){if(!row.profileId||seen.has(row.profileId)||!['here','on_my_way','running_late'].includes(row.status))return empty('Arrival updates could not be matched safely. Refresh the team.');seen.add(row.profileId);const courts=shared.lineup.filter(c=>!c.defaulted&&c.players.includes(row.playerName));if(courts.length!==1||courts[0].label!==row.courtLabel||shared.lineup.filter(c=>!c.defaulted).flatMap(c=>c.players).filter(name=>name===row.playerName).length!==1)return empty('A court assignment changed. Refresh before using arrival updates.');people.push({profileId:row.profileId,name:row.playerName,court:row.courtLabel,status:row.status as ArrivalSnapshot['people'][number]['status']})}
 return {available:true,reason:'Only explicit check-ins on this exact shared card are shown. Missing check-ins do not mean a player is absent.',people,here:people.filter(p=>p.status==='here').length,onMyWay:people.filter(p=>p.status==='on_my_way').length,runningLate:people.filter(p=>p.status==='running_late').length}
}
export type MatchDaySnapshot={publication:PublicationReview;replacement:Pick<ReplacementReview,'currentChange'|'canReplace'|'canSupersede'|'reason'>;arrivals:ArrivalSnapshot;checkedAt:string}
export async function loadMatchCenterDay(client:SupabaseClient,owner:string,current:()=>boolean,scope:TeamScope,match:CaptainMatch,roomId:string,center:MatchCenter,read={publication:loadPublicationReview,replacement:loadReplacementReview,chat:loadTeamChatUpdate,fixture:readCenterFixture}):Promise<MatchDaySnapshot>{
 if(!current()||!roomId)throw Error('Refresh your team before checking match day.')
 const [publication,fixture]=await Promise.all([read.publication(client,owner,current,scope,match),read.fixture(client,owner,current,scope,match.id)]);if(!current())throw Error('This match is no longer open.');matchCenterContext(scope,match,center.lineup,publication);matchCenterFixture(scope,match,fixture.fixture);if(fixtureSignature(fixture.fixture)!==fixtureSignature(center.fixture))throw Error('The fixture details changed. Refresh Match Center.')
 const [replacement,chat]=await Promise.all([read.replacement(client,owner,current,scope,match),read.chat(client,owner,current,scope,roomId)])
 if(!current())throw Error('This match is no longer open.')
 if(!sameScope(replacement.scope,scope)||replacement.fixtureId!==match.id||replacement.matchDate!==match.date||replacement.opponent!==match.opponent||replacement.expectedCardToken!==publication.expectedCardToken||replacement.messageId!==publication.shared.messageId||courtShape(replacement.lineup)!==courtShape(publication.shared.lineup))throw Error('The shared lineup changed. Refresh Match Center before checking match day.')
 return {publication,replacement:{currentChange:replacement.currentChange,canReplace:replacement.canReplace,canSupersede:replacement.canSupersede,reason:replacement.reason},arrivals:matchCenterArrivals(publication,chat.messages),checkedAt:new Date().toISOString()}
}

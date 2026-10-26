import type {SupabaseClient} from '@supabase/supabase-js'
import {loadTeamCourtResults,type TeamCourtMatch} from '../../lib/team-court-results'
import {isPublicTeamDirectoryMatch,isPublicTeamDirectoryName} from '../../lib/team-directory-rules'
import {isValidCalendarDate} from '../../lib/calendar-date'
import {validateTiqTennisMatchScore} from '../../lib/tiq-scoring'
import type {RosterTeamScope} from './team-roster-data'
export type CourtParent={id:string;externalId:string;date:string;home:string;away:string;league:string|null;flight:string|null}
export type CourtPlayer={id:string;name:string}
export type TeamCourtRecord={id:string;date:string;format:'singles'|'doubles';opponent:string;score:string;result:'W'|'L';players:CourtPlayer[]|null}
export type TeamCourtSample={records:TeamCourtRecord[];excluded:number;parentCount:number;sampled:boolean}
const obj=(v:unknown):Record<string,unknown>=>{if(!v||typeof v!=='object'||Array.isArray(v))throw Error('Court records unavailable.');return v as Record<string,unknown>}
const text=(v:unknown,max=200)=>{if(v==null)return null;if(typeof v!=='string'||v.length>max)throw Error('Court records unavailable.');return v.trim()||null}
const id=(v:unknown):v is string=>typeof v==='string'&&/^[a-zA-Z0-9_-]{1,100}$/.test(v)
export function parseCourtParents(value:unknown,team:RosterTeamScope,today=new Date().toISOString().slice(0,10)):CourtParent[] {
 if(!Array.isArray(value)||value.length>22)throw Error('Fixture coverage unavailable.')
 const seen=new Map<string,CourtParent>(),locators=new Set<string>()
 for(const raw of value){const r=obj(raw),home=text(r.home_team),away=text(r.away_team),league=text(r.league_name),flight=text(r.flight),date=text(r.match_date,40),externalId=text(r.external_match_id,1000),source=text(r.source)
 if(!id(r.id)||(home!==team.name&&away!==team.name)||league!==team.league||flight!==team.flight||r.line_number!==null||!home||!away||home===away||!date||!isValidCalendarDate(date.slice(0,10))||!Number.isFinite(Date.parse(date))||date.slice(0,10)>today)throw Error('Fixture scope unavailable.')
 if(!isPublicTeamDirectoryName(home,league)||!isPublicTeamDirectoryName(away,league)||!isPublicTeamDirectoryMatch({homeTeam:home,awayTeam:away,league,source})||/\btiq\b/i.test([league,source].join(' ')))continue
 if(!externalId)continue
 if(externalId.includes('::line:'))throw Error('Fixture locator unavailable.')
 const entry={id:r.id,externalId,date,home,away,league,flight},old=seen.get(r.id)
 if(old&&JSON.stringify(old)!==JSON.stringify(entry))throw Error('Conflicting fixtures.')
 if(!old){if(locators.has(externalId))throw Error('Ambiguous fixture locator.');locators.add(externalId);seen.set(r.id,entry)}
 }
 return [...seen.values()].sort((a,b)=>b.date.localeCompare(a.date)||b.id.localeCompare(a.id)).slice(0,10)
}
function courtPlayers(value:unknown,format:'singles'|'doubles',side:'A'|'B'):CourtPlayer[]|null {
 try{if(!Array.isArray(value)||value.length!==(format==='singles'?2:4))return null
 const entries=value.map(v=>{const r=obj(v);if(!id(r.player_id)||!['A','B'].includes(String(r.side)))throw Error();let joined=r.players;if(Array.isArray(joined)){if(joined.length!==1)throw Error();joined=joined[0]}const p=obj(joined),name=text(p.name);if(p.id!==r.player_id||!name)throw Error();return {id:r.player_id,name,side:r.side}})
 const size=format==='singles'?1:2;if(new Set(entries.map(e=>e.id)).size!==entries.length||entries.filter(e=>e.side==='A').length!==size||entries.filter(e=>e.side==='B').length!==size)return null
 return entries.filter(e=>e.side===side).map(({id,name})=>({id,name})).sort((a,b)=>a.id.localeCompare(b.id))
 }catch{return null}
}
export function parseTeamCourtSample(value:unknown,proof:TeamCourtMatch[],parents:CourtParent[],team:RosterTeamScope):TeamCourtSample {
 if(!Array.isArray(value)||value.length>100||proof.length>100)throw Error('Court coverage unavailable.')
 const parentByExternal=new Map(parents.map(p=>[p.externalId,p])),byId=new Map(proof.map(r=>[r.id,r])),seen=new Set<string>();let excluded=0
 const records:TeamCourtRecord[]=[]
 for(const raw of value){const r=obj(raw),known=typeof r.id==='string'?byId.get(r.id):null,external=text(r.external_match_id,1000),boundary=external?.lastIndexOf('::line:')??-1,parent=boundary>=0?parentByExternal.get(external!.slice(0,boundary)):null
 if(!known||!id(r.id)||seen.has(r.id)||!parent||external!==known.external_match_id||r.winner_side!==known.winner_side||r.score!==known.score||r.match_type!==known.match_type||r.line_number!==known.line_number||r.match_date!==parent.date||text(r.league_name)!==team.league||text(r.flight)!==team.flight||r.public_history_eligible!==true||r.line_number==null||!['singles','doubles'].includes(String(r.match_type))||!['A','B'].includes(String(r.winner_side)))throw Error('Court evidence changed.')
 seen.add(r.id)
 const home=text(r.home_team),away=text(r.away_team),source=text(r.source),score=text(r.score,500)
 if(home!==null&&home!==parent.home||away!==null&&away!==parent.away||/\btiq\b/i.test([source,team.league].join(' ')))throw Error('Court scope unavailable.')
 if(!score||!validateTiqTennisMatchScore(score.replace(/–/g,'-')).valid){excluded++;continue}
 const side=parent.home===team.name?'A':'B',format=r.match_type as 'singles'|'doubles'
 records.push({id:r.id,date:parent.date,format,opponent:side==='A'?parent.away:parent.home,score,result:r.winner_side===side?'W':'L',players:courtPlayers(r.match_players,format,side)})
 }
 records.sort((a,b)=>b.date.localeCompare(a.date)||b.id.localeCompare(a.id));return {records:records.slice(0,25),excluded,parentCount:parents.length,sampled:records.length>25}
}
export function teamCourtPairs(records:TeamCourtRecord[]) {
 const pairs=new Map<string,{key:string;names:string[];played:number;wins:number;losses:number}>()
 for(const row of records){if(row.format!=='doubles'||row.players?.length!==2)continue;const key=JSON.stringify(row.players.map(p=>p.id).sort()),pair=pairs.get(key)??{key,names:row.players.map(p=>p.name),played:0,wins:0,losses:0};pair.played++;if(row.result==='W')pair.wins++;else pair.losses++;pairs.set(key,pair)}
 return [...pairs.values()].sort((a,b)=>b.played-a.played||b.wins-a.wins||a.key.localeCompare(b.key))
}
export async function loadTeamCourtSample(client:SupabaseClient,team:RosterTeamScope,current:()=>boolean):Promise<TeamCourtSample> {
 if(!current()||!team.name||team.name.length>200||!isPublicTeamDirectoryName(team.name,team.league))throw Error('Team visit closed.')
 const owner=async(previous?:string)=>{const {data,error}=await client.auth.getSession();if(error||!data.session||!current()||previous&&previous!==data.session.user.id)throw Error('Team visit closed.');return data.session.user.id},account=await owner(),today=new Date().toISOString().slice(0,10)
 const query=(column:string)=>{let q=client.from('matches').select('id,external_match_id,match_date,home_team,away_team,league_name,flight,line_number,source').is('line_number',null).eq(column,team.name).lte('match_date',today);q=team.league===null?q.is('league_name',null):q.eq('league_name',team.league);q=team.flight===null?q.is('flight',null):q.eq('flight',team.flight);return q.order('match_date',{ascending:false}).order('id',{ascending:false}).limit(11).abortSignal(AbortSignal.timeout(12000))}
 const results=await Promise.all([query('home_team'),query('away_team')]);await owner(account);if(results.some(r=>r.error))throw Error('Fixtures unavailable.')
 const parents=parseCourtParents(results.flatMap(r=>r.data??[]),team,today);if(!parents.length)return {records:[],excluded:0,parentCount:0,sampled:false}
 const courts=await loadTeamCourtResults(client,parents.map(p=>({externalId:p.externalId,matchDate:p.date})),{maxRows:100,signal:AbortSignal.timeout(12000)});await owner(account);if(courts.error||!courts.data)throw Error('Court coverage unavailable.');if(!courts.data.length)return {records:[],excluded:0,parentCount:parents.length,sampled:false}
 const ids=courts.data.map(r=>r.id);if(ids.some(v=>!id(v))||new Set(ids).size!==ids.length)throw Error('Court identities unavailable.')
 const hydrated=await client.from('matches').select('id,external_match_id,match_date,home_team,away_team,league_name,flight,line_number,source,score,winner_side,match_type,public_history_eligible,match_players(player_id,side,players(id,name))').in('id',ids).eq('public_history_eligible',true).order('id').limit(101).limit(5,{referencedTable:'match_players'}).abortSignal(AbortSignal.timeout(12000));await owner(account);if(hydrated.error)throw Error('Court records unavailable.');return parseTeamCourtSample(hydrated.data,courts.data,parents,team)
}

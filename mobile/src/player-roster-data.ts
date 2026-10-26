import type {SupabaseClient} from '@supabase/supabase-js'
import {isPublicTeamDirectoryName,isPublicTeamDirectoryMatch} from '../../lib/team-directory-rules'
import {isValidCalendarDate} from '../../lib/calendar-date'
import {loadTeamRecords,type TeamChoice,type TeamRecord} from './directory-data'
export type PlayerRosterTeam={key:string;name:string;league:string|null;flight:string|null;section:string|null;district:string|null;source:'observation'}
const key=(v:unknown):v is string=>typeof v==='string'&&/^[a-zA-Z0-9_-]{1,100}$/.test(v)
const object=(v:unknown):Record<string,unknown>=>{if(!v||typeof v!=='object'||Array.isArray(v))throw Error('Roster unavailable.');return v as Record<string,unknown>}
const text=(v:unknown,max=200)=>{if(v==null)return null;if(typeof v!=='string'||v.length>max)throw Error('Roster unavailable.');return v.trim()||null}
const tiq=(fields:Array<string|null>)=>/\btiq\b/i.test(fields.filter(Boolean).join(' '))
export function parsePlayerRoster(rows:unknown,count:unknown,playerId:string):PlayerRosterTeam[] {
 if(!Array.isArray(rows)||rows.length>50||count!==rows.length)throw Error('Roster coverage unavailable.')
 const teams=new Map<string,PlayerRosterTeam>()
 for(const raw of rows){const r=object(raw);if(r.player_id!==playerId)throw Error('Roster unavailable.')
 const name=text(r.team_name),league=text(r.league_name),flight=text(r.flight),section=text(r.usta_section),district=text(r.district_area),source=text(r.source)
 if(!name||name.toLowerCase()==='name'||!isPublicTeamDirectoryName(name,league)||tiq([source,league,section,district]))continue
 const teamKey=JSON.stringify([name.toLowerCase(),league?.toLowerCase()??'',flight?.toLowerCase()??''])
 if(!teams.has(teamKey))teams.set(teamKey,{key:teamKey,name,league,flight,section,district,source:'observation'})
 }
 return [...teams.values()].sort((a,b)=>a.name.localeCompare(b.name)||a.key.localeCompare(b.key))
}
async function owner(client:SupabaseClient,current:()=>boolean,previous?:string) {const {data,error}=await client.auth.getSession();if(error||!current()||!data.session||previous&&previous!==data.session.user.id)throw Error('Player visit closed.');return data.session.user.id}
export async function loadPlayerRoster(client:SupabaseClient,playerId:string,current:()=>boolean) {
 if(!current()||!key(playerId))throw Error('Player visit closed.')
 const account=await owner(client,current)
 const {data,error,count}=await client.from('team_roster_members').select('player_id,team_name,league_name,flight,usta_section,district_area,source',{count:'exact'}).eq('player_id',playerId).order('team_name').order('league_name').order('flight').limit(51).abortSignal(AbortSignal.timeout(12000))
 await owner(client,current,account);if(error)throw Error('Roster unavailable.');return parsePlayerRoster(data,count,playerId)
}
export function parsePlayerTeamRecords(value:unknown,team:TeamChoice):TeamRecord[] {
 if(!Array.isArray(value)||value.length>10)throw Error('Team records unavailable.')
 const records=value.map(raw=>{const r=object(raw),id=r.id;if(!key(id))throw Error('Team records unavailable.')
 const home=text(r.home_team),away=text(r.away_team),league=text(r.league_name),flight=text(r.flight),date=text(r.match_date,40),score=text(r.score,500),status=text(r.status,100),source=text(r.source)
 if((home!==team.name&&away!==team.name)||league!==team.league||flight!==team.flight||!isPublicTeamDirectoryMatch({homeTeam:home,awayTeam:away,league,source})||tiq([source,league])||date!==null&&(!isValidCalendarDate(date.slice(0,10))||!Number.isFinite(Date.parse(date))))throw Error('Team records unavailable.')
 return {id,home_team:home,away_team:away,league_name:league,flight,match_date:date,score,status,source}
 })
 if(new Set(records.map(r=>r.id)).size!==records.length)throw Error('Team records unavailable.')
 return records
}
export async function loadPlayerTeamRecords(client:SupabaseClient,team:PlayerRosterTeam,current:()=>boolean) {
 if(!current()||!team.name||team.name.length>200||!isPublicTeamDirectoryName(team.name,team.league))throw Error('Team records unavailable.')
 const account=await owner(client,current),rows=await loadTeamRecords(client,team);await owner(client,current,account);return parsePlayerTeamRecords(rows,team)
}

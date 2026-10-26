import type {SupabaseClient} from '@supabase/supabase-js'
import {normalizeTeamName} from '../../lib/captain-formatters'
import {isPublicTeamDirectoryName} from '../../lib/team-directory-rules'
import {parseProfileHeaderPlayer,type ProfileHeaderPlayer} from './player-profile-header-data'
import type {PlayerRosterTeam} from './player-roster-data'
export type RosterTeamScope=Pick<PlayerRosterTeam,'name'|'league'|'flight'>
export type TeamRosterPlayer={id:string;name:string;ntrp:number|null;player:ProfileHeaderPlayer|null}
const object=(v:unknown):Record<string,unknown>=>{if(!v||typeof v!=='object'||Array.isArray(v))throw Error('Roster unavailable.');return v as Record<string,unknown>}
const text=(v:unknown)=>{if(v==null)return null;if(typeof v!=='string'||v.length>200)throw Error('Roster unavailable.');return v.trim()||null}
const validId=(v:unknown):v is string=>typeof v==='string'&&/^[a-zA-Z0-9_-]{1,100}$/.test(v)
export function parseTeamRoster(rows:unknown,count:unknown,team:RosterTeamScope):TeamRosterPlayer[] {
 if(!Array.isArray(rows)||rows.length>50||count!==rows.length)throw Error('Roster coverage unavailable.')
 const players=new Map<string,TeamRosterPlayer>()
 for(const raw of rows){const r=object(raw),name=text(r.team_name),league=text(r.league_name),flight=text(r.flight)
 if(!name||normalizeTeamName(name)!==normalizeTeamName(team.name)||league!==team.league||flight!==team.flight)throw Error('Roster scope unavailable.')
 if(/\btiq\b/i.test([text(r.source),league,text(r.usta_section),text(r.district_area)].filter(Boolean).join(' ')))continue
 if(!validId(r.player_id))throw Error('Roster identity unavailable.')
 const recordedName=text(r.player_name);if(!recordedName||recordedName.toLowerCase()==='name')throw Error('Roster identity unavailable.')
 const ntrp=r.ntrp??null;if(ntrp!==null&&(typeof ntrp!=='number'||!Number.isFinite(ntrp)||ntrp<1.5||ntrp>7))throw Error('Roster rating unavailable.')
 let joined=r.players??null;if(Array.isArray(joined)){if(joined.length>1)throw Error('Roster identity unavailable.');joined=joined[0]??null}
 if(joined!==null&&object(joined).id!==r.player_id)throw Error('Roster identity unavailable.')
 const player=joined===null?null:parseProfileHeaderPlayer(joined,r.player_id)
 const entry={id:r.player_id,name:player?.name??recordedName,ntrp,player},previous=players.get(r.player_id)
 if(previous&&JSON.stringify(previous)!==JSON.stringify(entry))throw Error('Conflicting roster records.')
 players.set(r.player_id,entry)
 }
 return [...players.values()].sort((a,b)=>a.name.localeCompare(b.name)||a.id.localeCompare(b.id))
}
export async function loadTeamRoster(client:SupabaseClient,team:RosterTeamScope,current:()=>boolean) {
 if(!current()||!team.name||team.name.length>200||!isPublicTeamDirectoryName(team.name,team.league))throw Error('Team visit closed.')
 const owner=async(previous?:string)=>{const {data,error}=await client.auth.getSession();if(error||!current()||!data.session||previous&&previous!==data.session.user.id)throw Error('Team visit closed.');return data.session.user.id}
 const account=await owner()
 let q=client.from('team_roster_members').select('team_name,player_id,player_name,league_name,flight,ntrp,source,usta_section,district_area,players(id,name,location,flight,overall_rating,singles_rating,doubles_rating,overall_dynamic_rating,singles_dynamic_rating,doubles_dynamic_rating,rating_source,tiq_rating_status,tiq_rating_model,tiq_rating_season,tiq_singles_matches,tiq_doubles_matches)',{count:'exact'}).eq('normalized_team_name',normalizeTeamName(team.name))
 q=team.league===null?q.is('league_name',null):q.eq('league_name',team.league)
 q=team.flight===null?q.is('flight',null):q.eq('flight',team.flight)
 const {data,count,error}=await q.order('player_name').order('player_id').limit(51).abortSignal(AbortSignal.timeout(12000))
 await owner(account);if(error)throw Error('Roster unavailable.');return parseTeamRoster(data,count,team)
}

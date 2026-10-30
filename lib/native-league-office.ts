import type {SupabaseClient} from '@supabase/supabase-js'
import type {OfficeLeague,OfficeSnapshot} from './native-league-office-contract'
import {nativeLeagueColumns as columns,readNativeLeagueSeason} from './native-league-season'
const str=(v:unknown)=>typeof v==='string'?v.trim():''
type Row=Record<string,unknown>
const checked=(r:{data:unknown;error:unknown},max:number):Row[]=>{if(r.error||!Array.isArray(r.data)||r.data.length>max)throw Error('League records unavailable');return r.data as Row[]}
function mapLeague(r:Row,owner:string):OfficeLeague{if(r.created_by_user_id!==owner||!str(r.id)||!str(r.league_name)||!['team','individual'].includes(str(r.league_format)))throw Error('League ownership changed');return {id:str(r.id),name:str(r.league_name),format:r.league_format as 'team'|'individual',season:str(r.season_label),status:str(r.season_status),flight:str(r.flight),location:str(r.location_label),startsOn:str(r.starts_on),endsOn:str(r.ends_on),timeZone:str(r.schedule_time_zone)||'America/Chicago',updatedAt:str(r.updated_at)}}
export async function loadNativeLeagueOffice(db:SupabaseClient,owner:string,selected=''):Promise<OfficeSnapshot>{
 if(!owner||selected.length>80||selected&&!/^[a-zA-Z0-9_-]+$/.test(selected))throw Error('Invalid league selection')
 const raw=checked(await db.from('tiq_leagues').select(columns).eq('created_by_user_id',owner).order('updated_at',{ascending:false}).order('id').limit(21).abortSignal(AbortSignal.timeout(12000)),21),leagues=raw.slice(0,20).map(r=>mapLeague(r,owner)),base:OfficeSnapshot={owner,checkedAt:new Date().toISOString(),leagues,moreLeagues:raw.length>20,detail:null}
 if(!selected)return base
 const league=leagues.find(l=>l.id===selected),source=raw.find(l=>l.id===selected);if(!league||!source)throw Error('League no longer in this account list')
 return {...base,detail:await readNativeLeagueSeason(db,league,source,async()=>{const latest=await db.from('tiq_leagues').select(columns).eq('id',selected).eq('created_by_user_id',owner).abortSignal(AbortSignal.timeout(12000)).maybeSingle();if(latest.error)throw Error('League records unavailable');return latest.data})}
}

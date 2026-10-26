import {useEffect,useId,useRef,useState} from 'react'
import type {SupabaseClient} from '@supabase/supabase-js'
import {createRoot} from 'react-dom/client'
import {loadTeamRoster,type TeamRosterPlayer,type RosterTeamScope} from './team-roster-data'
import {headerRating} from './player-profile-header-data'
import cards from './player-performance.module.css'
import styles from '../../app/components/tennis-insight-cards.module.css'
import rosterStyles from './player-roster.module.css'
import {TeamRosterDepth} from './team-roster-depth-view'
import {sortRosterPlayers,type RosterSort} from './team-roster-depth'
export function teamRosterRating(row:TeamRosterPlayer,view:'singles'|'doubles') {
 if(!row.player)return {value:'Not recorded',note:'Player rating unavailable'}
 const rating=headerRating(row.player,view)
 if(row.player[`${view}_dynamic_rating`]==null&&rating.evidence.status!=='unknown'&&rating.evidence.status!=='review')return {value:'Not recorded',note:'No separate discipline rating'}
 return {value:rating.evidence.status==='unknown'||rating.evidence.status==='review'?rating.value:row.player[`${view}_dynamic_rating`]==null?'Not recorded':rating.value,note:rating.evidence.label}
}
export function TeamRosterCards({rows,search,onSearch,sort='name',onSort}:{rows:TeamRosterPlayer[];search:string;onSearch:(value:string)=>void;sort?:RosterSort;onSort?:(value:RosterSort)=>void}) {
 const input=useId(),sortId=useId(),term=search.trim().replace(/\s+/g,' ').toLocaleLowerCase(),filtered=sortRosterPlayers(rows,sort).filter(row=>row.name.replace(/\s+/g,' ').toLocaleLowerCase().includes(term))
 return <><label htmlFor={input}>Find a roster player</label><input className={rosterStyles.searchInput} id={input} type="search" maxLength={100} value={search} onChange={e=>onSearch(e.target.value)}/><label htmlFor={sortId}>Sort roster</label><select className={rosterStyles.searchInput} id={sortId} value={sort} onChange={e=>onSort?.(e.target.value as RosterSort)}><option value="name">Player name</option><option value="singles">Singles TIQ: highest first</option><option value="doubles">Doubles TIQ: highest first</option><option value="ntrp">Recorded NTRP: highest first</option></select>{sort==='singles'||sort==='doubles'?<p>Rating sorts include current and provisional estimates. Unavailable ratings appear last.</p>:null}<p role="status">{filtered.length} of {rows.length} listed players</p>{rows.length===0?<p>No linked public roster players are available for this team, league and flight yet.</p>:filtered.length===0?<p>No roster players match your search.</p>:<ul className={`${cards.list} ${rosterStyles.fixtures}`}>{filtered.map(row=><li key={row.id} className={`${cards.season} ${rosterStyles.row}`}><h3>{row.name}</h3><dl className={cards.grid}><div><dt>Recorded NTRP</dt><dd>{row.ntrp===null?'Not recorded':row.ntrp.toFixed(1)}</dd></div>{(['singles','doubles'] as const).map(view=>{const rating=teamRosterRating(row,view);return <div key={view}><dt>{view==='singles'?'Singles':'Doubles'} TIQ</dt><dd>{rating.value}</dd><p>{rating.note}</p></div>})}</dl></li>)}</ul>}<p>Roster listings may include earlier seasons. Recorded NTRP is source-reported; TIQ is an estimate, not an official USTA rating.</p></>
}
export function TeamRosterSection({client,team,current}:{client:SupabaseClient;team:RosterTeamScope;current:()=>boolean}) {
 const [state,setState]=useState<'idle'|'loading'|'ready'|'failed'>('idle'),[rows,setRows]=useState<TeamRosterPlayer[]>([]),[search,setSearch]=useState(''),[sort,setSort]=useState<RosterSort>('name'),alive=useRef(true),request=useRef(0),busy=useRef(false)
 useEffect(()=>{alive.current=true;return()=>{alive.current=false}},[])
 const load=async()=>{if(busy.current||!alive.current||!current())return;busy.current=true;const revision=++request.current,valid=()=>alive.current&&current()&&revision===request.current;setState('loading');try{const result=await loadTeamRoster(client,team,valid);if(valid()){setRows(result);setState('ready')}}catch{if(valid())setState('failed')}finally{if(revision===request.current)busy.current=false}}
 return <section className={`${cards.panel} ${rosterStyles.fixturePanel}`} aria-label="Team roster"><h3>Team roster</h3>{state==='idle'?<p>See linked players and their recorded ratings for this team, league and flight.</p>:state==='loading'?<p role="status">Loading team roster...</p>:state==='failed'?<p role="alert">The roster could not be confirmed. Check your connection and retry.</p>:<><TeamRosterDepth rows={rows}/><TeamRosterCards rows={rows} search={search} onSearch={setSearch} sort={sort} onSort={setSort}/></>}<button type="button" className={styles.button} disabled={state==='loading'} onClick={()=>{void load()}}>{state==='loading'?'Loading team roster...':state==='idle'?'Load team roster':state==='failed'?'Retry team roster':'Refresh team roster'}</button></section>
}

export function showTeamRoster(host:HTMLElement,client:SupabaseClient,team:RosterTeamScope,current:()=>boolean) {
 let disposed=false;const root=createRoot(host),valid=()=>!disposed&&host.isConnected&&current()
 root.render(<div className="website-ui"><TeamRosterSection client={client} team={team} current={valid}/></div>)
 return {dispose:()=>{disposed=true;root.unmount();host.replaceChildren()}}
}

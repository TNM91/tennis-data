import {useEffect,useRef,type ReactNode} from 'react'
import {createRoot} from 'react-dom/client'
import type {SupabaseClient} from '@supabase/supabase-js'
import {loadPlayerRoster,loadPlayerTeamRecords,type PlayerRosterTeam} from './player-roster-data'
import type {TeamRecord} from './directory-data'
import {matchDate} from './recent-results'
import cards from './player-performance.module.css'
import styles from '../../app/components/tennis-insight-cards.module.css'
import rosterStyles from './player-roster.module.css'
export function PlayerRosterTeams({teams,onOpen,onRefresh}:{teams:PlayerRosterTeam[];onOpen:(team:PlayerRosterTeam)=>void;onRefresh?:()=>void}) {
 return <div className="website-ui"><section className={cards.panel} aria-label="Player roster teams"><small className={cards.kicker}>Team context</small><h2>Roster teams</h2><p>Linked roster records may include earlier seasons. Open a team to review its recorded fixtures.</p>{teams.length?<div className={cards.list}>{teams.map(team=><article key={team.key} className={`${cards.season} ${rosterStyles.row}`}><h3>{team.name}</h3><p>{[team.league,team.flight].filter(Boolean).join(' · ')||'League and flight unavailable'}</p>{team.section||team.district?<p>{[team.section,team.district].filter(Boolean).join(' · ')}</p>:null}<p>Roster listing</p><button type="button" className={styles.button} aria-label={['View team',team.name,team.league,team.flight].filter(Boolean).join(' ')} onClick={()=>onOpen(team)}>View team</button></article>)}</div>:<p>No linked public roster teams are available for this player yet.</p>}{onRefresh?<button type="button" className={styles.button} onClick={onRefresh}>Refresh roster teams</button>:null}</section></div>
}
export function PlayerTeamFixtures({team,records}:{team:PlayerRosterTeam;records:TeamRecord[]}) {
 return <section className={`${cards.panel} ${rosterStyles.fixturePanel}`} aria-label="Recorded team fixtures"><p>{team.league??'League unavailable'} · {team.flight??'Flight unavailable'}</p><p>Up to ten records for this exact team, league and flight. Fixtures may include scheduled matches.</p>{records.length?<ol className={`${cards.list} ${rosterStyles.fixtures}`}>{records.map(r=><li key={r.id} className={`${cards.season} ${rosterStyles.row}`}><strong>{r.home_team} vs {r.away_team}</strong><p>{matchDate(r.match_date)}</p><p>Recorded score: {r.score??'Unavailable'}</p><p>{r.status??'Status unavailable'}</p></li>)}</ol>:<p>No recorded fixtures are available for this team, league and flight yet.</p>}<p>Scores follow the source’s court order. This sample is not a full-season record.</p></section>
}
function TeamFrame({team,onClose,children}:{team:PlayerRosterTeam;onClose:()=>void;children:ReactNode}) {
 const heading=useRef<HTMLHeadingElement>(null);useEffect(()=>{heading.current?.focus()},[])
 return <><h2 tabIndex={-1} ref={heading}>{team.name}</h2>{children}<button type="button" className={styles.button} onClick={onClose}>Back to player profile</button></>
}
export function openPlayerTeam(client:SupabaseClient,team:PlayerRosterTeam,current:()=>boolean) {
 const previous=document.activeElement instanceof HTMLElement?document.activeElement:null,dialog=document.createElement('dialog');dialog.className='captain-lineup-dialog website-ui';dialog.setAttribute('aria-label','Player roster team')
 let disposed=false,version=0;const valid=()=>!disposed&&current(),root=createRoot(dialog)
 const close=()=>{if(disposed)return;disposed=true;version++;root.unmount();dialog.remove();if(current()&&previous?.isConnected)previous.focus({preventScroll:true})}
 const load=async()=>{if(!valid())return;const attempt=++version;root.render(<TeamFrame key={attempt+':loading'} team={team} onClose={close}><p role="status">Loading team fixtures…</p></TeamFrame>);try{const rows=await loadPlayerTeamRecords(client,team,()=>valid()&&attempt===version);if(!valid()||attempt!==version)return;root.render(<TeamFrame key={attempt+':ready'} team={team} onClose={close}><PlayerTeamFixtures team={team} records={rows}/></TeamFrame>)}catch{if(!valid()||attempt!==version)return;root.render(<TeamFrame key={attempt+':failed'} team={team} onClose={close}><p role="alert">These team fixtures could not be confirmed. Check your connection and retry.</p><button type="button" className={styles.button} onClick={()=>{void load()}}>Retry team fixtures</button></TeamFrame>)}}
 dialog.oncancel=e=>{e.preventDefault();close()};document.body.append(dialog);dialog.showModal();void load()
 return {dispose:close,isOpen:()=>!disposed}
}
export function showPlayerRosterTeams(host:HTMLElement,client:SupabaseClient,playerId:string,current:()=>boolean) {
 let disposed=false,attempt=0,team:ReturnType<typeof openPlayerTeam>|null=null;const root=createRoot(host),valid=()=>!disposed&&current()&&host.isConnected
 const load=async()=>{if(!valid())return;const version=++attempt;team?.dispose();team=null;root.render(<div className="website-ui"><h2>Roster teams</h2><p role="status">Loading linked roster records…</p></div>);try{const rows=await loadPlayerRoster(client,playerId,()=>valid()&&version===attempt);if(!valid()||version!==attempt)return;root.render(<PlayerRosterTeams teams={rows} onRefresh={()=>{void load()}} onOpen={choice=>{if(!valid())return;team?.dispose();team=openPlayerTeam(client,choice,valid)}}/>)}catch{if(!valid()||version!==attempt)return;root.render(<div className="website-ui"><h2>Roster teams</h2><p role="alert">Linked roster records could not be confirmed. This does not mean the player has no teams.</p><button type="button" className={styles.button} onClick={()=>{void load()}}>Retry roster teams</button></div>)}}
 void load();return {closeTeam:()=>{if(!team?.isOpen())return false;team.dispose();team=null;return true},dispose:()=>{disposed=true;attempt++;team?.dispose();team=null;root.unmount();host.replaceChildren()}}
}

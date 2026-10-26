import {useState} from 'react'
import {createRoot} from 'react-dom/client'
import type {SupabaseClient} from '@supabase/supabase-js'
import PlayerCareerRecords from '../../app/components/player-career-records'
import styles from '../../app/components/tennis-insight-cards.module.css'
import cards from './player-performance.module.css'
import {getRatingViewLabel,type RatingView} from '../../lib/player-rating-display'
import {journeyViews} from './player-journey-data'
import {loadPlayerPerformance,playerPerformanceSummary,type PlayerPerformanceData} from './player-performance-data'
import {FollowAccessError} from './follows-data'
export function PlayerPerformance({data}:{data:PlayerPerformanceData}) {
  const [view,setView]=useState<RatingView>('overall')
  const summary=playerPerformanceSummary(data,view)
  return <div className="website-ui"><h2>Performance</h2>
    {!summary?<p role="status">The loaded public match history is incomplete. Personal records and season totals are withheld until the complete record is available.</p>:<>
      <p>{data.matches.length} public decided matches loaded across recorded years. Pending results and future matches are excluded.</p>
      {data.snapshots.length>0?<div className={styles.chartNavigation} role="group" aria-label="Peak TIQ format">{journeyViews.map(kind=><button key={kind} type="button" className={styles.button} aria-pressed={view===kind} onClick={()=>setView(kind)}>{getRatingViewLabel(kind)}</button>)}</div>:null}
      {data.ratingsLimited?<p role="status">The loaded rating history is incomplete. Peak TIQ and yearly rating movement are withheld; match records remain available.</p>:<p>{getRatingViewLabel(view)} peak uses saved TIQ history. Streaks and seasons use all loaded public decided matches.</p>}
      {summary.careerHighs.peakRating!==null||summary.careerHighs.bestSeason?<PlayerCareerRecords careerHighs={summary.careerHighs} coverage="Best marks in this player’s recorded public history. Best season means most wins; ties keep the latest year."/>:null}
      {summary.seasons.length?<section className={cards.panel} aria-label="Year-by-year performance"><small className={cards.kicker}>Season history</small><h2>Year-by-year performance</h2><p>Match record, Singles/Doubles split and recorded rating movement by calendar year.</p><div className={cards.list}>{summary.seasons.map(season=><article className={cards.season} key={season.year}><div className={cards.top}><strong>{season.year}</strong><span>{season.winRate}% wins</span></div><dl className={cards.grid}><div><dt>Record</dt><dd>{season.wins}W-{season.losses}L</dd></div><div><dt>Singles</dt><dd>{season.singles}</dd></div><div><dt>Doubles</dt><dd>{season.doubles}</dd></div><div><dt>Recorded movement</dt><dd>{season.netDelta===null?'—':`${season.netDelta>0?'+':''}${season.netDelta.toFixed(3)}`}</dd></div></dl><p>{data.ratingsLimited?'Rating movement is unavailable while history is incomplete.':`${season.movementCount} of ${season.total} match movements recorded. Missing changes are not zero.`}</p></article>)}</div></section>:<p>No public decided matches are recorded yet. Season records appear after reviewed results connect to this player.</p>}
    </>}
    <p>TIQ is an estimate, not an official USTA rating. These are recorded results, not a forecast.</p>
  </div>
}
export function showPlayerPerformance(host:HTMLElement,client:SupabaseClient,playerId:string,current:()=>boolean) {
  let disposed=false,request=0,root:ReturnType<typeof createRoot>|null=null
  const valid=()=>!disposed&&current()&&host.isConnected
  const load=async()=>{const version=++request;root?.unmount();root=null;host.innerHTML='<h2>Performance</h2><p role="status">Loading player performance…</p>'
    try{const data=await loadPlayerPerformance(client,playerId,valid);if(!valid()||version!==request)return;host.innerHTML='';root=createRoot(host);root.render(<PlayerPerformance data={data}/>)}
    catch(error){if(!valid()||version!==request)return;if(error instanceof FollowAccessError){host.innerHTML='<h2>Performance</h2><p>Personal records and season analysis are included with Player access.</p>';return}host.innerHTML='<h2>Performance</h2><p role="alert">Can’t load player performance. Check your connection and try again.</p><button type="button" class="secondary">Retry performance</button>';host.querySelector<HTMLButtonElement>('button')!.onclick=()=>{void load()}}
  };void load()
  return {dispose:()=>{disposed=true;request++;root?.unmount();root=null;host.replaceChildren()}}
}

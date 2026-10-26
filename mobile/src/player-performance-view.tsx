import {PlayerMatchQuality} from '../../app/components/player-profile-overview'
import {playerMatchQuality} from '../../lib/player-profile-overview'
import type {PlayerChoice} from './player-connection'
import {useState} from 'react'
import {createRoot} from 'react-dom/client'
import type {SupabaseClient} from '@supabase/supabase-js'
import {PlayerBenchmarkPanel,PlayerOpponentQualityPanel} from '../../app/components/player-benchmark-panels'
import PlayerCareerRecords from '../../app/components/player-career-records'
import styles from '../../app/components/tennis-insight-cards.module.css'
import cards from './player-performance.module.css'
import {getRatingViewLabel,type RatingView} from '../../lib/player-rating-display'
import {journeyViews} from './player-journey-data'
import {loadPlayerPerformance,playerPerformanceSummary,playerInsightSummary,type PlayerPerformanceData} from './player-performance-data'
import {FollowAccessError} from './follows-data'
export function PlayerPerformance({data,onRefresh,onOpenPlayer}:{data:PlayerPerformanceData;onRefresh?:()=>void;onOpenPlayer?:(player:PlayerChoice)=>void}) {
  const [view,setView]=useState<RatingView>('overall')
  const summary=playerPerformanceSummary(data,view),insight=playerInsightSummary(data,view)
  return <div className="website-ui"><h2>Performance</h2>
    {!summary?<p role="status">The loaded public match history is incomplete. Personal records and season totals are withheld until the complete record is available.</p>:<>
      <p>{data.matches.length} public decided matches loaded across recorded years. Pending results and future matches are excluded.</p>
      {data.snapshots.length>0||data.matches.length>0||data.insight?.player?<div className={styles.chartNavigation} role="group" aria-label="Performance format">{journeyViews.map(kind=><button key={kind} type="button" className={styles.button} aria-pressed={view===kind} onClick={()=>setView(kind)}>{getRatingViewLabel(kind)}</button>)}</div>:null}
      {data.ratingsLimited?<p role="status">The loaded rating history is incomplete. Peak TIQ and yearly rating movement are withheld; match records remain available.</p>:<p>{getRatingViewLabel(view)} peak uses saved TIQ history. Streaks and seasons use all loaded public decided matches.</p>}
      <PlayerMatchQuality metrics={playerMatchQuality(data.matches.filter(m=>view==='overall'||m.matchType===view),data.ratingsLimited?[]:data.snapshots.filter(s=>s.view===view&&s.opponentRating!==null).map(s=>s.opponentRating!),getRatingViewLabel(view))}/>
      {summary.careerHighs.peakRating!==null||summary.careerHighs.bestSeason?<PlayerCareerRecords careerHighs={summary.careerHighs} coverage="Best marks in this player’s recorded public history. Best season means most wins; ties keep the latest year."/>:null}
      {insight?<><p>{getRatingViewLabel(view)} comparisons use selected-format results and snapshots. Streaks and yearly records remain across all formats.</p>{onRefresh&&(!data.insight?.player||!insight.reference)?<button type="button" className={styles.button} onClick={onRefresh}>Retry comparison data</button>:null}<PlayerBenchmarkPanel benchmark={insight.benchmark} reference={insight.reference} ratingNote={insight.usedOverall?'Missing split TIQ; the recorded Overall estimate is used.':undefined}/>
        {data.ratingsLimited?<p>Opponent breakdown is unavailable while rating history is incomplete.</p>:!data.insight?.player?<p>Player baseline details could not be loaded. Retry comparison data to check again.</p>:insight.baseline===null?<p>A verified published USTA baseline is needed for the opponent-strength breakdown.</p>:insight.bands?<PlayerOpponentQualityPanel bands={insight.bands} baseline={insight.baseline} matchCount={insight.matchCount}/>:<p>No usable opponent ratings are recorded for this format yet.</p>}</>:null}
      {data.repeatOpponents!==undefined?<section className={cards.panel} aria-label="Repeat opponents"><small className={cards.kicker}>Rivalry records</small><h2>Repeat opponents</h2><p>Players or doubles pairs faced at least twice. Records use all public decided matches, across formats.</p>{data.repeatOpponents===null?<><p role="status">Complete opponent records could not be confirmed. Head-to-head totals are withheld.</p>{onRefresh?<button type="button" className={styles.button} onClick={onRefresh}>Retry opponent records</button>:null}</>:data.repeatOpponents.length?<div className={cards.list}>{data.repeatOpponents.map(opponent=><article className={cards.season} key={opponent.key}><div className={cards.top}>{opponent.id&&onOpenPlayer?<button type="button" className={cards.opponent} onClick={()=>onOpenPlayer({id:opponent.id!,name:opponent.name.split(' / ')[0],location:null,flight:null})}>{opponent.name}<span className={cards.linkHint}>View {opponent.name.includes(' / ')?'first player’s':'player'} profile</span></button>:<strong>{opponent.name}</strong>}<span className={opponent.wins/opponent.total>=.7?cards.strong:opponent.wins/opponent.total<=.3?cards.struggling:cards.balanced}>{Math.round(opponent.wins/opponent.total*100)}% wins</span></div><p>{opponent.wins}W-{opponent.losses}L · {opponent.total} matches · Last played {opponent.lastDate.slice(0,10)}</p></article>)}</div>:<p>No repeat opponents in this player’s public decided history yet.</p>}</section>:null}
      {summary.seasons.length?<section className={cards.panel} aria-label="Year-by-year performance"><small className={cards.kicker}>Season history</small><h2>Year-by-year performance</h2><p>Match record, Singles/Doubles split and recorded rating movement by calendar year.</p><div className={cards.list}>{summary.seasons.map(season=><article className={cards.season} key={season.year}><div className={cards.top}><strong>{season.year}</strong><span>{season.winRate}% wins</span></div><dl className={cards.grid}><div><dt>Record</dt><dd>{season.wins}W-{season.losses}L</dd></div><div><dt>Singles</dt><dd>{season.singles}</dd></div><div><dt>Doubles</dt><dd>{season.doubles}</dd></div><div><dt>Recorded movement</dt><dd>{season.netDelta===null?'—':`${season.netDelta>0?'+':''}${season.netDelta.toFixed(3)}`}</dd></div></dl><p>{data.ratingsLimited?'Rating movement is unavailable while history is incomplete.':`${season.movementCount} of ${season.total} match movements recorded. Missing changes are not zero.`}</p></article>)}</div></section>:<p>No public decided matches are recorded yet. Season records appear after reviewed results connect to this player.</p>}
    </>}
    <p>TIQ is an estimate, not an official USTA rating. These are recorded results, not a forecast.</p>
  </div>
}
export function showPlayerPerformance(host:HTMLElement,client:SupabaseClient,playerId:string,current:()=>boolean,onOpenPlayer?:(player:PlayerChoice)=>void) {
  let disposed=false,request=0,root:ReturnType<typeof createRoot>|null=null
  const valid=()=>!disposed&&current()&&host.isConnected
  const load=async()=>{const version=++request;root?.unmount();root=null;host.innerHTML='<h2>Performance</h2><p role="status">Loading player performance…</p>'
    try{const data=await loadPlayerPerformance(client,playerId,valid);if(!valid()||version!==request)return;host.innerHTML='';root=createRoot(host);root.render(<PlayerPerformance data={data} onOpenPlayer={onOpenPlayer} onRefresh={()=>{void load()}}/>)}
    catch(error){if(!valid()||version!==request)return;if(error instanceof FollowAccessError){host.innerHTML='<h2>Performance</h2><p>Personal records and season analysis are included with Player access.</p>';return}host.innerHTML='<h2>Performance</h2><p role="alert">Can’t load player performance. Check your connection and try again.</p><button type="button" class="secondary">Retry performance</button>';host.querySelector<HTMLButtonElement>('button')!.onclick=()=>{void load()}}
  };void load()
  return {dispose:()=>{disposed=true;request++;root?.unmount();root=null;host.replaceChildren()}}
}

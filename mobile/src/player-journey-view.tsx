import {usePlayerProfileFormat,type PlayerProfileFormat} from './player-profile-format'
import {openHistoryScorecard} from './player-history-scorecard-view'
import type {RatingJourneyPoint} from '../../app/components/rating-journey-explorer'
import { useEffect,useRef,useState } from 'react'
import { createRoot } from 'react-dom/client'
import type { SupabaseClient } from '@supabase/supabase-js'
import RatingJourneyExplorer from '../../app/components/rating-journey-explorer'
import styles from '../../app/components/tennis-insight-cards.module.css'
import layout from './player-journey.module.css'
import { getRatingViewLabel, type RatingView } from '../../lib/player-rating-display'
import { loadPlayerJourney,journeyPoints,journeyViews,journeyWindowSummary,type JourneyHistory,type JourneyWindow } from './player-journey-data'
import { FollowAccessError } from './follows-data'
export function PlayerJourney({history,onOpenMatch,onRefresh,format,expandChart=false}:{history:JourneyHistory;expandChart?:boolean;format?:PlayerProfileFormat;onRefresh?:()=>void;onOpenMatch?:(point:RatingJourneyPoint,view:RatingView)=>void}) {
  const heading=useRef<HTMLHeadingElement>(null)
  useEffect(()=>{if(expandChart&&(document.activeElement===document.body||heading.current?.parentElement?.contains(document.activeElement)))heading.current?.focus({preventScroll:true})},[expandChart])
  const [view,setView]=usePlayerProfileFormat(format)
  const [window,setWindow]=useState<JourneyWindow>('all')
  const points=journeyPoints(history,view,window)
  const loaded=history[view],missing=loaded.rows.filter(row=>row.dynamic_rating===null).length
  const summary=journeyWindowSummary(points),change=summary.change===null?null:Number(summary.change.toFixed(3))
  return <div className={"website-ui native-player-journey "+layout.shell}>
    <h2 ref={heading} tabIndex={expandChart?-1:undefined}>Rating journey</h2>
    <div className={styles.chartNavigation} role="group" aria-label="Rating format">{journeyViews.map(kind=><button key={kind} className={styles.button} type="button" aria-pressed={view===kind} onClick={()=>setView(kind)}>{getRatingViewLabel(kind)}</button>)}</div>
    <label className={layout.window}>History window<select value={window} onChange={event=>setWindow(event.target.value as JourneyWindow)}><option value="all">All loaded history</option><option value="90d">Last 90 days</option><option value="30d">Last 30 days</option></select></label>
    {summary.count?<dl className={layout.summary} aria-label="Saved rating window summary"><div><dt>First in window</dt><dd>{summary.first!.toFixed(3)}</dd></div><div><dt>Latest in window</dt><dd>{summary.latest!.toFixed(3)}</dd></div><div><dt>Window change</dt><dd data-direction={change===null||change===0?'flat':change>0?'up':'down'}>{change===null?'—':`${change>0?'+':''}${change.toFixed(3)}`}</dd></div></dl>:null}
    {summary.count?<p className={layout.windowNote}>{summary.count===1?'One saved rating; a second is needed to show movement.':`Change from the first to the latest of ${summary.count} available ratings in this window. This is not a match count or a forecast.`}</p>:null}
    {points.length?<details open={expandChart||undefined} key={view+':'+window} className={layout.fullChart}><summary>{expandChart?'Full rating chart':'Open full rating chart'}</summary><RatingJourneyExplorer terminology="snapshots" key={view+':'+window} points={points} onOpenMatch={onOpenMatch?point=>onOpenMatch(point,view):undefined}/></details>:<p role="status">No recorded {getRatingViewLabel(view).toLowerCase()} ratings in this window. Try another format or All loaded history.</p>}
    <details className={layout.historyNote}><summary>About the loaded history</summary><p className={layout.coverage}>{getRatingViewLabel(view)} TIQ · Latest {loaded.rows.length}{loaded.more?' of more saved':''} snapshot{loaded.rows.length===1?'':'s'} loaded. This is not a complete season or a match count. {missing?`${missing} snapshot${missing===1?' has':'s have'} no rating and ${missing===1?'is':'are'} omitted from the chart.`:''}</p></details>
    <details><summary>Dated {getRatingViewLabel(view)} ratings · {points.length}</summary><div className="horizontal-data" role="region" tabIndex={0} aria-label="Dated player ratings"><table className={layout.table}><caption>{getRatingViewLabel(view)} TIQ · selected window</caption><thead><tr><th scope="col">Date</th><th scope="col">TIQ</th><th scope="col">Change</th>{onOpenMatch?<th scope="col">Match</th>:null}</tr></thead><tbody>{points.map(point=><tr key={point.id}><td>{point.date.slice(0,10)}</td><td>{point.rating.toFixed(3)}</td><td>{point.delta===null?'—':`${point.delta>=0?'+':''}${point.delta.toFixed(3)}`}</td>{onOpenMatch?<td>{point.matchId?<button type="button" className={styles.button} onClick={()=>onOpenMatch(point,view)} aria-label={`Open scorecard for ${point.date.slice(0,10)}`}>Scorecard</button>:'Not linked'}</td>:null}</tr>)}</tbody></table></div></details>
    {onRefresh?<button type="button" className={styles.button} onClick={onRefresh}>Refresh rating history</button>:null}
    <p>TIQ is an estimate, not an official USTA rating. Each format uses its own saved ratings; missing Singles or Doubles history stays empty.</p>
  </div>
}
export function showPlayerJourney(host:HTMLElement,client:SupabaseClient,playerId:string,current:()=>boolean,format?:PlayerProfileFormat,onHistory?:(data:JourneyHistory|null)=>void,options:{expandChart?:boolean}={}) {
  let scorecard:ReturnType<typeof openHistoryScorecard>|null=null
  let disposed=false,request=0
  let root:ReturnType<typeof createRoot>|null=null
  const valid=()=>!disposed&&current()&&host.isConnected
  const load=async()=>{
    if(!valid())return
    const version=++request
    onHistory?.(null)
    scorecard?.dispose();scorecard=null
    root?.unmount();root=null
    host.innerHTML='<h2>Rating journey</h2><p role="status">Loading rating history…</p>'
    try{
      const history=await loadPlayerJourney(client,playerId,valid)
      if(!valid()||version!==request)return
      onHistory?.(history)
      host.innerHTML='';root=createRoot(host);root.render(<PlayerJourney history={history} format={format} expandChart={options.expandChart} onRefresh={()=>{void load()}} onOpenMatch={(point,view)=>{if(!valid()||version!==request)return;scorecard?.dispose();scorecard=openHistoryScorecard(client,playerId,view,point,()=>valid()&&version===request)}}/>)
    }catch(error){
      if(!valid()||version!==request)return
      if(error instanceof FollowAccessError){host.innerHTML='<h2>Rating journey</h2><p>Detailed rating history is included with Player access.</p>';return}
      host.innerHTML='<h2>Rating journey</h2><p role="alert">Can’t load rating history. Check your connection and try again.</p><button type="button" class="secondary">Retry rating history</button>'
      host.querySelector<HTMLButtonElement>('button')!.onclick=()=>{void load()}
    }
  }
  void load()
  return {isScorecardOpen:()=>scorecard?.isOpen()??false,closeScorecard:()=>{if(!scorecard?.isOpen())return false;scorecard.dispose();scorecard=null;return true},dispose:()=>{disposed=true;request++;scorecard?.dispose();scorecard=null;root?.unmount();root=null;host.replaceChildren()}}
}

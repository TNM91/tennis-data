import {useEffect,useRef,type ReactNode} from 'react'
import {createRoot} from 'react-dom/client'
import type {SupabaseClient} from '@supabase/supabase-js'
import type {RatingJourneyPoint} from '../../app/components/rating-journey-explorer'
import type {RatingView} from '../../lib/player-rating-display'
import {loadHistoryScorecard,type HistoryScorecard} from './player-history-scorecard-data'
import {matchDate} from './recent-results'
import styles from '../../app/components/tennis-insight-cards.module.css'
export function PlayerHistoryScorecard({data}:{data:HistoryScorecard}) {
 return <section className={styles.card} aria-label="Recorded match scorecard"><p>{matchDate(data.date)} · {data.format==='singles'?'Singles':'Doubles'} · {data.league??'League unavailable'}</p><h3>{data.result} · {data.score??'Score unavailable'}</h3>{(['A','B'] as const).map(side=><div key={side}><h4>Side {side}{side===data.side?' · Selected player’s side':''}</h4><p>{data.players.filter(p=>p.side===side).map(p=>p.name).join(' / ')}</p></div>)}<dl><dt>TIQ after this reviewed result</dt><dd>{data.rating.toFixed(3)}</dd><dt>Recorded rating change</dt><dd>{data.delta===null?'Unavailable':`${data.delta>=0?'+':''}${data.delta.toFixed(3)}`}</dd></dl><p className={styles.muted}>Scores follow the source’s court order. TIQ is an estimate, not an official USTA rating.</p></section>
}
function ScorecardFrame({children,onClose}:{children:ReactNode;onClose:()=>void}) {
 const heading=useRef<HTMLHeadingElement>(null);useEffect(()=>{heading.current?.focus()},[])
 return <><h2 tabIndex={-1} ref={heading}>Match scorecard</h2>{children}<button type="button" className={styles.button} onClick={onClose}>Back to rating history</button></>
}
export function openHistoryScorecard(client:SupabaseClient,playerId:string,view:RatingView,point:RatingJourneyPoint,current:()=>boolean) {
 const previous=document.activeElement instanceof HTMLElement?document.activeElement:null,dialog=document.createElement('dialog');dialog.className='captain-lineup-dialog website-ui';dialog.setAttribute('aria-label','Historical match scorecard')
 let disposed=false,version=0;const valid=()=>!disposed&&current(),root=createRoot(dialog)
 const close=()=>{if(disposed)return;disposed=true;version++;root.unmount();dialog.remove();if(current()&&previous?.isConnected)previous.focus({preventScroll:true})}
 const load=async()=>{if(!valid())return;const attempt=++version;root.render(<ScorecardFrame key={attempt+':loading'} onClose={close}><p role="status">Checking this rating�s recorded match�</p></ScorecardFrame>)
 try{const data=await loadHistoryScorecard(client,playerId,view,point,()=>valid()&&attempt===version);if(!valid()||attempt!==version)return;root.render(<ScorecardFrame key={attempt+':result'} onClose={close}><PlayerHistoryScorecard data={data}/></ScorecardFrame>)}catch{if(!valid()||attempt!==version)return;root.render(<ScorecardFrame key={attempt+':error'} onClose={close}><p role="alert">This scorecard could not be confirmed. The result, rating history or your access may have changed. Retry, or return and refresh the player.</p><button type="button" className={styles.button} onClick={()=>{void load()}}>Retry scorecard</button></ScorecardFrame>)}
 }
 dialog.oncancel=event=>{event.preventDefault();close()};document.body.append(dialog);dialog.showModal();void load()
 return {dispose:close,isOpen:()=>!disposed}
}

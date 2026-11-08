import {RecordBars} from './record-graphics'
import {matchTapeScorecard} from './player-match-tape-scorecard'
import type {RecentMatchRow} from './recent-results'
import {useEffect,useId,useLayoutEffect,useRef,useState} from 'react'
import type {PlayerPerformanceData} from './player-performance-data'
import type {RatingView} from '../../lib/player-rating-display'
import {getRatingViewLabel} from '../../lib/player-rating-display'
import {repeatOpponentKey,type RepeatOpponent} from '../../lib/player-repeat-opponents'
import {matchDate} from './recent-results'
import styles from './player-match-tape.module.css'
export function filterPlayerMatchTape(data:PlayerPerformanceData,view:RatingView,year:string,outcome:string,query:string,rivalryKey?:string) {
 if(data.matchesLimited)return null
 const names=new Map((data.opponentHistory??[]).map(match=>[match.id,match]))
 if(rivalryKey!==undefined)return data.matches.filter(match=>{
  const opponents=names.get(match.id)?.opponentIds
  return opponents&&repeatOpponentKey(opponents)===rivalryKey
 })
 const search=query.trim().toLocaleLowerCase()
 return data.matches.filter(m=>(view==='overall'||m.matchType===view)&&(year==='all'||m.date.slice(0,4)===year)&&(outcome==='all'||m.result===outcome)&&(!search||[m.score??'',...(names.get(m.id)?.players.map(p=>p.name)??[])].join(' ').toLocaleLowerCase().includes(search)))
}

export type MatchTapeRivalry={opponent:RepeatOpponent;onBack:()=>void}
export type OpenMatchTapeScorecard=(row:RecentMatchRow,source:'match history'|'head-to-head')=>void
const pageSize=20

export function PlayerMatchTape({data,view,onView,onRefresh,playerId,onOpenScorecard,rivalry}:{
 playerId?:string
 onOpenScorecard?:OpenMatchTapeScorecard
 data:PlayerPerformanceData
 view:RatingView
 onView:(view:RatingView)=>void
 onRefresh?:()=>void
 rivalry?:MatchTapeRivalry|null
}) {
 const id=useId(),heading=useRef<HTMLHeadingElement>(null)
 const overallFilter=useRef<HTMLButtonElement>(null)
 const resultList=useRef<HTMLOListElement>(null)
 const nextResult=useRef<{key:string;index:number}|null>(null)
 const [year,setYear]=useState('all'),[outcome,setOutcome]=useState('all'),[query,setQuery]=useState('')
 const [page,setPage]=useState({key:'',count:pageSize}),[meetingPage,setMeetingPage]=useState({key:'',count:pageSize})
 const key=rivalry?.opponent.key??JSON.stringify([year,outcome,query,view])
 const currentPage=rivalry?meetingPage:page,setCurrentPage=rivalry?setMeetingPage:setPage
 const limit=currentPage.key===key?currentPage.count:pageSize
 const filtered=filterPlayerMatchTape(data,view,year,outcome,query,rivalry?.opponent.key)
 const hasFilters=view!=='overall'||year!=='all'||outcome!=='all'||Boolean(query)
 const resultCount=filtered?.length??0
 const nextBatchSize=Math.min(pageSize,Math.max(0,resultCount-limit))
 const resultLabel=hasFilters?'matching result':'recorded result'
 const resultStatus=resultCount===0
  ? hasFilters?'No results match your filters.':'No decided results yet.'
  : resultCount>limit?`Showing ${limit} of ${resultCount} ${resultLabel}s`
  : `${resultCount} ${resultLabel}${resultCount===1?'':'s'} · newest first`
 const names=new Map((data.opponentHistory??[]).map(m=>[m.id,m]))
 const years=[...new Set(data.matches.map(m=>m.date.slice(0,4)))].sort().reverse()
 const title=rivalry?`Meetings with ${rivalry.opponent.name}`:'Match history'

 useEffect(()=>{
  if(!rivalry)return
  heading.current?.scrollIntoView({block:'start'})
  heading.current?.focus({preventScroll:true})
 },[rivalry])

 useLayoutEffect(()=>{
  const next=nextResult.current
  nextResult.current=null
  if(next?.key!==key)return
  const target=resultList.current?.children.item(next.index)?.querySelector<HTMLElement>('button, summary')
  target?.scrollIntoView({block:'center'})
  target?.focus({preventScroll:true})
 },[key,limit])

 return <section className={styles.panel} aria-label={rivalry?title:'Public match history'}>
  <p className={styles.kicker}>{rivalry?'Head-to-head':'Match tape'}</p>
  <h2 ref={heading} tabIndex={-1} data-match-history-title>{title}</h2>
  {rivalry
   ? <button type="button" className={styles.rivalryBack} onClick={rivalry.onBack}><span aria-hidden="true">‹</span> Back to repeat opponents</button>
   : <p>Review loaded public decided results. Pending and future matches are excluded.</p>}
  {filtered===null?<p role="status">The loaded match history is incomplete. The full match tape is withheld.</p>:<>
   {rivalry?null:<>
    <div role="group" aria-label="Match history format" className={styles.formats}>
     {(['overall','singles','doubles'] as const).map(kind=><button key={kind} ref={kind==='overall'?overallFilter:undefined} type="button" aria-pressed={view===kind} onClick={()=>onView(kind)}>{getRatingViewLabel(kind)}</button>)}
    </div>
    <div className={styles.filters}>
     <div><label htmlFor={id+'year'}>Year</label><select id={id+'year'} value={year} onChange={e=>setYear(e.target.value)}>
      <option value="all">All years</option>{years.map(y=><option key={y} value={y}>{y}</option>)}
     </select></div>
     <div><label htmlFor={id+'result'}>Result</label><select id={id+'result'} value={outcome} onChange={e=>setOutcome(e.target.value)}>
      <option value="all">All results</option><option value="W">Wins</option><option value="L">Losses</option>
     </select></div>
     <div className={styles.search}><label htmlFor={id+'search'}>Search player names or scores</label>
      <input id={id+'search'} type="search" maxLength={200} value={query} onChange={e=>setQuery(e.target.value)} placeholder="Player name or 6-4"/>
     </div>
    </div>
    {data.opponentHistory==null?<p role="status">Player names could not be confirmed. Scores and results remain available; name search is unavailable.</p>:null}
    <div className={styles.resultsToolbar}>
     <p role="status">{resultStatus}</p>
     {hasFilters?<button type="button" onClick={()=>{
      setYear('all')
      setOutcome('all')
      setQuery('')
      onView('overall')
      overallFilter.current?.focus()
     }}>Clear filters</button>:null}
    </div>
   </>}
   {resultCount>0||rivalry?<RecordBars label={rivalry?'Head-to-head record':'Record for filtered match history'} rows={[{
    key:'filtered',label:rivalry?'Decided meetings':'Filtered results',
    wins:filtered.filter(match=>match.result==='W').length,losses:filtered.filter(match=>match.result==='L').length,
   }]}/>:null}
   {rivalry
    ? <p role="status">{filtered.length} recorded {filtered.length===1?'meeting':'meetings'} · newest first{filtered.length>limit?` · showing ${limit}`:''}</p>
    : resultCount>limit?<p className={styles.coverage}>The record covers all {resultCount} loaded results for these filters.</p>:null}
   {filtered.length?<ol id={id+'results'} ref={resultList} className={styles.list} role="list">{filtered.slice(0,limit).map(match=>{
    const players=names.get(match.id),scorecard=playerId?matchTapeScorecard(data,match.id,playerId):null
    const date=matchDate(match.date),result=match.result==='W'?'Won':'Lost'
    const format=getRatingViewLabel(match.matchType),score=match.score??'Score unavailable'
    if(scorecard&&onOpenScorecard){
     const opponent=!rivalry&&players?`vs ${players.opponent}`:null
     const partner=!rivalry&&match.matchType==='doubles'&&players?players.players.find(player=>player.side===players.side&&player.id!==playerId):null
     const partnerLabel=partner?`With ${partner.name}`:null
     const label=['Open full scorecard',result,`${format} · ${date}`,opponent,score,partnerLabel].filter(Boolean).join('. ')
     return <li key={match.id}><button type="button" className={styles.scorecardRow} aria-label={label} onClick={event=>{
      event.currentTarget.focus({preventScroll:true})
      onOpenScorecard(scorecard,rivalry?'head-to-head':'match history')
     }}>
      <span className={styles.scorecardRead}>
       <span className={styles.scorecardMeta}><b data-outcome={match.result}>{result}</b><span>{format} · {date}</span></span>
       {opponent?<span className={styles.scorecardOpponent}>{opponent}</span>:null}
       <strong>{score}</strong>
       {partnerLabel?<span className={styles.scorecardPartner}>{partnerLabel}</span>:null}
      </span>
      <span className={styles.scorecardArrow} aria-hidden="true">›</span>
     </button></li>
    }
    return <li key={match.id}><details className={styles.card}>
     <summary>
      <span className={styles.top}><strong>{result}</strong><span>{date}</span></span>
      <span className={styles.names}>{players?`vs ${players.opponent}`:'Player names unavailable'}</span>
      <span>{format} · {score}</span>
      <small>View recorded result</small>
     </summary>
     <div className={styles.detail}>
      <p>Recorded score: <strong>{match.score??'Unavailable'}</strong></p>
      {players?(['A','B'] as const).map(side=><div key={side}>
       <h3>Side {side}{side===players.side?' · Selected player’s side':''}</h3>
       <p>{players.players.filter(p=>p.side===side).map(p=>p.name).join(' / ')}</p>
      </div>):<p>Player names unavailable. Refresh match history to check again.</p>}
      <p>Scores follow the source’s court order. This is the loaded public result; refresh history to check for updates.</p>
     </div>
    </details></li>
   })}</ol>:rivalry?<p>No meetings are available in the loaded history.</p>:null}
   {nextBatchSize>0?<button type="button" className={styles.showMore} aria-controls={id+'results'} onClick={()=>{
    nextResult.current={key,index:limit}
    setCurrentPage({key,count:limit+nextBatchSize})
   }}>Show {nextBatchSize} more {nextBatchSize===1?'result':'results'}</button>
   :resultCount>pageSize?<p className={styles.coverage}>All {resultCount} {rivalry?'meetings':'results'} shown</p>:null}
  </>}
  {onRefresh&&!rivalry?<button type="button" onClick={onRefresh}>Refresh match history</button>:null}
 </section>
}

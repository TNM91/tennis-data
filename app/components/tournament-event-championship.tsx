'use client'

import Link from 'next/link'
import { useMemo, useState } from 'react'
import { ArrowRight, Trophy } from '@phosphor-icons/react'
import { buildRoundRobinStandings, buildTournamentGroupChampionship, buildTournamentPreview, type TiqTournamentRecord, type TiqTournamentStanding } from '@/lib/tiq-tournament-registry'
import { GROUP_PLAYOFF_RULES } from '@/lib/tournament-group-playoffs'
import { formatTournamentEventTime } from '@/lib/tournament-event-presentation'
import styles from './tournament-event-championship.module.css'

export default function TournamentEventChampionship({ event, divisions, initialDivisionId, onManage }: {
  event:TiqTournamentRecord; divisions:TiqTournamentRecord[]; initialDivisionId?:string;
  onManage?:(division:TiqTournamentRecord,section:string)=>void
}) {
  const [divisionId,setDivisionId]=useState(initialDivisionId || '')
  const division=divisions.find(item=>item.id===divisionId) || divisions[0]
  const championship=useMemo(()=>division?.format==='group_playoffs' ? buildTournamentGroupChampionship(division):null,[division])
  const draw=useMemo(()=>division ? buildTournamentPreview(division):[],[division])
  const standings=useMemo(()=>division?.format==='round_robin' ? buildRoundRobinStandings(division):[],[division])
  const playoffs=championship?.playoffs || (division?.format==='single_elimination' ? draw:[])
  const rounds=[...new Set(playoffs.map(match=>match.round))]
  const final=playoffs.at(-1)
  const champion=championship?.champion || (final?.result?.winner && division?.entrants.includes(final.result.winner) ? final.result.winner:'')
  const groups=championship?.groups || []
  const completedGroups=groups.filter(group=>group.qualifier).length
  const completed=draw.filter(match=>match.sideA!=='Bye' && match.sideB!=='Bye' && match.result?.winner).length
  const total=draw.filter(match=>match.sideA!=='Bye' && match.sideB!=='Bye').length
  const groupCompleted=groups.reduce((sum,group)=>sum+group.matches.filter(match=>match.result).length,0)
  const groupTotal=groups.reduce((sum,group)=>sum+group.matches.length,0)

  return <section id="event-championship" className={styles.panel} aria-labelledby={`championship-${event.id}`}>
    <header><div><p className={styles.eyebrow}>The road to the title</p><h2 id={`championship-${event.id}`}>Every round counts.</h2><p>Follow your division’s posted scores, standings, and championship draw.</p></div><Trophy size={42} weight="duotone" aria-hidden="true" /></header>
    <nav aria-label="Standings division" className={styles.tabs}>{divisions.map(item=><button key={item.id} type="button" aria-pressed={item.id===division?.id} onClick={()=>setDivisionId(item.id)}>{item.name}</button>)}</nav>
    {!division || division.entrants.length<2 ? <div className={styles.empty}><h3>Meet the field soon.</h3><p>Groups and the championship path appear after the director confirms entrants.</p>{division && onManage ? <button type="button" onClick={()=>onManage(division,'tournament-setup')}>Add confirmed entrants <ArrowRight aria-hidden="true" /></button>:null}</div> : <>
      <div className={styles.progress}>
        <div><span>01 · {groups.length ? 'Group play':'Division play'}</span><strong>{groups.length ? groupCompleted:completed}/{groups.length ? groupTotal:total} results posted</strong></div>
        <div><span>02 · {groups.length ? 'Group winners':'Next round'}</span><strong>{groups.length ? `${completedGroups}/${groups.length} qualified`:standings.length ? 'Follow the standings':'Winners advance'}</strong></div>
        <div><span>03 · Championship</span><strong>{champion ? 'Champion confirmed':playoffs.length ? 'Title to be decided':'Follow division results'}</strong></div>
      </div>
      {championship ? <details className={styles.rules}><summary>Format and tie-break rules</summary><p>{GROUP_PLAYOFF_RULES}</p><p>Groups follow the confirmed entrant order, distributed evenly. Set the field before scoring starts. Scores are recorded in the order of the two names shown.</p>{championship.smallField ? <p>This division has fewer than six entrants and uses an elimination bracket.</p>:null}</details>:null}
      {champion ? <div className={styles.champion}><Trophy size={32} weight="fill" aria-hidden="true" /><div><span>Division champion</span><h3>{champion}</h3><p>{division.name}</p></div></div>:null}
      {groups.length ? <div className={styles.groups}>{groups.map(group=><article key={group.name} className={styles.group}>
        <div className={styles.groupHeading}><h3>{group.name}</h3><span>{group.qualifier ? 'Winner qualified':group.complete ? 'Tie-break in play':`${group.matches.filter(match=>match.result).length}/${group.matches.length} scores`}</span></div>
        <Standings rows={group.standings} qualifier={group.qualifier} caption={`${division.name} — ${group.name}`} />
        <p className={styles.groupNote}>{group.qualifier ? `${group.qualifier} advances to the championship.`:group.complete ? 'A group tie-break decides the qualifying spot. Find those matches in the division draw.':'The group winner advances when all group results are posted.'}</p>
      </article>)}</div>:standings.length ? <div className={styles.group}><h3>Division standings</h3><Standings rows={standings} caption={division.name} /><p className={styles.groupNote}>Ranked by wins, losses, game difference, then games won. This division is set to round robin.</p></div>:null}
      {playoffs.length ? <div className={styles.bracket}><div className={styles.bracketHeading}><h3>Championship draw</h3><span>{championship && !championship.smallField ? 'Group winners only':'Elimination bracket'}</span></div>
        <div className={styles.rounds}>{rounds.map((round,index)=><div key={round} className={styles.round}><h4>{index===rounds.length-1 ? 'Final':rounds.length-index===2 ? 'Semifinals':`Round ${index+1}`}</h4>{playoffs.filter(match=>match.round===round).map(match=><article key={match.id} className={styles.match}>
          <div className={styles.sides}>{[match.sideA,match.sideB].map((name,side)=><div key={side} data-winner={match.result?.winner===name}><span>{name==='Bye' ? 'Bye':name}</span>{match.result?.winner===name ? <span className={styles.winner}>Winner</span>:null}</div>)}</div>
          <p>{match.result?.score || (match.sideA==='Bye' || match.sideB==='Bye' ? 'Bye to the next round':match.ready===false ? 'Awaiting earlier results':'Awaiting result')}</p>
          {match.schedule?.time || match.schedule?.court ? <p className={styles.slot}>{match.schedule.time ? formatTournamentEventTime(match.schedule.time):'Time pending'}{match.schedule.court ? ` · Court ${match.schedule.court}`:''}</p>:null}
        </article>)}</div>)}</div>
      </div>:!standings.length ? <p className={styles.empty}>Open the division draw to follow this format’s matches.</p>:null}
      <footer>{onManage ? <button type="button" onClick={()=>onManage(division,'tournament-scorebook')}>Enter division scores <ArrowRight aria-hidden="true" /></button>:<Link href={`/tournaments/${encodeURIComponent(division.id)}#draw`}>View scores and court assignments <ArrowRight aria-hidden="true" /></Link>}<button type="button" onClick={()=>window.location.reload()}>Refresh results</button></footer>
    </>}
  </section>
}

function Standings({rows,qualifier,caption}:{rows:TiqTournamentStanding[];qualifier?:string;caption:string}) {
  function rank(row:TiqTournamentStanding) {
    if (!row.played) return '—'
    if (row.entrant===qualifier) return 1
    return 1+rows.filter(other=>other.entrant!==row.entrant && (other.entrant===qualifier || other.wins>row.wins
      || other.wins===row.wins && (other.gameDiff>row.gameDiff || other.gameDiff===row.gameDiff && other.gamesWon>row.gamesWon))).length
  }
  return <table className={styles.standings}><caption>{caption} standings</caption><thead><tr><th scope="col">Rank</th><th scope="col">Team / player</th><th scope="col">W–L</th><th scope="col"><abbr title="Games won minus games lost">GD</abbr></th></tr></thead><tbody>{rows.map(row=><tr key={row.entrant} data-qualified={row.entrant===qualifier}><td>{rank(row)}</td><th scope="row">{row.entrant}{row.entrant===qualifier ? <span className={styles.qualified}>Qualified</span>:null}</th><td>{row.wins}–{row.losses}</td><td>{row.gamesKnown===false ? '—':`${row.gameDiff>0 ? '+':''}${row.gameDiff}`}</td></tr>)}</tbody></table>
}

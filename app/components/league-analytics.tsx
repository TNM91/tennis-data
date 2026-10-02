'use client'

import { useId, useMemo, useState } from 'react'
import type { LeagueWeeklyCompetitionView } from '@/lib/league-weekly-player-records'
import { buildWeeklyAnalytics } from '@/lib/league-weekly-analytics'
import styles from './league-analytics.module.css'

const delta = (n: number) => `${n > 0 ? '+' : ''}${n}`
const key = (name: string) => name.trim().toLowerCase()
const scoredWeeks = (count: number) => `${count} scored ${count === 1 ? 'week' : 'weeks'}`
export default function LeagueAnalytics({ view, initialSessionId = '', showRankings = true }: { view: LeagueWeeklyCompetitionView; initialSessionId?: string; showRankings?: boolean }) {
  const id = useId()
  const [tab, setTab] = useState<'week' | 'players' | 'pairs'>('week')
  const [period, setPeriod] = useState(initialSessionId || view.weeks.find(week => week.acceptedSetCount > 0)?.sessionId || '')
  const [playerName, setPlayerName] = useState('')
  const [pairKey, setPairKey] = useState('')
  const [query, setQuery] = useState('')
  const [establishedOnly, setEstablishedOnly] = useState(false)
  const sessionId = view.weeks.some(week => week.sessionId === period) ? period : ''
  const data = useMemo(() => buildWeeklyAnalytics(view, sessionId, showRankings), [view, sessionId, showRankings])
  const played = data.view.playerInsights.filter(player => player.setsPlayed > 0)
  const player = played.find(item => item.playerName === playerName) || played[0]
  const extra = player ? data.players[key(player.playerName)] : null
  const pairs = data.pairs.filter(pair => (!establishedOnly || pair.setsPlayed >= 3) && pair.players.join(' ').toLowerCase().includes(query.trim().toLowerCase()))
  const selectedPair = pairs.find(pair => pair.key === pairKey) || pairs[0]
  const week = view.weeks.find(item => item.sessionId === sessionId)
  return <section className={styles.panel} aria-labelledby={`${id}-title`}>
    <header className={styles.header}>
      <div><span className={styles.eyebrow}>Inside the league</span><h3 id={`${id}-title`}>The tennis behind the numbers</h3><p>Accepted sets only. Discover your form, your partnerships, and the moments worth celebrating.</p></div>
      <label className={styles.period}>Results for<select value={sessionId} onChange={event => setPeriod(event.target.value)}><option value="">Season so far</option>{view.weeks.map(item => <option key={item.sessionId} value={item.sessionId}>{item.playOn}{item.acceptedSetCount ? '' : ' · no scores yet'}</option>)}</select></label>
    </header>
    <div className={styles.navigation} role="group" aria-label="League insights">
      {([['week', 'This Week'], ['players', 'Players'], ['pairs', 'Partnerships']] as const).map(([value, label]) => <button key={value} type="button" aria-pressed={tab === value} onClick={() => setTab(value)}>{label}</button>)}
    </div>
    <p className={styles.caption}>{week ? `Week of ${week.playOn}` : 'Season so far'} · {data.view.summary.acceptedSets} accepted sets · {played.length} players with scores{week?.status === 'published' ? ' · Results in progress' : ''}</p>
    {!data.view.summary.acceptedSets ? <p className={styles.empty}>Once scores are confirmed, player form, partnership records, and highlights will appear here.</p> : <>
      {tab === 'week' ? <>
        <div className={styles.metrics}><Metric label="Games played" value={data.view.summary.totalGames} /><Metric label="Close sets" value={data.closeSets} /><Metric label="7–6 finishes" value={data.tiebreaks} /><Metric label="Scored weeks" value={data.playedWeeks} /></div>
        <p className={styles.caption}>Close sets finish within two games. Each court set counts once in these totals.</p>
        <div className={styles.grid}>{data.highlights.map(item => <article className={styles.highlight} key={item.title}><span className={styles.eyebrow}>{item.title}</span><p>{item.detail}</p></article>)}</div>
        {showRankings ? <>
          <h4>{week ? 'This week’s leaders' : 'Season leaders'}</h4>
          <div className={styles.grid}>{played.slice(0, 3).map(item => <button type="button" className={styles.leader} key={item.playerName} onClick={() => { setPlayerName(item.playerName); setTab('players') }}><span className={styles.eyebrow}>#{item.rank}</span><strong>{item.playerName}</strong><span>{item.wins}–{item.losses} sets · {delta(item.gameDifferential)} games</span><small>View player story →</small></button>)}</div>
        </> : <button type="button" className={styles.row} onClick={() => setTab('players')}><strong>Explore player stats</strong><span>Win rates, recent form, and partnerships →</span></button>}
      </> : null}
      {tab === 'players' && player && extra ? <>
        <label className={styles.period}>Player spotlight<select value={player.playerName} onChange={event => setPlayerName(event.target.value)}>{played.map(item => <option key={item.playerName}>{item.playerName}</option>)}</select></label>
        <article className={styles.spotlight}>
          <div className={styles.header}><div><span className={styles.eyebrow}>{showRankings ? `#${player.rank} · ` : ''}{player.setsPlayed} sets · {scoredWeeks(player.weeksPlayed)}</span><h4>{player.playerName}</h4></div>{showRankings ? <span className={styles.badge}>{extra.rankMovement === null ? 'Rank movement needs prior scores' : extra.rankMovement === 0 ? 'Season rank unchanged' : `${delta(extra.rankMovement)} season rank places`}</span> : null}</div>
          <div className={styles.metrics}><Metric label="Set record" value={`${player.wins}–${player.losses}`} /><Metric label="Set win rate" value={`${player.winPercentage}%`} /><Metric label="Games won / lost" value={`${player.gamesWon} / ${player.gamesLost}`} /><Metric label="Game difference" value={delta(player.gameDifferential)} /><Metric label="Close-set record" value={`${extra.closeSets.wins}–${extra.closeSets.losses}`} /><Metric label="Tiebreak record" value={`${extra.tiebreaks.wins}–${extra.tiebreaks.losses}`} /></div>
          <div className={styles.form} aria-label={`Recent form, oldest to newest: ${player.recentForm.join(', ')}`}><span>Recent form</span>{player.recentForm.map((outcome, index) => <strong key={index} data-outcome={outcome}>{outcome}</strong>)}<small>Oldest → newest</small></div>
          <p className={styles.caption}>Current run: {player.currentStreak ? `${player.currentStreak.count} consecutive ${player.currentStreak.outcome === 'W' ? 'wins' : 'losses'}` : 'No sets'} · {extra.repeatedPartners} partners played with more than once in this period.</p>
          <h4>Partner combinations</h4><div className={styles.list}>{player.partners.map(partner => <button className={styles.row} type="button" key={partner.playerName} onClick={() => { setQuery(''); setEstablishedOnly(false); setPairKey(data.pairs.find(pair => pair.players.some(name => key(name) === key(player.playerName)) && pair.players.some(name => key(name) === key(partner.playerName)))?.key || ''); setTab('pairs') }}><strong>{partner.playerName}</strong><span>{partner.wins} of {partner.setsPlayed} sets won · {delta(partner.gameDifferential)} games →</span></button>)}</div>
          <details className={styles.details}><summary>Weekly form and court history</summary>{player.weeks.map(item => <p key={item.sessionId}>{item.playOn} · Court {item.courtNumbers.join(', ')} · {item.wins}–{item.losses} sets · {delta(item.gameDifferential)} games</p>)}</details>
        </article>
        <details className={styles.details}><summary>Compare all {played.length} players</summary><div className={styles.list}>{played.map(item => <button className={styles.row} type="button" key={item.playerName} aria-pressed={item.playerName === player.playerName} onClick={() => setPlayerName(item.playerName)}><strong>{showRankings ? `#${item.rank} ` : ''}{item.playerName}</strong><span>{item.wins}–{item.losses} · {delta(item.gameDifferential)} games</span></button>)}</div></details>
      </> : null}
      {tab === 'pairs' ? <>
        <p className={styles.caption}>Each partnership set counts once—not twice. Records show results together, not an individual rating or prediction. Three sets is a useful starting sample, not proof of a strong partnership.</p>
        <div className={styles.filters}><label className={styles.period}>Find a partnership<input type="search" placeholder="Search a player’s name" value={query} onChange={event => setQuery(event.target.value)} /></label><label className={styles.check}><input type="checkbox" checked={establishedOnly} onChange={event => setEstablishedOnly(event.target.checked)} />At least 3 sets together</label></div>
        {selectedPair ? <article className={styles.spotlight}><span className={styles.eyebrow}>Partnership spotlight</span><h4>{selectedPair.players.join(' + ')}</h4><div className={styles.metrics}><Metric label="Sets won together" value={`${selectedPair.wins} of ${selectedPair.setsPlayed}`} /><Metric label="Set win rate" value={`${selectedPair.winPercentage}%`} /><Metric label="Games won / lost" value={`${selectedPair.gamesWon} / ${selectedPair.gamesLost}`} /><Metric label="Game difference" value={delta(selectedPair.gameDifferential)} /></div><p className={styles.caption}>{scoredWeeks(selectedPair.weeksPlayed)} · {selectedPair.setsPlayed < 3 ? 'Early sample—keep playing together before drawing conclusions.' : 'Compare the sample size and opponents alongside the win rate.'}</p><h4>Against other pairs</h4>{selectedPair.opponents.map(opponent => <div className={styles.row} key={JSON.stringify(opponent.players)}><strong>{opponent.players.join(' + ')}</strong><span>{opponent.wins}–{opponent.losses} sets</span></div>)}</article> : <p className={styles.empty}>No partnerships match this filter. Try another name or include pairs with fewer sets.</p>}
        <p className={styles.caption}>{showRankings ? 'Pairs are ordered by set wins, then fewer losses, then game difference—not a partnership rating.' : 'Players and partnerships are listed alphabetically. Enjoy the stats without competitive rankings.'}</p>
        <details className={styles.details}><summary>Explore {pairs.length} partnerships</summary><div className={styles.list}>{pairs.map(pair => <button className={styles.row} type="button" key={pair.key} aria-pressed={pair.key === selectedPair?.key} onClick={() => setPairKey(pair.key)}><strong>{pair.players.join(' + ')}</strong><span>{pair.wins} of {pair.setsPlayed} sets · {delta(pair.gameDifferential)} games</span><small>{pair.setsPlayed < 3 ? 'Early sample' : `${pair.weeksPlayed} weeks together`}</small></button>)}</div></details>
      </> : null}
    </>}
  </section>
}
function Metric({ label, value }: { label: string; value: string | number }) { return <div className={styles.metric}><strong>{value}</strong><span>{label}</span></div> }

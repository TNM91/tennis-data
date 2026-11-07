import {statDonutHtml} from './stat-donut'
import {RECENT_HISTORY_LIMIT} from './recent-results-history'
import {labResultBreakdownHtml,type BreakdownView} from './lab-result-breakdown'
import {playerRecentRecord} from '../../lib/player-recent-record'
import {filterMatchbookEntries} from '../../lib/player-matchbook'
import { matchDate, matchResult, type RecentMatchRow } from './recent-results'
import { html } from './match-details'

export type MatchFilter = 'All' | 'Singles' | 'Doubles'
export type ResultView='form'|'formats'|'leagues'|'years'
const resultViews:ResultView[]=['form','formats','leagues','years']
export function resultViewControls(view:ResultView){return `<div class="match-filters result-view-controls" role="group" aria-label="Result insights">${resultViews.map(value=>`<button type="button" class="secondary" data-result-view="${value}" aria-pressed="${view===value}" aria-controls="lab-result-panel">${value[0].toUpperCase()+value.slice(1)}</button>`).join('')}</div>`}
const filters: MatchFilter[] = ['All', 'Singles', 'Doubles']
export function filteredMatches(rows: RecentMatchRow[], filter: MatchFilter) {
  return filterMatchbookEntries(rows.map(row=>({row,matchType:row.match_type})),filter.toLowerCase() as 'all'|'singles'|'doubles').map(entry=>entry.row)
}
export function recentForm(rows: RecentMatchRow[], playerId: string) {
  return rows.reduce((form, row) => {
    const result = matchResult(row, playerId)
    if (result === 'Won') form.wins++
    else if (result === 'Lost') form.losses++
    else form.pending++
    return form
  }, {wins: 0, losses: 0, pending: 0})
}

function latestResultChips(rows: RecentMatchRow[], playerId: string) {
  const items = rows.slice(0, 5).map(row => {
    const result = matchResult(row, playerId)
    const symbol = result === 'Won' ? 'W' : result === 'Lost' ? 'L' : '—'
    return `<li data-outcome="${symbol}" aria-label="${html(matchDate(row.match_date))}: ${result}">${symbol}</li>`
  }).join('')
  return `<ol aria-label="Latest results, newest first">${items}</ol>`
}

export function recentPulseHtml(rows:RecentMatchRow[],playerId:string) {
  const form=recentForm(rows,playerId),decided=form.wins+form.losses
  const percent=decided?Math.round(form.wins/decided*100):null
  return `<div class="match-pulse"><div class="match-pulse-rate"><span>Decided win rate</span>${statDonutHtml(percent,'Decided win rate in loaded recent results')}${percent===null?'<p>No decided results yet.</p>':`<meter class="sr-only" aria-hidden="true" min="0" max="100" value="${percent}" aria-label="Win percentage in loaded recent results">${percent}%</meter><p>${form.wins} ${form.wins===1?'win':'wins'} · ${form.losses} ${form.losses===1?'loss':'losses'}</p>`}</div><div class="match-pulse-form"><span>Latest form</span>${latestResultChips(rows,playerId)}<p>Newest first · ${form.pending} pending</p></div></div>`
}

function matchFormSummary(rows: RecentMatchRow[], playerId: string, stats: ReturnType<typeof playerRecentRecord>) {
  if (!rows.length) return ''
  return `<div class="lab-match-form">
    <div class="lab-match-form-record">
      ${statDonutHtml(stats.winRate, 'Decided win rate in loaded recent results')}
      <div>
        <p>Decided win rate</p>
        ${stats.winRate === null ? '<strong>No decided results yet</strong>' : `<strong>${stats.wins}W · ${stats.losses}L</strong>`}
        ${stats.pending ? `<p>${stats.pending} pending</p>` : ''}
      </div>
    </div>
    <div class="lab-match-form-latest match-pulse-form">
      <p>Latest results <span>Newest first</span></p>
      ${latestResultChips(rows, playerId)}
    </div>
    ${stats.winRate === null ? '' : `<dl class="lab-match-streaks" aria-label="Win streaks">
      <div><dt>Current win streak</dt><dd>${stats.currentWinStreak}</dd></div>
      <div><dt>Best win streak</dt><dd>${stats.bestWinStreak}</dd></div>
    </dl>`}
    ${stats.winRate !== null && stats.pending ? '<p class="lab-match-form-note">Pending matches don’t affect streaks.</p>' : ''}
  </div>`
}

function matchRecord(rows: RecentMatchRow[], playerId: string) {
  return playerRecentRecord(rows.map(row => {
    const result = matchResult(row, playerId)
    return {date:row.match_date, result:result === 'Won' ? 'W' : result === 'Lost' ? 'L' : 'pending'}
  }))
}

function formatComparisonHtml(rows: RecentMatchRow[], playerId: string) {
  const formats = (['Singles', 'Doubles'] as const).map(mode => {
    const matches = filteredMatches(rows, mode)
    const {wins, losses, pending, winRate} = matchRecord(matches, playerId)
    const lower = mode.toLowerCase()
    const record = winRate === null ? 'No decided results yet' : `${wins}W · ${losses}L`
    return `<div class="lab-format-row">
      <div class="lab-format-row-heading"><h4>${mode}</h4>${winRate === null ? '' : `<strong aria-hidden="true">${winRate}%</strong>`}</div>
      ${winRate === null ? '' : `<meter min="0" max="100" value="${winRate}" aria-label="${mode} decided win percentage in loaded recent results">${winRate}%</meter>`}
      <p>${matches.length ? record + (pending ? ` · ${pending} pending` : '') : `No ${lower} results in this sample.`}</p>
      ${matches.length ? `<button type="button" class="secondary lab-format-open" data-format-matches="${mode}">
        <span>View ${matches.length} ${lower} ${matches.length === 1 ? 'scorecard' : 'scorecards'}</span><span class="app-tool-arrow" aria-hidden="true">›</span>
      </button>` : ''}
    </div>`
  }).join('')
  return `<section class="lab-format-grid" aria-label="Singles and doubles comparison">
    <div class="lab-format-heading"><h3>Singles &amp; doubles</h3><p>Decided win rate</p></div>
    ${formats}
  </section>`
}

export function recentStatsHtml(rows: RecentMatchRow[], playerId: string, filter: MatchFilter, view: 'all' | 'form' | 'formats' = 'all') {
  if (view === 'formats') return formatComparisonHtml(rows, playerId)
  const shown = filteredMatches(rows, filter)
  const stats = matchRecord(shown, playerId)
  if (view === 'form') return matchFormSummary(shown, playerId, stats)
  const streak = `<h3>Build your next run</h3><dl class="lab-streak-grid"><div><dt>Current win streak</dt><dd>${stats.currentWinStreak}<small> decided ${stats.currentWinStreak===1?'win':'wins'}</small></dd></div><div><dt>Best win streak</dt><dd>${stats.bestWinStreak}<small> in this sample</small></dd></div></dl><p class="rating-context">${filter==='All'?'All formats':filter} · latest ${rows.length} connected results. Pending results do not end a decided-result streak. This is not your full-history record.</p>`
  return `<section class="lab-recent-stats" aria-label="Recent result insights">${streak}${formatComparisonHtml(rows, playerId)}</section>`
}

function matchListHtml(rows: RecentMatchRow[], playerId: string, compact: boolean, filter: MatchFilter) {
  if (!rows.length) return ''
  const entries = rows.map((row, index) => {
    const result = matchResult(row, playerId)
    const tone = result === 'Won' ? 'won' : result === 'Lost' ? 'lost' : 'pending'
    const date = html(matchDate(row.match_date))
    const format = html(row.match_type || 'Match')
    const league = html(row.league_name || 'League unavailable')
    const score = html(row.score || 'Score unavailable')
    if (!compact) return `<li>
      <div class="match-heading"><strong class="result-${tone}">${result}</strong><span>${date}</span></div>
      <p>${format} · ${league}</p><p class="score">${score}</p>
      <button type="button" class="secondary match-open" data-index="${index}" aria-label="View match details, ${date}, ${html(row.match_type || 'match')}">View match</button>
    </li>`
    return `<li><button type="button" class="secondary match-open recent-scorecard" data-index="${index}">
      <span class="app-tool-copy">
        <span class="recent-scorecard-meta"><b class="result-${tone}">${result}</b><span class="recent-scorecard-date">${format} · ${date}</span></span>
        <strong>${score}</strong>
        <span>${league}</span>
      </span>
      <span class="app-tool-arrow" aria-hidden="true">›</span>
    </button></li>`
  }).join('')
  const list = `<ol class="matches">${entries}</ol><small>Scores are shown as recorded, in the source’s court order.</small>`
  if (!compact) return list
  const format = filter === 'All' ? '' : `${filter.toLowerCase()} `
  return `<details class="recent-match-list">
    <summary><span class="app-tool-copy"><strong>Match scorecards</strong><span>${rows.length} ${format}${rows.length === 1 ? 'match' : 'matches'}</span></span><span class="app-tool-arrow" aria-hidden="true">›</span></summary>
    ${list}
  </details>`
}

export function resultsHtml(rows: RecentMatchRow[], playerId: string, filter: MatchFilter, owner = 'your', compact=false,breakdown:BreakdownView='leagues',view:ResultView=breakdown==='seasons'?'years':'form') {
  const shown = filteredMatches(rows, filter)
  const form = compact ? null : recentForm(shown, playerId)
  const list = matchListHtml(shown, playerId, compact, filter)
  const loadedSample = `${rows.length} connected ${rows.length === 1 ? 'result' : 'results'}`
  const shownMatches = `${shown.length} ${filter === 'All' ? 'match' : filter.toLowerCase() + ' match'}${shown.length === 1 ? '' : 'es'}`
  let sampleLabel = `${shownMatches} in ${html(owner)} latest ${rows.length} connected results.`
  if (compact && filter === 'All') sampleLabel = `Latest ${loadedSample}.`
  if (compact && view === 'formats') sampleLabel = `Both formats use the latest ${loadedSample}.`
  return `<div class="match-filters" role="group" aria-label="Match type">${filters.map(value => `<button type="button" class="secondary" data-match-filter="${value}" aria-pressed="${value === filter}">${value}</button>`).join('')}</div>
    ${compact ? list + resultViewControls(view) : ''}
    <div role="status" class="form-status">
      <p>${sampleLabel}</p>
      ${!shown.length ? `<p>No matches of this type in ${html(owner)} latest results. Try All.</p>` : form ? `${recentPulseHtml(shown,playerId)}<dl class="recent-form" aria-label="Recent form"><div><dt>Wins</dt><dd>${form.wins}</dd></div><div><dt>Losses</dt><dd>${form.losses}</dd></div><div><dt>Pending</dt><dd>${form.pending}</dd></div></dl>` : ''}
    </div>
    ${compact ? `<div id="lab-result-panel" role="region" aria-label="${view[0].toUpperCase()+view.slice(1)} result insights">${view==='form'||view==='formats'?recentStatsHtml(rows,playerId,filter,view):labResultBreakdownHtml(shown,playerId,view==='years'?'seasons':'leagues',rows.length,filter==='All'?'All formats':filter,false)}</div>` : list}`
}
export type RecentHistoryLoader={current:()=>boolean;load:(rows:RecentMatchRow[])=>Promise<{rows:RecentMatchRow[];hasMore:boolean}>}
export function showRecentResults(content: HTMLElement, initialRows: RecentMatchRow[], playerId: string, open: (row: RecentMatchRow) => void, owner = 'your', compact=false,history?:RecentHistoryLoader) {
  if (!initialRows.length) {
    content.innerHTML = '<p>No matches are connected to this player record yet. Results will appear here as scores are added.</p>'
    return
  }
  let rows=initialRows,activeView:ResultView='form',activeFilter:MatchFilter='All',busy=false,hasMore=rows.length===10,notice=''
  const valid=()=>content.isConnected&&(!history||history.current())
  const render = (filter: MatchFilter, restoreFocus = false,viewFocus=false,historyFocus=false) => {
    activeFilter=filter
    const expanded=content.querySelector<HTMLDetailsElement>('.recent-match-list')?.open??false
    content.innerHTML = resultsHtml(rows, playerId, filter, owner,compact,activeView==='years'?'seasons':'leagues',activeView)+(history?`<div class="recent-history-actions"><p>${rows.length} connected results loaded. Up to ${RECENT_HISTORY_LIMIT} per visit; this is not a full-history total.</p><p role="status">${html(notice)}</p>${hasMore&&rows.length<RECENT_HISTORY_LIMIT?`<button type="button" class="secondary" data-older-results ${busy?'disabled':''}>${busy?'Loading older matches...':'Load older matches'}</button>`:`<p>${rows.length>=RECENT_HISTORY_LIMIT?'Sample limit reached. Refresh profile to return to the latest ten.':'No more older matches were found in this loaded history.'}</p>`}</div>`:'')
    const list=content.querySelector<HTMLDetailsElement>('.recent-match-list');if(list)list.open=expanded
    content.querySelectorAll<HTMLButtonElement>('[data-result-view]').forEach(button=>{button.onclick=()=>{activeView=button.dataset.resultView as ResultView;render(activeFilter,false,true)}})
    content.querySelectorAll<HTMLButtonElement>('[data-match-filter]').forEach(button => {
      button.onclick = () => render(button.dataset.matchFilter as MatchFilter, true)
    })
    content.querySelectorAll<HTMLButtonElement>('[data-format-matches]').forEach(button=>{button.onclick=()=>{
      if(!valid())return
      render(button.dataset.formatMatches as MatchFilter)
      const list=content.querySelector<HTMLDetailsElement>('.recent-match-list');if(list){list.open=true;list.querySelector<HTMLElement>('summary')?.focus({preventScroll:true});list.scrollIntoView({block:'start'})}
    }})
    const shown = filteredMatches(rows, filter)
    content.querySelectorAll<HTMLButtonElement>('.match-open').forEach(button => {
      button.onclick = () => {
        const row = shown[Number(button.dataset.index)]
        if (!valid() || !row) return
        if (compact) button.focus({preventScroll:true})
        open(row)
      }
    })
    const older=content.querySelector<HTMLButtonElement>('[data-older-results]')
    if(older&&history)older.onclick=async()=>{
      if(busy||!valid())return
      busy=true;notice='';render(activeFilter)
      try{const result=await history.load(rows);if(!valid())return;rows=result.rows;hasMore=result.hasMore;notice='Older match check finished. Charts and records use the loaded sample.'}
      catch{if(!valid())return;notice='Could not add older matches. Your loaded results are still here. Try again, or refresh your profile if history changed.'}
      finally{busy=false;if(valid())render(activeFilter,false,false,true)}
    }
    if (restoreFocus) content.querySelector<HTMLButtonElement>('[data-match-filter][aria-pressed="true"]')?.focus({preventScroll:true})
    if (viewFocus) content.querySelector<HTMLButtonElement>('[data-result-view][aria-pressed="true"]')?.focus({preventScroll:true})
    if (historyFocus) (content.querySelector<HTMLButtonElement>('[data-older-results]')||content.querySelector<HTMLButtonElement>('[data-match-filter][aria-pressed="true"]'))?.focus({preventScroll:true})
  }
  render('All')
}

import {statDonutHtml} from './stat-donut'
import {RECENT_HISTORY_LIMIT} from './recent-results-history'
import {labResultBreakdownHtml,type BreakdownView} from './lab-result-breakdown'
import {playerRecentRecord} from '../../lib/player-recent-record'
import {filterMatchbookEntries} from '../../lib/player-matchbook'
import { matchDate, matchResult, type RecentMatchRow } from './recent-results'
import { html } from './match-details'
import {recentScorecardRow,scorecardOpponents} from './recent-scorecard-row'
import type {PlayerProfileFormat} from './player-profile-format'

export type MatchFilter = 'All' | 'Singles' | 'Doubles'
export type ResultView='form'|'formats'|'leagues'|'years'
const resultViews:ResultView[]=['form','formats','leagues','years']
export function resultViewControls(view:ResultView){return `<div class="match-filters result-view-controls" role="group" aria-label="Result insights">${resultViews.map(value=>`<button type="button" class="secondary" data-result-view="${value}" aria-pressed="${view===value}" aria-controls="lab-result-panel">${value[0].toUpperCase()+value.slice(1)}</button>`).join('')}</div>`}
const filters: MatchFilter[] = ['All', 'Singles', 'Doubles']
const profileViews = {All:'overall',Singles:'singles',Doubles:'doubles'} as const
function matchFilterControls(filter:MatchFilter) {
  return `<div class="match-filters" role="group" aria-label="Match type">${filters.map(value=>`<button type="button" class="secondary" data-match-filter="${value}" aria-pressed="${value===filter}">${value}</button>`).join('')}</div>`
}
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
    if (compact) return recentScorecardRow(row, index, result, playerId)
    const tone = result === 'Won' ? 'won' : result === 'Lost' ? 'lost' : 'pending'
    const date = html(matchDate(row.match_date))
    const format = html(row.match_type || 'Match')
    const league = html(row.league_name || 'League unavailable')
    const score = html(row.score || 'Score unavailable')
    return `<li>
      <div class="match-heading"><strong class="result-${tone}">${result}</strong><span>${date}</span></div>
      <p>${format} · ${league}</p><p class="score">${score}</p>
      <button type="button" class="secondary match-open" data-index="${index}" aria-label="View match details, ${date}, ${html(row.match_type || 'match')}">View match</button>
    </li>`
  }).join('')
  const list = `<ol class="matches">${entries}</ol><small>Scores are shown as recorded, in the source’s court order.</small>`
  if (!compact) return list
  const format = filter === 'All' ? '' : `${filter.toLowerCase()} `
  return `<details class="recent-match-list">
    <summary><span class="app-tool-copy"><strong>Match scorecards</strong><span>${rows.length} ${format}${rows.length === 1 ? 'match' : 'matches'}</span></span><span class="app-tool-arrow" aria-hidden="true">›</span></summary>
    <div class="recent-scorecard-search">
      <label for="lab-scorecard-search">Find a scorecard</label>
      <input id="lab-scorecard-search" type="search" maxlength="100" autocomplete="off" placeholder="Opponent or league">
      <p role="status" data-scorecard-search-status></p>
      <button type="button" class="secondary" data-clear-scorecard-search hidden>Clear search</button>
    </div>
    ${list}
  </details>`
}

function bindScorecardSearch(list:HTMLDetailsElement,rows:RecentMatchRow[],playerId:string,query:string,onQuery:(query:string)=>void) {
  const input=list.querySelector<HTMLInputElement>('#lab-scorecard-search')!
  const entries=list.querySelector<HTMLOListElement>('ol.matches')!
  const note=list.querySelector<HTMLElement>(':scope > small')!
  const status=list.querySelector<HTMLElement>('[data-scorecard-search-status]')!
  const clear=list.querySelector<HTMLButtonElement>('[data-clear-scorecard-search]')!
  const normalize=(text:string)=>text.normalize('NFKD').replace(/\p{M}/gu,'').toLowerCase().trim()
  const cards=Array.from(entries.children,(entry,index)=>({
    entry:entry as HTMLLIElement,
    text:normalize(`${scorecardOpponents(rows[index],playerId)} ${rows[index].league_name??''}`),
  }))
  const update=()=>{
    const words=normalize(input.value).split(/\s+/).filter(Boolean)
    let count=0
    for(const {entry,text} of cards){
      entry.hidden=!words.every(word=>text.includes(word))
      if(!entry.hidden)count++
    }
    entries.hidden=note.hidden=count===0
    status.textContent=words.length?(count?`${count} of ${cards.length} scorecards shown.`:'No loaded scorecards match.') : ''
    clear.hidden=count!==0
  }
  input.value=query
  input.oninput=()=>{onQuery(input.value);update()}
  clear.onclick=()=>{input.value='';input.focus({preventScroll:true});onQuery('');update()}
  update()
  return input
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
  const grouped = compact && (view === 'leagues' || view === 'years')
  return `${matchFilterControls(filter)}
    ${compact ? list + resultViewControls(view) : ''}
    <div role="status" class="form-status">
      ${grouped ? '' : `<p>${sampleLabel}</p>`}
      ${!shown.length ? `<p>No matches of this type in ${html(owner)} latest results. Try All.</p>` : form ? `${recentPulseHtml(shown,playerId)}<dl class="recent-form" aria-label="Recent form"><div><dt>Wins</dt><dd>${form.wins}</dd></div><div><dt>Losses</dt><dd>${form.losses}</dd></div><div><dt>Pending</dt><dd>${form.pending}</dd></div></dl>` : ''}
    </div>
    ${compact ? `<div id="lab-result-panel" role="region" aria-label="${view[0].toUpperCase()+view.slice(1)} result insights">${view==='form'||view==='formats'?recentStatsHtml(rows,playerId,filter,view):labResultBreakdownHtml(shown,playerId,view==='years'?'seasons':'leagues',rows.length,filter==='All'?'All formats':filter,false)}</div>` : list}`
}
function profileScorecardsHtml(shown:RecentMatchRow[],total:number,playerId:string,filter:MatchFilter) {
  const format=filter==='All'?'':`${filter.toLowerCase()} `
  const count=shown.length?`${shown.length} ${format}${shown.length===1?'scorecard':'scorecards'}`:`No ${format}scorecards`
  return `${matchFilterControls(filter)}<p class="player-scorecard-note">${count} in the latest ${total} ${total===1?'result':'results'}.</p>
    ${shown.length?`<ol class="matches player-scorecard-list" role="list">${shown.map((row,index)=>recentScorecardRow(row,index,matchResult(row,playerId),playerId)).join('')}</ol>
    <p class="player-scorecard-note">Scores follow the source’s court order.</p>`:''}`
}
export type RecentHistoryLoader={current:()=>boolean;load:(rows:RecentMatchRow[])=>Promise<{rows:RecentMatchRow[];hasMore:boolean}>}
export function showRecentResults(content: HTMLElement, initialRows: RecentMatchRow[], playerId: string, open: (row: RecentMatchRow) => void, owner = 'your', compact=false,history?:RecentHistoryLoader,profileFormat?:PlayerProfileFormat) {
  if (!initialRows.length) {
    content.innerHTML = '<p>No matches are connected to this player record yet. Results will appear here as scores are added.</p>'
    return
  }
  let rows=initialRows,activeView:ResultView='form',activeFilter:MatchFilter='All',busy=false,hasMore=rows.length===10,notice=''
  let scorecardQuery='',scorecardsExpanded=false
  const valid=()=>content.isConnected&&(!history||history.current())
  const profileFilter=()=>filters.find(filter=>profileViews[filter]===profileFormat?.get())??'All'
  const render = (filter: MatchFilter, restoreFocus = false,viewFocus=false,historyFocus=false) => {
    activeFilter=filter
    const shown=filteredMatches(rows,filter)
    const previousList=content.querySelector<HTMLDetailsElement>('.recent-match-list')
    const previousSearch=previousList?.querySelector<HTMLInputElement>('#lab-scorecard-search')
    const selection=previousSearch&&document.activeElement===previousSearch
      ? [previousSearch.selectionStart,previousSearch.selectionEnd] as const : null
    if(previousList)scorecardsExpanded=previousList.open
    const results=profileFormat?profileScorecardsHtml(shown,rows.length,playerId,filter):resultsHtml(rows,playerId,filter,owner,compact,activeView==='years'?'seasons':'leagues',activeView)
    content.innerHTML = results+(history?`<div class="recent-history-actions">
      <p>${rows.length} ${rows.length===1?'match':'matches'} loaded.</p>
      <p role="status">${html(notice)}</p>
      ${hasMore&&rows.length<RECENT_HISTORY_LIMIT
        ? `<button type="button" class="secondary" data-older-results ${busy?'disabled':''}>${busy?'Loading older matches...':'Load older matches'}</button>`
        : `<p>${rows.length>=RECENT_HISTORY_LIMIT?`Showing the latest ${RECENT_HISTORY_LIMIT} matches.`:'No older matches available.'}</p>`}
    </div>`:'')
    const list=content.querySelector<HTMLDetailsElement>('.recent-match-list')
    let searchInput:HTMLInputElement|undefined
    if(list){
      list.open=scorecardsExpanded
      searchInput=bindScorecardSearch(list,shown,playerId,scorecardQuery,value=>{scorecardQuery=value})
      const historyActions=content.querySelector<HTMLElement>('.recent-history-actions')
      if(historyActions)list.append(historyActions)
    }
    content.querySelectorAll<HTMLButtonElement>('[data-result-view]').forEach(button=>{button.onclick=()=>{activeView=button.dataset.resultView as ResultView;render(activeFilter,false,true)}})
    content.querySelectorAll<HTMLButtonElement>('[data-match-filter]').forEach(button => {
      button.onclick = () => {
        const next=button.dataset.matchFilter as MatchFilter
        if(!profileFormat){render(next,true);return}
        profileFormat.set(profileViews[next])
        content.querySelector<HTMLButtonElement>('[data-match-filter][aria-pressed="true"]')?.focus({preventScroll:true})
      }
    })
    content.querySelectorAll<HTMLButtonElement>('[data-format-matches]').forEach(button=>{button.onclick=()=>{
      if(!valid())return
      render(button.dataset.formatMatches as MatchFilter)
      const list=content.querySelector<HTMLDetailsElement>('.recent-match-list');if(list){list.open=true;list.querySelector<HTMLElement>('summary')?.focus({preventScroll:true});list.scrollIntoView({block:'start'})}
    }})
    content.querySelectorAll<HTMLButtonElement>('.match-open').forEach(button => {
      button.onclick = () => {
        const row = shown[Number(button.dataset.index)]
        if (!valid() || !row) return
        if (compact||profileFormat) button.focus({preventScroll:true})
        open(row)
      }
    })
    const older=content.querySelector<HTMLButtonElement>('[data-older-results]')
    if(older&&history)older.onclick=async()=>{
      if(busy||!valid())return
      busy=true;notice='';render(activeFilter)
      try{
        const result=await history.load(rows)
        if(!valid())return
        notice=result.rows.length>rows.length?'Older matches loaded.':''
        rows=result.rows
        hasMore=result.hasMore
      }
      catch{if(!valid())return;notice='Could not add older matches. Your loaded results are still here. Try again, or refresh your profile if history changed.'}
      finally{busy=false;if(valid())render(activeFilter,false,false,true)}
    }
    if (restoreFocus) content.querySelector<HTMLButtonElement>('[data-match-filter][aria-pressed="true"]')?.focus({preventScroll:true})
    if (viewFocus) content.querySelector<HTMLButtonElement>('[data-result-view][aria-pressed="true"]')?.focus({preventScroll:true})
    if (selection&&searchInput) {
      searchInput.focus({preventScroll:true})
      searchInput.setSelectionRange(...selection)
    } else if (historyFocus) {
      const target=list&&!list.open
        ? list.querySelector<HTMLElement>('summary')
        : content.querySelector<HTMLButtonElement>('[data-older-results]')??searchInput??content.querySelector<HTMLButtonElement>('[data-match-filter][aria-pressed="true"]')
      target?.focus({preventScroll:true})
    }
  }
  render(profileFilter())
  return profileFormat?.subscribe(()=>{
    const next=profileFilter()
    if(valid()&&next!==activeFilter)render(next)
  })
}

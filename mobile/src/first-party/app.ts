import {formatCalendarDay,isValidCalendarDate} from '../../../lib/calendar-date'
import {LEVEL_UP_CARDS} from '../../../lib/level-up/level-up-cards'
import {OFFLINE_IOS_PRIVACY_PARAGRAPHS} from '../../../lib/offline-ios-privacy'
import {TrainingClock,trainingTime} from '../training-clock'
import './app.css'

document.querySelector('#privacy-copy')!.append(...OFFLINE_IOS_PRIVACY_PARAGRAPHS.map(copy=>{
 const paragraph = document.createElement('p')
 paragraph.textContent = copy
 return paragraph
}))

const drills = [
 {id:'split-step-rhythm',label:'Footwork'},
 {id:'serve-target-call',label:'Serve'},
 {id:'three-step-reset',label:'Reset'},
].map(({id,label})=>({card:LEVEL_UP_CARDS.find(card=>card.id===id)!,label}))
let drill = drills[0].card
const drillPicker = document.querySelector('#drill-picker')!
const drillTitle = document.querySelector('#drill-title')!
const drillCue = document.querySelector('#drill-cue')!
const drillDuration = document.querySelector('#drill-duration')!
const drillSteps = document.querySelector('#drill-steps')!
const drillLast = document.querySelector<HTMLElement>('#drill-last')!
const drillStatus = document.querySelector('#drill-status')!
const clock = new TrainingClock()
const elapsed = document.querySelector('#elapsed')!
const toggle = document.querySelector<HTMLButtonElement>('#timer-toggle')!
const timerActions = document.querySelector<HTMLElement>('#timer-actions')!
const finish = document.querySelector<HTMLButtonElement>('#timer-finish')!
const discard = document.querySelector<HTMLButtonElement>('#timer-discard')!
let ticker: number | undefined
const paintTime = () => {elapsed.textContent = trainingTime(clock.seconds())}
const drillButtons = drills.map(({card,label})=>{
 const button = document.createElement('button')
 button.type = 'button'
 button.className = 'secondary'
 button.textContent = label
 button.addEventListener('click',()=>{
  if(card===drill)return
  drill = card
  drillStatus.textContent = ''
  renderDrill()
 })
 drillPicker.append(button)
 return button
})

type PracticeResult = {date:string;seconds:number}
const practiceKey = () => `tenaceiq:first-party:last-practice:v1:${drill.id}`

function readLastPractice(): PracticeResult | null {
 try {
  const practice = JSON.parse(localStorage.getItem(practiceKey()) ?? 'null') as Partial<PracticeResult> | null
  if(typeof practice?.date==='string' && isValidCalendarDate(practice.date)
   && typeof practice.seconds==='number' && Number.isInteger(practice.seconds)
   && practice.seconds>0 && practice.seconds<=7200){
   return {date:practice.date,seconds:practice.seconds}
  }
 } catch {
  // An unreadable practice record does not prevent use of the drill.
 }
 return null
}

function renderLastPractice() {
 const practice = readLastPractice()
 drillLast.hidden = !practice
 drillLast.textContent = practice?`Last practice · ${formatCalendarDay(practice.date,false)} · ${trainingTime(practice.seconds)}`:''
}

function renderDrill() {
 drillButtons.forEach((button,index)=>button.setAttribute('aria-pressed',String(drills[index].card===drill)))
 drillTitle.textContent = drill.title
 drillCue.textContent = drill.cue
 drillDuration.textContent = `About ${drill.durationMinutes} min`
 drillSteps.replaceChildren(...drill.routine.map(step=>{
  const item = document.createElement('li')
  item.textContent = step
  return item
 }))
 renderLastPractice()
}

function closeDrill() {
 window.clearInterval(ticker)
 clock.reset()
 paintTime()
 toggle.textContent = 'Start drill'
 toggle.focus({preventScroll:true})
 timerActions.hidden = true
 drillButtons.forEach(button=>{button.disabled = false})
}

renderDrill()

toggle.addEventListener('click', () => {
 if(clock.running()){
  clock.pause()
  window.clearInterval(ticker)
  paintTime()
  toggle.textContent = 'Resume drill'
  return
 }
 clock.start()
 paintTime()
 ticker = window.setInterval(paintTime, 250)
 timerActions.hidden = false
 drillButtons.forEach(button=>{button.disabled = true})
 toggle.textContent = 'Pause drill'
 drillStatus.textContent = ''
})

finish.addEventListener('click', () => {
 const seconds = clock.seconds()
 closeDrill()
 if(seconds===0){
  drillStatus.textContent = 'Practice ended. No time was recorded.'
  return
 }
 try {
  localStorage.setItem(practiceKey(),JSON.stringify({date:today(),seconds}))
  renderLastPractice()
  drillStatus.textContent = 'Practice saved on this device.'
 } catch {
  drillStatus.textContent = `Practice ended after ${trainingTime(seconds)}. Couldn’t save it on this device.`
 }
})

discard.addEventListener('click',()=>{
 closeDrill()
 drillStatus.textContent = 'Practice discarded.'
})

type MatchResult = {date:string;format:'Singles'|'Doubles';result:'Won'|'Lost';score:string}
type LocalMatch = MatchResult & {id:number}
const storageKey = 'tenaceiq:first-party:match-log:v1'
const matchLimit = 200
const matchForm = document.querySelector<HTMLFormElement>('#match-form')!
const dateInput = matchForm.querySelector<HTMLInputElement>('[name=date]')!
const formatInput = matchForm.querySelector<HTMLSelectElement>('[name=format]')!
const resultInput = matchForm.querySelector<HTMLSelectElement>('[name=result]')!
const scoreInput = matchForm.querySelector<HTMLInputElement>('[name=score]')!
const matchTitle = document.querySelector<HTMLElement>('#match-title')!
const matchSave = document.querySelector<HTMLButtonElement>('#match-save')!
const matchCancel = document.querySelector<HTMLButtonElement>('#match-cancel')!
const matchStatus = document.querySelector('#match-status')!
const matchList = document.querySelector('#match-list')!
const matchEmpty = document.querySelector<HTMLElement>('#match-empty')!
const recentForm = document.querySelector<HTMLElement>('#recent-form')!
const recentSample = document.querySelector('#recent-sample')!
const recentRecord = document.querySelector('#recent-record')!
const recentSingles = document.querySelector('#recent-singles')!
const recentDoubles = document.querySelector('#recent-doubles')!
let editing: LocalMatch | null = null

function today() {
 const now = new Date()
 return [now.getFullYear(),now.getMonth()+1,now.getDate()].map((part,index)=>String(part).padStart(index===0?4:2,'0')).join('-')
}

function isMatch(value: unknown): value is MatchResult {
 if(!value || typeof value !== 'object')return false
 const row = value as Partial<MatchResult>
 return typeof row.date === 'string' && isValidCalendarDate(row.date)
  && (row.format === 'Singles' || row.format === 'Doubles')
  && (row.result === 'Won' || row.result === 'Lost')
  && typeof row.score === 'string' && row.score.length <= 48
}

function readMatches(): LocalMatch[] {
 const raw = localStorage.getItem(storageKey)
 if(raw === null)return []
 const records: unknown = JSON.parse(raw)
 if(!Array.isArray(records) || records.length > matchLimit)throw Error('Match log unavailable.')
 const ids = new Set<number>()
 return records.map((record:unknown,index)=>{
  if(!isMatch(record))throw Error('Match log unavailable.')
  // The first offline build stored results without identifiers. Give those
  // records stable IDs when the player next saves a change.
  const id = 'id' in record ? record.id : -(index+1)
  if(typeof id !== 'number' || !Number.isSafeInteger(id) || id === 0 || ids.has(id)){
   throw Error('Match log unavailable.')
  }
  ids.add(id)
  return {id,date:record.date,format:record.format,result:record.result,score:record.score}
 })
}

function recordLabel(matches: MatchResult[]) {
 const wins = matches.filter(match=>match.result==='Won').length
 const losses = matches.length-wins
 return `${wins} ${wins===1?'win':'wins'} · ${losses} ${losses===1?'loss':'losses'}`
}

function setEditor(match: LocalMatch | null = null) {
 editing = match
 matchForm.reset()
 dateInput.max = today()
 dateInput.value = match?.date ?? dateInput.max
 formatInput.value = match?.format ?? ''
 resultInput.value = match?.result ?? ''
 scoreInput.value = match?.score ?? ''
 matchTitle.textContent = match?'Edit match':'Record a match'
 matchSave.textContent = match?'Save changes':'Save match'
 matchCancel.hidden = !match
}

function focusEdit(id: number) {
 matchList.querySelector<HTMLButtonElement>(`[data-edit-match="${id}"]`)?.focus()
}

function renderMatches(records: LocalMatch[]) {
 const sorted = [...records].sort((a,b)=>b.date.localeCompare(a.date))
 const recent = sorted.slice(0,10)
 recentForm.hidden = !recent.length
 recentSample.textContent = recent.length===1?'Most recent recorded match':`Last ${recent.length} recorded matches`
 recentRecord.textContent = recordLabel(recent)
 recentSingles.textContent = recordLabel(recent.filter(match=>match.format==='Singles'))
 recentDoubles.textContent = recordLabel(recent.filter(match=>match.format==='Doubles'))
 matchList.replaceChildren()
 matchEmpty.hidden = records.length > 0
 for(const match of sorted){
  const item = document.createElement('li')
  const details = document.createElement('div')
  const summary = document.createElement('strong')
  const date = document.createElement('time')
  const edit = document.createElement('button')
  summary.textContent = `${match.result} · ${match.format}`
  details.append(summary)
  if(match.score){
   const score = document.createElement('span')
   score.className = 'match-score'
   score.textContent = match.score
   details.append(score)
  }
  date.dateTime = match.date
  date.textContent = formatCalendarDay(match.date, true)
  details.append(date)
  edit.type = 'button'
  edit.className = 'secondary'
  edit.dataset.editMatch = String(match.id)
  edit.textContent = 'Edit'
  edit.setAttribute('aria-label',`Edit ${match.format.toLowerCase()} match on ${date.textContent}`)
  edit.addEventListener('click',()=>{
   setEditor(match)
   matchStatus.textContent = ''
   matchTitle.focus()
  })
  item.append(details,edit)
  matchList.append(item)
 }
}

setEditor()
dateInput.addEventListener('focus', () => {dateInput.max = today()})
matchCancel.addEventListener('click',()=>{
 const previous = editing
 setEditor()
 matchStatus.textContent = ''
 if(previous)focusEdit(previous.id)
})
try {
 renderMatches(readMatches())
} catch {
 matchEmpty.hidden = true
 matchStatus.textContent = 'Couldn’t open your saved matches on this device.'
}

matchForm.addEventListener('submit', event => {
 event.preventDefault()
 const values = new FormData(matchForm)
 const match = {date:values.get('date'),format:values.get('format'),result:values.get('result'),score:String(values.get('score') ?? '').trim()}
 if(!isMatch(match) || match.date > today()){
  matchStatus.textContent = 'Choose a match date, format and result.'
  return
 }
 try {
  const records = readMatches()
  const previous = editing
  if(previous){
   const index = records.findIndex(record=>record.id===previous.id)
   if(index<0 || JSON.stringify(records[index])!==JSON.stringify(previous)){
    renderMatches(records)
    setEditor()
    matchStatus.textContent = 'This match changed. Open it again from your log.'
    return
   }
   records[index] = {id:previous.id,...match}
  }else if(records.length >= matchLimit){
   matchStatus.textContent = 'Your match log has reached 200 matches.'
   return
  }else{
   const id = Math.max(0,...records.map(record=>record.id))+1
   if(!Number.isSafeInteger(id))throw Error('Match log unavailable.')
   records.unshift({id,...match})
  }
  localStorage.setItem(storageKey,JSON.stringify(records))
  renderMatches(records)
  setEditor()
  matchStatus.textContent = previous?'Match updated on this device.':'Match saved on this device.'
  if(previous)focusEdit(previous.id)
 } catch {
  matchStatus.textContent = 'Couldn’t save the match on this device.'
 }
})

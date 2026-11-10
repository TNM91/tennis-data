import {formatCalendarDay,isValidCalendarDate} from '../../../lib/calendar-date'
import {LEVEL_UP_CARDS} from '../../../lib/level-up/level-up-cards'
import {TrainingClock,trainingTime} from '../training-clock'
import './app.css'

const drill = LEVEL_UP_CARDS.find(card => card.id === 'split-step-rhythm')!
document.querySelector('#drill-title')!.textContent = drill.title
document.querySelector('#drill-cue')!.textContent = drill.cue
for(const step of drill.routine){
 const item = document.createElement('li')
 item.textContent = step
 document.querySelector('#drill-steps')!.append(item)
}

const clock = new TrainingClock()
const elapsed = document.querySelector('#elapsed')!
const toggle = document.querySelector<HTMLButtonElement>('#timer-toggle')!
const finish = document.querySelector<HTMLButtonElement>('#timer-finish')!
const drillStatus = document.querySelector('#drill-status')!
let ticker: number | undefined
const paintTime = () => {elapsed.textContent = trainingTime(clock.seconds())}

toggle.addEventListener('click', () => {
 if(clock.running()){
  clock.pause()
  window.clearInterval(ticker)
  paintTime()
  toggle.textContent = 'Resume warm-up'
  return
 }
 if(finish.hidden)clock.reset()
 clock.start()
 paintTime()
 ticker = window.setInterval(paintTime, 250)
 finish.hidden = false
 toggle.textContent = 'Pause warm-up'
 drillStatus.textContent = ''
})

finish.addEventListener('click', () => {
 clock.pause()
 window.clearInterval(ticker)
 paintTime()
 drillStatus.textContent = `Warm-up complete · ${trainingTime(clock.seconds())}`
 toggle.textContent = 'Start warm-up'
 toggle.focus({preventScroll:true})
 finish.hidden = true
})

type LocalMatch = {date:string;format:'Singles'|'Doubles';result:'Won'|'Lost';score:string}
const storageKey = 'tenaceiq:first-party:match-log:v1'
const matchLimit = 200
const matchForm = document.querySelector<HTMLFormElement>('#match-form')!
const dateInput = matchForm.querySelector<HTMLInputElement>('[name=date]')!
const matchStatus = document.querySelector('#match-status')!
const matchList = document.querySelector('#match-list')!
const matchEmpty = document.querySelector<HTMLElement>('#match-empty')!

function today() {
 const now = new Date()
 return [now.getFullYear(),now.getMonth()+1,now.getDate()].map((part,index)=>String(part).padStart(index===0?4:2,'0')).join('-')
}

function isMatch(value: unknown): value is LocalMatch {
 if(!value || typeof value !== 'object')return false
 const row = value as Partial<LocalMatch>
 return typeof row.date === 'string' && isValidCalendarDate(row.date)
  && (row.format === 'Singles' || row.format === 'Doubles')
  && (row.result === 'Won' || row.result === 'Lost')
  && typeof row.score === 'string' && row.score.length <= 48
}

function readMatches(): LocalMatch[] {
 const raw = localStorage.getItem(storageKey)
 if(raw === null)return []
 const records: unknown = JSON.parse(raw)
 if(!Array.isArray(records) || records.length > matchLimit || !records.every(isMatch)){
  throw Error('Match log unavailable.')
 }
 return records
}

function renderMatches(records: LocalMatch[]) {
 matchList.replaceChildren()
 matchEmpty.hidden = records.length > 0
 for(const match of [...records].sort((a,b)=>b.date.localeCompare(a.date))){
  const item = document.createElement('li')
  const summary = document.createElement('strong')
  const date = document.createElement('time')
  summary.textContent = [match.result,match.format,match.score].filter(Boolean).join(' · ')
  date.dateTime = match.date
  date.textContent = formatCalendarDay(match.date, true)
  item.append(summary,date)
  matchList.append(item)
 }
}

dateInput.value = dateInput.max = today()
dateInput.addEventListener('focus', () => {dateInput.max = today()})
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
  if(records.length >= matchLimit){
   matchStatus.textContent = 'Your match log has reached 200 matches.'
   return
  }
  records.unshift(match)
  localStorage.setItem(storageKey,JSON.stringify(records))
  renderMatches(records)
  matchForm.reset()
  dateInput.value = dateInput.max = today()
  matchStatus.textContent = 'Match saved on this device.'
 } catch {
  matchStatus.textContent = 'Couldn’t save the match on this device.'
 }
})

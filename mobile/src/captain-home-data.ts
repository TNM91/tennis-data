import type {CaptainHomeMatchFocus} from '../../lib/captain-home-match-focus'
import {isValidCalendarDate} from '../../lib/calendar-date'
import {matchCenterContext,matchCenterFixture,matchCenterNext,type MatchCenter} from './captain-match-center-data'
import type {CaptainData,CaptainMatch} from './captain-data'
import type {TeamScope} from './team-room-data'
import {lineupReadiness} from './lineup-readiness'
import ui from '../generated/website-ui.json'
import {html} from './match-details'
export function captainHomeMatch(data:CaptainData,id:string):CaptainMatch|null{
 const matches=data.matches.filter(m=>m.id===id)
 if(matches.length!==1)return null
 const m=matches[0];return m.id&&m.opponent.trim()&&isValidCalendarDate(m.date)?m:null
}
export function captainHomeFocus(scope:TeamScope,match:CaptainMatch,data:MatchCenter):CaptainHomeMatchFocus{
 matchCenterContext(scope,match,data.lineup,data.publication);matchCenterFixture(scope,match,data.fixture)
 if(!Number.isFinite(Date.parse(data.checkedAt)))throw Error('Readiness time could not be confirmed.')
 const ready=lineupReadiness(data.lineup.plan,data.lineup.roster,data.replies),next=matchCenterNext(data),issues:CaptainHomeMatchFocus['issues']=[]
 if(ready.openSeats||ready.duplicates)issues.push({kind:'lineup',label:ready.duplicates?'A player appears more than once in this plan.':`${ready.openSeats} open playing seat${ready.openSeats===1?'':'s'}.`})
 if(ready.attention.length)issues.push({kind:'availability',label:`${ready.attention.length} selected player${ready.attention.length===1?' needs':'s need'} availability review.`})
 if(data.publication.shared.pendingFinal)issues.push({kind:'send',label:'Final lineup delivery needs review.'})
 return {courtsLabel:String(ready.courts)+(ready.defaults?` (${ready.defaults} defaulted)`:''),confirmedLabel:`${ready.available} of ${ready.selected.length}`,waitingLabel:String(ready.attention.length),issues,action:{kind:next.action==='plan'?'lineup':next.action==='publish'?'send':'court',label:next.label,detail:next.reason}}
}
export function captainHomeFocusHtml(focus:CaptainHomeMatchFocus|null){
 const value=focus??{courtsLabel:'Not checked',confirmedLabel:'Not checked',waitingLabel:'Not checked',issues:[],action:{kind:'lineup' as const,label:'Check match readiness',detail:'Check this fixture’s private working plan, availability and shared lineup before choosing your next task.'}}
 const fields:Record<string,string>={TIQ_CAPTAIN_COURTS:value.courtsLabel,TIQ_CAPTAIN_AVAILABLE:value.confirmedLabel,TIQ_CAPTAIN_REVIEW:value.waitingLabel,TIQ_CAPTAIN_ACTION:value.action.label,TIQ_CAPTAIN_DETAIL:value.action.detail}
 value.issues.forEach((issue,i)=>fields['TIQ_CAPTAIN_ISSUE'+i]=issue.label)
 if(value.issues.length>3)throw Error('Readiness summary unavailable.')
 return '<div class="website-ui website-captain-focus">'+ui.captainFocus[value.issues.length].replace(/TIQ_CAPTAIN_[A-Z]+[0-9]?/g,key=>html(fields[key]??key))+'</div>'
}

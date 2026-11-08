import {html} from './match-details'

export function competitionScheduleHtml(date:string,time:string,location:string) {
 if(!date&&!time&&!location)return ''
 return `<div class="fixture-schedule">
  ${date?`<p class="fixture-schedule-date">${html(date)}</p>`:''}
  ${time?`<p class="fixture-schedule-time">${html(time)}</p>`:''}
  ${location?`<p class="fixture-location">${html(location)}</p>`:''}
 </div>`
}

export function competitionOpponentsHtml(a:string,b:string) {
 return `<h4 class="competition-opponents"><span class="competition-contender">${html(a)}</span> <span class="fixture-versus">vs</span> <span class="competition-contender">${html(b)}</span></h4>`
}

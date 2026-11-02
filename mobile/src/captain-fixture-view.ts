import type {CaptainMatch} from './captain-data'
import type {TeamScope} from './team-room-data'
import {html} from './match-details'
import {matchDate} from './recent-results'

export function captainFixtureHtml(scope:TeamScope,match:CaptainMatch){
 return `<div class="captain-fixture-hero"><p class="captain-eyebrow">${html(scope.teamName)}</p><h3><span>vs</span> ${html(match.opponent)}</h3><p class="captain-fixture-scope">${html(scope.leagueName)} · ${html(scope.flight)}</p><dl class="captain-fixture-details"><div><dt>Match date</dt><dd>${html(matchDate(match.date))}</dd></div><div><dt>Start time</dt><dd>${html(match.time||'Time not set')}</dd></div><div><dt>Courts</dt><dd>${html(match.facility||'Facility not set')}</dd></div></dl></div>`
}

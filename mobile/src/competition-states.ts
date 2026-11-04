import websiteUi from '../generated/website-ui.json'
import {html} from './match-details'

type CompetitionFeature='leagues'|'tournaments'
export function competitionFeedbackHtml(feature:CompetitionFeature,busy:boolean,message:string){
 const kind=busy?'loading':'error',noun=feature==='leagues'?'Leagues':'Tournaments'
 return `<section class="competition-feedback" data-kind="${kind}" role="${busy?'status':'alert'}" tabindex="-1" data-${feature==='leagues'?'competition':'tournament'}-notice><div class="competition-feedback-heading"><span aria-hidden="true">${websiteUi.icons[feature]}</span><h3>${busy?'Loading '+noun.toLowerCase():noun+' unavailable'}</h3></div><p>${html(message)}</p>${busy?'<div class="competition-loading-preview" aria-hidden="true"><span></span><span></span></div>':'<button type="button" class="secondary" data-competition-retry>Try again</button>'}</section>`
}
export function competitionEmptyHtml(feature:CompetitionFeature,heading:string,detail:string,action?:'browse'|'clear'){
 return `<section class="competition-empty competition-feedback" data-kind="empty"><div class="competition-feedback-heading"><span aria-hidden="true">${websiteUi.icons[feature]}</span><h3>${html(heading)}</h3></div><p>${html(detail)}</p>${action?`<button type="button" class="${action==='clear'?'secondary':''}" data-competition-${action==='browse'?'discover':'clear-search'}>${action==='browse'?'Browse leagues':'Clear search'}</button>`:''}</section>`
}

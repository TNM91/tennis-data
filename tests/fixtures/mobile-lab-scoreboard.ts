import websiteUi from '../../mobile/generated/website-ui.json'
import {ratingsHtml} from '../../mobile/src/player-ratings-view'
import {labRecentFormHtml,bindLabFormScorecards} from '../../mobile/src/lab-recent-form'
import {labLevelPathHtml} from '../../mobile/src/lab-level-path'
import {showRecentResults} from '../../mobile/src/results-view'
import {mountLabRatingTrends} from '../../mobile/src/lab-rating-trends'
import type {RecentMatchRow} from '../../mobile/src/recent-results'
import type {RecordedRatings} from '../../mobile/src/player-ratings-data'
const owner='synthetic-owner',app=document.querySelector<HTMLElement>('#app')!
const navigation=document.createElement('nav');navigation.className='app-navigation';navigation.setAttribute('aria-label','Main navigation')
navigation.innerHTML=(['lab','explore','following','matchup','teams'] as const).map(key=>`<button type="button" data-screen="${key}" ${key==='lab'?'aria-current="page"':''}><span aria-hidden="true">${websiteUi.icons[key]}</span><span>${({lab:'My Lab',explore:'Explore',following:'Following',matchup:'Matchup',teams:'Chats'})[key]}</span></button>`).join('');app.after(navigation)
const account=document.createElement('button');account.type='button';account.className='secondary native-account-entry';account.setAttribute('aria-label','Account settings');account.textContent='Account';document.querySelector('.app-header')?.append(account)
type LabFixtureState={authReads:number;opened:string;training:string;active:boolean;render:(scenario?:string)=>void;invalidate:()=>void}
const state:LabFixtureState={authReads:0,opened:'',training:'',active:true,render:()=>{},invalidate:()=>{state.active=false}}
Object.assign(window,{labFixture:state})
let revision=0,trends:ReturnType<typeof mountLabRatingTrends>|null=null
state.render=(scenario='default')=>{
 trends?.dispose();trends=null;const version=++revision;state.active=true;state.authReads=0;state.opened='';state.training=''
 const player:RecordedRatings={overall_rating:4,overall_dynamic_rating:4.42,singles_dynamic_rating:4.37,doubles_dynamic_rating:4.49,rating_source:'verified'}
 let rows:RecentMatchRow[]=Array.from({length:10},(_,i)=>({id:'court-'+i,match_date:'2026-10-'+(28-i),match_type:i%3===0?'singles':'doubles',league_name:'City Tennis League',score:i%3===2?'4-6, 3-6':'6-4, 6-3',winner_side:i%3===2?'A':'B',match_players:[{player_id:owner,side:'B'}]}))
 if(scenario==='fallback'){player.singles_dynamic_rating=null;player.doubles_dynamic_rating=null}
 if(scenario==='empty'){player.overall_dynamic_rating=null;player.singles_dynamic_rating=null;player.doubles_dynamic_rating=null;rows=[]}
 if(scenario==='self')player.rating_source='self'
 if(scenario==='pending')rows=rows.map(row=>({...row,winner_side:null}))
 if(scenario==='all-losses')rows=rows.map(row=>({...row,winner_side:'A'}))
 if(scenario==='all-wins')rows=rows.map(row=>({...row,winner_side:'B'}))
 const name=scenario==='long'?'Alexandria-Marguerite Montgomery':'Jordan Lee'
 app.innerHTML='<header class="lab-scoreboard-intro"><div><small class="stat-eyebrow">My Lab</small><h1>'+name+'</h1><p>Review Aces</p></div></header><section class="lab-stat-panel lab-scoreboard" aria-labelledby="lab-ratings-title"><small class="stat-eyebrow">Your game, in numbers</small><h2 id="lab-ratings-title">Your scoreboard</h2><div>'+ratingsHtml(player,true,true)+'</div></section><div class="lab-form-host">'+labRecentFormHtml(rows,owner)+'</div><section id="rating-trends"></section><section id="recent-results"><h2>Recent matches</h2><div id="results-content"></div></section><div class="lab-next-band">'+labLevelPathHtml(player)+'</div><section id="lab-identity"><h2>Move your game forward</h2><p>Choose your next practice from your training tools.</p></section>'
 const current=()=>state.active&&revision===version
 bindLabFormScorecards(app.querySelector<HTMLElement>('.lab-form-host')!,rows,current,row=>{state.opened=row.id})
 showRecentResults(app.querySelector<HTMLElement>('#results-content')!,rows,owner,row=>{state.opened=row.id},'your',true)
 const client={auth:{getSession:async()=>{state.authReads++;return {data:{session:null},error:Error('Synthetic unavailable session')}}}}
 trends=mountLabRatingTrends(app.querySelector<HTMLElement>('#rating-trends')!,client as never,owner,current)
 app.querySelectorAll<HTMLButtonElement>('[data-training]').forEach(button=>{button.onclick=()=>{if(current())state.training=button.dataset.training||''}})
}
state.render(new URLSearchParams(location.search).get('scenario')||'default')

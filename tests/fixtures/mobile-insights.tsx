import {useEffect,useState} from 'react'
import {createRoot} from 'react-dom/client'
import websiteUi from '../../mobile/generated/website-ui.json'
import {PlayerJourney} from '../../mobile/src/player-journey-view'
import type {JourneyHistory} from '../../mobile/src/player-journey-data'
import {PlayerRecordGraphics} from '../../mobile/src/player-record-graphics'
import {PlayerProfileHeader} from '../../mobile/src/player-profile-header-view'
import {createPlayerProfileFormat,usePlayerProfileFormat} from '../../mobile/src/player-profile-format'
import {unknownImportFreshness} from '../../lib/player-import-freshness'
import {TeamCourtSampleView} from '../../mobile/src/team-court-records-view'
import type {TeamCourtSample} from '../../mobile/src/team-court-records-data'
import type {PlayerPerformanceData} from '../../mobile/src/player-performance-data'
import {showRecentResults} from '../../mobile/src/results-view'
import type {RecentMatchRow} from '../../mobile/src/recent-results'
const state={opened:'',active:true,invalidate:()=>{state.active=false}}
Object.assign(window,{insightsFixture:state})
const date=(ago:number)=>new Date(Date.now()-ago*86400000).toISOString().slice(0,10)
const snapshot=(id:string,ago:number,rating:number|null)=>({id,player_id:'fixture-player',rating_type:'overall',snapshot_date:date(ago),dynamic_rating:rating,delta:rating===null?null:.01,track:'tiq' as const,match_id:'court-'+id})
const history:JourneyHistory={overall:{rows:[snapshot('5',1,4.42),snapshot('missing',5,null),snapshot('4',10,4.37),snapshot('3',20,4.3),snapshot('2',45,4.2),snapshot('1',100,4.1)],more:true},singles:{rows:[{...snapshot('single',3,4.37),match_id:null}],more:false},doubles:{rows:[],more:false}}
const data:PlayerPerformanceData={matches:Array.from({length:6},(_,i)=>({id:'court-'+i,date:date(i+1),matchType:i<2?'singles':'doubles',result:i===1||i===5?'L':'W'})),snapshots:[],matchesLimited:false,ratingsLimited:false}
const sample:TeamCourtSample={parentCount:2,sampled:false,excluded:0,records:Array.from({length:4},(_,i)=>({id:'team-court-'+i,date:i===3?'2025-10-24':date(i+1),format:i<2?'singles':'doubles',result:i===1?'L':'W',score:'6-4 6-3',opponent:i===0?'Montgomery & Alexandria-Marguerite Aces':'Northside Aces',players:[{id:'player-'+i,name:'Jordan Lee'},...(i<2?[]:[{id:'partner-'+i,name:'Casey Morgan'}])]}))}
const choice={id:'fixture-player',name:'Alexandria-Marguerite Montgomery',location:'Northside Tennis Club',flight:'4.0'},store=createPlayerProfileFormat()
function Profile(){const [view]=usePlayerProfileFormat(store);return <><PlayerProfileHeader choice={choice} player={{...choice,rating_source:'verified',overall_rating:4,overall_dynamic_rating:4.42,singles_dynamic_rating:4.37,doubles_dynamic_rating:4.49,tiq_rating_status:'current',tiq_rating_model:'fixture',tiq_rating_season:new Date().getUTCFullYear(),tiq_singles_matches:2,tiq_doubles_matches:4}} freshness={unknownImportFreshness} loading={false} failed={false} performance={data} state="ready" format={store}/><PlayerRecordGraphics data={data} view={view}/></>}
function Journey(){const [opened,setOpened]=useState('');return <><PlayerJourney history={history} expandChart onOpenMatch={point=>{if(state.active){state.opened=point.matchId||'';setOpened(state.opened)}}}/><p id="opened-scorecard" role="status">{opened}</p></>}
function Results(){useEffect(()=>{const rows:RecentMatchRow[]=Array.from({length:6},(_,i)=>({id:'result-'+i,match_date:i===5?'2025-10-24':date(i+1),match_type:i<2?'singles':'doubles',league_name:i===0?'City League':'Northside League',winner_side:i===1||i===5?'A':'B',score:'6-4 6-3',match_players:[{player_id:'fixture-player',side:'B'}]}));showRecentResults(document.querySelector('#results-content')!,rows,'fixture-player',row=>{state.opened=row.id},'your',true,{current:()=>state.active,load:async previous=>({rows:previous,hasMore:false})})},[]);return <section id="recent-results"><h1>Match insights</h1><div id="results-content"/></section>}
const app=document.querySelector('#app')!,view=new URLSearchParams(location.search).get('view')||'journey'
const nav=document.createElement('nav');nav.className='app-navigation';nav.setAttribute('aria-label','Main navigation');nav.innerHTML=(['lab','explore','following','matchup','teams'] as const).map(key=>`<button type="button" ${key==='lab'?'aria-current="page"':''}><span aria-hidden="true">${websiteUi.icons[key]}</span><span>${({lab:'My Lab',explore:'Explore',following:'Following',matchup:'Matchup',teams:'Chats'})[key]}</span></button>`).join('');app.after(nav)
createRoot(app).render(view==='results'?<Results/>:<div className="website-ui insights-fixture">{view==='team'?<><h1>Team court results</h1><TeamCourtSampleView sample={sample}/></>:view==='profile'?<Profile/>:<Journey/>}</div>)

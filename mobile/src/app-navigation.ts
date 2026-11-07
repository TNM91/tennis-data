import websiteUi from '../generated/website-ui.json'
import {nativeActionIcon} from './native-action-icons'
import {html} from './match-details'

export type AppScreen='lab'|'explore'|'following'|'matchup'|'teams'|'compete'|'more'|'coach'
export type AppDestination=AppScreen|'leagues'|'tournaments'|'league-office'|'imports'|'account'|'training'|'training-inbox'|'training-progress'|'coach-workspace'|'coach-connection'|'coach-tactics'|'coach-lessons'|'coach-calendar'|'coach-weeks'|'coach-proof'|'coach-video'|'coach-messages'|'coach-dates'|'updates'|'calendar'
export type AppHub='compete'|'more'|'coach'
export const mainTabs=[{screen:'lab',label:'My Lab',icon:'lab'},{screen:'explore',label:'Explore',icon:'explore'},{screen:'teams',label:'Chats',icon:'teams'},{screen:'compete',label:'Compete',icon:'compete'},{screen:'more',label:'More',icon:'more'}] as const
export function currentTab(screen:AppScreen){return screen==='following'||screen==='matchup'||screen==='coach'?'more':screen}
export function navigationHtml(){return mainTabs.map(t=>'<button type="button" data-screen="'+t.screen+'"><span class="nav-tab-icon" aria-hidden="true">'+(t.icon==='more'?nativeActionIcon('more'):websiteUi.icons[t.icon])+(t.screen==='teams'?'<span class="chat-unread-badge" data-chat-badge hidden></span>':'')+'</span><span>'+t.label+'</span></button>').join('')}
type Tool={destination:AppDestination;title:string;detail:string;icon:keyof typeof websiteUi.icons;web?:boolean;keywords?:string}
const tools:Record<string,Tool>={
 personalCalendar:{destination:'calendar',title:'Calendar',detail:'Matches, lessons and practice.',icon:'calendar',keywords:'agenda schedule dates availability events personal plans competition coach sessions'},
 updates:{destination:'updates',title:'Updates',detail:'Your unread messages, schedule changes and account news.',icon:'alerts',keywords:'notifications unread alerts'},
 leagues:{destination:'leagues',title:'Leagues',detail:'Your entries, schedules, results and standings.',icon:'leagues'},
 tournaments:{destination:'tournaments',title:'Tournaments',detail:'Find events, enter a division and follow the draw.',icon:'tournaments'},
 coach:{destination:'coach',title:'Coach & training',detail:'Lessons, drills and check-ins.',icon:'coach',keywords:'coaching students assignments weekly plans practice accept invitation invite'},
 following:{destination:'following',title:'Following',detail:'Players, teams and leagues you follow.',icon:'following',keywords:'saved favorites'},
 matchup:{destination:'matchup',title:'Matchup',detail:'Compare players before you play.',icon:'matchup',keywords:'prepare opponent'},
 office:{destination:'league-office',title:'League Office',detail:'Manage your league seasons, entries and match desk.',icon:'leagues'},
 imports:{destination:'imports',title:'Uploads & imports',detail:'Review your scorecards, schedules and roster uploads.',icon:'imports'},
 account:{destination:'account',title:'Account',detail:'Membership, Face ID, sign-in and account settings.',icon:'account',keywords:'login log in logout log out subscription billing password'},
 teams:{destination:'teams',title:'Teams & captain tools',detail:'Open Chats, then your team’s match-day and captain tools.',icon:'teams'},
 training:{destination:'training',title:'Practice & drills',detail:'Build a focused session for your next step.',icon:'catalog'},
 inbox:{destination:'training-inbox',title:'Your coach & weekly plans',detail:'Open assignments, send a check-in and review saved weeks.',icon:'inbox'},
 connection:{destination:'coach-connection',title:'Accept coach invitation',detail:'Connect your account using the link your coach shared.',icon:'inbox'},
 progress:{destination:'training-progress',title:'Training progress',detail:'Review the sessions and proof you have saved.',icon:'progress'},
 coachDesk:{destination:'coach-workspace',title:'Students & assignments',detail:'Plan practice and review your players’ check-ins.',icon:'coach'},
 tactics:{destination:'coach-tactics',title:'Tactics',detail:'A full-screen court for patterns, movement and match plans.',icon:'tactics'},
 lessons:{destination:'coach-lessons',title:'Lesson planner',detail:'Session plans, development lessons and practice packs.',icon:'coach'},
 lessonDates:{destination:'coach-dates',title:'Lesson dates',detail:'Shared lessons and follow-up dates.',icon:'calendar'},
 calendar:{destination:'coach-calendar',title:'Coach calendar',detail:'Lessons, follow-up dates and calendar subscriptions.',icon:'calendar'},
 weeks:{destination:'coach-weeks',title:'Shared weeks',detail:'Guide the next rep, answer questions and adjust practice.',icon:'catalog'},
 proof:{destination:'coach-proof',title:'Player proof',detail:'Shared sessions, player reflections and progress.',icon:'progress'},
 video:{destination:'coach-video',title:'Video review',detail:'Record, slow down and mark up a player’s clip.',icon:'coach'},
 coachMessages:{destination:'coach-messages',title:'Coach messages',detail:'Private chats with your coach or players.',icon:'teams'},
}
function toolHtml(t:Tool,featured=false){
 const competition=t.destination==='leagues'||t.destination==='tournaments'
 const category=t.destination==='leagues'?'Season play':'Event play'
 const action=t.destination==='leagues'?'Find your league':'Explore events'
 return '<button type="button" class="secondary app-tool'+(competition?' app-tool-competition':'')+(featured?' app-tool-featured':'')+'" data-app-destination="'+t.destination+'" data-tool-search="'+html([t.title,t.detail,t.keywords||''].join(' '))+'">'
  +(featured?'<span class="app-tool-court-atmosphere" aria-hidden="true"><img class="app-tool-court" src="./brand/courts/tiq-native-ace-deuce-refined-20261031-v3.png" alt="" width="1727" height="911"></span>':'')
  +'<span class="app-tool-icon" aria-hidden="true">'+websiteUi.icons[t.icon]+'</span><span class="app-tool-copy">'
  +(competition?'<small class="competition-category">'+category+'</small>':'')
  +'<strong>'+t.title+'</strong><span>'+t.detail+'</span>'+(t.web?'<small>Opens website</small>':'')+'</span>'
  +'<span class="app-tool-arrow" aria-hidden="true">'+(t.web?'↗':'›')+'</span>'
  +(competition?'<span class="competition-action" aria-hidden="true">'+action+'<span>→</span></span>':'')+'</button>'
}
export function homeShortcutsHtml(){
 const shortcuts=[
  [tools.leagues,'Schedules & standings'],
  [tools.tournaments,'Events & draws'],
  [tools.coach,'Lessons, drills & check-ins'],
 ] as const
 return `<nav class="lab-shortcuts" aria-label="Play and improve">${shortcuts.map(([tool,detail])=>{
  const id=`lab-shortcut-${tool.destination}`
  return `<button type="button" class="secondary app-tool lab-action-row${tool.destination==='coach'?' lab-shortcut-coach':''}" data-app-destination="${tool.destination}" aria-labelledby="${id}-title" aria-describedby="${id}-detail">
   <span class="lab-action-icon" aria-hidden="true">${websiteUi.icons[tool.icon]}</span>
   <span class="app-tool-copy"><strong id="${id}-title">${html(tool.title)}</strong><span id="${id}-detail">${html(detail)}</span></span>
   <span class="app-tool-arrow" aria-hidden="true">›</span>
  </button>`
 }).join('')}</nav>`
}
export function appHubHtml(hub:AppHub){
 const groups:{title:string;keys:string[];lane?:'player'|'studio'}[]=hub==='compete'
  ?[{title:'Browse competitions',keys:['leagues','tournaments']},{title:'Run your season',keys:['office','teams']}]
  :hub==='coach'
   ?[{title:'Your game plan',keys:['lessonDates','inbox','connection','training','progress'],lane:'player'},{title:'Coach studio',keys:['tactics','coachDesk','lessons','calendar','weeks','proof','video'],lane:'studio'}]
   :[{title:'Your game',keys:['personalCalendar','following','matchup','coach']},{title:'Your competitions',keys:['leagues','tournaments','office','teams']},{title:'Your account',keys:['updates','imports','account']}]
 const title=hub==='compete'?'Compete':hub==='coach'?'Coach & training':'More'
 const note=hub==='compete'?'Find your competition. Arrive with a plan.':'Lessons, practice and conversations.'
 const total=groups.reduce((count,group)=>count+group.keys.length,0)
 const coachControls=hub==='coach'?`<div class="coach-hub-messages">${toolHtml(tools.coachMessages)}</div>
  <div class="coach-hub-lanes" role="group" aria-label="Coach and training tools">
   <button type="button" class="secondary" aria-controls="coach-player-tools" aria-pressed="true">For players</button>
   <button type="button" class="secondary" aria-controls="coach-studio-tools" aria-pressed="false">For coaches</button>
  </div>`:''
 const groupHtml=groups.map(group=>{
  const lane=group.lane?` id="coach-${group.lane}-tools" data-coach-lane${group.lane==='studio'?' hidden':''}`:''
  return `<section class="app-hub-group"${lane}>${group.lane==='player'?'<div class="coach-next-assignment" data-coach-next-assignment hidden></div>':''}<h2>${group.title}</h2><div class="app-hub-tools">${group.keys.map(key=>toolHtml(tools[key],key==='tactics')).join('')}</div></section>`
 }).join('')
 const toolFinder=hub==='more'?`<div class="app-tool-finder" role="search" aria-label="Tools">
  <label for="app-tool-query" class="sr-only">Find a tool</label>
  <div class="app-tool-search">
   <span aria-hidden="true">${nativeActionIcon('search')}</span>
   <input id="app-tool-query" type="search" maxlength="80" autocomplete="off" placeholder="Find a tool" aria-controls="app-tool-results">
   <button type="button" class="secondary" data-clear-tool-search hidden>Clear</button>
  </div>
  <p role="status" class="sr-only" data-tool-count>${total} tools</p>
 </div>`:''
 return `<div class="app-tools-hub" data-hub="${hub}">
  <header class="app-hub-heading${hub==='more'?' app-hub-heading-compact':hub==='compete'?' tab-hero tab-hero-court':' tab-hero'}">
   ${hub==='compete'?'<small class="stat-eyebrow">TenAceIQ</small>':''}
   <h1 tabindex="-1">${title}</h1>${hub==='more'?'':'<p>'+note+'</p>'}
  </header>
  ${hub==='compete'?'<div class="compete-next-match" data-compete-next-match hidden></div>':''}
  ${coachControls}${toolFinder}<div id="app-tool-results">${groupHtml}</div>
  ${hub==='more'?'<p class="app-tools-empty" data-tools-empty hidden>No tools found. Try coach, leagues or account.</p>':''}
  <p role="alert" class="app-hub-notice"></p>
 </div>`
}
function bindToolFinder(host:HTMLElement){
 const input=host.querySelector<HTMLInputElement>('#app-tool-query')
 if(!input)return
 const buttons=Array.from(host.querySelectorAll<HTMLButtonElement>('.app-tool[data-tool-search]'))
 const clear=host.querySelector<HTMLButtonElement>('[data-clear-tool-search]')!,count=host.querySelector<HTMLElement>('[data-tool-count]')!,empty=host.querySelector<HTMLElement>('[data-tools-empty]')!
 const normalize=(value:string)=>value.normalize('NFKD').replace(/\p{M}/gu,'').toLowerCase().trim().replace(/\s+/g,' ')
 const render=()=>{
  const words=normalize(input.value).split(' ').filter(Boolean)
  let found=0
  for(const button of buttons){button.hidden=!words.every(word=>normalize(button.dataset.toolSearch||'').includes(word));if(!button.hidden)found++}
  for(const group of host.querySelectorAll<HTMLElement>('.app-hub-group'))group.hidden=!group.querySelector('.app-tool:not([hidden])')
  clear.hidden=!input.value;empty.hidden=found!==0
  count.classList.toggle('sr-only',words.length===0)
  count.textContent=found+' '+(found===1?'tool':'tools')+(words.length?' found':'')
 }
 const reset=()=>{input.value='';render();input.focus({preventScroll:true})}
 input.oninput=render
 input.onkeydown=event=>{if(event.key==='Escape'&&input.value){event.preventDefault();event.stopPropagation();reset()}}
 clear.onclick=reset
 render()
}
export function bindAppDestinations(host:HTMLElement,open:(destination:AppDestination,trigger:HTMLButtonElement)=>void){
 const valid=new Set<AppDestination>([...mainTabs.map(t=>t.screen),...Object.values(tools).map(t=>t.destination)])
 host.querySelectorAll<HTMLButtonElement>('[data-app-destination]').forEach(button=>{button.onclick=()=>{const destination=button.dataset.appDestination as AppDestination;if(valid.has(destination))open(destination,button)}})
 const lanes=Array.from(host.querySelectorAll<HTMLButtonElement>('.coach-hub-lanes button'))
 const panels=host.querySelectorAll<HTMLElement>('[data-coach-lane]')
 for(const lane of lanes)lane.onclick=()=>{
  lanes.forEach(button=>button.setAttribute('aria-pressed',String(button===lane)))
  panels.forEach(panel=>panel.hidden=panel.id!==lane.getAttribute('aria-controls'))
  lane.focus({preventScroll:true})
 }
 bindToolFinder(host)
}

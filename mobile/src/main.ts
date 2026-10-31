import {openCoachLessons} from './coach-lesson-view'
import {openCoachResources} from './coach-resources-view'
import {openCoachMessages} from './coach-messages-view'
import {openCoachVideo} from './coach-video-view'
import {openCompetitions} from './competitions-view'
import {openTournaments} from './tournaments-view'
import {openCoachWorkspace} from './coach-workspace-view'
import {openCoachConnection} from './coach-connection-view'
import {openNativeTactics} from './coach-tactics-view'
import {navigationHtml,currentTab,appHubHtml,homeShortcutsHtml,bindAppDestinations,type AppScreen,type AppHub,type AppDestination} from './app-navigation'
import {applePurchases} from './apple-purchases'
import {showEmailAuth} from './email-auth'
import {openAccountSettings} from './account-settings'
import {createNativeSignOut} from './native-sign-out'
import {mountBiometricSignIn} from './biometric-sign-in'
import {showGuestExplore} from './guest-explore'
import {PRODUCT_MOTTO,MEMBERSHIP_TIERS} from '../../lib/product-story'
import type {TeamChatDestination} from './team-room-data'
import {nativeActionIcon} from './native-action-icons'
import {labRecentFormHtml,bindLabFormScorecards} from './lab-recent-form'
import {labLevelPathHtml} from './lab-level-path'
import {loadOlderResults} from './recent-results-history'
import {mountLabRatingTrends} from './lab-rating-trends'
import {openDataImports} from './data-imports-view'
import {openLeagueOffice} from './league-office-view'
import {mountCourtCalendar} from './lab-calendar'
import type {LabGoal} from '../../lib/my-lab-goal-sync'
import {openLabGoals,goalReadinessHtml} from './lab-goals-view'
import {loadTrainingHistory} from './level-up-data'
import {labTrainingOverview} from './lab-training-overview'
import {showExplore as showPlayerDetail} from './explore'
import {openLevelUp} from './level-up-view'
import {createTeamNavigationGuard} from './navigation-warning'
import {labIdentityHtml,labActionsHtml} from './lab-home'
import {createNativePush} from './native-push'
import { showTeamRoom } from './team-room-view'
import { showComparison } from './comparison-view'
import { showFollowing } from './follows-view'
import { showPlayerRatings } from './player-ratings-view'
import { createClient, type Session } from '@supabase/supabase-js'
import { Capacitor } from '@capacitor/core'
import { App } from '@capacitor/app'
import { supabaseUrl, supabaseKey } from '../../lib/supabase-public-config'
import { getNativeAuthStorage } from '../../lib/native-auth-storage'
import { loadRecentResults, type RecentMatchRow } from './recent-results'
import { showRecentResults } from './results-view'
import { connectPlayer, findPlayers, showPlayerConnection } from './player-connection'
import { createMatchDetails, html as escape } from './match-details'
import { showExplore } from './explore-directory'
import { accountLinksHtml, bindAccountLinks, showPasswordRecovery } from './account-actions'

const client = createClient(supabaseUrl, supabaseKey, { auth: {
  storage: getNativeAuthStorage(), persistSession: true, autoRefreshToken: true,
  detectSessionInUrl: false,
} })
const app = document.querySelector<HTMLElement>('#app')!
const navigation = document.createElement('nav')
navigation.className = 'app-navigation'
navigation.setAttribute('aria-label','Main navigation')
navigation.hidden = true
navigation.innerHTML = navigationHtml()
app.after(navigation)
const accountEntry=document.createElement('button')
accountEntry.type='button';accountEntry.className='secondary native-account-entry';accountEntry.hidden=true;accountEntry.textContent='Account';accountEntry.setAttribute('aria-label','Account settings')
document.querySelector('.app-header')!.append(accountEntry)
accountEntry.onclick=()=>{if(!session||accountSettings?.isOpen()||competitions?.isOpen()||tournaments?.isOpen()||connection?.isSaving())return;const owner=session.user.id,visit=revision;accountSettings=openAccountSettings(client,owner,()=>visit===revision&&owner===session?.user.id,()=>signOut(owner))}
let labRatingTrends:ReturnType<typeof mountLabRatingTrends>|null=null
let dataImports:ReturnType<typeof openDataImports>|null=null
let competitions:ReturnType<typeof openCompetitions>|null=null
let tournaments:ReturnType<typeof openTournaments>|null=null
let coachWorkspace:ReturnType<typeof openCoachWorkspace>|ReturnType<typeof openCoachConnection>|ReturnType<typeof openNativeTactics>|ReturnType<typeof openCoachLessons>|ReturnType<typeof openCoachResources>|ReturnType<typeof openCoachMessages>|ReturnType<typeof openCoachVideo>|null=null
let hub:AppHub|null=null
let leagueOffice:ReturnType<typeof openLeagueOffice>|null=null
let goals:ReturnType<typeof openLabGoals>|null=null
let training:ReturnType<typeof openLevelUp>|null=null
let teamRoom:ReturnType<typeof showTeamRoom>|null=null
let comparison:ReturnType<typeof showComparison>|null=null
let following:ReturnType<typeof showFollowing>|null=null
let explore: ReturnType<typeof showExplore> | null = null
let emailAuth:ReturnType<typeof showEmailAuth>|null=null
let accountSettings:ReturnType<typeof openAccountSettings>|null=null
let guest:ReturnType<typeof showGuestExplore>|null=null
let storageUnavailable=false
let session: Session | null = null
let revision = 0
let profileOpen=false
let connection: ReturnType<typeof showPlayerConnection> | null = null
let details: ReturnType<typeof createMatchDetails> | null = null
let recovery: ReturnType<typeof showPasswordRecovery> | null = null
let biometricLogin:ReturnType<typeof mountBiometricSignIn>|null=null

if (Capacitor.getPlatform() === 'android') {
  void App.addListener('backButton', () => {
    if(accountSettings?.isOpen()){accountSettings.back()}
    else if(emailAuth){login()}
    else if(guest){guest.back()}
    else if(dataImports?.isOpen()){dataImports.back()}
    else if(competitions?.isOpen()){competitions.back()}
    else if(tournaments?.isOpen()){tournaments.back()}
    else if(coachWorkspace?.isOpen()){coachWorkspace.back()}
    else if(leagueOffice?.isOpen()){leagueOffice.back()}
    else if(goals?.isOpen()){goals.back()}
    else if(training?.isOpen()){training.back()}
    else if(labRatingTrends?.isScorecardOpen()){labRatingTrends.back()}
    else if(teamRoom){if(!teamRoom.back())guardNavigation(()=>{void lab()})}
    else if(comparison){if(!comparison.back())void lab()}
    else if(following){if(!following.back())void lab()}
    else if (explore) { if (!explore.back()) void lab() }
    else if (connection) { if (!connection.isSaving()) void lab() }
    else if (recovery) login()
    else if (details?.isOpen()) history.back()
    else if(hub){if(hub==='coach')showHub('more');else void lab()}
    else void App.minimizeApp()
  })
}

function login(message = '') {
  biometricLogin?.dispose();biometricLogin=null
  const visit=++revision
  emailAuth?.dispose();emailAuth=null
  accountSettings?.dispose();accountSettings=null
  guest?.dispose();guest=null
  document.body.dataset.screen='welcome'
  labRatingTrends?.dispose();labRatingTrends=null
  dataImports?.dispose();dataImports=null
  competitions?.dispose();competitions=null
  tournaments?.dispose();tournaments=null;coachWorkspace?.dispose();coachWorkspace=null;hub=null
  leagueOffice?.dispose();leagueOffice=null
  goals?.dispose();goals=null
  training?.dispose();training=null
  document.querySelector<HTMLDialogElement>('[data-team-navigation-warning]')?.close()
  teamRoom?.dispose();teamRoom=null
  comparison?.dispose();comparison=null
  following?.dispose();following=null
  explore?.dispose()
  explore = null
  navigation.hidden = true
  accountEntry.hidden=true
  connection?.dispose()
  connection = null
  recovery?.dispose()
  recovery = null
  details?.dispose()
  details = null
  app.dataset.state = 'signed-out'
  app.innerHTML = `<div class="native-welcome"><small>Tennis intelligence</small><h1 tabindex="-1">${escape(PRODUCT_MOTTO)}</h1><p>Your game. Your team. Your next ace.</p><button type="button" id="browse-public">Explore without signing in <span aria-hidden="true">↗</span></button><p class="welcome-browse-note">Players, teams, leagues and TIQ rankings.</p><div class="welcome-account"><h2>Your tennis, connected.</h2>${storageUnavailable?'<p role="alert">Secure sign-in storage is unavailable. Close the app and try again to sign in. You can still explore public tennis.</p>':`<p>Sign in for My Lab and your team chats.</p><button type="button" class="secondary" id="email-sign-in">Create account or use an email code</button><p class="welcome-email-note">New accounts start ${escape(MEMBERSHIP_TIERS.free.name)}. Existing access stays the same.</p><form><label>Email<input type="email" name="email" autocomplete="username" required></label><label>Password<input type="password" name="password" autocomplete="current-password" required></label><p role="alert">${escape(message)}</p><button>Sign in</button></form><button type="button" class="secondary" id="forgot-password">Forgot password?</button>`}</div>${accountLinksHtml}</div>`
  const biometricHost=document.createElement('div');biometricHost.className='biometric-login';app.querySelector('.welcome-account')!.querySelector('form')?.before(biometricHost)
  if(!storageUnavailable)biometricLogin=mountBiometricSignIn(biometricHost,client,()=>visit===revision&&!session)
  app.querySelector<HTMLButtonElement>('#browse-public')!.onclick=openGuest
  bindAccountLinks(app)
  app.querySelector<HTMLElement>('h1')!.focus({preventScroll:true})
  const emailEntry=app.querySelector<HTMLButtonElement>('#email-sign-in')
  if(emailEntry)emailEntry.onclick=()=>{if(session)return;biometricLogin?.dispose();const visit=++revision;emailAuth?.dispose();emailAuth=showEmailAuth(app,client,()=>visit===revision&&!session,()=>login())}
  const forgot=app.querySelector<HTMLButtonElement>('#forgot-password')
  if(forgot)forgot.onclick = () => {
    biometricLogin?.dispose()
    recovery = showPasswordRecovery(app, client, () => login())
  }
  const signInForm=app.querySelector<HTMLFormElement>('form')
  if(signInForm)signInForm.onsubmit = async event => {
    event.preventDefault()
    const form = event.currentTarget as HTMLFormElement
    if(visit!==revision||session||!form.isConnected)return
    biometricLogin?.dispose()
    const fields = new FormData(form)
    const button = form.querySelector('button')!
    button.disabled = true
    button.textContent = 'Signing in…'
    try {
      const { error } = await client.auth.signInWithPassword({email: String(fields.get('email')).trim(), password: String(fields.get('password'))})
      if (error&&visit===revision&&!session&&form.isConnected) login('Could not sign in. Check your email, password, and connection.')
    } catch { if(visit===revision&&!session&&form.isConnected)login('Could not sign in. Check your connection and try again.') }
  }
}

function openGuest() {
  biometricLogin?.dispose();biometricLogin=null
  if(session)return
  recovery?.dispose();recovery=null
  emailAuth?.dispose();emailAuth=null
  guest?.dispose();guest=null
  const visit=++revision
  navigation.hidden=true
  document.body.dataset.screen='explore'
  app.dataset.state='public-explore'
  window.scrollTo(0,0)
  guest=showGuestExplore(app,()=>!session&&visit===revision,()=>login())
}

function selectNavigation(screen:AppScreen) {
  labRatingTrends?.dispose();labRatingTrends=null
  dataImports?.dispose();dataImports=null
  competitions?.dispose();competitions=null
  tournaments?.dispose();tournaments=null;coachWorkspace?.dispose();coachWorkspace=null
  leagueOffice?.dispose();leagueOffice=null
  hub=screen==='compete'||screen==='more'||screen==='coach'?screen:null
  navigation.hidden = false
  accountEntry.hidden=false
  document.body.dataset.screen=screen
  window.scrollTo(0,0)
  navigation.querySelectorAll<HTMLButtonElement>('button').forEach(button => {
    if (button.dataset.screen === currentTab(screen)) button.setAttribute('aria-current','page')
    else button.removeAttribute('aria-current')
  })
}
function launchCompetitions(scope:'mine'|'discover'='mine',trigger?:HTMLElement){
 if(!session||competitions?.isOpen()||accountSettings?.isOpen())return
 const owner=session.user.id,visit=revision
 competitions=openCompetitions(client,owner,()=>visit===revision&&owner===session?.user.id,scope,()=>navigation.querySelector<HTMLButtonElement>('[data-screen="teams"]')?.click(),undefined,trigger)
}
const guardNavigation=createTeamNavigationGuard(()=>Boolean(teamRoom?.hasDraft()),()=>revision)
navigation.querySelector<HTMLButtonElement>('[data-screen="lab"]')!.onclick = () => {if (!connection?.isSaving()) guardNavigation(()=>{void lab()})}
navigation.querySelector<HTMLButtonElement>('[data-screen="explore"]')!.onclick = () => {
  if (!session || connection?.isSaving() || explore&&!profileOpen) return
  guardNavigation(()=>{
    if(!session)return
    explore?.dispose();explore=null;profileOpen=false
    teamRoom?.dispose();teamRoom=null
    comparison?.dispose();comparison=null
    following?.dispose();following=null
    connection?.dispose(); connection = null
    recovery?.dispose(); recovery = null
    details?.dispose(); details = null
    const userId = session.user.id
    const version = ++revision
    selectNavigation('explore')
    explore = showExplore(app,client,()=>version === revision && userId === session?.user.id,'Overview',undefined,trigger=>launchCompetitions('discover',trigger))
  })
}

function openFollowing(){
  if(!session || connection?.isSaving() || following)return
  guardNavigation(()=>{
    if(!session)return
    teamRoom?.dispose();teamRoom=null
    comparison?.dispose();comparison=null
    explore?.dispose();explore=null;connection?.dispose();connection=null;details?.dispose();details=null
    const userId=session.user.id,version=++revision
    selectNavigation('following')
    following=showFollowing(app,client,()=>version===revision && userId===session?.user.id)
  })
}

function openMatchup(){
  if(!session || connection?.isSaving() || comparison)return
  guardNavigation(()=>{
    if(!session)return
    teamRoom?.dispose();teamRoom=null
    following?.dispose();following=null;explore?.dispose();explore=null;connection?.dispose();connection=null;details?.dispose();details=null
    const userId=session.user.id,version=++revision
    selectNavigation('matchup')
    comparison=showComparison(app,client,()=>version===revision && userId===session?.user.id)
  })
}

function openTeamRoom(initialScope?:TeamChatDestination){
  if(coachWorkspace?.isOpen()){coachWorkspace.requestLeave(()=>{coachWorkspace=null;openTeamRoom(initialScope)});return}
  if(comparison?.isNotebookOpen()){comparison.back();return}
  if(goals?.isOpen()){goals.back();return}
  if(!session || connection?.isSaving())return
  if(teamRoom && !initialScope){teamRoom.openInbox();return}
  if(teamRoom?.hasDraft() && !window.confirm('Open this team alert? Your unfinished message will be discarded.'))return
  teamRoom?.dispose();teamRoom=null
  comparison?.dispose();comparison=null;following?.dispose();following=null;explore?.dispose();explore=null;connection?.dispose();connection=null;details?.dispose();details=null
  const userId=session.user.id,version=++revision
  selectNavigation('teams')
  teamRoom=showTeamRoom(app,client,userId,()=>version===revision && userId===session?.user.id,initialScope)
}

navigation.querySelector<HTMLButtonElement>('[data-screen="teams"]')!.onclick=()=>openTeamRoom()
navigation.querySelector<HTMLButtonElement>('[data-screen="compete"]')!.onclick=()=>{if(!connection?.isSaving())guardNavigation(()=>showHub('compete'))}
navigation.querySelector<HTMLButtonElement>('[data-screen="more"]')!.onclick=()=>{if(!connection?.isSaving())guardNavigation(()=>showHub('more'))}
function openDestination(destination:AppDestination,trigger:HTMLButtonElement){
 if(!session||!trigger.isConnected||connection?.isSaving())return
 if(destination==='leagues'){launchCompetitions('mine',trigger);return}
 if(destination==='tournaments'){
  if(tournaments?.isOpen()||competitions?.isOpen()||accountSettings?.isOpen())return
  const owner=session.user.id,visit=revision
  tournaments=openTournaments(client,owner,()=>visit===revision&&owner===session?.user.id,()=>{tournaments=null},undefined,trigger,'Close');return
 }
 if(destination==='following'){openFollowing();return}
 if(destination==='matchup'){openMatchup();return}
 if(destination==='coach'){guardNavigation(()=>showHub('coach'));return}
 const owner=session.user.id,visit=revision,current=()=>visit===revision&&owner===session?.user.id
 if(destination==='coach-workspace'){if(!coachWorkspace?.isOpen())coachWorkspace=openCoachWorkspace(client,owner,current,undefined,trigger);return}
 if(destination==='coach-connection'){if(!coachWorkspace?.isOpen())coachWorkspace=openCoachConnection(client,owner,current,trigger);return}
 if(destination==='coach-lessons'){if(!coachWorkspace?.isOpen())coachWorkspace=openCoachLessons(client,owner,current,trigger);return}
 if(destination==='coach-calendar'||destination==='coach-weeks'||destination==='coach-proof'){if(!coachWorkspace?.isOpen())coachWorkspace=openCoachResources(client,owner,current,destination==='coach-calendar'?'calendar':destination==='coach-weeks'?'weeks':'proof',trigger);return}
 if(destination==='coach-video'){if(!coachWorkspace?.isOpen())coachWorkspace=openCoachVideo(client,owner,current,trigger);return}
 if(destination==='coach-messages'){if(!coachWorkspace?.isOpen())coachWorkspace=openCoachMessages(client,owner,current,trigger);return}
 if(destination==='coach-tactics'){if(!coachWorkspace?.isOpen())coachWorkspace=openNativeTactics(client,owner,current,trigger,undefined,openCoachHref);return}
 if(destination==='league-office'){if(!leagueOffice?.isOpen())leagueOffice=openLeagueOffice(client,owner,current);return}
 if(destination==='imports'){if(!dataImports?.isOpen())dataImports=openDataImports(client,owner,current);return}
 if(destination==='account'){accountEntry.click();return}
 if(destination==='training'||destination==='training-inbox'||destination==='training-progress'){
  if(!training?.isOpen())training=openLevelUp(client,owner,current,destination==='training-inbox'?'inbox':destination==='training-progress'?'progress':'catalog');return
 }

 navigation.querySelector<HTMLButtonElement>('[data-screen="'+destination+'"]')?.click()
}
function openCoachHref(href:string){
 let url:URL;try{url=new URL(href,'https://www.tenaceiq.com')}catch{return false}
 if(url.origin!=='https://www.tenaceiq.com')return false
 const destination:AppDestination|null=url.pathname==='/coach'?'coach':url.pathname==='/video-review'?'coach-video':url.pathname.startsWith('/tactics')?'coach-tactics':/^\/player-development\/[^/]+\/coach-planner$/.test(url.pathname)?'coach-lessons':url.pathname==='/messages'?'coach-messages':url.pathname.startsWith('/level-up/')?'training':null
 if(!destination||!session)return false
 const open=()=>{coachWorkspace?.dispose();coachWorkspace=null;showHub('coach');if(destination==='coach')return;const button=app.querySelector<HTMLButtonElement>('[data-app-destination="'+destination+'"]');if(button)openDestination(destination,button)}
 if(coachWorkspace?.isOpen())coachWorkspace.requestLeave(open);else open()
 return true
}
document.addEventListener('tenaceiq:navigate',event=>{const e=event as CustomEvent<{href?:unknown}>;if(typeof e.detail?.href==='string'&&openCoachHref(e.detail.href))event.preventDefault()})
function showHub(next:AppHub){
 if(!session)return
 accountSettings?.dispose();accountSettings=null
 emailAuth?.dispose();emailAuth=null;goals?.dispose();goals=null;training?.dispose();training=null
 teamRoom?.dispose();teamRoom=null;comparison?.dispose();comparison=null;following?.dispose();following=null
 explore?.dispose();explore=null;profileOpen=false;connection?.dispose();connection=null
 recovery?.dispose();recovery=null;details?.dispose();details=null
 ++revision;selectNavigation(next);app.dataset.state='ready';app.innerHTML=appHubHtml(next)
 bindAppDestinations(app,openDestination);app.querySelector<HTMLElement>('h1')?.focus({preventScroll:true})
}
const nativePush=createNativePush(client,scope=>openTeamRoom(scope))
const nativePurchases=applePurchases(client)
const signOut=createNativeSignOut(client,owner=>nativePush.beforeSignOut(owner),()=>session?.user.id||null)
function setNativeSession(next:typeof session){if(next){biometricLogin?.dispose();biometricLogin=null}nativePush.setSession(next);nativePurchases.setOwner(next?.user.id||null)}

async function lab() {
  emailAuth?.dispose();emailAuth=null
  accountSettings?.dispose();accountSettings=null
  goals?.dispose();goals=null
  training?.dispose();training=null
  document.querySelector<HTMLDialogElement>('[data-team-navigation-warning]')?.close()
  teamRoom?.dispose();teamRoom=null
  comparison?.dispose();comparison=null
  following?.dispose();following=null
  explore?.dispose()
  explore = null
  connection?.dispose()
  connection = null
  const current = session
  if (!current) return login()
  selectNavigation('lab')
  recovery?.dispose()
  recovery = null
  details?.dispose()
  const version = ++revision
  details = createMatchDetails(app, client, () => version === revision && current.user.id === session?.user.id)
  app.dataset.state = 'loading'
  app.innerHTML = `<h1>My Lab</h1><p role="status">Loading your player profile…</p>`
  const { data, error } = await client.from('profiles')
    .select('linked_player_id,linked_player_name,linked_team_name,linked_league_name')
    .eq('id', current.user.id).abortSignal(AbortSignal.timeout(12000)).maybeSingle()
  if (version !== revision || current.user.id !== session?.user.id) return
  app.dataset.state = error ? 'unavailable' : 'ready'
  app.innerHTML = `${error
    ? '<h1 tabindex="-1">My Lab</h1><section><h2>Can’t load your profile</h2><p role="alert">Check your connection, then try again. Your profile has not been changed.</p></section>'
    : `${data?.linked_player_id&&data.linked_player_name?'<header class="lab-scoreboard-intro"><div><small class="stat-eyebrow">My Lab</small><h1 tabindex="-1">'+escape(data.linked_player_name)+'</h1><p>'+escape(data.linked_team_name||'Your tennis, in focus')+'</p></div><button type="button" class="secondary lab-profile-action" data-lab-profile aria-label="Open full player profile">'+nativeActionIcon('profile')+'</button></header>':''}<div id="lab-identity">${labIdentityHtml(data)}</div>${data?.linked_player_id&&data.linked_player_name?'<section aria-label="Account training overview"><button type="button" class="secondary" id="lab-training-refresh">Load training overview</button><p role="status" id="lab-training-status">Open your latest account proof and weekly progress.</p></section>':''}`}${!error&&data?.linked_player_id&&data.linked_player_name?'<section id="lab-goal-context"><h2>Training notes</h2><div id="goal-context-copy"><p>Bring your saved goals and notes into this week’s tennis.</p></div><button type="button" data-lab-goals>Open goals and notes</button></section>':''}${!error ? labActionsHtml()+'<section><h2>Uploads & imports</h2><p>Check saved scorecards, schedules and roster imports.</p><button type="button" class="secondary" data-open-imports>Open uploads & imports</button></section><section><h2>League Office</h2><p>Review your owned league seasons, schedules and results.</p><button type="button" class="secondary" data-league-office>Open League Office</button></section>' : ''}${!error ? '<section id="recent-results" aria-labelledby="results-title"><h2 id="results-title">Recent matches</h2><div id="results-content" aria-live="polite"></div></section>' : ''}<button id="refresh">${error ? 'Try again' : 'Refresh profile'}</button><button class="secondary" id="logout">Log out</button><p role="alert" id="notice"></p>`

  const labHeading=app.querySelector<HTMLElement>('h1');if(labHeading){labHeading.tabIndex=-1;labHeading.focus({preventScroll:true})}
  let selectedLabGoal:LabGoal|undefined
  const bindLabActions=()=>{
  bindAppDestinations(app,openDestination)
  app.querySelectorAll<HTMLButtonElement>('[data-lab-goals]').forEach(button=>{button.onclick=()=>{
    if(goals?.isOpen()||training?.isOpen()||!data?.linked_player_id)return
    const active=()=>version===revision&&current.user.id===session?.user.id,heroTrigger=Boolean(button.closest('#lab-identity'))
    goals=openLabGoals(client,{owner:current.user.id,player:data.linked_player_id},active,goal=>{
      const host=app.querySelector<HTMLElement>('#goal-context-copy');if(!active()||!host)return;selectedLabGoal=goal
      host.innerHTML='<h3>'+escape(goal.goal)+'</h3><p>'+escape(goal.improveNext||goal.progressUpdate||'Review your notes before the next match or practice.')+'</p>'+goalReadinessHtml(goal)
    },()=>{if(!active()||!selectedLabGoal)return;const host=app.querySelector<HTMLElement>('#lab-identity');if(host){host.innerHTML=labIdentityHtml(data,undefined,selectedLabGoal);bindLabActions();if(heroTrigger)host.querySelector<HTMLElement>('[data-lab-goals]')?.focus({preventScroll:true})}})
  }})
  app.querySelectorAll<HTMLButtonElement>('[data-lab-screen]').forEach(b=>{b.onclick=()=>{if(b.dataset.labScreen==='competitions'){launchCompetitions('mine',b);return}if(b.dataset.labScreen==='following'){openFollowing();return}if(b.dataset.labScreen==='matchup'){openMatchup();return}navigation.querySelector<HTMLButtonElement>(`[data-screen="${b.dataset.labScreen}"]`)?.click()}})
  app.querySelectorAll<HTMLButtonElement>('[data-training]').forEach(b=>{b.onclick=()=>{if(training?.isOpen())return;training=openLevelUp(client,current.user.id,()=>version===revision&&current.user.id===session?.user.id,b.dataset.training==='inbox'?'inbox':b.dataset.training==='progress'?'progress':'catalog',b.dataset.training==='next'?{cardId:b.dataset.trainingCard||'',identitySlug:b.dataset.trainingDirection||''}:undefined)}})
  app.querySelectorAll<HTMLButtonElement>('[data-lab-profile]').forEach(button=>{button.onclick=()=>{if(!data?.linked_player_id||!data.linked_player_name)return;details?.dispose();details=null;const profileVersion=++revision;selectNavigation('explore');profileOpen=true;explore=showPlayerDetail(app,client,()=>profileVersion===revision&&current.user.id===session?.user.id,{player:{id:data.linked_player_id,name:data.linked_player_name,location:null,flight:null},back:()=>{void lab()},backLabel:'Back to My Lab'})}})
  app.querySelectorAll<HTMLButtonElement>('[data-connect-player],#connect-player').forEach(connectButton=>{connectButton.onclick = () => {
    details?.dispose()
    details = null
    labRatingTrends?.dispose();labRatingTrends=null
    const connectionVersion = ++revision
    const isCurrent = () => connectionVersion === revision && current.user.id === session?.user.id
    connection = showPlayerConnection(app, {
      search: term => findPlayers(client, term),
      connect: playerId => connectPlayer(client, playerId, current.user.id, isCurrent),
    }, () => { void lab() }, isCurrent)
  }})
  }
  app.querySelector('[data-open-imports]')?.addEventListener('click',()=>{if(dataImports?.isOpen()||leagueOffice?.isOpen()||training?.isOpen()||goals?.isOpen())return;dataImports=openDataImports(client,current.user.id,()=>version===revision&&current.user.id===session?.user.id)})
  app.querySelector('[data-league-office]')?.addEventListener('click',()=>{if(leagueOffice?.isOpen()||training?.isOpen()||goals?.isOpen())return;leagueOffice=openLeagueOffice(client,current.user.id,()=>version===revision&&current.user.id===session?.user.id)})
  bindLabActions()
  if(!error){const calendar=document.createElement('section');app.querySelector('#lab-goal-context')?.before(calendar);if(!calendar.isConnected)app.querySelector('#refresh')!.before(calendar);mountCourtCalendar(calendar,client,current.user.id,()=>version===revision&&current.user.id===session?.user.id)}
  const alerts=document.createElement('section');app.querySelector('#logout')!.before(alerts);nativePush.mount(alerts)
  app.insertAdjacentHTML('beforeend', accountLinksHtml)
  bindAccountLinks(app)
  const overviewButton=app.querySelector<HTMLButtonElement>('#lab-training-refresh'),overviewStatus=app.querySelector<HTMLElement>('#lab-training-status'),identityHost=app.querySelector<HTMLElement>('#lab-identity')
  if(overviewButton&&overviewStatus&&identityHost)overviewButton.onclick=async()=>{
    if(overviewButton.disabled||version!==revision||current.user.id!==session?.user.id)return
    overviewButton.disabled=true;overviewStatus.textContent='Loading account training…';identityHost.innerHTML=labIdentityHtml(data);bindLabActions()
    const active=()=>version===revision&&current.user.id===session?.user.id&&identityHost.isConnected
    try{
      const rows=await loadTrainingHistory(client,current.user.id,active)
      if(!active())return
      if(training?.isOpen()||goals?.isOpen()){overviewStatus.textContent='Close training or notes, then refresh this overview to see your latest proof.';return}
      identityHost.innerHTML=labIdentityHtml(data,labTrainingOverview(rows));bindLabActions()
      overviewButton.textContent='Refresh training overview';overviewStatus.textContent='Training overview loaded. Weekly progress uses your latest 40 sessions.'
    }catch{if(active())overviewStatus.textContent='Training overview unavailable. Your saved sessions have not changed. Try again when connected.'}
    finally{if(active())overviewButton.disabled=false}
  }
  app.querySelector<HTMLButtonElement>('#refresh')!.onclick = () => { void lab() }
  app.querySelector<HTMLButtonElement>('#logout')!.onclick = async event => {
    const button=event.currentTarget as HTMLButtonElement;button.disabled=true
    try {await signOut(current.user.id)}
    catch {if(version!==revision||!button.isConnected)return;app.querySelector('#notice')!.textContent='Couldn’t log out. Check your connection and try again.';button.disabled=false}
  }
  if (!error) {
    const playerId = typeof data?.linked_player_id === 'string' ? data.linked_player_id : ''
    const content = app.querySelector<HTMLElement>('#results-content')!
    if (!playerId) {
      content.dataset.state = 'unlinked'
      content.innerHTML = '<p>Find your player record above to bring your results here.</p>'
    } else {
      const ratingsSection=document.createElement('section')
      ratingsSection.setAttribute('aria-labelledby','lab-ratings-title')
      ratingsSection.className='lab-stat-panel lab-scoreboard'
      ratingsSection.innerHTML='<small class="stat-eyebrow">Your game, in numbers</small><h2 id="lab-ratings-title">Your scoreboard</h2><div aria-live="polite"></div>'
      app.querySelector('#lab-identity')!.before(ratingsSection,app.querySelector('#recent-results')!)
      const trendSection=document.createElement('section')
      const formSection=document.createElement('div');formSection.className='lab-form-host'
      const shortcuts=document.createElement('div');shortcuts.innerHTML=homeShortcutsHtml()
      ratingsSection.after(formSection,shortcuts,trendSection)
      labRatingTrends=mountLabRatingTrends(trendSection,client,playerId,()=>version===revision&&current.user.id===session?.user.id)
      bindLabActions()
      const pathSection=document.createElement('div');pathSection.className='lab-next-band';app.querySelector('#recent-results')!.after(pathSection)
      showPlayerRatings(ratingsSection.querySelector<HTMLElement>('div')!,client,playerId,()=>version===revision && current.user.id===session?.user.id,true,{showcase:true,onReady:player=>{pathSection.innerHTML=labLevelPathHtml(player);bindLabActions()}})
      const refreshResults = async () => {
        content.dataset.state = 'loading'
        content.innerHTML = '<p role="status">Loading your latest matches…</p>'
        const result = await loadRecentResults(client, playerId)
        if (version !== revision || current.user.id !== session?.user.id || !content.isConnected) return
        if (result.error) {
          content.dataset.state = 'unavailable'
          content.innerHTML = '<p role="alert">Can’t load your matches. Check your connection and try again.</p><button class="secondary" id="retry-results">Retry matches</button>'
          content.querySelector<HTMLButtonElement>('#retry-results')!.onclick = () => { void refreshResults() }
          return
        }
        const rows = (result.data || []) as RecentMatchRow[]
        formSection.innerHTML=labRecentFormHtml(rows,playerId)
        bindLabFormScorecards(formSection,rows,()=>version===revision&&current.user.id===session?.user.id,row=>details?.open(row,playerId))
        content.dataset.state = rows.length ? 'ready' : 'empty'
        showRecentResults(content, rows, playerId, row => details?.open(row, playerId),'your',true,{current:()=>version===revision&&current.user.id===session?.user.id,load:loaded=>loadOlderResults(client,playerId,loaded)})
      }
      void refreshResults()
    }
  }
}

client.auth.onAuthStateChange((_event, next) => {
  // A late signed-out event must not reset an active public visit.
  if(!next&&!session&&(guest||emailAuth)){setTimeout(()=>setNativeSession(null),0);return}
  if(next){guest?.dispose();guest=null}
  if (next?.user.id === session?.user.id && (accountSettings?.isOpen() || details?.isOpen() || connection || explore || following || comparison || teamRoom || goals?.isOpen() || training?.isOpen() || competitions?.isOpen() || tournaments?.isOpen() || coachWorkspace?.isOpen() || hub || leagueOffice?.isOpen() || dataImports?.isOpen())) { session = next; setTimeout(()=>setNativeSession(next),0); return }
  session = next
  revision++
  // Schedule outside the auth callback's lock before making another SDK call.
  setTimeout(() => {
    if(next?.user.id!==session?.user.id)return
    void (async()=>{if(session)await lab();else login();if(next?.user.id===session?.user.id)setNativeSession(session)})()
  }, 0)
})
client.auth.getSession().catch(() => {
  storageUnavailable=true
  if(!session&&!guest)login()
})
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible') { if(session)void nativePurchases.recover(session.user.id).catch(()=>{}); client.auth.startAutoRefresh(); if (session && !accountSettings?.isOpen() && !details?.isOpen() && !labRatingTrends?.isScorecardOpen() && !connection && !explore && !following && !comparison && !teamRoom && !goals?.isOpen() && !training?.isOpen() && !competitions?.isOpen() && !tournaments?.isOpen() && !coachWorkspace?.isOpen() && !hub && !leagueOffice?.isOpen() && !dataImports?.isOpen()) void lab() }
  else {labRatingTrends?.dispose();labRatingTrends=null;client.auth.stopAutoRefresh()}
})
window.addEventListener('online', () => { if (session && !accountSettings?.isOpen() && !details?.isOpen() && !labRatingTrends?.isScorecardOpen() && !connection && !explore && !following && !comparison && !teamRoom && !goals?.isOpen() && !training?.isOpen() && !competitions?.isOpen() && !tournaments?.isOpen() && !coachWorkspace?.isOpen() && !hub && !leagueOffice?.isOpen() && !dataImports?.isOpen()) void lab() })

import {openCalendar,type CalendarStart} from './calendar-view'
import {openCoachLessons} from './coach-lesson-view'
import {openUpdates} from './updates-view'
import {createUpdatesCounter} from './updates-counter'
import {createChatUnreadCounter,paintChatsBadge,combinedChatUnread} from './chat-unread'
import {createChatReceiptRefresh} from './chat-receipt-refresh'
import {publishCoachMessageCounts} from './coach-message-catchup'
import {createAppLinkHandoff,appLinkTitle} from './app-links'
import {openSharedMatch} from './shared-match-view'
import {openTeamInvite} from './team-invite-view'
import {playerSetupHtml} from './player-setup'
import {openCoachResources} from './coach-resources-view'
import {openCoachMessages} from './coach-messages-view'
import {openCoachVideo} from './coach-video-view'
import {openCompetitions} from './competitions-view'
import {openTournaments} from './tournaments-view'
import {openTournamentEntry} from './tournament-entry-view'
import {openMyTournamentEntries} from './my-tournament-entries'
import {openCoachWorkspace} from './coach-workspace-view'
import {openCoachConnection} from './coach-connection-view'
import {openNativeTactics} from './coach-tactics-view'
import {navigationHtml,currentTab,appHubHtml,homeShortcutsHtml,bindAppDestinations,type AppScreen,type AppHub,type AppDestination} from './app-navigation'
import {mountCompeteTeams,type CompeteTeamDestination} from './compete-teams'
import {applePurchases} from './apple-purchases'
import {showEmailAuth} from './email-auth'
import {openAccountSettings} from './account-settings'
import {createNativeSignOut} from './native-sign-out'
import {mountBiometricSignIn} from './biometric-sign-in'
import {showGuestExplore} from './guest-explore'
import {welcomeHtml,signInHtml} from './welcome-view'
import type {TeamChatDestination} from './team-room-data'
import {nativeActionIcon} from './native-action-icons'
import websiteUi from '../generated/website-ui.json'
import {mountLabRecentForm} from './lab-recent-form'
import {mountSetupTrophyCase} from './setup-trophy-case'
import {mountPersonalMatchLog,type PersonalMatchFormSession} from './personal-match-view'
import type {CalendarScorecardSeed} from './personal-match-data'
import {labLevelPathHtml} from './lab-level-path'
import {loadOlderResults} from './recent-results-history'
import {mountLabRatingTrends} from './lab-rating-trends'
import {firstPartyBuild} from './build-scope'
import {openLeagueOffice} from './league-office-view'
import {createCalendarHighlights} from './lab-calendar'
import {CALENDAR_WEEKLY_REP_CHANGED,type CalendarWeeklyRepChange} from './calendar-weekly-reps'
import {personalCalendarOccurrence,type CalendarPractice} from './calendar-data'
import {openCourtInvite} from './explore-court-invite'
import {createCoachNextAssignment} from './coach-next-assignment'
import type {LabGoal} from '../../lib/my-lab-goal-sync'
import {openLabGoals,goalReadinessHtml} from './lab-goals-view'
import {accountGoalScope} from './lab-goals-data'
import {loadTrainingHistory} from './level-up-data'
import {labTrainingOverview} from './lab-training-overview'
import {showExplore as showPlayerDetail} from './explore'
import {openLevelUp} from './level-up-view'
import {createTeamNavigationGuard} from './navigation-warning'
import {labIdentityHtml,labActionsHtml,labFirstScorecardHtml,labScoreboardHtml,labTrainingActionsHtml,showLabWarmupReceipt} from './lab-home'
import {createNativePush} from './native-push'
import {createCoachAlerts} from './coach-alerts'
import {createCoachAlertHandoff} from './coach-alert-handoff'
import { showTeamRoom,type TeamResultsReturn } from './team-room-view'
import {createTeamScoreDraftSession,type TeamScoreDraftSession} from './team-score-drafts'
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
import { connectPlayer, findPlayers, showPlayerConnection, type PlayerLink } from './player-connection'
import { createMatchDetails, html as escape } from './match-details'
import {showExplore,type ExploreSearchState,type ExploreVisit} from './explore-directory'
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
const updatesEntry=document.createElement('button')
updatesEntry.type='button';updatesEntry.className='secondary native-updates-entry';updatesEntry.setAttribute('aria-label','Updates');updatesEntry.innerHTML='<span aria-hidden="true">'+websiteUi.icons.alerts+'</span><span class="updates-header-badge" aria-hidden="true" hidden></span>'
accountEntry.innerHTML='<span aria-hidden="true">'+nativeActionIcon('settings')+'</span>'
const headerActions=document.createElement('div');headerActions.className='native-header-actions';headerActions.hidden=true;headerActions.append(updatesEntry,accountEntry)
document.querySelector('.app-header')!.append(headerActions)
updatesEntry.onclick=()=>launchUpdates(updatesEntry)
accountEntry.onclick=()=>launchAccount(accountEntry)
function launchAccount(trigger:HTMLButtonElement){
 if(!session||!trigger.isConnected||accountSettings?.isOpen()||competitions?.isOpen()||tournaments?.isOpen()||connection?.isSaving())return
 const owner=session.user.id,visit=revision
 const scoreDrafts=teamScoreDrafts
 accountSettings=openAccountSettings(client,owner,()=>visit===revision&&owner===session?.user.id,()=>signOut(owner),trigger,
  firstPartyBuild?()=>{accountSettings?.dispose();accountSettings=null;guardNavigation(()=>{void lab('trophies')})}:undefined,
  scoreDrafts?.owner===owner?()=>scoreDrafts.clear():undefined)
}
let labRatingTrends:ReturnType<typeof mountLabRatingTrends>|null=null
let dataImports:ReturnType<typeof import('./data-imports-view').openDataImports>|null=null
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
let explore: ReturnType<typeof showExplore> | ReturnType<typeof showPlayerDetail> | null = null
let emailAuth:ReturnType<typeof showEmailAuth>|null=null
let accountSettings:ReturnType<typeof openAccountSettings>|null=null
let guest:ReturnType<typeof showGuestExplore>|null=null
let storageUnavailable=false
let session: Session | null = null
let personalMatchForm:PersonalMatchFormSession={}
let teamScoreDrafts:TeamScoreDraftSession|undefined
let linkedLabOwner:string|undefined
let exploreSearch:ExploreSearchState|undefined
let guestExploreResume:{visit:ExploreVisit;owner?:string}|undefined
const calendarHighlights=createCalendarHighlights(client,()=>session?.user.id)
window.addEventListener(CALENDAR_WEEKLY_REP_CHANGED,event=>{
 const change=(event as CustomEvent<CalendarWeeklyRepChange>).detail
 if(change&&change.owner===session?.user.id)calendarHighlights.refreshPractice(change.calendarChanged)
})
const coachNextAssignment=createCoachNextAssignment(client,()=>session?.user.id)
let revision = 0
let labTeamReturnVersion:number|undefined
const inTeamScorecard=()=>labTeamReturnVersion===revision
let profileOpen=false
let connection: ReturnType<typeof showPlayerConnection> | null = null
let details: ReturnType<typeof createMatchDetails> | null = null
let recovery: ReturnType<typeof showPasswordRecovery> | null = null
let biometricLogin:ReturnType<typeof mountBiometricSignIn>|null=null
let sharedMatch:ReturnType<typeof openSharedMatch>|null=null
let teamInvite:ReturnType<typeof openTeamInvite>|null=null
let updates:ReturnType<typeof openUpdates>|null=null
let agenda:ReturnType<typeof openCalendar>|null=null
let courtInvite:ReturnType<typeof openCourtInvite>|null=null
let authReady=false
const incoming=document.createElement('aside');incoming.className='app-link-handoff';incoming.hidden=true;incoming.setAttribute('aria-label','Shared link');app.before(incoming)
const appLinks=createAppLinkHandoff((link,cold)=>{
 incoming.hidden=!link
 if(!link){incoming.replaceChildren();return}
 incoming.innerHTML='<p role="status"><strong>'+appLinkTitle(link)+'</strong><span>'+(session?'Ready to open in TenAceIQ.':'Sign in to continue to your shared link.')+'</span></p><button type="button" data-link-open>'+(session?'Open link':'Sign in')+'</button><button type="button" class="secondary" data-link-dismiss aria-label="Dismiss shared link">×</button>'
 incoming.querySelector('[data-link-dismiss]')!.addEventListener('click',()=>appLinks.clear())
 incoming.querySelector('[data-link-open]')!.addEventListener('click',()=>{
  if(session){resumeAppLink();return}
  const heading=app.querySelector<HTMLElement>('.welcome-account h1')
  if(heading)heading.focus()
  else login('account')
 })
 if(cold&&authReady&&session&&document.body.dataset.screen==='lab'&&app.dataset.state==='ready'&&!document.querySelector('dialog[open]')&&!connection&&!details?.isOpen())resumeAppLink()
})
function launchTeamInvite(initialLink='',trigger?:HTMLButtonElement){
 if(!session||teamInvite?.isOpen())return
 const owner=session.user.id,visit=revision
 const active=()=>visit===revision&&owner===session?.user.id
 trigger?.focus({preventScroll:true})
 teamInvite=openTeamInvite(client,owner,active,scope=>{teamInvite=null;openTeamRoom(scope)},()=>{
  teamInvite=null
  if(active()&&trigger?.isConnected)trigger.focus({preventScroll:true})
 },initialLink)
}
document.addEventListener('tenaceiq:open-shared-link',event=>{
 const e=event as CustomEvent<{href?:unknown}>
 if(typeof e.detail?.href!=='string'||!session)return
 if(appLinks.receive(e.detail.href)){event.preventDefault();resumeAppLink()}
})
function resumeAppLink(){
 if(!session||!appLinks.peek())return
 if(connection?.isSaving()||document.querySelector('dialog[open]')){
  incoming.querySelector('p span')!.textContent='Close your current form to open this link.';return
 }
 const owner=session.user.id
 guardNavigation(()=>{
  if(session?.user.id!==owner)return
  const link=appLinks.take(owner);if(!link)return
  if(link.kind==='chat'){openTeamRoom(link.scope);return}
  showHub(link.kind==='league'||link.kind==='tournament'?'compete':'more')
  const visit=revision,current=()=>visit===revision&&owner===session?.user.id
  if(link.kind==='coach-invite')coachWorkspace=openCoachConnection(client,owner,current,undefined,undefined,link.href)
  else if(link.kind==='team-invite')launchTeamInvite(link.href)
  else if(link.kind==='league')competitions=openCompetitions(client,owner,current,'discover',()=>openTeamRoom(),undefined,undefined,link.id)
  else if(link.kind==='tournament')tournaments=openTournaments(client,owner,current,()=>{tournaments=null},undefined,undefined,'Close',link.id)
  else sharedMatch=openSharedMatch(client,owner,current,link.id)
 })
}

if (Capacitor.getPlatform() === 'android') {
  void App.addListener('backButton', () => {
    if(updates?.isOpen()){updates.back();return}
    if(agenda?.isOpen()){agenda.back();return}
    if(courtInvite?.isOpen()){courtInvite.dispose();courtInvite=null;return}
    if(sharedMatch?.isOpen()){sharedMatch.dispose();sharedMatch=null;return}
  if(teamInvite?.isOpen()){teamInvite.dispose();teamInvite=null;return}
  if(accountSettings?.isOpen()){accountSettings.back()}
    else if(emailAuth){login('account')}
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
    else if (recovery) login('account')
    else if (app.dataset.state==='sign-in') app.querySelector<HTMLButtonElement>('#welcome-back')?.click()
    else if (details?.isOpen()) history.back()
    else if(hub==='coach'){
      const back=app.querySelector<HTMLButtonElement>('[data-coach-back]')
      if(back)back.click();else showHub('more')
    }
    else if(hub)void lab()
    else void App.minimizeApp()
  })
}

function login(entry:'welcome'|'account'='welcome',message='',email='') {
  if(entry==='welcome')guestExploreResume=undefined
  agenda?.dispose();agenda=null
  courtInvite?.dispose();courtInvite=null
  updates?.dispose();updates=null
  sharedMatch?.dispose();sharedMatch=null;teamInvite?.dispose();teamInvite=null
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
  headerActions.hidden=true
  connection?.dispose()
  connection = null
  recovery?.dispose()
  recovery = null
  details?.dispose()
  details = null
  app.dataset.state=entry==='account'?'sign-in':'signed-out'
  app.innerHTML=entry==='account'?signInHtml(storageUnavailable,message,email):welcomeHtml(storageUnavailable)
  const biometricHost=app.querySelector<HTMLElement>('.biometric-login')
  if(biometricHost)biometricLogin=mountBiometricSignIn(biometricHost,client,()=>visit===revision&&!session)
  app.querySelector('#browse-public')?.addEventListener('click',openGuest)
  app.querySelector('#welcome-signin')?.addEventListener('click',()=>login('account'))
  app.querySelector('#welcome-back')?.addEventListener('click',()=>login())
  bindAccountLinks(app)
  window.scrollTo(0,0)
  const feedback=message?app.querySelector<HTMLElement>('.welcome-account form [role=alert]'):null
  if(feedback)feedback.focus()
  else app.querySelector<HTMLElement>('h1')!.focus({preventScroll:true})
  const emailEntry=app.querySelector<HTMLButtonElement>('#email-sign-in')
  if(emailEntry)emailEntry.onclick=()=>{if(session)return;biometricLogin?.dispose();const visit=++revision;emailAuth?.dispose();emailAuth=showEmailAuth(app,client,()=>visit===revision&&!session,()=>login('account'))}
  const forgot=app.querySelector<HTMLButtonElement>('#forgot-password')
  if(forgot)forgot.onclick = () => {
    biometricLogin?.dispose()
    recovery = showPasswordRecovery(app, client, () => login('account'))
  }
  const signInForm=app.querySelector<HTMLFormElement>('form')
  if(signInForm)signInForm.onsubmit = async event => {
    event.preventDefault()
    const form = event.currentTarget as HTMLFormElement
    if(visit!==revision||session||!form.isConnected)return
    const button = form.querySelector('button')!
    if(button.disabled)return
    biometricLogin?.dispose()
    const fields = new FormData(form)
    const address=String(fields.get('email')).trim()
    for(const control of app.querySelectorAll<HTMLButtonElement>('#welcome-back,#email-sign-in,#forgot-password,[data-biometric-signin]'))control.disabled=true
    button.disabled = true
    button.textContent = 'Signing in…'
    try {
      const { error } = await client.auth.signInWithPassword({email:address,password:String(fields.get('password'))})
      if (error&&visit===revision&&!session&&form.isConnected) login('account','Could not sign in. Check your email, password, and connection.',address)
    } catch { if(visit===revision&&!session&&form.isConnected)login('account','Could not sign in. Check your connection and try again.',address) }
  }
}

function openGuest() {
  biometricLogin?.dispose();biometricLogin=null
  if(session)return
  guestExploreResume=undefined
  recovery?.dispose();recovery=null
  emailAuth?.dispose();emailAuth=null
  guest?.dispose();guest=null
  const visit=++revision
  navigation.hidden=true
  document.body.dataset.screen='explore'
  app.dataset.state='public-explore'
  window.scrollTo(0,0)
  guest=showGuestExplore(app,()=>!session&&visit===revision,location=>{
    guestExploreResume={visit:location}
    login('account')
  },()=>login())
}

function selectNavigation(screen:AppScreen,activeTab=currentTab(screen)) {
  agenda?.dispose();agenda=null
  courtInvite?.dispose();courtInvite=null
  updates?.dispose();updates=null
  sharedMatch?.dispose();sharedMatch=null;teamInvite?.dispose();teamInvite=null
  labRatingTrends?.dispose();labRatingTrends=null
  dataImports?.dispose();dataImports=null
  competitions?.dispose();competitions=null
  tournaments?.dispose();tournaments=null;coachWorkspace?.dispose();coachWorkspace=null
  leagueOffice?.dispose();leagueOffice=null
  hub=screen==='compete'||screen==='more'||screen==='coach'?screen:null
  navigation.hidden = false
  accountEntry.hidden=false
  headerActions.hidden=false
  document.body.dataset.screen=screen
  window.scrollTo(0,0)
  navigation.querySelectorAll<HTMLButtonElement>('button').forEach(button => {
    if (button.dataset.screen === activeTab) button.setAttribute('aria-current','page')
    else button.removeAttribute('aria-current')
  })
}
function launchCompetitions(scope:'mine'|'discover'='mine',trigger?:HTMLElement,query?:string,id?:string){
 if(!session||competitions?.isOpen()||accountSettings?.isOpen())return
 const owner=session.user.id,visit=revision
 const current=()=>visit===revision&&owner===session?.user.id
 competitions=openCompetitions(client,owner,current,scope,()=>navigation.querySelector<HTMLButtonElement>('[data-screen="teams"]')?.click(),undefined,trigger,id,undefined,query,
  firstPartyBuild?scorecard=>guardNavigation(()=>{if(current())void lab({scorecard})}):undefined)
}
function launchTournaments(trigger:HTMLElement,id?:string,entries=false){
 if(!session||tournaments?.isOpen()||competitions?.isOpen()||accountSettings?.isOpen())return
 const owner=session.user.id,visit=revision,current=()=>visit===revision&&owner===session?.user.id
 const onClose=()=>{tournaments=null}
 tournaments=entries
  ?openMyTournamentEntries(client,owner,current,onClose,trigger)
  :openTournaments(client,owner,current,onClose,undefined,trigger,'Close',id)
}
function openScheduledPractice(owner:string,current:()=>boolean,button:HTMLElement,practice:CalendarPractice,options?:{reviewRep:boolean;fromCalendar:true}){
 button.focus({preventScroll:true})
 return openLevelUp(client,owner,current,'cardId' in practice?{view:'scheduled-focus',focus:practice}:{view:'weeks',calendarRep:practice,...options})
}
function openScorecardPractice(owner:string,current:()=>boolean,matchDate:string|null,doubles:boolean){
 if(!current()||training?.isOpen()||document.querySelector('dialog[open]'))return
 training=openLevelUp(client,owner,current,{view:'scorecard',matchDate,doubles})
 return training
}
function openPlayerCalendar(owner:string,current:()=>boolean,trigger:HTMLElement,initial?:CalendarStart){
 const start=typeof initial==='object'?initial:{
  ...(initial==='coach'?{filter:'coach' as const}:{}),
  onClose:(changed:boolean)=>{if(changed)calendarHighlights.refreshPractice(true)},
 }
 return openCalendar(client,owner,current,trigger,start,(practice,button,active,reviewRep)=>openScheduledPractice(owner,active,button,practice,{reviewRep,fromCalendar:true}),
  firstPartyBuild?scorecard=>guardNavigation(()=>{if(current())void lab({scorecard})}):undefined)
}
function launchCalendar(trigger:HTMLElement,initial:CalendarStart='all'){
 if(!session||agenda?.isOpen()||connection?.isSaving()||document.querySelector('dialog[open]'))return
 const owner=session.user.id,visit=revision
 agenda=openPlayerCalendar(owner,()=>visit===revision&&owner===session?.user.id,trigger,initial)
}
function openScorecardInvite(owner:string,clubId:string,trigger:HTMLButtonElement,current:()=>boolean){
 if(!current()||document.querySelector('dialog[open]'))return
 const changed=()=>calendarHighlights.refreshPractice(true)
 courtInvite=openCourtInvite(trigger,current,owner,clubId,undefined,{client,changed,open:saved=>{
  if(!current())return
  courtInvite?.dispose();courtInvite=null
  launchCalendar(trigger,{event:personalCalendarOccurrence(saved),onClose:updated=>{if(updated)changed()}})
 }})
}
function launchUpdates(trigger:HTMLElement){
 if(!session||updates?.isOpen()||connection?.isSaving()||document.querySelector('dialog[open]'))return
 const owner=session.user.id,visit=revision,current=()=>visit===revision&&owner===session?.user.id
 const leave=()=>{updates?.dispose();updates=null}
 updates=openUpdates(client,owner,current,()=>updatesCounter.refresh(),(action,button,active)=>{
  if(action.kind==='coach-message')return openCoachMessages(client,owner,active,button,undefined,action.student,undefined,()=>{void chatUnread.refresh()})
  if(action.kind==='coach-plan'){
   button.focus({preventScroll:true})
   return openLevelUp(client,owner,active,{view:'weeks',planId:action.planId})
  }
  if(action.kind==='tournament-entry'){
   return openTournamentEntry(client,owner,active,action.parent,action.division,()=>{},undefined,button,
    {backLabel:'Back to updates',receiptId:action.receiptId})
  }
  if(action.kind==='tool'){
   if(action.destination==='calendar')return openPlayerCalendar(owner,active,button)
   if(action.destination==='training-inbox')return openLevelUp(client,owner,active,'inbox')
   if(action.destination==='tournament-entries')return openMyTournamentEntries(client,owner,active,()=>{},button,'Updates')
   leave();guardNavigation(()=>{if(!current())return;if(action.destination==='lab')void lab();else showHub('coach')});return null
  }
  const link=action.link
  if(link.kind==='chat'){leave();guardNavigation(()=>{if(current())openTeamRoom(link.scope)});return null}
  if(link.kind==='coach-invite')return openCoachConnection(client,owner,active,button,undefined,link.href)
  if(link.kind==='team-invite')return openTeamInvite(client,owner,active,scope=>{leave();guardNavigation(()=>{if(current())openTeamRoom(scope)})},()=>{},link.href)
  if(link.kind==='league')return openCompetitions(client,owner,active,'discover',()=>{leave();guardNavigation(()=>{if(current())openTeamRoom()})},undefined,button,link.id)
  if(link.kind==='tournament')return openTournaments(client,owner,active,()=>{},undefined,button,'Back to updates',link.id)
  return openSharedMatch(client,owner,active,link.id,button)
 },trigger)
}
const guardNavigation=createTeamNavigationGuard(()=>Boolean(teamRoom?.hasDraft()),()=>revision)
navigation.querySelector<HTMLButtonElement>('[data-screen="lab"]')!.onclick = () => {if (!connection?.isSaving()) guardNavigation(()=>{void lab()})}
navigation.querySelector<HTMLButtonElement>('[data-screen="explore"]')!.onclick = () => openExplore()
function openExplore(resume?:ExploreVisit) {
  if (!session || connection?.isSaving() || explore&&!profileOpen) return
  guardNavigation(()=>{
    if(!session)return
    emailAuth?.dispose();emailAuth=null
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
    explore = showExplore(app,client,()=>version === revision && userId === session?.user.id,{
      search:exploreSearch,
      resume,
      onLeave:state=>{exploreSearch=state},
      onCompetitions:(trigger,query,id)=>launchCompetitions('discover',trigger,query,id),
      nearby:firstPartyBuild?{owner:userId,onTournaments:launchTournaments,calendar:{
        changed:calendarHighlights.clear,
        open:(trigger,event)=>launchCalendar(trigger,{event,onClose:changed=>{if(changed)calendarHighlights.clear()}}),
      }}:undefined,
    })
  })
}

function openFollowing(){
  if(firstPartyBuild || !session || connection?.isSaving() || following)return
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
  if(firstPartyBuild || !session || connection?.isSaving() || comparison)return
  guardNavigation(()=>{
    if(!session)return
    teamRoom?.dispose();teamRoom=null
    following?.dispose();following=null;explore?.dispose();explore=null;connection?.dispose();connection=null;details?.dispose();details=null
    const userId=session.user.id,version=++revision
    selectNavigation('matchup')
    comparison=showComparison(app,client,()=>version===revision && userId===session?.user.id)
  })
}

function openTeamRoom(initialScope?:TeamChatDestination,fromCompete?:CompeteTeamDestination&{browseFirst?:boolean},returnTo?:TeamResultsReturn){
  if(coachWorkspace?.isOpen()){coachWorkspace.requestLeave(()=>{coachWorkspace=null;openTeamRoom(initialScope,fromCompete,returnTo)});return}
  if(comparison?.isNotebookOpen()){comparison.back();return}
  if(goals?.isOpen()){goals.back();return}
  if(!session || connection?.isSaving())return
  if(teamRoom && !initialScope && navigation.querySelector('[data-screen="teams"][aria-current="page"]')){teamRoom.openInbox();return}
  if(teamRoom?.hasDraft() && !window.confirm('Open this team alert? Your unfinished message will be discarded.'))return
  teamRoom?.dispose();teamRoom=null
  comparison?.dispose();comparison=null;following?.dispose();following=null;explore?.dispose();explore=null;connection?.dispose();connection=null;details?.dispose();details=null
  const userId=session.user.id,version=++revision
  selectNavigation('teams',fromCompete?'compete':'teams')
  const current=()=>version===revision&&userId===session?.user.id
  teamRoom=showTeamRoom(app,client,userId,current,initialScope,{unread:()=>chatUnread.snapshot(),refresh:()=>{void chatUnread.refresh()},mountNotifications:host=>nativePush.mount(host)},fromCompete?{
   view:fromCompete.action,
   back:()=>{if(current())showHub('compete',{returnTeam:fromCompete,browseFirst:fromCompete.browseFirst})},
  }:undefined,teamScoreDrafts?{
   drafts:teamScoreDrafts,
   onScheduleChanged:calendarHighlights.clear,
   returnTo,
   openScorecard:(scorecard,source)=>guardNavigation(()=>{
    if(!current())return
    void lab({scorecard,backToTeamResults:()=>openTeamRoom(source.scope,fromCompete,source)})
   }),
  }:undefined)
  void chatUnread.refresh()
}

navigation.querySelector<HTMLButtonElement>('[data-screen="teams"]')!.onclick=()=>openTeamRoom()
navigation.querySelector<HTMLButtonElement>('[data-screen="compete"]')!.onclick=()=>{if(!connection?.isSaving())guardNavigation(()=>showHub('compete'))}
navigation.querySelector<HTMLButtonElement>('[data-screen="more"]')!.onclick=()=>{if(!connection?.isSaving())guardNavigation(()=>showHub('more'))}
async function launchDataImports(owner: string, current: () => boolean) {
 // Keep the condition at the import so the first-party build can omit the module entirely.
 if (typeof TIQ_FIRST_PARTY_BUILD === 'undefined' || !TIQ_FIRST_PARTY_BUILD) {
  const canOpen = () => current() && !dataImports?.isOpen() && !leagueOffice?.isOpen() && !training?.isOpen() && !goals?.isOpen()
  if (!canOpen()) return
  const {openDataImports} = await import('./data-imports-view')
  if (canOpen()) dataImports = openDataImports(client,owner,current)
 }
}
function openDestination(destination:AppDestination,trigger:HTMLButtonElement){
 if(destination==='updates'){launchUpdates(trigger);return}
 if(destination==='calendar'||destination==='coach-dates'){launchCalendar(trigger,destination==='coach-dates'?'coach':'all');return}
 if(!session||!trigger.isConnected||connection?.isSaving())return
 if(destination==='compete'&&trigger.hasAttribute('data-browse-first')){
  guardNavigation(()=>showHub('compete',{browseFirst:true}));return
 }
 if(destination==='leagues'||destination==='browse-leagues'){launchCompetitions(destination==='browse-leagues'?'discover':'mine',trigger);return}
 if(firstPartyBuild&&destination==='tournament-entries')return
 if(destination==='tournaments'||destination==='tournament-entries'){
  launchTournaments(trigger,undefined,destination==='tournament-entries')
  return
 }
 if(destination==='following'){openFollowing();return}
 if(destination==='matchup'){openMatchup();return}
 if(destination==='coach'){guardNavigation(()=>showHub('coach',{fromLab:Boolean(trigger.closest('.lab-shortcuts'))}));return}
 const owner=session.user.id,visit=revision,current=()=>visit===revision&&owner===session?.user.id
 if(destination==='coach-workspace'){if(!coachWorkspace?.isOpen())coachWorkspace=openCoachWorkspace(client,owner,current,undefined,trigger);return}
 if(destination==='coach-connection'){if(!coachWorkspace?.isOpen())coachWorkspace=openCoachConnection(client,owner,current,trigger);return}
 if(destination==='coach-lessons'){if(!coachWorkspace?.isOpen())coachWorkspace=openCoachLessons(client,owner,current,trigger);return}
 if(destination==='coach-calendar'||destination==='coach-weeks'||destination==='coach-proof'){if(!coachWorkspace?.isOpen())coachWorkspace=openCoachResources(client,owner,current,destination==='coach-calendar'?'calendar':destination==='coach-weeks'?'weeks':'proof',trigger);return}
 if(destination==='coach-video'){if(!coachWorkspace?.isOpen())coachWorkspace=openCoachVideo(client,owner,current,trigger);return}
 if(destination==='coach-messages'){if(!coachWorkspace?.isOpen())coachWorkspace=openCoachMessages(client,owner,current,trigger,undefined,undefined,undefined,()=>{void chatUnread.refresh()});return}
 if(destination==='coach-tactics'){if(!coachWorkspace?.isOpen())coachWorkspace=openNativeTactics(client,owner,current,trigger,undefined,openCoachHref);return}
 if(destination==='league-office'){if(!firstPartyBuild&&!leagueOffice?.isOpen())leagueOffice=openLeagueOffice(client,owner,current);return}
 if(destination==='imports'){void launchDataImports(owner,current);return}
 if(destination==='account'){launchAccount(trigger);return}
 if(destination==='training'||destination==='training-inbox'||destination==='training-progress'){
  if(!training?.isOpen()){
   trigger.focus({preventScroll:true})
   const starterCard=destination==='training'?trigger.dataset.trainingCard:undefined
   training=openLevelUp(client,owner,current,destination==='training-inbox'?'inbox':destination==='training-progress'?'progress':'catalog',
     starterCard?{cardId:starterCard,identitySlug:'',starterWarmup:{onFinish:(title,seconds)=>showLabWarmupReceipt(trigger,title,seconds)}}:undefined)
  }
  return
 }

 navigation.querySelector<HTMLButtonElement>('[data-screen="'+destination+'"]')?.click()
}
function openCoachHref(href:string){
 let url:URL;try{url=new URL(href,'https://www.tenaceiq.com')}catch{return false}
 if(url.origin!=='https://www.tenaceiq.com')return false
 const destination:AppDestination|null=url.pathname==='/coach'?'coach':url.pathname==='/video-review'?'coach-video':url.pathname.startsWith('/tactics')?'coach-tactics':/^\/player-development\/[^/]+\/coach-planner$/.test(url.pathname)?'coach-lessons':url.pathname==='/messages'?'coach-messages':url.pathname.startsWith('/level-up/')?'training':null
 if(!destination||!session)return false
 const open=()=>{
  coachWorkspace?.dispose();coachWorkspace=null;showHub('coach');if(destination==='coach')return
  const button=app.querySelector<HTMLButtonElement>('[data-app-destination="'+destination+'"]');if(!button)return
  const hiddenLane=button.closest<HTMLElement>('[data-coach-lane][hidden]')
  if(hiddenLane)app.querySelector<HTMLButtonElement>(`[aria-controls="${hiddenLane.id}"]`)?.click()
  openDestination(destination,button)
 }
 if(coachWorkspace?.isOpen())coachWorkspace.requestLeave(open);else open()
 return true
}
document.addEventListener('tenaceiq:navigate',event=>{const e=event as CustomEvent<{href?:unknown}>;if(typeof e.detail?.href==='string'&&openCoachHref(e.detail.href))event.preventDefault()})
function showHub(next:AppHub,{fromLab=false,returnTeam,browseFirst=false}:{fromLab?:boolean;returnTeam?:CompeteTeamDestination;browseFirst?:boolean}={}){
 if(!session)return
 accountSettings?.dispose();accountSettings=null
 emailAuth?.dispose();emailAuth=null;goals?.dispose();goals=null;training?.dispose();training=null
 teamRoom?.dispose();teamRoom=null;comparison?.dispose();comparison=null;following?.dispose();following=null
 explore?.dispose();explore=null;profileOpen=false;connection?.dispose();connection=null
 recovery?.dispose();recovery=null;details?.dispose();details=null
 ++revision;selectNavigation(next,fromLab?'lab':undefined);app.dataset.state='ready';app.innerHTML=appHubHtml(next,{fromLab,browseFirst})
 const back=app.querySelector<HTMLButtonElement>('[data-coach-back]')
 if(back)back.onclick=()=>{void lab('coach')}
 const owner=session.user.id,visit=revision,current=()=>visit===revision&&owner===session?.user.id
 const nextMatch=app.querySelector<HTMLElement>('[data-compete-next-match]')
 let refreshCompeteCalendar:((changed:boolean)=>void)|undefined
 if(nextMatch){
  const replies=app.querySelector<HTMLButtonElement>('[data-compete-replies]')!
  const tournament=app.querySelector<HTMLButtonElement>('[data-compete-my-event]')!
  refreshCompeteCalendar=calendarHighlights.mount(nextMatch,owner,current,true,
   (button,event,onClose)=>launchCalendar(button,{event,onClose,followMovedMatch:true}),'match',
   {
    replies:{button:replies,open:(button,event,onClose)=>launchCalendar(button,{event,filter:'needs-reply',onClose})},
    tournament:firstPartyBuild?undefined:{button:tournament,open:(button,entry,onClose)=>{
     if(!current()||document.querySelector('dialog[open]'))return
     tournaments=openTournamentEntry(client,owner,current,entry.parent,entry.division,changed=>{
      tournaments=null
      if(current())onClose(changed)
     },undefined,button,{backLabel:'Back to Compete',existingEntry:true})
    }},
   })
 }
 const nextAssignment=app.querySelector<HTMLElement>('[data-coach-next-assignment]')
 const latestFeedback=app.querySelector<HTMLElement>('[data-coach-latest-feedback]')
 if(nextAssignment&&latestFeedback){
  const lessonDates=app.querySelector<HTMLButtonElement>('[data-app-destination="coach-dates"]')!
  const openLesson=calendarHighlights.mountLesson(lessonDates,owner,current,
   (button,event,onClose)=>launchCalendar(button,{event,filter:'coach',onClose}))
  const refresh=coachNextAssignment.mount(nextAssignment,latestFeedback,owner,current,openCoachInbox)
  function openCoachInbox(trigger:HTMLButtonElement,id?:string,kind:'assignment'|'feedback'='assignment'){
   if(!current()||!trigger.isConnected||connection?.isSaving()||document.querySelector('dialog[open]'))return
   trigger.focus({preventScroll:true})
   training=openLevelUp(client,owner,current,{view:'coach',...(kind==='feedback'?{feedbackId:id}:{assignmentId:id}),onClose:refresh})
  }
  bindAppDestinations(app,(destination,trigger)=>{
   if(destination==='training-inbox')openCoachInbox(trigger)
   else if(destination==='coach-dates')openLesson()
   else openDestination(destination,trigger)
  })
 }else bindAppDestinations(app,(destination,trigger)=>{
  if(destination==='competition-calendar'&&refreshCompeteCalendar){
   launchCalendar(trigger,{filter:'competition',onClose:refreshCompeteCalendar})
  }else openDestination(destination,trigger)
 })
 app.querySelector<HTMLElement>('h1')?.focus({preventScroll:true})
 const teams=app.querySelector<HTMLElement>('[data-compete-teams]')
 if(teams)mountCompeteTeams(teams,client,owner,current,destination=>{
  if(current()&&!document.querySelector('dialog[open]'))openTeamRoom(destination.team,{...destination,browseFirst})
 },trigger=>launchTeamInvite('',trigger),returnTeam)
}
const coachIncoming=document.createElement('aside');coachIncoming.hidden=true;app.before(coachIncoming)
const coachHandoff=createCoachAlertHandoff(coachIncoming,client,()=>session?.user.id||null,()=>revision,()=>Boolean(connection?.isSaving()||document.querySelector('dialog[open]')),guardNavigation,(student,owner)=>{if(session?.user.id!==owner)return;showHub('coach');const visit=revision;coachWorkspace=openCoachMessages(client,owner,()=>visit===revision&&owner===session?.user.id,undefined,undefined,student,undefined,()=>{void chatUnread.refresh()})},undefined,undefined,()=>authReady&&document.body.dataset.screen==='lab'&&app.dataset.state==='ready'&&document.visibilityState==='visible')
const coachAlerts=createCoachAlerts(client,()=>nativePush.isEnabled())
const chatReceipts=createChatReceiptRefresh(async owner=>{if(session?.user.id===owner)await chatUnread.refresh()})
const nativePush=createNativePush(client,scope=>openTeamRoom(scope),{onCoachOpen:(id,owner)=>coachHandoff.receive(id,owner),onReceive:owner=>chatReceipts.receive(owner),mountCoachAlerts:host=>coachAlerts.mount(host)})
const chatUnread=createChatUnreadCounter(client,value=>{publishCoachMessageCounts(value);nativePush.syncBadge(value);paintChatsBadge(navigation.querySelector<HTMLElement>('[data-screen="teams"]')!,combinedChatUnread(value),value?.coach?.available===false);teamRoom?.refreshUnread()})
const updatesCounter=createUpdatesCounter(client,count=>{
 updatesEntry.setAttribute('aria-label',count===null?'Updates':'Updates, '+count+' unread')
 const badge=updatesEntry.querySelector<HTMLElement>('.updates-header-badge')!;badge.hidden=count===null||count===0;badge.textContent=count===null?'':count>99?'99+':String(count)
})
const nativePurchases=applePurchases(client)
const signOut=createNativeSignOut(client,async owner=>{
 await nativePush.beforeSignOut(owner)
 if(teamScoreDrafts?.owner===owner)await teamScoreDrafts.clear()
},()=>session?.user.id||null)
function setNativeSession(next:typeof session){if(next){biometricLogin?.dispose();biometricLogin=null}chatReceipts.setOwner(next?.user.id||null);nativePush.setSession(next);if(nativePush.isSupported())coachAlerts.setOwner(next?.user.id||null);coachHandoff.syncOwner();nativePurchases.setOwner(next?.user.id||null);updatesCounter.setOwner(next?.user.id||null);chatUnread.setOwner(next?.user.id||null)}

function focusLabCoachShortcut(shortcuts: HTMLElement, ...sectionsAbove: HTMLElement[]) {
  const shortcut = shortcuts.querySelector<HTMLButtonElement>('[data-app-destination="coach"]')
  if (!shortcut) return
  shortcut.focus({ preventScroll: true })
  shortcut.scrollIntoView({ block: 'center' })

  const interaction = new AbortController()
  const layout = new ResizeObserver(() => {
    if (!shortcut.isConnected || document.activeElement !== shortcut) {
      stop()
      return
    }
    shortcut.scrollIntoView({ block: 'center' })
  })
  function stop() {
    layout.disconnect()
    interaction.abort()
  }

  // Keep focus visible through async layout changes until the player interacts again.
  for (const section of sectionsAbove) layout.observe(section)
  shortcut.addEventListener('blur', stop, { once: true, signal: interaction.signal })
  for (const event of ['pointerdown', 'wheel', 'keydown']) {
    window.addEventListener(event, stop, { capture: true, once: true, passive: true, signal: interaction.signal })
  }
}

async function lab(entry?:'coach'|'trophies'|PlayerLink|{scorecard:CalendarScorecardSeed;backToTeamResults?:()=>void}) {
  agenda?.dispose();agenda=null
  updates?.dispose();updates=null
  sharedMatch?.dispose();sharedMatch=null;teamInvite?.dispose();teamInvite=null
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
  details?.dispose();details=null
  const version = ++revision
  const link=typeof entry==='object'&&'profile' in entry?entry:undefined
  const scorecardEntry=typeof entry==='object'&&'scorecard' in entry?entry:undefined
  const scorecard=scorecardEntry?.scorecard
  labTeamReturnVersion=scorecardEntry?.backToTeamResults?version:undefined
  if(!firstPartyBuild&&!link?.profile){
    app.dataset.state = 'loading'
    app.innerHTML = linkedLabOwner===current.user.id
      ?labScoreboardHtml(null)
      :'<header class="tab-hero tab-hero-court"><small class="stat-eyebrow">Your game</small><h1>My Lab</h1><p role="status">Loading your player profile…</p></header>'
  }
  const { data, error } = firstPartyBuild
    ? {data:null,error:null}
    : link?.profile ? {data:link.profile,error:null}
    : await client.from('profiles').select('linked_player_id,linked_player_name,linked_team_name,linked_league_name')
      .eq('id', current.user.id).abortSignal(AbortSignal.timeout(12000)).maybeSingle()
  if (version !== revision || current.user.id !== session?.user.id) return
  app.dataset.state = error ? 'unavailable' : 'ready'
  const playerId=typeof data?.linked_player_id==='string'?data.linked_player_id:''
  if(!error)linkedLabOwner=playerId?current.user.id:undefined
  const hasIdentity=firstPartyBuild||Boolean(playerId&&data?.linked_player_name)
  const goalScope=firstPartyBuild?accountGoalScope(current.user.id):playerId?{owner:current.user.id,player:playerId}:null
  const justConnected=hasIdentity&&link?.id===playerId
  const tools=error?'':labActionsHtml()+
    (firstPartyBuild?'':'<section><h2>Uploads & imports</h2><p>Check saved scorecards, schedules and roster imports.</p><button type="button" class="secondary" data-open-imports>Open uploads & imports</button></section>'+
    '<section><h2>League Office</h2><p>Review your owned league seasons, schedules and results.</p><button type="button" class="secondary" data-league-office>Open League Office</button></section>')
  const controls=`<button id="refresh">${error?'Try again':'Refresh profile'}</button><button class="secondary" id="logout">Log out</button><p role="alert" id="notice"></p>`
  const identity=error
    ? `<header class="tab-hero tab-hero-court"><h1 tabindex="-1">My Lab</h1><p role="alert">${link?'Your player record was connected. Try again to load My Lab.':'Can’t load your profile. Check your connection, then try again.'}</p></header>`
    : `${firstPartyBuild||playerId&&data?labScoreboardHtml(data,justConnected):''}<div id="lab-identity">${hasIdentity?labIdentityHtml(data):playerSetupHtml()}</div>`
  const trainingContent=!error&&hasIdentity?labTrainingActionsHtml()+
    '<section id="lab-goal-context"><h2>Training notes</h2><div id="goal-context-copy"><p>Bring your saved goals and notes into this week’s tennis.</p></div><button type="button" data-lab-goals>Open goals and notes</button></section>':''
  const matches=!firstPartyBuild&&!error&&playerId?`<section id="recent-results" aria-labelledby="results-title">
    <div class="lab-recent-heading">
      <h2 id="results-title" tabindex="-1">Recent matches</h2>
      <button type="button" class="secondary" data-lab-scorecard-return hidden><span aria-hidden="true">↑</span> Back to scoreboard</button>
    </div>
    <div id="results-content" aria-live="polite"></div>
  </section>`:''
  app.innerHTML=identity+trainingContent+(!firstPartyBuild&&!error&&!playerId
    ?`<details class="lab-setup-utilities"><summary>More My Lab tools</summary>${tools}${controls}</details>`
    :tools+matches+controls)

  const labHeading=app.querySelector<HTMLElement>('h1')
  if(labHeading){labHeading.tabIndex=-1;if(entry!=='coach'||!(firstPartyBuild||playerId))labHeading.focus({preventScroll:true})}
  let selectedLabGoal:LabGoal|undefined
  const bindLabActions=()=>{
  const invite=app.querySelector<HTMLButtonElement>('[data-setup-team]')
  if(invite)invite.onclick=()=>launchTeamInvite('',invite)
  bindAppDestinations(app,openDestination)
  app.querySelectorAll<HTMLButtonElement>('[data-lab-goals]').forEach(button=>{button.onclick=()=>{
    if(goals?.isOpen()||training?.isOpen()||!goalScope)return
    const active=()=>version===revision&&current.user.id===session?.user.id,heroTrigger=Boolean(button.closest('#lab-identity'))
    goals=openLabGoals(client,goalScope,active,goal=>{
      const host=app.querySelector<HTMLElement>('#goal-context-copy');if(!active()||!host)return;selectedLabGoal=goal
      host.innerHTML='<h3>'+escape(goal.goal)+'</h3><p>'+escape(goal.improveNext||goal.progressUpdate||'Review your notes before the next match or practice.')+'</p>'+goalReadinessHtml(goal)
    },()=>{if(!active()||!selectedLabGoal)return;const host=app.querySelector<HTMLElement>('#lab-identity');if(host){host.innerHTML=labIdentityHtml(data,undefined,selectedLabGoal);bindLabActions();if(heroTrigger)host.querySelector<HTMLElement>('[data-lab-goals]')?.focus({preventScroll:true})}})
  }})
  app.querySelectorAll<HTMLButtonElement>('[data-lab-screen]').forEach(b=>{b.onclick=()=>{if(b.dataset.labScreen==='competitions'){launchCompetitions('mine',b);return}if(b.dataset.labScreen==='following'){openFollowing();return}if(b.dataset.labScreen==='matchup'){openMatchup();return}navigation.querySelector<HTMLButtonElement>(`[data-screen="${b.dataset.labScreen}"]`)?.click()}})
  app.querySelectorAll<HTMLButtonElement>('[data-training]').forEach(button=>{button.onclick=()=>{
   if(training?.isOpen())return
   const action=button.dataset.training
   const initial=action==='weeks'?{view:'weeks'} as const:action==='inbox'||action==='progress'?action:'catalog'
   button.focus({preventScroll:true})
   training=openLevelUp(client,current.user.id,()=>version===revision&&current.user.id===session?.user.id,initial,action==='next'?{cardId:button.dataset.trainingCard||'',identitySlug:button.dataset.trainingDirection||''}:undefined)
  }})
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
      onConnected: link => { void lab(link) },
      teamInvite:hasIdentity?undefined:trigger=>launchTeamInvite('',trigger),
      openStarterAction:hasIdentity?undefined:openDestination,
    }, () => { void lab() }, isCurrent)
  }})
  }
  app.querySelector('[data-open-imports]')?.addEventListener('click',()=>{void launchDataImports(current.user.id,()=>version===revision&&current.user.id===session?.user.id)})
  if(!firstPartyBuild)app.querySelector('[data-league-office]')?.addEventListener('click',()=>{if(leagueOffice?.isOpen()||training?.isOpen()||goals?.isOpen())return;leagueOffice=openLeagueOffice(client,current.user.id,()=>version===revision&&current.user.id===session?.user.id)})
  bindLabActions()
  const calendar=document.createElement('div')
  if(!error){
    calendar.className='lab-up-next'
    const scoreboard=app.querySelector('.lab-scoreboard')
    if(scoreboard)scoreboard.after(calendar)
    else app.querySelector('#refresh')!.before(calendar)
    const active=()=>version===revision&&current.user.id===session?.user.id
    calendarHighlights.mount(calendar,current.user.id,active,Boolean(scoreboard),
      (button,event,onClose)=>launchCalendar(button,{event,onClose}),'up-next',{
       scorecard:firstPartyBuild&&!scorecard?seed=>guardNavigation(()=>{if(active())void lab({scorecard:seed})}):undefined,
       practice:(button,practice)=>{
        if(connection?.isSaving()||document.querySelector('dialog[open]'))return
        training=openScheduledPractice(current.user.id,active,button,practice)
       },
      })
  }
  const alerts=document.createElement('section');app.querySelector('#logout')!.before(alerts);nativePush.mount(alerts)
  app.insertAdjacentHTML('beforeend', accountLinksHtml)
  bindAccountLinks(app)
  const overviewButton=app.querySelector<HTMLButtonElement>('#lab-training-refresh'),overviewStatus=app.querySelector<HTMLElement>('#lab-training-status'),identityHost=app.querySelector<HTMLElement>('#lab-identity')
  if(overviewButton&&overviewStatus&&identityHost)overviewButton.onclick=async()=>{
    if(overviewButton.disabled||version!==revision||current.user.id!==session?.user.id)return
    overviewButton.disabled=true;overviewStatus.textContent='Loading saved practice…'
    const active=()=>version===revision&&current.user.id===session?.user.id&&identityHost.isConnected
    try{
      const rows=await loadTrainingHistory(client,current.user.id,active)
      if(!active())return
      if(training?.isOpen()||goals?.isOpen()){overviewStatus.textContent='Close training or notes, then refresh saved practice.';return}
      identityHost.innerHTML=labIdentityHtml(data,labTrainingOverview(rows));bindLabActions()
      overviewButton.textContent='Refresh saved practice';overviewStatus.textContent='Saved practice loaded. Weekly progress uses your latest 40 sessions.'
      const repHeading=identityHost.querySelector<HTMLElement>('[data-native-part="postRepProof"] h2, [data-native-part="repContent"] h2')
      if(repHeading&&(document.activeElement===overviewButton||document.activeElement===document.body)){
        repHeading.tabIndex=-1;repHeading.focus({preventScroll:true});repHeading.scrollIntoView({block:'center'})
      }
    }catch{if(active())overviewStatus.textContent='Couldn’t load saved practice. Try again when connected.'}
    finally{if(active())overviewButton.disabled=false}
  }
  app.querySelector<HTMLButtonElement>('#refresh')!.onclick = () => { void lab(error?link:undefined) }
  app.querySelector<HTMLButtonElement>('#logout')!.onclick = async event => {
    const button=event.currentTarget as HTMLButtonElement;button.disabled=true
    try {await signOut(current.user.id)}
    catch {if(version!==revision||!button.isConnected)return;app.querySelector('#notice')!.textContent='Couldn’t log out. Check your connection and try again.';button.disabled=false}
  }
  if (!error&&(firstPartyBuild||playerId)) {
    const shortcuts=document.createElement('div');shortcuts.innerHTML=homeShortcutsHtml()
    if(firstPartyBuild){
      calendar.after(shortcuts)
      const scoreReviewShortcut = !entry ? document.createElement('div') : undefined
      if (scoreReviewShortcut) {
        scoreReviewShortcut.className = 'lab-up-next lab-score-review-shortcut'
        scoreReviewShortcut.hidden = true
        shortcuts.before(scoreReviewShortcut)
      }
      bindAppDestinations(shortcuts,openDestination)
      const matchLog = document.createElement('div')
      shortcuts.after(matchLog)
      const active = () => version===revision&&current.user.id===session?.user.id
      mountPersonalMatchLog(matchLog,client,current.user.id,active,personalMatchForm,{
        seed:scorecard,backToTeamResults:scorecardEntry?.backToTeamResults,scoreReviewShortcut,
        openPractice:(match,currentMatch)=>openScorecardPractice(current.user.id,currentMatch,match.match_date,match.format==='doubles'),
        openRematchInvite:(clubId,trigger,currentMatch)=>openScorecardInvite(current.user.id,clubId,trigger,currentMatch),
      })
      const trophies = document.createElement('div')
      matchLog.after(trophies)
      mountSetupTrophyCase(trophies,client,current.user.id,active,(action,button)=>{
        if(action==='chats')openTeamRoom()
        else if(action==='scorecard')matchLog.querySelector<HTMLButtonElement>('[data-log-match]')?.click()
        else openDestination(action,button)
      },entry==='trophies')
      if(entry==='coach')focusLabCoachShortcut(shortcuts,calendar)
      return
    }
    const active = () => version===revision && current.user.id===session?.user.id
    details = createMatchDetails(app, client, active, {openPractice: (match, currentMatch) =>
      openScorecardPractice(current.user.id,currentMatch,match.match_date,match.match_type?.trim().toLowerCase()==='doubles')})
    const content = app.querySelector<HTMLElement>('#results-content')!
    const ratingsSection=app.querySelector<HTMLElement>('.lab-scoreboard')!
    const recent=app.querySelector<HTMLElement>('#recent-results')!
    const recentHeading=recent.querySelector<HTMLElement>('#results-title')!
    const jump=ratingsSection.querySelector<HTMLButtonElement>('[data-lab-scorecard-jump]')
    const backToScoreboard=recent.querySelector<HTMLButtonElement>('[data-lab-scorecard-return]')!
    const revealScorecards=()=>{
      const list=content.querySelector<HTMLDetailsElement>('.recent-match-list')
      if(list)list.open=true
    }
    if(jump&&labHeading){
      jump.onclick=()=>{
        backToScoreboard.hidden=false
        revealScorecards()
        recentHeading.focus({preventScroll:true})
        recent.scrollIntoView({block:'start'})
      }
      backToScoreboard.onclick=()=>{
        backToScoreboard.hidden=true
        labHeading.focus({preventScroll:true})
        ratingsSection.scrollIntoView({block:'start'})
      }
    }
    app.querySelector('#lab-identity')!.before(recent)
    const trendSection=document.createElement('section')
    const formSection=document.createElement('div');formSection.className='lab-form-host'
    calendar.after(formSection,shortcuts,trendSection)
    if(entry==='coach')focusLabCoachShortcut(shortcuts,ratingsSection,calendar,formSection)
    labRatingTrends=mountLabRatingTrends(trendSection,client,playerId,()=>version===revision&&current.user.id===session?.user.id)
    bindLabActions()
    const pathSection=document.createElement('div');pathSection.className='lab-next-band';app.querySelector('#recent-results')!.after(pathSection)
    showPlayerRatings(ratingsSection.querySelector<HTMLElement>('[data-lab-ratings]')!,client,playerId,()=>version===revision && current.user.id===session?.user.id,true,{showcase:true,onReady:player=>{pathSection.innerHTML=labLevelPathHtml(player);bindLabActions()}})
    const refreshResults = async () => {
      content.dataset.state = 'loading'
      content.innerHTML = '<p role="status">Loading your latest matches…</p>'
      const result = await loadRecentResults(client, playerId, true)
      if (version !== revision || current.user.id !== session?.user.id || !content.isConnected) return
      if (result.error) {
        content.dataset.state = 'unavailable'
        content.innerHTML = '<p role="alert">Can’t load your matches. Check your connection and try again.</p><button class="secondary" id="retry-results">Retry matches</button>'
        content.querySelector<HTMLButtonElement>('#retry-results')!.onclick = () => { void refreshResults() }
        return
      }
      const rows = (result.data || []) as RecentMatchRow[]
      if (!rows.length) {
        const keepScorecardFocus=document.activeElement===recentHeading
        content.dataset.state = 'empty'
        recentHeading.textContent='Your first scorecard'
        content.innerHTML = labFirstScorecardHtml()
        ratingsSection.after(recent)
        if(keepScorecardFocus){recentHeading.focus({preventScroll:true});recent.scrollIntoView({block:'start'})}
        const jumpLabel=jump?.querySelector('span:first-child')
        if(jumpLabel)jumpLabel.textContent='First scorecard'
        bindAppDestinations(content,openDestination)
        return
      }
      mountLabRecentForm(formSection,rows,playerId,()=>version===revision&&current.user.id===session?.user.id,row=>details?.open(row,playerId))
      content.dataset.state = 'ready'
      showRecentResults(content, rows, playerId, row => details?.open(row, playerId),'your',true,{current:()=>version===revision&&current.user.id===session?.user.id,load:loaded=>loadOlderResults(client,playerId,loaded)})
      if(!backToScoreboard.hidden)revealScorecards()
    }
    void refreshResults()
  }
}

client.auth.onAuthStateChange((_event, next) => {
  if(next?.user.id!==session?.user.id){
    calendarHighlights.clear();coachNextAssignment.clear();linkedLabOwner=undefined;exploreSearch=undefined
    personalMatchForm={}
    teamScoreDrafts=firstPartyBuild&&next?createTeamScoreDraftSession(next.user.id):undefined
    if(!session&&next&&_event==='SIGNED_IN'&&guestExploreResume)guestExploreResume.owner=next.user.id
    else guestExploreResume=undefined
  }
  const resumeLink=(!session&&Boolean(next))||_event==='INITIAL_SESSION'
  appLinks.setOwner(next?.user.id||null)
  // Keep the public visit and its sign-in handoff through late signed-out events.
  if(!next&&!session&&(guest||emailAuth||guestExploreResume)){setTimeout(()=>setNativeSession(null),0);return}
  if(next){guest?.dispose();guest=null}
  if (next?.user.id === session?.user.id && (inTeamScorecard() || agenda?.isOpen() || courtInvite?.isOpen() || updates?.isOpen() || sharedMatch?.isOpen() || teamInvite?.isOpen() || accountSettings?.isOpen() || details?.isOpen() || connection || explore || following || comparison || teamRoom || goals?.isOpen() || training?.isOpen() || competitions?.isOpen() || tournaments?.isOpen() || coachWorkspace?.isOpen() || hub || leagueOffice?.isOpen() || dataImports?.isOpen())) { session = next; setTimeout(()=>setNativeSession(next),0); return }
  session = next
  const authRevision=++revision
  // Schedule outside the auth callback's lock before making another SDK call.
  setTimeout(() => {
    if(next?.user.id!==session?.user.id||authRevision!==revision)return
    void (async()=>{
      const resume=guestExploreResume?.owner===next?.user.id?guestExploreResume?.visit:undefined
      guestExploreResume=undefined
      if(session){
        if(resume&&!appLinks.peek())openExplore(resume)
        else await lab()
      }else login()
      if(next?.user.id===session?.user.id){setNativeSession(session);authReady=true;if(session&&(resume||resumeLink))resumeAppLink();coachHandoff.resume()}
    })()
  }, 0)
})
client.auth.getSession().catch(() => {
  storageUnavailable=true
  if(!session&&!guest)login()
})
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible') { if(session)void nativePurchases.recover(session.user.id).catch(()=>{}); client.auth.startAutoRefresh(); if (session && !inTeamScorecard() && !agenda?.isOpen() && !courtInvite?.isOpen() && !updates?.isOpen() && !sharedMatch?.isOpen() && !teamInvite?.isOpen() && !accountSettings?.isOpen() && !details?.isOpen() && !labRatingTrends?.isScorecardOpen() && !connection && !explore && !following && !comparison && !teamRoom && !goals?.isOpen() && !training?.isOpen() && !competitions?.isOpen() && !tournaments?.isOpen() && !coachWorkspace?.isOpen() && !hub && !leagueOffice?.isOpen() && !dataImports?.isOpen()) void lab() }
  else {if(!updates?.hasChild()){updates?.dispose();updates=null}labRatingTrends?.dispose();labRatingTrends=null;client.auth.stopAutoRefresh()}
})
window.addEventListener('online', () => { if (session && !inTeamScorecard() && !agenda?.isOpen() && !courtInvite?.isOpen() && !updates?.isOpen() && !sharedMatch?.isOpen() && !teamInvite?.isOpen() && !accountSettings?.isOpen() && !details?.isOpen() && !labRatingTrends?.isScorecardOpen() && !connection && !explore && !following && !comparison && !teamRoom && !goals?.isOpen() && !training?.isOpen() && !competitions?.isOpen() && !tournaments?.isOpen() && !coachWorkspace?.isOpen() && !hub && !leagueOffice?.isOpen() && !dataImports?.isOpen()) void lab() })

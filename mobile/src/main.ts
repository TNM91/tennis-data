import {createTeamNavigationGuard} from './navigation-warning'
import {labIdentityHtml,labActionsHtml} from './lab-home'
import type {TeamScope} from './team-room-data'
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
import { MY_LAB_STORY } from '../../lib/product-story'
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
navigation.innerHTML = '<button type="button" data-screen="lab">My Lab</button><button type="button" data-screen="explore">Explore</button><button type="button" data-screen="following">Following</button><button type="button" data-screen="matchup">Matchup</button><button type="button" data-screen="teams">My teams</button>'
app.after(navigation)
let teamRoom:ReturnType<typeof showTeamRoom>|null=null
let comparison:ReturnType<typeof showComparison>|null=null
let following:ReturnType<typeof showFollowing>|null=null
let explore: ReturnType<typeof showExplore> | null = null
let session: Session | null = null
let revision = 0
let connection: ReturnType<typeof showPlayerConnection> | null = null
let details: ReturnType<typeof createMatchDetails> | null = null
let recovery: ReturnType<typeof showPasswordRecovery> | null = null

if (Capacitor.getPlatform() === 'android') {
  void App.addListener('backButton', () => {
    if(teamRoom){if(!teamRoom.back())guardNavigation(()=>{void lab()})}
    else if(comparison){if(!comparison.back())void lab()}
    else if(following){if(!following.back())void lab()}
    else if (explore) { if (!explore.back()) void lab() }
    else if (connection) { if (!connection.isSaving()) void lab() }
    else if (recovery) login()
    else if (details?.isOpen()) history.back()
    else void App.minimizeApp()
  })
}

function login(message = '') {
  document.querySelector<HTMLDialogElement>('[data-team-navigation-warning]')?.close()
  teamRoom?.dispose();teamRoom=null
  comparison?.dispose();comparison=null
  following?.dispose();following=null
  explore?.dispose()
  explore = null
  navigation.hidden = true
  connection?.dispose()
  connection = null
  recovery?.dispose()
  recovery = null
  details?.dispose()
  details = null
  app.dataset.state = 'signed-out'
  app.innerHTML = `<h1>Your tennis, connected.</h1><p>Sign in to see your player profile in My Lab.</p><form><label>Email<input type="email" name="email" autocomplete="username" required></label><label>Password<input type="password" name="password" autocomplete="current-password" required></label><p role="alert">${escape(message)}</p><button>Sign in</button></form><button class="secondary" id="forgot-password">Forgot password?</button>${accountLinksHtml}`
  bindAccountLinks(app)
  app.querySelector<HTMLButtonElement>('#forgot-password')!.onclick = () => {
    recovery = showPasswordRecovery(app, client, () => login())
  }
  app.querySelector('form')!.onsubmit = async event => {
    event.preventDefault()
    const form = event.currentTarget as HTMLFormElement
    const fields = new FormData(form)
    const button = form.querySelector('button')!
    button.disabled = true
    button.textContent = 'Signing in…'
    try {
      const { error } = await client.auth.signInWithPassword({email: String(fields.get('email')).trim(), password: String(fields.get('password'))})
      if (error) login('Could not sign in. Check your email, password, and connection.')
    } catch { login('Could not sign in. Check your connection and try again.') }
  }
}

function selectNavigation(screen: 'lab' | 'explore' | 'following' | 'matchup' | 'teams') {
  navigation.hidden = false
  window.scrollTo(0,0)
  navigation.querySelectorAll<HTMLButtonElement>('button').forEach(button => {
    if (button.dataset.screen === screen) button.setAttribute('aria-current','page')
    else button.removeAttribute('aria-current')
  })
}
const guardNavigation=createTeamNavigationGuard(()=>Boolean(teamRoom?.hasDraft()),()=>revision)
navigation.querySelector<HTMLButtonElement>('[data-screen="lab"]')!.onclick = () => {if (!connection?.isSaving()) guardNavigation(()=>{void lab()})}
navigation.querySelector<HTMLButtonElement>('[data-screen="explore"]')!.onclick = () => {
  if (!session || connection?.isSaving() || explore) return
  guardNavigation(()=>{
    if(!session)return
    teamRoom?.dispose();teamRoom=null
    comparison?.dispose();comparison=null
    following?.dispose();following=null
    connection?.dispose(); connection = null
    recovery?.dispose(); recovery = null
    details?.dispose(); details = null
    const userId = session.user.id
    const version = ++revision
    selectNavigation('explore')
    explore = showExplore(app,client,()=>version === revision && userId === session?.user.id)
  })
}

navigation.querySelector<HTMLButtonElement>('[data-screen="following"]')!.onclick=()=>{
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

navigation.querySelector<HTMLButtonElement>('[data-screen="matchup"]')!.onclick=()=>{
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

function openTeamRoom(initialScope?:TeamScope){
  if(!session || connection?.isSaving())return
  if(teamRoom && !initialScope)return
  if(teamRoom?.hasDraft() && !window.confirm('Open this team alert? Your unfinished message will be discarded.'))return
  teamRoom?.dispose();teamRoom=null
  comparison?.dispose();comparison=null;following?.dispose();following=null;explore?.dispose();explore=null;connection?.dispose();connection=null;details?.dispose();details=null
  const userId=session.user.id,version=++revision
  selectNavigation('teams')
  teamRoom=showTeamRoom(app,client,userId,()=>version===revision && userId===session?.user.id,initialScope)
}

navigation.querySelector<HTMLButtonElement>('[data-screen="teams"]')!.onclick=()=>openTeamRoom()
const nativePush=createNativePush(client,scope=>openTeamRoom(scope))

async function lab() {
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
  app.innerHTML = `<small>${escape(MY_LAB_STORY.eyebrow)}</small><h1 tabindex="-1">My Lab</h1><p>${escape(MY_LAB_STORY.headline)}</p>${error
    ? '<section><h2>Can’t load your profile</h2><p role="alert">Check your connection, then try again. Your profile has not been changed.</p></section>'
    : labIdentityHtml(data)}${!error ? labActionsHtml() : ''}${!error ? '<section id="recent-results" aria-labelledby="results-title"><h2 id="results-title">Recent matches</h2><div id="results-content" aria-live="polite"></div></section>' : ''}<button id="refresh">${error ? 'Try again' : 'Refresh profile'}</button><button class="secondary" id="logout">Sign out</button><p role="alert" id="notice"></p>`
  app.querySelector<HTMLElement>('h1')?.focus({preventScroll:true})
  app.querySelectorAll<HTMLButtonElement>('[data-lab-screen]').forEach(b=>{b.onclick=()=>{navigation.querySelector<HTMLButtonElement>(`[data-screen="${b.dataset.labScreen}"]`)?.click()}})
  const alerts=document.createElement('section');app.querySelector('#logout')!.before(alerts);nativePush.mount(alerts)
  app.insertAdjacentHTML('beforeend', accountLinksHtml)
  bindAccountLinks(app)
  const connectButton = app.querySelector<HTMLButtonElement>('#connect-player')
  if (connectButton) connectButton.onclick = () => {
    details?.dispose()
    details = null
    const connectionVersion = ++revision
    const isCurrent = () => connectionVersion === revision && current.user.id === session?.user.id
    connection = showPlayerConnection(app, {
      search: term => findPlayers(client, term),
      connect: playerId => connectPlayer(client, playerId, current.user.id, isCurrent),
    }, () => { void lab() }, isCurrent)
  }
  app.querySelector<HTMLButtonElement>('#refresh')!.onclick = () => { void lab() }
  app.querySelector<HTMLButtonElement>('#logout')!.onclick = async event => {
    (event.currentTarget as HTMLButtonElement).disabled = true
    try {
      await nativePush.beforeSignOut()
      const { error: logoutError } = await client.auth.signOut({scope: 'local'})
      if (logoutError) throw logoutError
    } catch {
      app.querySelector('#notice')!.textContent = 'Could not sign out. Please try again.'
      app.querySelector<HTMLButtonElement>('#logout')!.disabled = false
    }
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
      ratingsSection.innerHTML='<h2 id="lab-ratings-title">Your recorded TIQ ratings</h2><div aria-live="polite"></div>'
      app.querySelector('#recent-results')!.before(ratingsSection)
      showPlayerRatings(ratingsSection.querySelector<HTMLElement>('div')!,client,playerId,()=>version===revision && current.user.id===session?.user.id)
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
        content.dataset.state = rows.length ? 'ready' : 'empty'
        showRecentResults(content, rows, playerId, row => details?.open(row, playerId))
      }
      void refreshResults()
    }
  }
}

client.auth.onAuthStateChange((_event, next) => {
  if (next?.user.id === session?.user.id && (details?.isOpen() || connection || explore || following || comparison || teamRoom)) { session = next; setTimeout(()=>nativePush.setSession(next),0); return }
  session = next
  revision++
  // Schedule outside the auth callback's lock before making another SDK call.
  setTimeout(() => {
    if(next?.user.id!==session?.user.id)return
    void (async()=>{if(session)await lab();else login();if(next?.user.id===session?.user.id)nativePush.setSession(session)})()
  }, 0)
})
client.auth.getSession().catch(() => {
  app.dataset.state = 'storage-error'
  app.innerHTML = '<h1>Couldn’t open your account</h1><p role="alert">Close the app and try again. Secure sign-in storage is unavailable.</p>'
})
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible') { client.auth.startAutoRefresh(); if (session && !details?.isOpen() && !connection && !explore && !following && !comparison && !teamRoom) void lab() }
  else client.auth.stopAutoRefresh()
})
window.addEventListener('online', () => { if (session && !details?.isOpen() && !connection && !explore && !following && !comparison && !teamRoom) void lab() })

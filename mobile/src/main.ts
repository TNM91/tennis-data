import { createClient, type Session } from '@supabase/supabase-js'
import { Capacitor } from '@capacitor/core'
import { App } from '@capacitor/app'
import { supabaseUrl, supabaseKey } from '../../lib/supabase-public-config'
import { getNativeAuthStorage } from '../../lib/native-auth-storage'
import { MY_LAB_STORY } from '../../lib/product-story'
import { loadRecentResults, matchDate, matchResult, type RecentMatchRow } from './recent-results'
import { createMatchDetails, html as escape } from './match-details'
import { accountLinksHtml, bindAccountLinks, showPasswordRecovery } from './account-actions'

const client = createClient(supabaseUrl, supabaseKey, { auth: {
  storage: getNativeAuthStorage(), persistSession: true, autoRefreshToken: true,
  detectSessionInUrl: false,
} })
const app = document.querySelector<HTMLElement>('#app')!
let session: Session | null = null
let revision = 0
let details: ReturnType<typeof createMatchDetails> | null = null
let recovery: ReturnType<typeof showPasswordRecovery> | null = null

if (Capacitor.getPlatform() === 'android') {
  void App.addListener('backButton', () => {
    if (recovery) login()
    else if (details?.isOpen()) history.back()
    else void App.minimizeApp()
  })
}

function login(message = '') {
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

async function lab() {
  const current = session
  if (!current) return login()
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
  app.innerHTML = `<small>${escape(MY_LAB_STORY.eyebrow)}</small><h1>My Lab</h1><p>${escape(MY_LAB_STORY.headline)}</p>${error
    ? '<section><h2>Can’t load your profile</h2><p role="alert">Check your connection, then try again. Your profile has not been changed.</p></section>'
    : `<section><h2>Your player profile</h2>${data?.linked_player_name
      ? `<dl><dt>Player</dt><dd>${escape(data.linked_player_name)}</dd><dt>Team</dt><dd>${escape(data.linked_team_name || 'No team linked')}</dd><dt>League</dt><dd>${escape(data.linked_league_name || 'No league linked')}</dd></dl>`
      : '<p>No player record is linked to your account yet. Link your player record on the TenAceIQ website to see it here.</p>'}</section>`}${!error ? '<section id="recent-results" aria-labelledby="results-title"><h2 id="results-title">Recent matches</h2><div id="results-content" aria-live="polite"></div></section>' : ''}<button id="refresh">${error ? 'Try again' : 'Refresh profile'}</button><button class="secondary" id="logout">Sign out</button><p role="alert" id="notice"></p>`
  app.insertAdjacentHTML('beforeend', accountLinksHtml)
  bindAccountLinks(app)
  app.querySelector<HTMLButtonElement>('#refresh')!.onclick = () => { void lab() }
  app.querySelector<HTMLButtonElement>('#logout')!.onclick = async event => {
    (event.currentTarget as HTMLButtonElement).disabled = true
    try {
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
      content.innerHTML = '<p>Link your player record on the TenAceIQ website to bring your results here.</p>'
    } else {
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
        content.innerHTML = rows.length
          ? `<p>Your latest ${rows.length} connected match${rows.length === 1 ? '' : 'es'}.</p><ol class="matches">${rows.map((row, index) => `<li><div class="match-heading"><strong>${escape(matchResult(row, playerId))}</strong><span>${escape(matchDate(row.match_date))}</span></div><p>${escape(row.match_type || 'Match')} · ${escape(row.league_name || 'League unavailable')}</p><p class="score">${escape(row.score || 'Score unavailable')}</p><button class="secondary match-open" data-index="${index}" aria-label="View match details, ${escape(matchDate(row.match_date))}, ${escape(row.match_type || 'match')}">View match</button></li>`).join('')}</ol><small>Scores are shown as recorded, in the source’s court order.</small>`
          : '<p>No matches are connected to this player record yet. Results will appear here as scores are added.</p>'
        content.querySelectorAll<HTMLButtonElement>('.match-open').forEach(button => {
          button.onclick = () => details?.open(rows[Number(button.dataset.index)], playerId)
        })
      }
      void refreshResults()
    }
  }
}

client.auth.onAuthStateChange((_event, next) => {
  if (next?.user.id === session?.user.id && details?.isOpen()) { session = next; return }
  session = next
  revision++
  // Schedule outside the auth callback's lock before making another SDK call.
  setTimeout(() => { if (session) void lab(); else login() }, 0)
})
client.auth.getSession().catch(() => {
  app.dataset.state = 'storage-error'
  app.innerHTML = '<h1>Couldn’t open your account</h1><p role="alert">Close the app and try again. Secure sign-in storage is unavailable.</p>'
})
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible') { client.auth.startAutoRefresh(); if (session && !details?.isOpen()) void lab() }
  else client.auth.stopAutoRefresh()
})
window.addEventListener('online', () => { if (session && !details?.isOpen()) void lab() })

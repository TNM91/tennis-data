import {PRODUCT_MOTTO} from '../../lib/product-story'
import websiteUi from '../generated/website-ui.json'
import {accountLinksHtml} from './account-actions'
import {html} from './match-details'

const storageNotice='<p role="alert">Secure sign-in storage is unavailable. Close the app and try again. You can still explore public tennis.</p>'
const biometricEntry='<div class="biometric-login"></div>'

export function welcomeHtml(storageUnavailable:boolean){
 return `<div class="native-welcome">
  <div class="native-entry-hero tab-hero tab-hero-court">
   <small class="stat-eyebrow">Tennis intelligence</small>
   <h1 tabindex="-1">${html(PRODUCT_MOTTO)}</h1>
   <p>Track your game. Find your next match.</p>
  </div>
  <div class="native-entry-list">
   <button type="button" class="secondary app-tool native-entry-featured" id="browse-public" aria-labelledby="welcome-explore-title" aria-describedby="welcome-explore-detail">
    <span class="app-tool-icon" aria-hidden="true">${websiteUi.icons.explore}</span>
    <span class="app-tool-copy"><strong id="welcome-explore-title">Explore without signing in</strong><span id="welcome-explore-detail">Players, teams, leagues and TIQ rankings</span></span>
    <span aria-hidden="true">›</span>
   </button>
   ${storageUnavailable?storageNotice:`<button type="button" class="secondary app-tool" id="welcome-signin" aria-labelledby="welcome-account-title" aria-describedby="welcome-account-detail">
    <span class="app-tool-icon" aria-hidden="true">${websiteUi.icons.account}</span>
    <span class="app-tool-copy"><strong id="welcome-account-title">Sign in or join</strong><span id="welcome-account-detail">My Lab, chats and coaching</span></span>
    <span aria-hidden="true">›</span>
   </button>${biometricEntry}`}
  </div>
  ${accountLinksHtml}
 </div>`
}

export function signInHtml(storageUnavailable:boolean,message:string,email:string){
 return `<div class="native-welcome">
  <button type="button" class="secondary native-entry-back" id="welcome-back"><span aria-hidden="true">‹</span> Welcome</button>
  <div class="welcome-account">
   <h1 tabindex="-1">Sign in to TenAceIQ</h1>
   ${storageUnavailable?storageNotice:`<p>Pick up with My Lab and your chats.</p>
    ${biometricEntry}
    <button type="button" class="secondary" id="email-sign-in">Create account or use an email code</button>
    <p class="welcome-password-label">Or sign in with your password</p>
    <form>
     <label>Email<input type="email" name="email" autocomplete="username" required value="${html(email)}"></label>
     <label>Password<input type="password" name="password" autocomplete="current-password" required></label>
     <p role="alert" tabindex="-1">${html(message)}</p>
     <button type="submit">Sign in</button>
    </form>
    <button type="button" class="secondary" id="forgot-password">Forgot password?</button>`}
  </div>
  ${accountLinksHtml}
 </div>`
}

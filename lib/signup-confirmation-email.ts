import { MEMBERSHIP_TIERS, type MembershipTierId } from '@/lib/product-story'
import { CAPTAIN_PILOT_PRICE_LABEL } from '@/lib/captain-pilot'

export type SignupEmailIntent = MembershipTierId | 'captain-pilot'

type SignupConfirmationEmailInput = {
  intent: SignupEmailIntent
  firstName?: string
  confirmationUrl: string
}

type EmailStory = {
  eyebrow: string
  title: string
  lead: string
  steps: string[]
  cta: string
  note: string
}

const EMAIL_STORIES: Record<SignupEmailIntent, EmailStory> = {
  free: {
    eyebrow: 'Your tennis starting point',
    title: 'Welcome to TenAceiQ.',
    lead: 'Your free account puts players, teams, leagues, rankings, and public tennis context in one clear place.',
    steps: [
      'Confirm your email to open your account.',
      'Explore the tennis landscape at your own pace.',
      'Add Player, Captain, Coach, League, or Full-Court only when the right tennis need calls for it.',
    ],
    cta: 'Confirm my free account',
    note: 'Free access is yours to explore. There is no card and no surprise upgrade.',
  },
  player_plus: {
    eyebrow: 'Your Player path',
    title: 'Your game deserves a clearer plan.',
    lead: 'You are starting with a free TenAceiQ account. Once confirmed, activate Player to make My Lab, matchup preparation, development tools, and follows work around your tennis.',
    steps: [
      'Confirm your email and sign in.',
      'Activate Player when you are ready.',
      'Open My Lab and focus on the next useful step for your game.',
    ],
    cta: 'Confirm and continue to Player',
    note: 'Account confirmation starts Free access. Player tools unlock only after you activate the plan.',
  },
  coach: {
    eyebrow: 'Your Coach path',
    title: 'Give every player a better next step.',
    lead: 'You are starting with a free TenAceiQ account. Once confirmed, activate Coach to open Coach Hub for planning, assignments, player development, and communication.',
    steps: [
      'Confirm your email and sign in.',
      'Activate Coach when you are ready.',
      'Build the next lesson, drill, or follow-through moment with more context.',
    ],
    cta: 'Confirm and continue to Coach',
    note: 'Account confirmation starts Free access. Coach tools unlock only after you activate the plan.',
  },
  captain: {
    eyebrow: 'Your Captain path',
    title: 'Make match week feel more manageable.',
    lead: 'You are starting with a free TenAceiQ account. Once confirmed, activate Captain to open Team Hub for availability, lineups, scouting, readiness, and team decisions.',
    steps: [
      'Confirm your email and sign in.',
      'Activate Captain when you are ready.',
      'Bring the next team decision into clearer view.',
    ],
    cta: 'Confirm and continue to Captain',
    note: 'Account confirmation starts Free access. Captain tools unlock only after you activate the plan.',
  },
  league: {
    eyebrow: 'Your League path',
    title: 'Run the season with less admin work.',
    lead: 'You are starting with a free TenAceiQ account. Once confirmed, activate League to open League Office for setup, schedules, scores, standings, and organizer follow-through.',
    steps: [
      'Confirm your email and sign in.',
      'Activate League when you are ready.',
      'Give every player and team a clearer view of the season.',
    ],
    cta: 'Confirm and continue to League',
    note: 'Account confirmation starts Free access. League tools unlock only after you activate the plan.',
  },
  full_court: {
    eyebrow: 'Your Full-Court path',
    title: 'One connected view of your tennis world.',
    lead: 'You are starting with a free TenAceiQ account. Once confirmed, activate Full-Court to connect My Lab, Coach Hub, Team Hub, League Office, and Tournament Desk.',
    steps: [
      'Confirm your email and sign in.',
      'Activate Full-Court when you are ready.',
      'Support players, teams, leagues, and events from one place.',
    ],
    cta: 'Confirm and continue to Full-Court',
    note: 'Account confirmation starts Free access. Full-Court tools unlock only after you activate the plan.',
  },
  'captain-pilot': {
    eyebrow: 'Fall Captain Pilot',
    title: 'Welcome to the captain’s chair.',
    lead: `Your Captain Pilot starts with three months at $0, then renews at ${CAPTAIN_PILOT_PRICE_LABEL} until canceled. Confirm your account, then tell us about your team and complete secure checkout to activate the pilot.`,
    steps: [
      'Confirm your email and sign in.',
      'Complete the short Captain Pilot form.',
      'Add payment details to activate three months of Captain at $0. You will not be charged today.',
    ],
    cta: 'Confirm and start my Captain Pilot',
    note: `Captain access begins only after the Pilot form and secure checkout are complete. You will not be charged during the three-month pilot; continued Captain access renews at ${CAPTAIN_PILOT_PRICE_LABEL} until canceled. We are building this with local captains and your feedback matters.`,
  },
}

export function isSignupEmailIntent(value: unknown): value is SignupEmailIntent {
  return value === 'captain-pilot' || (typeof value === 'string' && value in MEMBERSHIP_TIERS)
}

export function buildSignupConfirmationEmail({ intent, firstName, confirmationUrl }: SignupConfirmationEmailInput) {
  const story = EMAIL_STORIES[intent]
  const greeting = cleanFirstName(firstName)
  const title = greeting ? personalizeTitle(story.title, greeting, intent) : story.title
  const steps = story.steps
    .map((step, index) => `
      <tr>
        <td valign="top" style="padding:0 12px 12px 0;">
          <div style="width:24px;height:24px;line-height:24px;border-radius:12px;background:#9BE11D;color:#06172F;font-family:Arial,Helvetica,sans-serif;font-size:12px;font-weight:800;text-align:center;">${index + 1}</div>
        </td>
        <td valign="top" style="padding:2px 0 12px;color:#31415C;font-family:Arial,Helvetica,sans-serif;font-size:15px;line-height:22px;">${escapeHtml(step)}</td>
      </tr>`)
    .join('')

  return `<!doctype html>
<html lang="en">
  <head>
    <meta http-equiv="Content-Type" content="text/html; charset=UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>${escapeHtml(title)}</title>
  </head>
  <body style="margin:0;padding:0;background:#EEF3F8;">
    <span style="display:none!important;visibility:hidden;opacity:0;color:transparent;height:0;width:0;overflow:hidden;">${escapeHtml(story.lead)}</span>
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background:#EEF3F8;margin:0;padding:0;width:100%;">
      <tr><td align="center" style="padding:28px 12px 38px;">
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="max-width:600px;background:#FFFFFF;border:1px solid #D7E0EC;border-radius:18px;overflow:hidden;">
          <tr><td style="padding:28px 34px 26px;background:#06172F;border-bottom:4px solid #9BE11D;">
            <img src="https://www.tenaceiq.com/brand/web/header-logo-transparent.png" width="190" alt="TenAceiQ" style="display:block;width:190px;max-width:100%;height:auto;border:0;outline:none;text-decoration:none;" />
          </td></tr>
          <tr><td style="padding:32px 34px 8px;">
            <div style="margin:0 0 12px;color:#639C0A;font-family:Arial,Helvetica,sans-serif;font-size:11px;font-weight:800;letter-spacing:1.8px;text-transform:uppercase;">${escapeHtml(story.eyebrow)}</div>
            <h1 style="margin:0;color:#06172F;font-family:Arial,Helvetica,sans-serif;font-size:31px;line-height:37px;font-weight:800;letter-spacing:-0.7px;">${escapeHtml(title)}</h1>
            <p style="margin:16px 0 0;color:#31415C;font-family:Arial,Helvetica,sans-serif;font-size:16px;line-height:24px;">${escapeHtml(story.lead)}</p>
          </td></tr>
          <tr><td style="padding:24px 34px 10px;">
            <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background:#F6FAEF;border:1px solid #DDECC3;border-radius:12px;"><tr><td style="padding:18px 18px 6px;">
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">${steps}</table>
            </td></tr></table>
          </td></tr>
          <tr><td align="center" style="padding:20px 34px 10px;">
            <a href="${escapeAttribute(confirmationUrl)}" style="display:inline-block;background:#9BE11D;border:1px solid #8BCE13;border-radius:10px;color:#06172F;font-family:Arial,Helvetica,sans-serif;font-size:16px;font-weight:800;line-height:20px;padding:15px 24px;text-align:center;text-decoration:none;">${escapeHtml(story.cta)}</a>
          </td></tr>
          <tr><td style="padding:12px 34px 30px;">
            <p style="margin:0;color:#66758C;font-family:Arial,Helvetica,sans-serif;font-size:12px;line-height:18px;text-align:center;">${escapeHtml(story.note)}</p>
          </td></tr>
          <tr><td style="padding:20px 34px;background:#F7F9FC;border-top:1px solid #E1E7F0;">
            <p style="margin:0;color:#66758C;font-family:Arial,Helvetica,sans-serif;font-size:12px;line-height:18px;text-align:center;">More Tennis. Less Chaos.<br />Questions or feedback? <a href="mailto:Nathan@TenAceiQ.com" style="color:#315C05;text-decoration:underline;">Nathan@TenAceiQ.com</a></p>
          </td></tr>
        </table>
      </td></tr>
    </table>
  </body>
</html>`
}

function cleanFirstName(value: string | undefined) {
  return value?.replace(/\s+/g, ' ').trim().slice(0, 60) ?? ''
}

function personalizeTitle(title: string, firstName: string, intent: SignupEmailIntent) {
  if (intent === 'captain-pilot') return `Welcome, ${firstName}. Your captain’s chair is ready.`
  if (title.startsWith('Welcome')) return `Welcome, ${firstName}.`
  return `${firstName}, ${title.charAt(0).toLowerCase()}${title.slice(1)}`
}

function escapeHtml(value: string) {
  return value.replace(/[&<>"']/g, (character) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;',
  })[character] ?? character)
}

function escapeAttribute(value: string) {
  return escapeHtml(value)
}

import { CapacitorHttp } from '@capacitor/core'
import type { SupabaseClient } from '@supabase/supabase-js'
import { formatCalendarDay } from '../../lib/calendar-date'
import { formatCaptainPracticeTime } from '../../lib/captain-practice-invite'
import { readReminderTime, type LeagueAttentionRow } from '../../lib/native-league-attention-contract'
import type { OfficeFixture } from '../../lib/native-league-office-contract'
import { scenarioOwner, type ScenarioSend } from './captain-scenarios-data'
import { competitionOpponentsHtml, competitionScheduleJumpHtml } from './competition-match-card'
import { html } from './match-details'

const needsCorrection = (row: LeagueAttentionRow) => row.revision !== null
const reasonLabel = (row: LeagueAttentionRow) => needsCorrection(row) ? 'Correction outstanding' : 'Score missing'

function reminderTime(value: string, timeZone: string) {
  return new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short', timeZone }).format(new Date(value))
}

export function showLeagueReminderCooldown(button: HTMLButtonElement, nextReminderAt: string, timeZone: string) {
  button.disabled = true
  const feedback = button.parentElement?.querySelector('[data-reminder-status]')
  if (feedback) feedback.textContent = 'Remind again after ' + reminderTime(nextReminderAt, timeZone) + '.'
}

export function leagueScoreReminderHtml(row: LeagueAttentionRow, fixture: OfficeFixture, timeZone: string) {
  const nextReminder = row.nextReminderAt && Date.parse(row.nextReminderAt) > Date.now() ? row.nextReminderAt : null
  return `<div class="competition-attention-action">
    <button type="button" class="secondary" data-competition-score-remind="${html(row.id)}" ${nextReminder ? 'disabled' : ''}>
      ${needsCorrection(row) ? 'Remind captain' : 'Remind captains'}<span class="sr-only"> for ${html(fixture.a)} vs ${html(fixture.b)}</span>
    </button>
    <p role="status" data-reminder-status>${nextReminder ? html('Remind again after ' + reminderTime(nextReminder, timeZone) + '.') : ''}</p>
  </div>`
}

export function leagueAttentionHtml(rows: LeagueAttentionRow[], fixtures: ReadonlyMap<string, OfficeFixture>, timeZone: string, moreFixtures: boolean) {
  const cards = rows.flatMap(row => {
    const fixture = fixtures.get(row.id)
    if (!fixture) return []
    const match = [formatCalendarDay(fixture.date), formatCaptainPracticeTime(fixture.time.slice(0, 5)), fixture.facility].filter(Boolean).join(' · ')
    return [`<li><article class="competition-fixture competition-attention-card">
      <p class="competition-attention-reason">${reasonLabel(row)}</p>
      ${competitionOpponentsHtml(fixture.a, fixture.b)}
      <p class="fixture-schedule-date">${html(match)}</p>
      ${needsCorrection(row) ? `<p class="competition-attention-note"><small>Returned ${html(reminderTime(row.since, timeZone))}</small>${html(row.note)}</p>` : ''}
      <div class="competition-attention-controls">
        ${leagueScoreReminderHtml(row, fixture, timeZone)}
        ${needsCorrection(row) ? `<button type="button" class="secondary" data-attention-scorecard="${html(row.id)}">Open scorecard<span class="sr-only"> for ${html(fixture.a)} vs ${html(fixture.b)}</span></button>` :
          competitionScheduleJumpHtml(row.id, `${fixture.a} vs ${fixture.b}`, 'View match')}
      </div>
    </article></li>`]
  })
  return `<section class="competition-attention" aria-label="Needs attention">
    <h3>Needs attention</h3>
    ${cards.length ? `<ol role="list">${cards.join('')}</ol>` :
      `<p>No missing scores or open corrections${moreFixtures ? ' in the loaded matches' : ''}.</p>`}
    ${cards.length && moreFixtures ? '<p class="rating-context">Showing follow-ups from the loaded schedule.</p>' : ''}
  </section>`
}

export async function remindLeagueCaptains(client: SupabaseClient, owner: string, current: () => boolean,
  leagueId: string, row: LeagueAttentionRow, button: HTMLButtonElement, timeZone: string,
  saveCooldown: (nextReminderAt: string) => void, send: ScenarioSend = request => CapacitorHttp.request(request)) {
  const feedback = button.parentElement?.querySelector('[data-reminder-status]')
  if (button.disabled || !feedback || !current()) return
  button.disabled = true
  feedback.textContent = 'Sending reminder…'
  let keepDisabled = false
  try {
    const session = await scenarioOwner(client, owner, current)
    const response = await send({
      url: 'https://www.tenaceiq.com/api/mobile/first-party/competitions/scores',
      method: 'POST',
      headers: { Authorization: 'Bearer ' + session.access_token, 'Content-Type': 'application/json',
        'Cache-Control': 'no-store', 'X-TenAceIQ-League-Score': '2' },
      data: { action: 'remind', leagueId, matchId: row.id, revision: row.revision, fixtureDigest: row.fixtureDigest },
      disableRedirects: true, responseType: 'json', webFetchExtra: { cache: 'no-store' }, connectTimeout: 12000, readTimeout: 30000,
    })
    await scenarioOwner(client, owner, current)
    const result = response.data
    if (result?.releaseScope !== 'first-party') throw Error()
    if (response.status === 403 || response.status === 409) {
      keepDisabled = true
      feedback.textContent = typeof result.message === 'string' ? result.message : 'Refresh the league before sending a reminder.'
      return
    }
    if (response.status !== 200 || result.ok !== true ||
        result.owner !== owner || result.leagueId !== leagueId || result.matchId !== row.id) throw Error()
    if (result.code === 'no_captains') {
      feedback.textContent = 'No eligible captains could be reached for this match.'
      return
    }
    if (result.code !== 'recent' && (result.code !== 'sent' || !Number.isSafeInteger(result.count) || result.count < 1)) throw Error()
    const nextReminderAt = readReminderTime(result.nextReminderAt)
    saveCooldown(nextReminderAt)
    keepDisabled = true
    feedback.textContent = result.code === 'recent'
      ? 'Already sent. Remind again after ' + reminderTime(nextReminderAt, timeZone) + '.'
      : result.count === 1 ? 'Reminder sent to 1 captain.' : `Reminder sent to ${result.count} captains.`
  } catch {
    if (current()) feedback.textContent = 'The reminder couldn’t be confirmed. Try again.'
  } finally {
    button.disabled = keepDisabled
  }
}

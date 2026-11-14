import { formatCalendarDay } from '../../lib/calendar-date'
import { tournamentDraftFormats, type TournamentDraft } from '../../lib/native-tournament-draft-contract'
import {
  initialTournamentSettings, maxTournamentDivisions, tournamentTimeZones,
  type NativeTournamentSetup, type TournamentSettings,
} from '../../lib/native-tournament-setup-contract'
import { html } from './match-details'

function timeZoneLabel(zone: string) {
  return tournamentTimeZones[zone as keyof typeof tournamentTimeZones] ?? zone
}

export function tournamentSetupSummary(setup: NativeTournamentSetup) {
  const settings = setup.settings ?? initialTournamentSettings(setup)
  return `<p>${html(formatCalendarDay(setup.draft.date))} · ${html(setup.draft.venue)}</p>
    <section class="entry-receipts" aria-label="Tournament registration"><article>
      <strong>Registration</strong>
      <p>${setup.settings
        ? `Closes ${html(formatCalendarDay(settings.registrationClosesOn))} · ${html(timeZoneLabel(settings.timeZone))} time`
        : 'Set the entry deadline and time zone.'}</p>
    </article></section>
    <section class="entry-receipts" aria-label="Tournament divisions">
      ${settings.divisions.map(division => `<article>
        <strong>${html(division.name)}</strong>
        <p>${division.discipline === 'singles' ? 'Singles' : 'Doubles'} · ${tournamentDraftFormats[division.format]}</p>
      </article>`).join('')}
    </section>
    <button type="button" data-setup-edit>Edit divisions and registration</button>`
}

export function tournamentSetupFields(settings: TournamentSettings, eventDate: string, disabled: boolean) {
  const zones: [string, string][] = Object.entries(tournamentTimeZones)
  if (settings.timeZone && !Object.hasOwn(tournamentTimeZones, settings.timeZone)) {
    zones.push([settings.timeZone, settings.timeZone])
  }
  return `<fieldset class="entry-fields"${disabled ? ' disabled' : ''}><legend>Registration</legend>
    <label>Entry deadline<input name="registrationClosesOn" type="date" required max="${eventDate}" value="${html(settings.registrationClosesOn)}"></label>
    <label>Tournament time zone<select name="timeZone" required>
      <option value="">Choose a time zone</option>
      ${zones.map(([zone, label]) => `<option value="${html(zone)}"${zone === settings.timeZone ? ' selected' : ''}>${html(label)}</option>`).join('')}
    </select></label>
  </fieldset>
  ${settings.divisions.map((division, index) => `<fieldset class="entry-fields"${disabled ? ' disabled' : ''}>
    <legend>Division ${index + 1}</legend>
    <label>Division name<input name="name-${index}" required maxlength="80" value="${html(division.name)}"></label>
    <label>Entry type<select name="discipline-${index}">
      <option value="singles">Singles</option>
      <option value="doubles"${division.discipline === 'doubles' ? ' selected' : ''}>Doubles</option>
    </select></label>
    <label>Draw format<select name="format-${index}">
      ${Object.entries(tournamentDraftFormats).map(([value, label]) =>
        `<option value="${value}"${value === division.format ? ' selected' : ''}>${label}</option>`).join('')}
    </select></label>
    ${settings.divisions.length > 1 ? `<button type="button" class="secondary" data-remove-division="${index}">Remove division ${index + 1}</button>` : ''}
  </fieldset>`).join('')}
  ${disabled ? '' : `
    ${settings.divisions.length < maxTournamentDivisions ? '<button type="button" class="secondary" data-add-division>Add division</button>' : ''}
    <button type="submit">Save tournament settings</button>
  `}`
}

export function readTournamentSetupFields(form: HTMLFormElement, settings: TournamentSettings): TournamentSettings {
  const fields = new FormData(form)
  return {
    registrationClosesOn: String(fields.get('registrationClosesOn') ?? ''),
    timeZone: String(fields.get('timeZone') ?? ''),
    divisions: settings.divisions.map((division, index) => ({
      id: division.id,
      name: String(fields.get('name-' + index) ?? ''),
      discipline: fields.get('discipline-' + index) as TournamentDraft['discipline'],
      format: fields.get('format-' + index) as TournamentDraft['format'],
    })),
  }
}

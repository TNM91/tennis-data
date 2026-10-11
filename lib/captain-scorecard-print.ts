import { normalizeTeamName, normalizeUstaRosterTeamName } from '@/lib/captain-formatters'

export type ScorecardRosterRow = {
  team_name?: string | null
  normalized_team_name?: string | null
  player_name?: string | null
  league_name?: string | null
  flight?: string | null
}

export function getScorecardRosterNames(rows: ScorecardRosterRow[], scope: { team: string; league: string; flight: string }) {
  const key = (value: string | null | undefined) => (value || '').trim().replace(/\s+/g, ' ').toLowerCase()
  if (!key(scope.team) || !key(scope.league) || !key(scope.flight)) return []
  const scoped = rows.filter((row) => key(row.league_name) === key(scope.league) && key(row.flight) === key(scope.flight))
  const exact = scoped.filter((row) => normalizeTeamName(row.team_name || row.normalized_team_name) === normalizeTeamName(scope.team))
  // A schedule-only suffix may be omitted in the imported roster. Never merge
  // two explicitly suffixed teams, or use unrelated opponents/history.
  const matches = exact.length ? exact : scoped.filter((row) => {
    const name = row.team_name || row.normalized_team_name || ''
    return !/\([a-z]\)\s*$/i.test(name) && normalizeUstaRosterTeamName(name) === normalizeUstaRosterTeamName(scope.team)
  })
  const names = new Map<string, string>()
  for (const row of matches) {
    const name = (row.player_name || '').trim().replace(/\s+/g, ' ')
    if (name && !names.has(key(name))) names.set(key(name), name)
  }
  return [...names.values()].sort((left, right) => left.localeCompare(right))
}

/** Fit the complete document, including long rosters, without clipping names. */
export function fitScorecardToLetterPage(document: Document) {
  const sheet = document.querySelector<HTMLElement>('.sheet')
  if (!sheet) return
  const printableWidthInches = 8
  const printableHeightPixels = 10.5 * 96 - 4
  document.body.style.width = printableWidthInches + 'in'
  sheet.style.zoom = '1'
  sheet.style.width = printableWidthInches + 'in'
  if (sheet.getBoundingClientRect().height <= printableHeightPixels) return
  let lower = 0.05
  let upper = 1
  // Maximize text size at the actual paper width, including changes in wrapping.
  for (let attempt = 0; attempt < 12; attempt += 1) {
    const scale = (lower + upper) / 2
    sheet.style.zoom = String(scale)
    sheet.style.width = printableWidthInches / scale + 'in'
    if (sheet.getBoundingClientRect().height <= printableHeightPixels) lower = scale
    else upper = scale
  }
  sheet.style.zoom = String(lower)
  sheet.style.width = printableWidthInches / lower + 'in'
}

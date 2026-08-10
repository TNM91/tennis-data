export type MatchDiscipline = 'singles' | 'doubles'

export type TeamMatchFormatId =
  | 'standard_2s_3d'
  | 'adult_18_1s_2d'
  | 'adult_40_1s_4d'
  | 'adult_40_1s_3d'
  | 'three_doubles'
  | 'four_doubles'
  | 'tri_level'
  | 'mixed_tri_level'
  | 'dominant_duo'
  | 'one_singles'
  | 'two_singles'
  | 'three_singles'
  | 'four_singles'
  | 'one_doubles'
  | 'two_doubles'
  | 'custom'

export type TeamMatchSlotTemplate = {
  discipline: MatchDiscipline
  label: string
  ratingLevel?: number
}

export type TeamMatchFormatDefinition = {
  id: TeamMatchFormatId
  label: string
  shortLabel: string
  description: string
  slots: TeamMatchSlotTemplate[]
  availableTo: Array<'usta' | 'tiq'>
  family: 'adult' | 'mixed' | 'combo' | 'tri_level' | 'team_event' | 'singles' | 'doubles' | 'custom'
}

export type ResolvedTeamMatchFormat = TeamMatchFormatDefinition & {
  inferredBy: 'explicit' | 'tri_level' | 'line_composition' | 'league_name' | 'default'
  formatKey: string
}

export type TournamentDrawFormatId =
  | 'single_elimination'
  | 'round_robin'
  | 'round_robin_first_match_consolation'
  | 'modified_feed_in_consolation'
  | 'compass_draw'
  | 'voluntary_consolation'
  | 'first_match_consolation'
  | 'team_tournament'
  | 'feed_in_consolation'
  | 'curtis_consolation'
  | 'flighted_draw'

export type TournamentDrawFormatDefinition = {
  id: TournamentDrawFormatId
  label: string
  description: string
  structure: 'bracket' | 'round_robin' | 'consolation' | 'compass' | 'team'
}

const buildSlots = (singles: number, doubles: number): TeamMatchSlotTemplate[] => [
  ...Array.from({ length: singles }, (_, index) => ({
    discipline: 'singles' as const,
    label: `Singles ${index + 1}`,
  })),
  ...Array.from({ length: doubles }, (_, index) => ({
    discipline: 'doubles' as const,
    label: `Doubles ${index + 1}`,
  })),
]

export const TEAM_MATCH_FORMATS: readonly TeamMatchFormatDefinition[] = [
  {
    id: 'standard_2s_3d',
    label: '2 singles + 3 doubles',
    shortLabel: '2S / 3D',
    description: 'Five-line team match used by many Adult 18 & Over leagues and available for TIQ team play.',
    slots: buildSlots(2, 3),
    availableTo: ['usta', 'tiq'],
    family: 'adult',
  },
  {
    id: 'adult_18_1s_2d',
    label: '1 singles + 2 doubles',
    shortLabel: '1S / 2D',
    description: 'Three-line team match used by Adult 18 & Over 2.5 and 5.0 programs and local variants.',
    slots: buildSlots(1, 2),
    availableTo: ['usta', 'tiq'],
    family: 'adult',
  },
  {
    id: 'adult_40_1s_4d',
    label: '1 singles + 4 doubles',
    shortLabel: '1S / 4D',
    description: 'Five-line Adult 40 & Over championship format.',
    slots: buildSlots(1, 4),
    availableTo: ['usta', 'tiq'],
    family: 'adult',
  },
  {
    id: 'adult_40_1s_3d',
    label: '1 singles + 3 doubles',
    shortLabel: '1S / 3D',
    description: 'Four-line Adult 40 & Over and local team format.',
    slots: buildSlots(1, 3),
    availableTo: ['usta', 'tiq'],
    family: 'adult',
  },
  {
    id: 'three_doubles',
    label: '3 doubles',
    shortLabel: '3D',
    description: 'Three doubles lines for Mixed, Combo, Adult 55/65 & Over, and doubles-only TIQ play.',
    slots: buildSlots(0, 3),
    availableTo: ['usta', 'tiq'],
    family: 'doubles',
  },
  {
    id: 'four_doubles',
    label: '4 doubles',
    shortLabel: '4D',
    description: 'Four-line doubles team match for local leagues and TIQ play.',
    slots: buildSlots(0, 4),
    availableTo: ['usta', 'tiq'],
    family: 'doubles',
  },
  {
    id: 'tri_level',
    label: 'Tri-Level',
    shortLabel: '3 rated doubles',
    description: 'Three doubles lines, one at each NTRP level named by the league or flight.',
    slots: buildSlots(0, 3),
    availableTo: ['usta', 'tiq'],
    family: 'tri_level',
  },
  {
    id: 'mixed_tri_level',
    label: 'Mixed Tri-Level',
    shortLabel: '3 mixed rated doubles',
    description: 'Three mixed doubles lines, one at each combined level named by the league or flight.',
    slots: buildSlots(0, 3),
    availableTo: ['usta', 'tiq'],
    family: 'tri_level',
  },
  {
    id: 'dominant_duo',
    label: 'Dominant Duo',
    shortLabel: '2S / 1D',
    description: 'Two singles lines and one doubles line for two-player team events.',
    slots: buildSlots(2, 1),
    availableTo: ['usta', 'tiq'],
    family: 'team_event',
  },
  ...([1, 2, 3, 4] as const).map((count): TeamMatchFormatDefinition => ({
    id: `${count === 1 ? 'one' : count === 2 ? 'two' : count === 3 ? 'three' : 'four'}_singles`,
    label: `${count} singles`,
    shortLabel: `${count}S`,
    description: `${count}-line singles team match for local, flex, club, or TIQ play.`,
    slots: buildSlots(count, 0),
    availableTo: ['usta', 'tiq'],
    family: 'singles',
  })),
  ...([1, 2] as const).map((count): TeamMatchFormatDefinition => ({
    id: `${count === 1 ? 'one' : 'two'}_doubles`,
    label: `${count} doubles`,
    shortLabel: `${count}D`,
    description: `${count}-line doubles team match for local, flex, club, or TIQ play.`,
    slots: buildSlots(0, count),
    availableTo: ['usta', 'tiq'],
    family: 'doubles',
  })),
  {
    id: 'custom',
    label: 'Custom scorecard',
    shortLabel: 'Custom',
    description: 'Start from the imported or saved scorecard and add the exact singles and doubles lines required.',
    slots: [],
    availableTo: ['usta', 'tiq'],
    family: 'custom',
  },
] as const

export const TOURNAMENT_DRAW_FORMATS: readonly TournamentDrawFormatDefinition[] = [
  { id: 'single_elimination', label: 'Single elimination', description: 'One main draw; a loss ends the entrant’s run.', structure: 'bracket' },
  { id: 'round_robin', label: 'Round robin', description: 'Entrants play through a pool or flight with standings.', structure: 'round_robin' },
  { id: 'round_robin_first_match_consolation', label: 'Round robin + first-match consolation', description: 'Round-robin play followed by a first-match consolation path.', structure: 'consolation' },
  { id: 'modified_feed_in_consolation', label: 'Modified feed-in consolation', description: 'Main-draw losses feed into a modified consolation bracket.', structure: 'consolation' },
  { id: 'compass_draw', label: 'Compass draw', description: 'Entrants move through named directions after wins and losses.', structure: 'compass' },
  { id: 'voluntary_consolation', label: 'Voluntary consolation', description: 'Eligible main-draw losers may opt into a consolation draw.', structure: 'consolation' },
  { id: 'first_match_consolation', label: 'First-match consolation', description: 'Entrants who lose their first played match enter consolation.', structure: 'consolation' },
  { id: 'team_tournament', label: 'Team tournament', description: 'Teams compete through a draw or pool using a shared team scorecard.', structure: 'team' },
  { id: 'feed_in_consolation', label: 'Feed-in consolation', description: 'Main-draw losers feed into consolation at defined rounds.', structure: 'consolation' },
  { id: 'curtis_consolation', label: 'Curtis consolation', description: 'A Curtis-style consolation path preserves additional play.', structure: 'consolation' },
  { id: 'flighted_draw', label: 'Flighted draw', description: 'Entrants are separated into ability-based draws outside a round robin.', structure: 'bracket' },
] as const

const TEAM_MATCH_FORMAT_MAP = new Map(TEAM_MATCH_FORMATS.map((format) => [format.id, format]))
const TOURNAMENT_DRAW_FORMAT_MAP = new Map(TOURNAMENT_DRAW_FORMATS.map((format) => [format.id, format]))
const RATING_PATTERN = /\b([2-9](?:\.[05])?)\b/g

export function normalizeTeamMatchFormatId(value: string | null | undefined): TeamMatchFormatId {
  const normalized = (value || '').trim().toLowerCase().replace(/[\s/-]+/g, '_')
  if (normalized === 'standard' || normalized === '2s_3d' || normalized === '2_singles_3_doubles') return 'standard_2s_3d'
  if (normalized === '1s_2d' || normalized === '1_singles_2_doubles') return 'adult_18_1s_2d'
  if (normalized === '1s_4d' || normalized === '1_singles_4_doubles') return 'adult_40_1s_4d'
  if (normalized === '1s_3d' || normalized === '1_singles_3_doubles') return 'adult_40_1s_3d'
  if (normalized === '3d' || normalized === '3_doubles') return 'three_doubles'
  if (normalized === '4d' || normalized === '4_doubles') return 'four_doubles'
  if (TEAM_MATCH_FORMAT_MAP.has(normalized as TeamMatchFormatId)) return normalized as TeamMatchFormatId
  return 'standard_2s_3d'
}

export function getTeamMatchFormatDefinition(value: string | null | undefined) {
  return TEAM_MATCH_FORMAT_MAP.get(normalizeTeamMatchFormatId(value)) || TEAM_MATCH_FORMATS[0]
}

export function getTournamentDrawFormatDefinition(value: string | null | undefined) {
  return TOURNAMENT_DRAW_FORMAT_MAP.get(normalizeTournamentDrawFormatId(value)) || TOURNAMENT_DRAW_FORMATS[0]
}

export function normalizeTournamentDrawFormatId(value: string | null | undefined): TournamentDrawFormatId {
  const normalized = (value || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
  const aliases: Partial<Record<string, TournamentDrawFormatId>> = {
    se: 'single_elimination',
    single_elim: 'single_elimination',
    rr: 'round_robin',
    rr_fmc: 'round_robin_first_match_consolation',
    rr_fmlc: 'round_robin_first_match_consolation',
    round_robin_fmc: 'round_robin_first_match_consolation',
    round_robin_fmlc: 'round_robin_first_match_consolation',
    round_robin_first_match_losers_consolation: 'round_robin_first_match_consolation',
    mfic: 'modified_feed_in_consolation',
    compass: 'compass_draw',
    vc: 'voluntary_consolation',
    fmc: 'first_match_consolation',
    fmlc: 'first_match_consolation',
    first_match_losers_consolation: 'first_match_consolation',
    team: 'team_tournament',
    fic: 'feed_in_consolation',
    feed_in: 'feed_in_consolation',
    curtis: 'curtis_consolation',
    flighted: 'flighted_draw',
  }
  if (aliases[normalized]) return aliases[normalized]
  if (TOURNAMENT_DRAW_FORMAT_MAP.has(normalized as TournamentDrawFormatId)) return normalized as TournamentDrawFormatId
  return 'single_elimination'
}

export function extractTriLevelRatings(leagueName: string, flight: string) {
  const context = `${leagueName} ${flight}`
  if (!/\btri[\s-]?level\b/i.test(context)) return []

  const ratings = Array.from(context.matchAll(RATING_PATTERN), (match) => Number(match[1]))
    .filter((rating) => Number.isFinite(rating))
    .filter((rating, index, values) => values.indexOf(rating) === index)

  return ratings.length >= 3 ? ratings.slice(-3).sort((left, right) => left - right) : []
}

function extractLineComposition(context: string) {
  const singles = extractLineCount(context, 'singles?', 's')
  const doubles = extractLineCount(context, 'doubles?', 'd')
  return singles !== null || doubles !== null
    ? { singles: singles || 0, doubles: doubles || 0 }
    : null
}

function extractLineCount(context: string, word: string, abbreviation: string) {
  const match = context.match(new RegExp(`\\b([1-9])\\s*(?:${word}|${abbreviation})(?:\\b|(?=\\s*[/+&]))`, 'i'))
  return match ? Number(match[1]) : null
}

function getFormatIdForComposition(singles: number, doubles: number): TeamMatchFormatId | null {
  return TEAM_MATCH_FORMATS.find((format) => {
    if (format.id === 'tri_level' || format.id === 'mixed_tri_level' || format.id === 'custom') return false
    return format.slots.filter((slot) => slot.discipline === 'singles').length === singles &&
      format.slots.filter((slot) => slot.discipline === 'doubles').length === doubles
  })?.id || null
}

function buildCustomCompositionDefinition(singles: number, doubles: number): TeamMatchFormatDefinition {
  return {
    ...getTeamMatchFormatDefinition('custom'),
    label: `${singles ? `${singles} singles` : ''}${singles && doubles ? ' + ' : ''}${doubles ? `${doubles} doubles` : ''}`,
    shortLabel: `${singles}S / ${doubles}D`,
    description: 'Line composition detected from the league, flight, schedule, or scorecard name.',
    slots: buildSlots(singles, doubles),
  }
}

function buildTriLevelDefinition(id: 'tri_level' | 'mixed_tri_level', ratings: number[]): TeamMatchFormatDefinition {
  const base = getTeamMatchFormatDefinition(id)
  return {
    ...base,
    slots: Array.from({ length: 3 }, (_, index) => ({
      discipline: 'doubles' as const,
      label: typeof ratings[index] === 'number'
        ? `${ratings[index].toFixed(1)} ${id === 'mixed_tri_level' ? 'Mixed Doubles' : 'Doubles'}`
        : `${id === 'mixed_tri_level' ? 'Mixed ' : ''}Level ${index + 1} Doubles`,
      ...(typeof ratings[index] === 'number' ? { ratingLevel: ratings[index] } : {}),
    })),
  }
}

export function resolveTeamMatchFormat(input: {
  leagueName?: string | null
  flight?: string | null
  explicitFormatId?: string | null
}): ResolvedTeamMatchFormat {
  const leagueName = (input.leagueName || '').trim()
  const flight = (input.flight || '').trim()
  const context = `${leagueName} ${flight}`.trim()
  const explicitRaw = (input.explicitFormatId || '').trim()

  if (explicitRaw && explicitRaw !== 'auto') {
    const explicitId = normalizeTeamMatchFormatId(explicitRaw)
    const ratings = extractTriLevelRatings(leagueName, flight)
    const definition = explicitId === 'tri_level' || explicitId === 'mixed_tri_level'
      ? buildTriLevelDefinition(explicitId, ratings)
      : getTeamMatchFormatDefinition(explicitId)
    const formatKey = explicitId === 'tri_level' || explicitId === 'mixed_tri_level'
      ? `${explicitId === 'mixed_tri_level' ? 'mixed-tri-level' : 'tri-level'}:${definition.slots.map((slot) => slot.ratingLevel ?? slot.label).join('/')}`
      : `${definition.id}:${definition.slots.map((slot) => `${slot.discipline}:${slot.label}`).join('|')}`
    return { ...definition, inferredBy: 'explicit', formatKey }
  }

  if (/\btri[\s-]?level\b/i.test(context)) {
    const id = /\bmixed\b/i.test(context) ? 'mixed_tri_level' : 'tri_level'
    const definition = buildTriLevelDefinition(id, extractTriLevelRatings(leagueName, flight))
    return { ...definition, inferredBy: 'tri_level', formatKey: `${id === 'mixed_tri_level' ? 'mixed-tri-level' : 'tri-level'}:${definition.slots.map((slot) => slot.ratingLevel ?? slot.label).join('/')}` }
  }

  const composition = extractLineComposition(context)
  if (composition && composition.singles + composition.doubles > 0) {
    const knownId = getFormatIdForComposition(composition.singles, composition.doubles)
    const definition = knownId
      ? getTeamMatchFormatDefinition(knownId)
      : buildCustomCompositionDefinition(composition.singles, composition.doubles)
    return { ...definition, inferredBy: 'line_composition', formatKey: `${definition.id}:${composition.singles}s:${composition.doubles}d` }
  }

  let inferredId: TeamMatchFormatId | null = null
  if (/\bdominant\s+duo\b/i.test(context)) inferredId = 'dominant_duo'
  else if (/\b(?:one|flex)\b[^\n]{0,40}\b(?:mixed\s+)?doubles\b/i.test(context)) inferredId = 'one_doubles'
  else if (/\b(mixed|combo|55\s*&?\s*over|65\s*&?\s*over|70\s*&?\s*over|75\s*&?\s*over)\b/i.test(context)) inferredId = 'three_doubles'
  else if (/\b(adult\s*)?40\s*&?\s*over\b/i.test(context) && /\b4[\s-]*line\b/i.test(context)) inferredId = 'adult_40_1s_3d'
  else if (/\b(adult\s*)?40\s*&?\s*over\b/i.test(context)) inferredId = 'adult_40_1s_4d'
  else if (/\b(adult\s*)?18\s*&?\s*over\b/i.test(context) && /\b3[\s-]*line\b/i.test(context)) inferredId = 'adult_18_1s_2d'
  else if (/\b(adult\s*)?18\s*&?\s*over\b/i.test(context) && /\b(2\.5|5\.0)\b/.test(flight)) inferredId = 'adult_18_1s_2d'
  else if (/\b(adult\s*)?18\s*&?\s*over\b/i.test(context)) inferredId = 'standard_2s_3d'
  else if (/\bsingles(?:\s+league)?\b/i.test(context)) inferredId = 'one_singles'
  else if (/\bdoubles(?:\s+league)?\b/i.test(context)) inferredId = 'three_doubles'

  const definition = getTeamMatchFormatDefinition(inferredId || 'standard_2s_3d')
  return {
    ...definition,
    inferredBy: inferredId ? 'league_name' : 'default',
    formatKey: definition.id,
  }
}

export function getTeamMatchFormatSummary(format: Pick<TeamMatchFormatDefinition, 'slots' | 'shortLabel'>) {
  const singles = format.slots.filter((slot) => slot.discipline === 'singles').length
  const doubles = format.slots.filter((slot) => slot.discipline === 'doubles').length
  const players = singles + doubles * 2
  return {
    singles,
    doubles,
    courts: singles + doubles,
    players,
    label: format.shortLabel,
  }
}

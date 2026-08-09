import {
  getTeamMatchFormatSummary,
  resolveTeamMatchFormat,
  type TeamMatchFormatId,
  type TournamentDrawFormatId,
} from './competition-format-registry'
import { inferLeagueAgeDivision } from './player-eligibility'

export type CompetitionRatingRule =
  | 'open'
  | 'straight_level'
  | 'combined_level'
  | 'rated_lines'
  | 'combined_rated_lines'
  | 'local_rules'

export type CompetitionEligibilityOverride = 'auto' | CompetitionRatingRule
export type CompetitionMixedPairOverride = 'auto' | 'required' | 'not_required'
export type CompetitionStandingsRule = 'auto' | 'match_wins' | 'line_wins' | 'points'

export type TeamCompetitionRulesOverride = {
  eligibilityRule: CompetitionEligibilityOverride
  competitionLevel: number | null
  mixedPairRule: CompetitionMixedPairOverride
  maxPartnerRatingGap: 'auto' | 'none' | number
  standingsRule: CompetitionStandingsRule
  notes: string
}

export const DEFAULT_TEAM_COMPETITION_RULES_OVERRIDE: TeamCompetitionRulesOverride = {
  eligibilityRule: 'auto',
  competitionLevel: null,
  mixedPairRule: 'auto',
  maxPartnerRatingGap: 'auto',
  standingsRule: 'auto',
  notes: '',
}

export type TeamCompetitionRules = {
  formatId: TeamMatchFormatId
  formatLabel: string
  courts: number
  players: number
  competitionLevel: number | null
  ageDivision: string | null
  minimumPlayerRating: number | null
  ratingRule: CompetitionRatingRule
  requiresMixedPair: boolean
  maxPartnerRatingGap: number | null
  eligibilityTitle: string
  eligibilityDetail: string
  scoringTitle: string
  scoringDetail: string
  teamResultDetail: string
  standingsDetail: string
  standingsRule: Exclude<CompetitionStandingsRule, 'auto'>
  rulesNotes: string
  localRulesApply: boolean
}

const LEVEL_PATTERN = /\b((?:10|[2-9])\.[05])\b/

function cleanText(value: string | null | undefined) {
  return (value || '').replace(/\s+/g, ' ').trim()
}

function normalizeHalfPoint(value: unknown, minimum: number, maximum: number) {
  const parsed = typeof value === 'number' ? value : Number.parseFloat(String(value ?? ''))
  if (!Number.isFinite(parsed)) return null
  return Math.min(maximum, Math.max(minimum, Math.round(parsed * 2) / 2))
}

export function normalizeTeamCompetitionRulesOverride(value: unknown): TeamCompetitionRulesOverride {
  const input = value && typeof value === 'object' ? value as Record<string, unknown> : {}
  const eligibilityRule = [
    'open',
    'straight_level',
    'combined_level',
    'rated_lines',
    'combined_rated_lines',
    'local_rules',
  ].includes(String(input.eligibilityRule))
    ? input.eligibilityRule as CompetitionRatingRule
    : 'auto'
  const mixedPairRule = input.mixedPairRule === 'required' || input.mixedPairRule === 'not_required'
    ? input.mixedPairRule
    : 'auto'
  const standingsRule = input.standingsRule === 'match_wins' || input.standingsRule === 'line_wins' || input.standingsRule === 'points'
    ? input.standingsRule
    : 'auto'
  const rawGap = input.maxPartnerRatingGap
  const maxPartnerRatingGap = rawGap === 'none'
    ? 'none'
    : normalizeHalfPoint(rawGap, 0.5, 3) ?? 'auto'

  return {
    eligibilityRule,
    competitionLevel: normalizeHalfPoint(input.competitionLevel, 1, 10),
    mixedPairRule,
    maxPartnerRatingGap,
    standingsRule,
    notes: cleanText(typeof input.notes === 'string' ? input.notes : '').slice(0, 1000),
  }
}

export function hasTeamCompetitionRulesOverride(value: TeamCompetitionRulesOverride) {
  return value.eligibilityRule !== 'auto' ||
    value.competitionLevel !== null ||
    value.mixedPairRule !== 'auto' ||
    value.maxPartnerRatingGap !== 'auto' ||
    value.standingsRule !== 'auto' ||
    Boolean(value.notes)
}

export function extractCompetitionLevel(leagueName: string | null | undefined, flight: string | null | undefined) {
  const flightMatch = cleanText(flight).match(LEVEL_PATTERN)
  const leagueMatch = cleanText(leagueName).match(LEVEL_PATTERN)
  const levelText = flightMatch?.[1] || leagueMatch?.[1]
  if (!levelText) return null
  const parsed = Number(levelText)
  return Number.isFinite(parsed) ? parsed : null
}

function formatLevel(level: number | null) {
  return typeof level === 'number' ? level.toFixed(1) : 'the selected level'
}

function buildScoringDetail(scoringSystem: string | null | undefined, thirdSetRule: string | null | undefined) {
  if (scoringSystem === 'dynamic_points') {
    return {
      title: 'Dynamic points',
      detail: 'Enter a complete best-of-three score. Points reward the winner, sets won, and games won before standings update.',
    }
  }

  if (thirdSetRule === 'full_set') {
    return {
      title: 'Best of three sets',
      detail: 'Play a full third set when the first two sets split. Record the winner and every completed set.',
    }
  }

  if (thirdSetRule === 'match_tiebreak_10') {
    return {
      title: 'Best of three with match tiebreak',
      detail: 'Use a 10-point match tiebreak instead of a full third set and record it with the completed score.',
    }
  }

  return {
    title: 'Best of three sets',
    detail: 'Use the league’s published deciding-set rule: a full third set or a 10-point match tiebreak. Save that choice before play begins.',
  }
}

export function resolveTeamCompetitionRules(input: {
  leagueName?: string | null
  flight?: string | null
  explicitFormatId?: string | null
  competitionLayer?: 'usta' | 'tiq' | string | null
  scoringSystem?: string | null
  thirdSetRule?: string | null
  rulesOverride?: Partial<TeamCompetitionRulesOverride> | null
}): TeamCompetitionRules {
  const leagueName = cleanText(input.leagueName)
  const flight = cleanText(input.flight)
  const context = `${leagueName} ${flight}`.trim()
  const format = resolveTeamMatchFormat({ leagueName, flight, explicitFormatId: input.explicitFormatId })
  const summary = getTeamMatchFormatSummary(format)
  const rulesOverride = normalizeTeamCompetitionRulesOverride(input.rulesOverride)
  const competitionLevel = rulesOverride.competitionLevel ?? extractCompetitionLevel(leagueName, flight)
  const ageDivision = inferLeagueAgeDivision(leagueName, flight)
  const mixed = /\bmixed\b/i.test(context) || format.id === 'mixed_tri_level'
  const combo = /\bcombo\b/i.test(context)
  const combinedAdult = /\badult\s*(?:55|65|70|75)\s*(?:&|and)?\s*over\b/i.test(context)
  const straightLevel = typeof competitionLevel === 'number' && competitionLevel <= 5
  const combinedLevel = typeof competitionLevel === 'number' && competitionLevel >= 5.5
  const triLevel = format.id === 'tri_level'
  const mixedTriLevel = format.id === 'mixed_tri_level'

  let ratingRule: CompetitionRatingRule = 'open'
  let minimumPlayerRating: number | null = null
  let maxPartnerRatingGap: number | null = null
  let eligibilityTitle = 'Open roster'
  let eligibilityDetail = 'Use the saved roster and any local eligibility notes for this competition.'

  if (mixedTriLevel) {
    ratingRule = 'combined_rated_lines'
    maxPartnerRatingGap = 1
    eligibilityTitle = 'Mixed pair at each line level'
    eligibilityDetail = 'Each court needs one man and one woman. Their combined NTRP may not exceed that court’s level, and partners may differ by no more than 1.0.'
  } else if (triLevel) {
    ratingRule = 'rated_lines'
    eligibilityTitle = 'One pair at each NTRP level'
    eligibilityDetail = 'Each player must be eligible for the NTRP level assigned to that doubles court.'
  } else if (combo) {
    ratingRule = combinedLevel ? 'combined_level' : 'local_rules'
    maxPartnerRatingGap = combinedLevel ? 1 : null
    eligibilityTitle = combinedLevel ? `${formatLevel(competitionLevel)} combined doubles` : 'Combo eligibility'
    eligibilityDetail = combinedLevel
      ? `Each pair’s ratings may not exceed ${formatLevel(competitionLevel)} combined. Partner-level limits can vary by section, so League Office keeps local rules visible.`
      : 'Combo rules vary by section. Save the local combined level and partner limits before lineups are built.'
  } else if (mixed) {
    ratingRule = combinedLevel ? 'combined_level' : straightLevel ? 'straight_level' : 'local_rules'
    maxPartnerRatingGap = combinedLevel ? 1 : null
    minimumPlayerRating = combinedLevel && typeof competitionLevel === 'number' ? competitionLevel / 2 - 0.5 : null
    eligibilityTitle = combinedLevel ? `${formatLevel(competitionLevel)} combined mixed doubles` : 'Mixed doubles eligibility'
    eligibilityDetail = combinedLevel
      ? `Each court needs one man and one woman. Their combined NTRP may not exceed ${formatLevel(competitionLevel)}, and partners may differ by no more than 1.0.`
      : straightLevel
        ? `Each court needs one man and one woman who are eligible for the ${formatLevel(competitionLevel)} level.`
        : 'Each court needs one man and one woman. Save the league’s level rule before lineups are built.'
  } else if (combinedAdult && combinedLevel) {
    ratingRule = 'combined_level'
    maxPartnerRatingGap = 1
    minimumPlayerRating = typeof competitionLevel === 'number' ? competitionLevel / 2 - 0.5 : null
    eligibilityTitle = `${formatLevel(competitionLevel)} combined doubles`
    eligibilityDetail = `Each pair’s ratings may not exceed ${formatLevel(competitionLevel)} combined, and partners may differ by no more than 1.0.`
  } else if (straightLevel) {
    ratingRule = 'straight_level'
    eligibilityTitle = `${formatLevel(competitionLevel)} level play`
    eligibilityDetail = `Players must be eligible for the ${formatLevel(competitionLevel)} team level. Local and championship rules can differ, so published league rules remain the final check.`
  }

  if (rulesOverride.eligibilityRule !== 'auto') {
    ratingRule = rulesOverride.eligibilityRule
    minimumPlayerRating = ratingRule === 'straight_level' && typeof competitionLevel === 'number'
      ? competitionLevel - 0.5
      : minimumPlayerRating
    if (ratingRule === 'open') {
      eligibilityTitle = 'Open roster'
      eligibilityDetail = 'Any saved roster player may be selected. Age, membership, or local restrictions remain in the published rules.'
    } else if (ratingRule === 'straight_level') {
      eligibilityTitle = `${formatLevel(competitionLevel)} level play`
      eligibilityDetail = `Players must be eligible for the saved ${formatLevel(competitionLevel)} level.`
    } else if (ratingRule === 'combined_level') {
      eligibilityTitle = `${formatLevel(competitionLevel)} combined doubles`
      eligibilityDetail = `Each pair's ratings may not exceed the saved ${formatLevel(competitionLevel)} combined level.`
    } else if (ratingRule === 'rated_lines') {
      eligibilityTitle = 'Rated lines'
      eligibilityDetail = 'Each player must be eligible for the rating assigned to that court.'
    } else if (ratingRule === 'combined_rated_lines') {
      eligibilityTitle = 'Combined rating at each line'
      eligibilityDetail = `Each pair's combined rating may not exceed the level assigned to that court.`
    } else {
      eligibilityTitle = 'Published local eligibility'
      eligibilityDetail = 'League Office uses the saved local rules as the final eligibility check.'
    }
  }

  const requiresMixedPair = rulesOverride.mixedPairRule === 'required'
    ? true
    : rulesOverride.mixedPairRule === 'not_required'
      ? false
      : mixed
  if (rulesOverride.maxPartnerRatingGap === 'none') maxPartnerRatingGap = null
  else if (typeof rulesOverride.maxPartnerRatingGap === 'number') maxPartnerRatingGap = rulesOverride.maxPartnerRatingGap
  if (requiresMixedPair && !eligibilityDetail.toLowerCase().includes('one man')) {
    eligibilityDetail = `${eligibilityDetail} Each doubles court needs one man and one woman.`
  }
  if (typeof maxPartnerRatingGap === 'number' && !eligibilityDetail.toLowerCase().includes('differ')) {
    eligibilityDetail = `${eligibilityDetail} Partners may differ by no more than ${maxPartnerRatingGap.toFixed(1)}.`
  }

  const scoring = buildScoringDetail(input.scoringSystem, input.thirdSetRule)
  const majority = Math.floor(summary.courts / 2) + 1
  const teamResultDetail = summary.courts % 2 === 0
    ? `Each court is one line result. The team with more line wins takes the match; a ${summary.courts / 2}-${summary.courts / 2} tie is possible unless the league defines another rule.`
    : `Each court is one line result. First to ${majority} line wins takes the team match.`
  const standingsRule = rulesOverride.standingsRule === 'auto'
    ? input.scoringSystem === 'dynamic_points' ? 'points' : 'match_wins'
    : rulesOverride.standingsRule
  const standingsDetail = standingsRule === 'points'
    ? 'Standings rank total points first, then team-match wins and line wins.'
    : standingsRule === 'line_wins'
      ? 'Standings rank line wins first, then team-match wins and points.'
      : 'Standings rank team-match wins first, then line wins and points.'

  return {
    formatId: format.id,
    formatLabel: format.label,
    courts: summary.courts,
    players: summary.players,
    competitionLevel,
    ageDivision,
    minimumPlayerRating,
    ratingRule,
    requiresMixedPair,
    maxPartnerRatingGap,
    eligibilityTitle,
    eligibilityDetail,
    scoringTitle: scoring.title,
    scoringDetail: scoring.detail,
    teamResultDetail,
    standingsDetail,
    standingsRule,
    rulesNotes: rulesOverride.notes,
    localRulesApply: input.competitionLayer === 'usta' || ratingRule === 'local_rules' || hasTeamCompetitionRulesOverride(rulesOverride),
  }
}

export function isCompetitionPlayerRatingEligible(
  rules: Pick<TeamCompetitionRules, 'ratingRule' | 'competitionLevel' | 'minimumPlayerRating'>,
  playerRating: number | null | undefined,
  courtRating?: number | null,
) {
  if (rules.ratingRule === 'open' || rules.ratingRule === 'local_rules') return true
  // Keep manually entered roster players selectable. The lineup warning layer
  // asks for a rating before the captain finalizes an eligibility-sensitive court.
  if (typeof playerRating !== 'number') return true

  if (rules.ratingRule === 'rated_lines') {
    return typeof courtRating !== 'number' || Math.abs(playerRating - courtRating) < 0.01
  }

  if (rules.ratingRule === 'combined_rated_lines' || rules.ratingRule === 'combined_level') {
    const cap = typeof courtRating === 'number' ? courtRating : rules.competitionLevel
    const minimum = rules.ratingRule === 'combined_rated_lines' && typeof courtRating === 'number'
      ? courtRating / 2 - 0.5
      : rules.minimumPlayerRating
    return (typeof cap !== 'number' || playerRating <= cap) &&
      (typeof minimum !== 'number' || playerRating >= minimum)
  }

  if (rules.ratingRule === 'straight_level' && typeof rules.competitionLevel === 'number') {
    return playerRating <= rules.competitionLevel && playerRating >= rules.competitionLevel - 0.5
  }

  return true
}

export function getCompetitionPairRatingIssues(
  rules: Pick<TeamCompetitionRules, 'ratingRule' | 'competitionLevel' | 'maxPartnerRatingGap'>,
  ratings: Array<number | null | undefined>,
  courtRating?: number | null,
) {
  if (rules.ratingRule !== 'combined_level' && rules.ratingRule !== 'combined_rated_lines') return []
  if (ratings.length < 2 || ratings.some((rating) => typeof rating !== 'number')) {
    return ['Both players need ratings before TIQ can confirm this pair.']
  }

  const left = ratings[0] as number
  const right = ratings[1] as number
  const cap = typeof courtRating === 'number' ? courtRating : rules.competitionLevel
  const issues: string[] = []
  if (typeof cap === 'number' && left + right > cap + 0.001) {
    issues.push(`Pair rating ${left.toFixed(1)} + ${right.toFixed(1)} exceeds ${cap.toFixed(1)}.`)
  }
  if (typeof rules.maxPartnerRatingGap === 'number' && Math.abs(left - right) > rules.maxPartnerRatingGap + 0.001) {
    issues.push(`Partners differ by more than ${rules.maxPartnerRatingGap.toFixed(1)}.`)
  }
  return issues
}

export function isCompetitionPairRatingEligible(
  rules: Pick<TeamCompetitionRules, 'ratingRule' | 'competitionLevel' | 'maxPartnerRatingGap'>,
  ratings: Array<number | null | undefined>,
  courtRating?: number | null,
) {
  return getCompetitionPairRatingIssues(rules, ratings, courtRating).length === 0
}

export function getTournamentOperationsSummary(format: TournamentDrawFormatId) {
  if (format === 'round_robin') return 'Every entrant plays the pool. Standings use wins, then score-based tiebreaks saved with the event.'
  if (format === 'single_elimination') return 'Winners advance in the main draw. A loss ends the entrant’s run.'
  if (format === 'team_tournament') return 'Teams advance from the saved team scorecard. Choose the court format and team-point rule before publishing.'
  if (format === 'compass_draw') return 'Each result moves entrants into the correct compass direction so play continues across multiple rounds.'
  if (format === 'flighted_draw') return 'Entrants stay inside their assigned ability flight; each flight publishes its own draw and winner.'
  return 'Main-draw results determine advancement and eligible losses feed into the selected consolation path.'
}

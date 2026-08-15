export type ClubCompetitionRatingMode = 'tiq_rated' | 'club_standings' | 'social'

export const DEFAULT_CLUB_COMPETITION_RATING_MODE: ClubCompetitionRatingMode = 'tiq_rated'

export function normalizeClubCompetitionRatingMode(
  value: string | null | undefined,
): ClubCompetitionRatingMode {
  if (value === 'club_standings' || value === 'social') return value
  return DEFAULT_CLUB_COMPETITION_RATING_MODE
}

export function competitionAffectsTiqRating(mode: ClubCompetitionRatingMode) {
  return mode === 'tiq_rated'
}

export function competitionPublishesMatchHistory(mode: ClubCompetitionRatingMode) {
  return mode !== 'social'
}

export function getClubCompetitionRatingModeLabel(mode: ClubCompetitionRatingMode) {
  if (mode === 'club_standings') return 'Club standings only'
  if (mode === 'social') return 'Social / event only'
  return 'TIQ Rated'
}

export function getClubCompetitionRatingModeDescription(mode: ClubCompetitionRatingMode) {
  if (mode === 'club_standings') {
    return 'Results power this league or tournament standings and public match history, but do not change TIQ ratings.'
  }

  if (mode === 'social') {
    return 'Run the event for fun. Results stay in the event room and do not enter player match history or TIQ ratings.'
  }

  return 'Verified results enter each linked player’s national TenAceIQ match history and update TIQ ratings. USTA ratings remain separate.'
}

export function getClubCompetitionRatingModeShortDescription(mode: ClubCompetitionRatingMode) {
  if (mode === 'club_standings') return 'Public results, no TIQ rating change'
  if (mode === 'social') return 'Event-only results, no rating change'
  return 'National history + TIQ rating'
}

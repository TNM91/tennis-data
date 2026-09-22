export const CLUB_COMPETITION_RESULT_MODES = [
  'tiq_rated',
  'public_history',
  'social',
] as const

export type ClubCompetitionResultMode = (typeof CLUB_COMPETITION_RESULT_MODES)[number]

export const CLUB_COMPETITION_RESULT_MODE_OPTIONS: ReadonlyArray<{
  value: ClubCompetitionResultMode
  label: string
  description: string
}> = [
  {
    value: 'tiq_rated',
    label: 'TIQ rated',
    description: 'Results appear in public player history and update TIQ ratings.',
  },
  {
    value: 'public_history',
    label: 'Public history only',
    description: 'Results appear in public player history without changing TIQ ratings.',
  },
  {
    value: 'social',
    label: 'Social / event only',
    description: 'Results stay with this club event and do not affect public history or TIQ ratings.',
  },
]

export function normalizeClubCompetitionResultMode(
  value: string | null | undefined,
): ClubCompetitionResultMode {
  if (value === 'public_history' || value === 'social') return value
  return 'tiq_rated'
}

export function getClubCompetitionResultPolicy(mode: ClubCompetitionResultMode) {
  return {
    ratingEligible: mode === 'tiq_rated',
    publicHistoryEligible: mode !== 'social',
  }
}

export function getClubCompetitionResultModeLabel(mode: ClubCompetitionResultMode) {
  return CLUB_COMPETITION_RESULT_MODE_OPTIONS.find((option) => option.value === mode)?.label ?? 'TIQ rated'
}

export function getClubCompetitionResultModeDescription(mode: ClubCompetitionResultMode) {
  return CLUB_COMPETITION_RESULT_MODE_OPTIONS.find((option) => option.value === mode)?.description
    ?? CLUB_COMPETITION_RESULT_MODE_OPTIONS[0].description
}

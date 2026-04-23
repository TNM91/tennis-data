'use client'

export type TiqIndividualCompetitionFormat =
  | 'standard'
  | 'ladder'
  | 'round_robin'
  | 'challenge'

export type TiqIndividualCompetitionFormatExperience = {
  participationCta: string
  entryTitle: string
  entryDescription: string
  participantsTitle: string
  participantsDescription: string
  participantsHintTitle: string
  participantsHintText: string
  emptyParticipants: string
  standingsEyebrow: string
  standingsTitle: string
  standingsDescription: string
  standingsHintTitle: string
  standingsHintText: string
  emptyStandings: string
  activityEyebrow: string
  activityTitle: string
  activityDescription: string
  activityHintTitle: string
  activityHintText: string
  actionLabel: string
  emptyResults: string
  scorePlaceholder: string
  notesPlaceholder: string
  enabledMessage: string
}

export const TIQ_INDIVIDUAL_COMPETITION_FORMATS: TiqIndividualCompetitionFormat[] = [
  'standard',
  'ladder',
  'round_robin',
  'challenge',
]

export function normalizeTiqIndividualCompetitionFormat(
  value: string | null | undefined,
): TiqIndividualCompetitionFormat {
  if (value === 'ladder') return 'ladder'
  if (value === 'round_robin') return 'round_robin'
  if (value === 'challenge') return 'challenge'
  return 'standard'
}

export function getTiqIndividualCompetitionFormatLabel(
  value: TiqIndividualCompetitionFormat | string | null | undefined,
) {
  const normalized = normalizeTiqIndividualCompetitionFormat(value)
  if (normalized === 'ladder') return 'Ladder'
  if (normalized === 'round_robin') return 'Round Robin'
  if (normalized === 'challenge') return 'Challenge'
  return 'Standard'
}

export function getTiqIndividualCompetitionFormatDescription(
  value: TiqIndividualCompetitionFormat | string | null | undefined,
) {
  const normalized = normalizeTiqIndividualCompetitionFormat(value)
  if (normalized === 'ladder') {
    return 'Players climb by challenging nearby opponents and defending position.'
  }
  if (normalized === 'round_robin') {
    return 'Players cycle through scheduled opponents with standings based on completed results.'
  }
  if (normalized === 'challenge') {
    return 'Open challenge play with logged outcomes and flexible scheduling.'
  }
  return 'General TIQ individual competition without a specialized rule set.'
}

export function getTiqIndividualCompetitionFormatExperience(
  value: TiqIndividualCompetitionFormat | string | null | undefined,
): TiqIndividualCompetitionFormatExperience {
  const normalized = normalizeTiqIndividualCompetitionFormat(value)

  if (normalized === 'ladder') {
    return {
      participationCta: 'Claim a ladder spot',
      entryTitle: 'Claim your TIQ ladder spot',
      entryDescription:
        'Players join the ladder individually, then climb by challenging nearby opponents and defending position.',
      participantsTitle: 'Ladder entrants',
      participantsDescription:
        'Every player enters on their own here, keeping teams and captain operations out of the ladder model.',
      participantsHintTitle: 'Movement matters',
      participantsHintText:
        'The ladder gets more useful as nearby opponents challenge each other and defended spots create visible separation.',
      emptyParticipants: 'No ladder entrants have been added yet.',
      standingsEyebrow: 'TIQ ladder',
      standingsTitle: 'Current ladder positions',
      standingsDescription:
        'Ladder positions emphasize actual TIQ challenge results first, then use TIQ rating as the secondary tie-break read while USTA remains the official outside baseline.',
      standingsHintTitle: 'Climb and defend',
      standingsHintText:
        'Use the standings to spot who is moving upward, who is holding their spot, and where the next meaningful challenge should happen.',
      emptyStandings: 'Add ladder entrants and log challenge results to generate live TIQ ladder positions.',
      activityEyebrow: 'Ladder activity',
      activityTitle: 'Log challenge and defense results',
      activityDescription:
        'Track who challenged, who defended, and how the ladder is moving without mixing those outcomes into imported USTA match truth.',
      activityHintTitle: 'Challenge context',
      activityHintText:
        'Use notes to capture spot battles, defended positions, rematches, or availability constraints around a challenge.',
      actionLabel: 'Log Challenge Result',
      emptyResults: 'No ladder challenges have been logged for this league yet.',
      scorePlaceholder: '6-4, 7-5',
      notesPlaceholder: 'Challenge for #3 spot',
      enabledMessage: 'Signed-in players can join this TIQ ladder directly.',
    }
  }

  if (normalized === 'round_robin') {
    return {
      participationCta: 'Join the field',
      entryTitle: 'Join this TIQ round robin',
      entryDescription:
        'Players join individually, then cycle through scheduled opponents with standings built from completed TIQ results.',
      participantsTitle: 'Round robin field',
      participantsDescription:
        'This field is the player pool for scheduled round-robin play, without introducing teams or captain operations.',
      participantsHintTitle: 'Coverage matters',
      participantsHintText:
        'The clearest table emerges when results are spread across the field instead of clustering around only a few players.',
      emptyParticipants: 'No round robin players have been added yet.',
      standingsEyebrow: 'Round robin standings',
      standingsTitle: 'Current round robin table',
      standingsDescription:
        'Standings prioritize completed TIQ round-robin results first, then TIQ rating as a secondary signal while keeping USTA separate as the official baseline.',
      standingsHintTitle: 'Table integrity',
      standingsHintText:
        'This view is strongest when the field has broad match coverage, so missing results and unplayed pairings stay easy to spot.',
      emptyStandings: 'Add round robin players and completed results to generate a stronger TIQ table.',
      activityEyebrow: 'Round robin activity',
      activityTitle: 'Log completed round robin matches',
      activityDescription:
        'Capture completed pairings and scorelines so the TIQ table reflects who has actually played through the field.',
      activityHintTitle: 'Round tracking',
      activityHintText:
        'Use notes to capture round number, pod, make-up matches, or scheduling changes that matter for season coverage.',
      actionLabel: 'Log Round Result',
      emptyResults: 'No round robin matches have been logged for this league yet.',
      scorePlaceholder: '6-2, 3-6, 10-7',
      notesPlaceholder: 'Round 2, court 4',
      enabledMessage: 'Signed-in players can join this TIQ round robin directly.',
    }
  }

  if (normalized === 'challenge') {
    return {
      participationCta: 'Join the challenge',
      entryTitle: 'Join this TIQ challenge league',
      entryDescription:
        'Players join individually, then create momentum through flexible challenge results instead of a fixed team structure.',
      participantsTitle: 'Challenge pool',
      participantsDescription:
        'Players participate directly here, making it easy to run open challenge competition without teams or captain roles.',
      participantsHintTitle: 'Flexible pressure',
      participantsHintText:
        'Challenge leagues work best when entry stays easy and recent results make momentum visible quickly.',
      emptyParticipants: 'No challengers have joined yet.',
      standingsEyebrow: 'Challenge board',
      standingsTitle: 'Current challenge momentum',
      standingsDescription:
        'The challenge board emphasizes logged TIQ challenge results first, then uses TIQ rating as the secondary read while keeping USTA separate as official context.',
      standingsHintTitle: 'Momentum over formality',
      standingsHintText:
        'This board is about who is winning recent challenges and creating pressure, not about mirroring official USTA status.',
      emptyStandings: 'Add challengers and recent challenge results to generate the challenge board.',
      activityEyebrow: 'Challenge activity',
      activityTitle: 'Log open challenge results',
      activityDescription:
        'Capture challenge outcomes as they happen so recent form and momentum stay visible inside the TIQ layer.',
      activityHintTitle: 'Keep it current',
      activityHintText:
        'Use notes to capture accepted challenges, rematches, or flexible scheduling details that explain the result flow.',
      actionLabel: 'Log Challenge Result',
      emptyResults: 'No TIQ challenges have been logged for this league yet.',
      scorePlaceholder: '7-6, 6-4',
      notesPlaceholder: 'Open challenge accepted Monday',
      enabledMessage: 'Signed-in players can join this TIQ challenge league directly.',
    }
  }

  return {
    participationCta: 'Join as a player',
    entryTitle: 'Join this TIQ individual league',
    entryDescription:
      'This keeps TIQ individual competition easy to join while preserving a separate organizer creation layer from captain workflows.',
    participantsTitle: 'Joined Players',
    participantsDescription:
      'Players are the participant unit here, without forcing team or captain concepts into the format.',
    participantsHintTitle: 'Separate TIQ layer',
    participantsHintText:
      'Use TIQ participation and TIQ results to understand internal competition without redefining official USTA status.',
    emptyParticipants: 'No players have been added yet.',
    standingsEyebrow: 'TIQ standings',
    standingsTitle: 'Current TIQ individual read',
    standingsDescription:
      'TIQ standings prioritize actual TIQ individual-league results first, then use TIQ rating as the secondary read while keeping USTA visible as the separate official baseline.',
    standingsHintTitle: 'Strategy, not status',
    standingsHintText:
      'USTA still shows outside status. TIQ standings show who is performing inside this competition context right now.',
    emptyStandings: 'Add identified players to this TIQ individual league to generate a richer standings read.',
    activityEyebrow: 'TIQ activity',
    activityTitle: 'Log and review individual results',
    activityDescription:
      'Use this result log to capture internal competition outcomes while keeping them separate from imported USTA match truth.',
    activityHintTitle: 'Internal result layer',
    activityHintText:
      'These logged TIQ outcomes stay inside the TIQ competition model and do not overwrite imported official match context.',
    actionLabel: 'Log TIQ Result',
    emptyResults: 'No TIQ individual results have been logged for this league yet.',
    scorePlaceholder: '6-4, 6-3',
    notesPlaceholder: 'Comeback, availability note, or internal match context',
    enabledMessage: 'Signed-in players can join this TIQ individual league directly.',
  }
}

export function getTiqIndividualCompetitionFormatPreview(
  value: TiqIndividualCompetitionFormat | string | null | undefined,
) {
  const normalized = normalizeTiqIndividualCompetitionFormat(value)

  if (normalized === 'ladder') {
    return 'Climb by challenging nearby spots and defending position.'
  }
  if (normalized === 'round_robin') {
    return 'Build the table through broad result coverage across the field.'
  }
  if (normalized === 'challenge') {
    return 'Keep open challenges moving and recent momentum visible.'
  }

  return 'Track TIQ individual results and form without blending into USTA status.'
}

export function getTiqIndividualCompetitionFormatNextAction(
  value: TiqIndividualCompetitionFormat | string | null | undefined,
  subjectName: string,
) {
  const normalized = normalizeTiqIndividualCompetitionFormat(value)
  const safeSubject = subjectName.trim() || 'This league'

  if (normalized === 'ladder') {
    return `${safeSubject}: spot the nearest ladder target and log the next climb or defense result.`
  }
  if (normalized === 'round_robin') {
    return `${safeSubject}: close the biggest coverage gaps by playing unlogged opponents across the field.`
  }
  if (normalized === 'challenge') {
    return `${safeSubject}: keep open challenges moving so recent momentum stays visible.`
  }

  return `${safeSubject}: log the next TIQ result to sharpen internal form and matchup context.`
}

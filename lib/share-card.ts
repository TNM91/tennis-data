export type TiqShareCardKind = 'player' | 'team' | 'league' | 'tournament' | 'club' | 'development'

const LABELS: Record<TiqShareCardKind, string> = {
  player: 'Player profile',
  team: 'Team intelligence',
  league: 'League season',
  tournament: 'Tournament',
  club: 'Club tennis',
  development: 'Player development',
}

export function isTiqShareCardKind(value: string): value is TiqShareCardKind {
  return Object.hasOwn(LABELS, value)
}

export function getTiqShareCardLabel(kind: TiqShareCardKind) {
  return LABELS[kind]
}

export function buildShareCardImageUrl(input: {
  kind: TiqShareCardKind
  title: string
  subtitle?: string
  detail?: string
}) {
  const query = new URLSearchParams({ kind: input.kind, title: input.title })
  if (input.subtitle) query.set('subtitle', input.subtitle)
  if (input.detail) query.set('detail', input.detail)
  return `/api/share-card?${query.toString()}`
}

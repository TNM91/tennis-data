export type PlayerReflection = {
  id: string
  playerUserId: string
  playerId: string | null
  outcome: 1 | 2 | 3
  worked: string
  nextStep: string
  proofLabel: string
  resultLabel: string
  createdAt: string
  updatedAt: string
}

export type PlayerReflectionRow = {
  id: string
  player_user_id: string
  player_id: string | null
  outcome: number
  worked: string
  next_step: string
  proof_label: string
  result_label: string
  created_at: string
  updated_at: string
}

export type PlayerReflectionInput = {
  id?: unknown
  playerId?: unknown
  outcome?: unknown
  worked?: unknown
  nextStep?: unknown
  proofLabel?: unknown
  resultLabel?: unknown
  createdAt?: unknown
}

export type ReflectionPatternRead = {
  sampleSize: number
  heldUpRate: number
  averageOutcome: number
  direction: 'Strengthening' | 'Holding steady' | 'Needs a response'
  workingTheme: { label: string; count: number } | null
  adjustmentTheme: { label: string; count: number } | null
}

type ReflectionSignal = {
  outcome: number
  worked: string
  nextStep: string
}

const reflectionThemes = [
  'second serve',
  'first serve',
  'serve',
  'return',
  'forehand',
  'backhand',
  'crosscourt',
  'down the line',
  'net',
  'volley',
  'footwork',
  'spacing',
  'depth',
  'height',
  'margin',
  'pressure',
  'patience',
] as const

export function buildReflectionPatternRead(reflections: ReflectionSignal[]): ReflectionPatternRead | null {
  const recent = reflections.slice(0, 8).flatMap((reflection) => {
    const outcome = normalizeOutcome(reflection.outcome)
    return outcome ? [{ ...reflection, outcome }] : []
  })
  if (recent.length < 2) return null

  const averageOutcome = average(recent.map((reflection) => reflection.outcome))
  const newest = recent.slice(0, Math.ceil(recent.length / 2))
  const older = recent.slice(Math.ceil(recent.length / 2))
  const directionDelta = average(newest.map((reflection) => reflection.outcome)) - average(older.map((reflection) => reflection.outcome))

  return {
    sampleSize: recent.length,
    heldUpRate: Math.round((recent.filter((reflection) => reflection.outcome === 3).length / recent.length) * 100),
    averageOutcome,
    direction: directionDelta >= 0.35 ? 'Strengthening' : directionDelta <= -0.35 ? 'Needs a response' : 'Holding steady',
    workingTheme: findRepeatedTheme(recent.map((reflection) => reflection.worked)),
    adjustmentTheme: findRepeatedTheme(recent.map((reflection) => reflection.nextStep)),
  }
}

export function mapPlayerReflectionRow(row: PlayerReflectionRow): PlayerReflection {
  return {
    id: row.id,
    playerUserId: row.player_user_id,
    playerId: row.player_id,
    outcome: normalizeOutcome(row.outcome) ?? 1,
    worked: row.worked,
    nextStep: row.next_step,
    proofLabel: row.proof_label,
    resultLabel: row.result_label,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

export function buildPlayerReflectionPayload(input: PlayerReflectionInput, playerUserId: string) {
  const outcome = normalizeOutcome(input.outcome)
  const worked = normalizeLine(input.worked, 140)
  const nextStep = normalizeLine(input.nextStep, 140)
  if (!outcome || (!worked && !nextStep)) return null

  const now = new Date().toISOString()
  return {
    id: normalizeLine(input.id, 120) || `reflection-${crypto.randomUUID()}`,
    player_user_id: playerUserId,
    player_id: normalizeLine(input.playerId, 120) || null,
    outcome,
    worked,
    next_step: nextStep,
    proof_label: normalizeLine(input.proofLabel, 180),
    result_label: normalizeLine(input.resultLabel, 180),
    created_at: normalizeIsoDate(input.createdAt) || now,
    updated_at: now,
  }
}

function normalizeOutcome(value: unknown): 1 | 2 | 3 | null {
  const numeric = typeof value === 'number' ? value : Number.parseInt(String(value), 10)
  return numeric === 1 || numeric === 2 || numeric === 3 ? numeric : null
}

function normalizeLine(value: unknown, maxLength: number) {
  return typeof value === 'string' ? value.replace(/\s+/g, ' ').trim().slice(0, maxLength) : ''
}

function normalizeIsoDate(value: unknown) {
  if (typeof value !== 'string' || !value.trim()) return ''
  const date = new Date(value)
  return Number.isFinite(date.getTime()) ? date.toISOString() : ''
}

function average(values: number[]) {
  return values.length ? values.reduce((total, value) => total + value, 0) / values.length : 0
}

function findRepeatedTheme(lines: string[]) {
  const counts = new Map<string, number>()
  lines.forEach((line) => {
    const normalized = line.toLowerCase()
    const matches = reflectionThemes.filter((theme) => normalized.includes(theme))
    const specificMatches = matches.filter((theme) => !matches.some((candidate) => candidate !== theme && candidate.includes(theme)))
    specificMatches.forEach((theme) => counts.set(theme, (counts.get(theme) ?? 0) + 1))
  })

  const top = [...counts.entries()].sort((left, right) => right[1] - left[1] || left[0].localeCompare(right[0]))[0]
  return top && top[1] >= 2
    ? { label: top[0].replace(/\b\w/g, (letter) => letter.toUpperCase()), count: top[1] }
    : null
}

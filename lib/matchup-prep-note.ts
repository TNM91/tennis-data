export type MatchupPrepDraft = {
  id: string
  title: string
  context: string
  evidence: string
  courtPlan: string
}

const MAX_ID_LENGTH = 180
const MAX_TITLE_LENGTH = 180
const MAX_BODY_LENGTH = 900

function clean(value: unknown, limit: number) {
  return typeof value === 'string' ? value.replace(/\s+/g, ' ').trim().slice(0, limit) : ''
}

function normalizeDraft(value: Partial<MatchupPrepDraft> | null | undefined): MatchupPrepDraft | null {
  const id = clean(value?.id, MAX_ID_LENGTH)
  const title = clean(value?.title, MAX_TITLE_LENGTH)
  const context = clean(value?.context, MAX_BODY_LENGTH)
  const evidence = clean(value?.evidence, MAX_BODY_LENGTH)
  const courtPlan = clean(value?.courtPlan, MAX_BODY_LENGTH)

  if (!id || !title || !context || !courtPlan) return null
  return { id, title, context, evidence, courtPlan }
}

export function buildMatchupPrepHref(draft: MatchupPrepDraft) {
  const normalized = normalizeDraft(draft)
  if (!normalized) return '/mylab#player-notebook'

  const params = new URLSearchParams()
  params.set('matchupPrep', JSON.stringify(normalized))
  return `/mylab?${params.toString()}#player-notebook`
}

export function readMatchupPrepDraft(value: string | null | undefined) {
  if (!value) return null

  try {
    const parsed = JSON.parse(value) as Partial<MatchupPrepDraft>
    return normalizeDraft(parsed)
  } catch {
    return null
  }
}

export type TenAceMemberRead = {
  headline: string
  summary: string
  evidence: string[]
  nextTest: string
  reflectionPrompt: string
}

type TenAceMemberMatch = {
  result: 'W' | 'L'
  matchType?: string | null
}

type TenAceMemberReadInput = {
  currentRating: number | null
  ratingDelta: number | null
  wins: number
  losses: number
  confidence: string
  recentPattern: string
  courtMix: string
  activeFocus?: string | null
  recentMatches?: TenAceMemberMatch[]
}

type FormatRead = {
  label: 'Singles' | 'Doubles'
  wins: number
  losses: number
  total: number
  winRate: number
}

function signedRating(value: number) {
  return `${value >= 0 ? '+' : ''}${value.toFixed(2)}`
}

function currentResultStreak(matches: TenAceMemberMatch[]) {
  const firstResult = matches[0]?.result
  if (!firstResult) return { result: null, count: 0 } as const

  let count = 0
  for (const match of matches) {
    if (match.result !== firstResult) break
    count += 1
  }
  return { result: firstResult, count }
}

function formatRead(matches: TenAceMemberMatch[], label: FormatRead['label']): FormatRead {
  const formatMatches = matches.filter((match) => (match.matchType || '').toLowerCase().includes(label.toLowerCase()))
  const wins = formatMatches.filter((match) => match.result === 'W').length
  const losses = formatMatches.filter((match) => match.result === 'L').length
  return {
    label,
    wins,
    losses,
    total: wins + losses,
    winRate: wins + losses ? wins / (wins + losses) : 0,
  }
}

export function buildTenAceMemberRead(input: TenAceMemberReadInput): TenAceMemberRead {
  const decidedMatches = input.wins + input.losses
  const record = decidedMatches ? `${input.wins}-${input.losses}` : 'No record yet'
  const focus = input.activeFocus?.trim() || ''
  const stable = typeof input.ratingDelta === 'number' && Math.abs(input.ratingDelta) <= 0.02
  const matches = input.recentMatches || []
  const streak = currentResultStreak(matches)
  const singles = formatRead(matches, 'Singles')
  const doubles = formatRead(matches, 'Doubles')
  const formatEdge = singles.total >= 2 && doubles.total >= 2 && Math.abs(singles.winRate - doubles.winRate) >= 0.25
    ? singles.winRate > doubles.winRate
      ? { stronger: singles, weaker: doubles }
      : { stronger: doubles, weaker: singles }
    : null

  let headline: string
  let summary: string

  if (input.currentRating == null) {
    headline = 'Your first useful read starts with one result.'
    summary = 'Connect one honest result to establish your first rating, form, and court-pattern baseline.'
  } else if (streak.count >= 2 && streak.result === 'W') {
    headline = stable
      ? `${streak.count} straight wins. Your rating is still catching up.`
      : `${streak.count} straight wins are moving your line.`
    summary = stable
      ? `Your ${record} overall record hides a short lift: the newest ${streak.count} connected results are wins while TIQ stayed nearly flat at ${signedRating(input.ratingDelta!)}. The next result will show whether this is a real turn.`
      : `The newest ${streak.count} connected results are wins while TIQ moved ${typeof input.ratingDelta === 'number' ? signedRating(input.ratingDelta) : 'into a new range'}. Results and level are starting to move together.`
  } else if (streak.count >= 2 && streak.result === 'L') {
    headline = `${streak.count} straight losses point to one repeat problem.`
    summary = `The ${record} overall record matters less than the newest ${streak.count} connected losses. Isolate the first pattern that breaks under pressure before changing the whole game.`
  } else if (formatEdge) {
    headline = `${formatEdge.stronger.label} is your clearest edge right now.`
    summary = `${formatEdge.stronger.label} is ${formatEdge.stronger.wins}-${formatEdge.stronger.losses}, compared with ${formatEdge.weaker.wins}-${formatEdge.weaker.losses} in ${formatEdge.weaker.label.toLowerCase()}. That gap is more useful than the blended ${record} record.`
  } else if (input.ratingDelta == null) {
    headline = 'Your level is set. Now build the pattern.'
    summary = `Your connected record is ${record}. Add another result so My Lab can separate a real trend from one-match noise.`
  } else if (stable && decidedMatches >= 4) {
    headline = 'Your level is steady. Focus is the edge.'
    summary = `TIQ moved ${signedRating(input.ratingDelta)} while your connected record is ${record}. That points to one controlled test, not a full rebuild.`
  } else if (input.ratingDelta > 0.02 && input.wins >= input.losses) {
    headline = 'Your level and results are moving together.'
    summary = `TIQ moved ${signedRating(input.ratingDelta)} alongside a ${record} connected record. Protect the pattern for two more matches before expanding the goal.`
  } else if (input.ratingDelta < -0.02 && input.losses > input.wins) {
    headline = 'One repeat pattern is holding the line back.'
    summary = `TIQ moved ${signedRating(input.ratingDelta)} alongside a ${record} connected record. The next useful move is one narrow correction, not more volume.`
  } else if (input.ratingDelta > 0) {
    headline = 'Your rating is lifting before the record.'
    summary = `TIQ moved ${signedRating(input.ratingDelta)} while your connected record is ${record}. The next result can confirm whether the level change is becoming match form.`
  } else {
    headline = 'Your results are moving faster than your rating.'
    summary = `TIQ moved ${signedRating(input.ratingDelta)} while your connected record is ${record}. Keep the next test narrow enough to explain what changes.`
  }

  const evidence = [
    typeof input.ratingDelta === 'number' ? `TIQ ${signedRating(input.ratingDelta)}` : 'TIQ building',
    decidedMatches ? `${record} recent` : 'First result needed',
    streak.count >= 2 ? `${streak.count} straight ${streak.result === 'W' ? 'wins' : 'losses'}` : null,
    formatEdge ? `${formatEdge.stronger.label} ${formatEdge.stronger.wins}-${formatEdge.stronger.losses}` : null,
    input.confidence,
  ].filter((item): item is string => Boolean(item))

  const nextTest = focus
    ? `Keep “${focus}” through the next two matches. Track whether it still holds when the score tightens.`
    : streak.count >= 2 && streak.result === 'W'
      ? `Name one repeatable pattern from the ${streak.count} wins. Use it deliberately in the next match, then record whether it held under pressure.`
      : streak.count >= 2 && streak.result === 'L'
        ? `Name the earliest repeat breakdown from the ${streak.count} losses. Test one correction in the next match before changing anything else.`
        : formatEdge
          ? `Take one repeatable behavior from ${formatEdge.stronger.label.toLowerCase()} into your next ${formatEdge.weaker.label.toLowerCase()} result and compare the outcome.`
          : input.losses > input.wins
            ? 'Choose one repeat pattern from the recent losses and track it for two matches.'
            : decidedMatches
              ? `Choose one measurable focus and keep it through the next two matches. Current pattern: ${input.recentPattern}.`
              : `Connect one result, then choose a focus that fits your ${input.courtMix.toLowerCase()}.`

  const reflectionPrompt = decidedMatches
    ? `After two more results, compare this ${record} / ${input.currentRating?.toFixed(2) || 'new'} baseline with the new record, TIQ movement, and whether the test held.`
    : 'After the first result, save what worked and what broke first. That becomes the baseline for your next read.'

  return { headline, summary, evidence, nextTest, reflectionPrompt }
}

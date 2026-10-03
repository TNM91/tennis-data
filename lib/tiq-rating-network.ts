export type NetworkFormat = 'singles' | 'doubles'
export type NetworkCourt = {
  id: string
  date: string
  format: NetworkFormat
  participants: { playerId: string; side: 'A' | 'B' }[]
  actualGameShare: number
  /** Individual Adult division context; never an official player rating. */
  divisionLevel?: number
}
export type NetworkState = {
  strength: number
  variance: number
  matches: number
  startingEvidence: 'dated-rating' | 'network-estimate'
  anchorDistance: number
  partners: Set<string>
  opponents: Set<string>
  playingDays: Set<string>
}
export type NetworkPrediction = {
  id: string
  date: string
  format: NetworkFormat
  expectedGameShare: number
  actualGameShare: number
  allParticipantsHavePriors: boolean
  maximumAnchorDistance: number
  distantAnchor: boolean
}
export const NETWORK_CONFIG = Object.freeze({
  response: 3,
  unknownVariance: 0.09,
  priorVariance: 0.0324,
  observationVariance: 0.09,
  processVariance: 0.0004,
  priorOffset: 0.25,
  repeatedPartnerWeight: 1,
  divisionContextWeight: 0,
})
export type NetworkConfig = { [Key in keyof typeof NETWORK_CONFIG]: number }
const bounded = (value: number) => Math.max(1.5, Math.min(7, value))
const validDate = (date: string) => /^\d{4}-\d{2}-\d{2}$/.test(date) && Number.isFinite(Date.parse(date)) && new Date(date).toISOString().slice(0, 10) === date
const key = (playerId: string, format: NetworkFormat) => `${playerId}:${format}`
const expected = (a: number, b: number) => 1 / (1 + 10 ** ((b - a) / 1.6))

/** Experimental playing strength only. Inputs must already have reviewed score orientation and identity. */
export function replayRatingNetwork(input: {
  startsOn: string
  cutoff: string
  priors: ReadonlyMap<string, number>
  courts: NetworkCourt[]
  config?: Partial<NetworkConfig>
  priorStrengthShifts?: ReadonlyMap<string, number>
  /** Called synchronously after a complete day's updates. Consumers must copy values. */
  onDay?: (day: { date: string; courts: NetworkCourt[]; states: ReadonlyMap<string, NetworkState>; previous: ReadonlyMap<string, { strength: number; matches: number }> }) => void
}) {
  const config = { ...NETWORK_CONFIG, ...input.config }
  if (!validDate(input.startsOn) || !validDate(input.cutoff) || input.startsOn > input.cutoff) throw new Error('Invalid replay window')
  if (Object.values(config).some(value => !Number.isFinite(value)) || config.response < 0 || config.unknownVariance <= 0 || config.priorVariance <= 0 || config.observationVariance <= 0 || config.processVariance < 0 || config.repeatedPartnerWeight <= 0 || config.repeatedPartnerWeight > 1 || config.divisionContextWeight < 0 || config.divisionContextWeight > 1) throw new Error('Invalid network configuration')
  for (const level of input.priors.values()) if (!Number.isFinite(level) || level < 1.5 || level > 7 || !Number.isInteger(level * 2)) throw new Error('Invalid dated rating prior')
  for (const shift of input.priorStrengthShifts?.values() ?? []) if (!Number.isFinite(shift) || Math.abs(shift) > 1) throw new Error('Invalid prior sensitivity shift')
  const seen = new Set<string>(), days = new Map<string, NetworkCourt[]>()
  for (const court of [...input.courts].sort((a, b) => a.date.localeCompare(b.date) || a.id.localeCompare(b.id))) {
    if (!validDate(court.date)) throw new Error('Invalid court date')
    if (court.date < input.startsOn || court.date > input.cutoff) continue
    if (seen.has(court.id)) throw new Error('Duplicate court identity')
    seen.add(court.id)
    const count = court.format === 'singles' ? 1 : court.format === 'doubles' ? 2 : 0
    if (!count || court.participants.length !== count * 2 || new Set(court.participants.map(p => p.playerId)).size !== count * 2 || court.participants.some(p => !p.playerId || !['A', 'B'].includes(p.side)) || ['A', 'B'].some(side => court.participants.filter(p => p.side === side).length !== count) || !Number.isFinite(court.actualGameShare) || court.actualGameShare < 0 || court.actualGameShare > 1) throw new Error('Invalid reviewed court')
    if (court.divisionLevel !== undefined && (!Number.isFinite(court.divisionLevel) || court.divisionLevel < 1.5 || court.divisionLevel >= 6 || !Number.isInteger(court.divisionLevel * 2))) throw new Error('Invalid individual division context')
    days.set(court.date, [...(days.get(court.date) ?? []), court])
  }
  const states = new Map<string, NetworkState>(), predictions: NetworkPrediction[] = [], skippedUnanchored: string[] = []
  const initialize = (strength: number, startingEvidence: NetworkState['startingEvidence'], anchorDistance: number): NetworkState => ({ strength: bounded(strength), variance: startingEvidence === 'dated-rating' ? config.priorVariance : config.unknownVariance, matches: 0, startingEvidence, anchorDistance, partners: new Set(), opponents: new Set(), playingDays: new Set() })
  for (const [date, courts] of days) {
    for (const court of courts) for (const player of court.participants) {
      const id = key(player.playerId, court.format), level = input.priors.get(player.playerId)
      if (!states.has(id) && level !== undefined) states.set(id, initialize(level + config.priorOffset + (input.priorStrengthShifts?.get(player.playerId) ?? 0), 'dated-rating', 0))
    }
    // Read an immutable pre-day snapshot; newly inferred states never seed other same-day proposals.
    const proposals = new Map<string, { strengths: number[]; distances: number[] }>()
    for (const court of courts) {
      const known = court.participants.map(p => states.get(key(p.playerId, court.format))).filter((state): state is NetworkState => !!state)
      if (!known.length) continue
      const knownStrength = known.reduce((sum, state) => sum + state.strength, 0) / known.length
      const strength = court.divisionLevel === undefined || config.divisionContextWeight === 0 ? knownStrength : (1 - config.divisionContextWeight) * knownStrength + config.divisionContextWeight * bounded(court.divisionLevel + config.priorOffset)
      const distance = Math.min(...known.map(state => state.anchorDistance)) + 1
      for (const player of court.participants) {
        const id = key(player.playerId, court.format)
        if (states.has(id)) continue
        const proposal = proposals.get(id) ?? { strengths: [], distances: [] }
        proposal.strengths.push(strength); proposal.distances.push(distance); proposals.set(id, proposal)
      }
    }
    for (const [id, proposal] of proposals) states.set(id, initialize(proposal.strengths.reduce((sum, value) => sum + value, 0) / proposal.strengths.length, 'network-estimate', Math.min(...proposal.distances)))
    const previous = new Map<string, { strength: number; matches: number }>()
    if (input.onDay) for (const court of courts) for (const player of court.participants) for (const format of ['singles', 'doubles'] as const) {
      const id = key(player.playerId, format), state = states.get(id)
      if (state) previous.set(id, { strength: state.strength, matches: state.matches })
    }
    const updates = new Map<NetworkState, { residual: number; weight: number; partners: string[]; opponents: string[] }[]>()
    for (const court of courts) {
      const allStates = court.participants.map(p => states.get(key(p.playerId, court.format)))
      if (allStates.some(state => !state)) { skippedUnanchored.push(court.id); continue }
      const courtStates = allStates as NetworkState[]
      const sideAverage = (side: 'A' | 'B') => court.participants.reduce((sum, player, index) => sum + (player.side === side ? courtStates[index].strength : 0), 0) / (court.format === 'singles' ? 1 : 2)
      const prediction = expected(sideAverage('A'), sideAverage('B'))
      predictions.push({ id: court.id, date, format: court.format, expectedGameShare: prediction, actualGameShare: court.actualGameShare, allParticipantsHavePriors: court.participants.every(p => input.priors.has(p.playerId)), maximumAnchorDistance: Math.max(...courtStates.map(state => state.anchorDistance)), distantAnchor: courtStates.some(state => state.anchorDistance > 2) })
      court.participants.forEach((player, index) => {
        const state = courtStates[index], partners = court.participants.filter(p => p.side === player.side && p.playerId !== player.playerId).map(p => p.playerId), opponents = court.participants.filter(p => p.side !== player.side).map(p => p.playerId)
        const weight = partners.some(partner => state.partners.has(partner)) ? config.repeatedPartnerWeight : 1
        const entries = updates.get(state) ?? []
        entries.push({ residual: player.side === 'A' ? court.actualGameShare - prediction : prediction - court.actualGameShare, weight, partners, opponents }); updates.set(state, entries)
      })
    }
    for (const [state, entries] of updates) {
      const priorVariance = state.variance + config.processVariance, precision = entries.reduce((sum, entry) => sum + entry.weight, 0), posterior = 1 / (1 / priorVariance + precision / config.observationVariance)
      state.strength = bounded(state.strength + config.response * posterior / config.observationVariance * entries.reduce((sum, entry) => sum + entry.weight * entry.residual, 0))
      state.variance = Math.max(0.0001, posterior); state.matches += entries.length; state.playingDays.add(date)
      for (const entry of entries) { for (const partner of entry.partners) state.partners.add(partner); for (const opponent of entry.opponents) state.opponents.add(opponent) }
    }
    input.onDay?.({ date, courts: courts.filter(court => court.participants.every(p => states.has(key(p.playerId, court.format)))), states, previous })
  }
  return { config, states, predictions, skippedUnanchored, confidenceCalibrated: false as const, movementForecastAvailable: false as const }
}


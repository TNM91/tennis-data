export function getVisitUpdates<T extends { createdAt: string | null }>(items: T[], previousVisit: number | null, now: number): T[] {
  if (previousVisit === null || !Number.isFinite(previousVisit) || previousVisit > now || previousVisit < 0) return []
  return items.filter(item => {
    const time = item.createdAt ? Date.parse(item.createdAt) : NaN
    return Number.isFinite(time) && time > previousVisit && time <= now
  })
}

export function readVisitTimestamp(value: string | null, now: number): number | null {
  if (!value?.trim()) return null
  const time = Number(value)
  return Number.isFinite(time) && time >= 0 && time <= now ? time : null
}

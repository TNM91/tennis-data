export function encodeTeamRouteSegment(teamName: string) {
  return encodeURIComponent(teamName).replace(/%2F/gi, '~2F')
}

export function buildTeamProfileHref(
  teamName: string,
  context: {
    layer?: string | null
    league?: string | null
    flight?: string | null
  } = {},
) {
  const params = new URLSearchParams()
  if (context.layer) params.set('layer', context.layer)
  if (context.league) params.set('league', context.league)
  if (context.flight) params.set('flight', context.flight)

  const query = params.toString()
  return `/teams/${encodeTeamRouteSegment(teamName)}${query ? `?${query}` : ''}`
}

export function decodeTeamRouteSegment(segment: string) {
  let value = segment.replace(/~2F/gi, '/')
  for (let index = 0; index < 2; index += 1) {
    try {
      const decoded = decodeURIComponent(value)
      if (decoded === value) break
      value = decoded
    } catch {
      break
    }
  }
  return value.trim()
}

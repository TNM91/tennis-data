export function encodeTeamRouteSegment(teamName: string) {
  return encodeURIComponent(teamName).replace(/%2F/gi, '~2F')
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

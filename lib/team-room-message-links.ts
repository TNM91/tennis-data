export type TeamRoomMessageSegment = {
  text: string
  href?: string
}

const WEB_URL_PATTERN = /https?:\/\/[^\s<>]+/gi
const TRAILING_PUNCTUATION_PATTERN = /[),.!?:;]+$/

export function tokenizeTeamRoomMessageBody(body: string): TeamRoomMessageSegment[] {
  const segments: TeamRoomMessageSegment[] = []
  let cursor = 0

  for (const match of body.matchAll(WEB_URL_PATTERN)) {
    const index = match.index ?? 0
    if (index > cursor) segments.push({ text: body.slice(cursor, index) })

    const rawUrl = match[0]
    const trailing = rawUrl.match(TRAILING_PUNCTUATION_PATTERN)?.[0] || ''
    const url = trailing ? rawUrl.slice(0, -trailing.length) : rawUrl
    if (url) segments.push({ text: url, href: url })
    if (trailing) segments.push({ text: trailing })
    cursor = index + rawUrl.length
  }

  if (cursor < body.length) segments.push({ text: body.slice(cursor) })
  return segments.length ? segments : [{ text: body }]
}

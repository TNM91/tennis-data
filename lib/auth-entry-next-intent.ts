export type AuthEntryNextIntent = {
  label: string
  title: string
  body: string
}

export function getAuthEntryNextIntent(nextHref: string | null | undefined): AuthEntryNextIntent | null {
  const readableHref = decodeNextHref(nextHref)

  if (
    readableHref.includes('/tactics')
    && readableHref.includes('source=improve')
    && readableHref.includes('template=crosscourt')
  ) {
    const cardTitle = getReadableSearchParam(readableHref, 'cardTitle')

    if (cardTitle) {
      return {
        label: 'After access',
        title: `Build the ${cardTitle} proof board.`,
        body: `TenAceIQ keeps the ${cardTitle} My Lab proof path attached, then opens Tactical Studio with the crosscourt board ready.`,
      }
    }

    return {
      label: 'After access',
      title: 'Build the starter tactic board.',
      body: 'TenAceIQ keeps the Improve court path attached, then opens Tactical Studio with the crosscourt board ready.',
    }
  }

  return null
}

function decodeNextHref(nextHref: string | null | undefined) {
  if (!nextHref) return ''

  let readableHref = nextHref
  for (let pass = 0; pass < 3; pass += 1) {
    try {
      const decodedHref = decodeURIComponent(readableHref)
      if (decodedHref === readableHref) break
      readableHref = decodedHref
    } catch {
      break
    }
  }

  return readableHref
}

function getReadableSearchParam(readableHref: string, paramName: string) {
  const queryStart = readableHref.indexOf('?')
  if (queryStart < 0) return ''

  const hashStart = readableHref.indexOf('#', queryStart)
  const rawSearch = readableHref.slice(queryStart + 1, hashStart >= 0 ? hashStart : undefined)
  return new URLSearchParams(rawSearch).get(paramName)?.trim() ?? ''
}

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

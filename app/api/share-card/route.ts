import { isTiqShareCardKind } from '@/lib/share-card'
import { renderTiqShareCard } from '@/lib/share-card-image'

export const runtime = 'nodejs'

function clean(value: string | null, maxLength: number) {
  return (value || '').trim().replace(/\s+/g, ' ').slice(0, maxLength)
}

export async function GET(request: Request) {
  const searchParams = new URL(request.url).searchParams
  const requestedKind = clean(searchParams.get('kind'), 24)
  const kind = isTiqShareCardKind(requestedKind) ? requestedKind : 'player'
  return renderTiqShareCard({
    kind,
    title: clean(searchParams.get('title'), 80) || 'Tennis intelligence',
    subtitle: clean(searchParams.get('subtitle'), 110),
    detail: clean(searchParams.get('detail'), 130),
  })
}

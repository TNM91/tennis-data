import { redirect } from 'next/navigation'

type TeamAliasPageProps = {
  params: Promise<{ id: string }>
  searchParams?: Promise<Record<string, string | string[] | undefined>>
}

function toParamValue(value: string | string[] | undefined) {
  if (Array.isArray(value)) return value[0] ?? ''
  return value ?? ''
}

export default async function TeamAliasPage({ params, searchParams }: TeamAliasPageProps) {
  const resolvedParams = await params
  const resolvedSearchParams = searchParams ? await searchParams : {}
  const nextParams = new URLSearchParams()

  for (const [key, rawValue] of Object.entries(resolvedSearchParams)) {
    const value = toParamValue(rawValue)
    if (!value) continue
    nextParams.set(key, value)
  }

  const query = nextParams.toString()
  redirect(`/teams/${encodeURIComponent(resolvedParams.id)}${query ? `?${query}` : ''}`)
}

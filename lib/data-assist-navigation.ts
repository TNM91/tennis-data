export function buildDataAssistSignInHref(query: string, section: 'upload' | 'history' = 'upload') {
  const params = new URLSearchParams(query)
  const search = params.toString()
  const next = `/data-assist${search ? `?${search}` : ''}#${section}`
  return `/login?${new URLSearchParams({ next }).toString()}`
}

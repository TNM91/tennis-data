/** Source-only team totals retain their original scorecard, separate from courts. */
export function teamResultHref(row: { id: string; source_url?: string | null }) {
  if (row.source_url) {
    try {
      const url = new URL(row.source_url)
      if (['http:', 'https:'].includes(url.protocol) && ['tennisrecord.com', 'www.tennisrecord.com'].includes(url.hostname)
        && !url.username && !url.password && !url.port
        && url.pathname.toLowerCase() === '/adult/matchresults.aspx'
        && /^20\d{2}$/.test(url.searchParams.get('year') || '') && /^\d+$/.test(url.searchParams.get('mid') || '')) {
        url.protocol = 'https:'
        url.hostname = 'www.tennisrecord.com'
        return url.toString()
      }
    } catch { /* A malformed locator must not become a link to another site. */ }
  }
  return `/matches/${encodeURIComponent(row.id)}`
}

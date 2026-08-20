import { createHash } from 'node:crypto'
import { isTennisRecordBlock } from './reconcile'

const allowedHosts = new Set(['tennisrecord.com', 'www.tennisrecord.com'])

export function assertAllowedTennisRecordUrl(input: string) {
  const url = new URL(input)
  if (!['https:', 'http:'].includes(url.protocol) || !allowedHosts.has(url.hostname.toLowerCase())) {
    throw new Error('TennisRecord collector accepts only normal TennisRecord HTTP(S) URLs.')
  }
  return url
}

export async function fetchTennisRecordPage(input: string, minIntervalMs: number) {
  const url = assertAllowedTennisRecordUrl(input)
  // Per-process pacing. No proxies, login, CAPTCHA handling, or retry-on-block behavior.
  await new Promise((resolve) => setTimeout(resolve, Math.max(1000, minIntervalMs)))
  const response = await fetch(url, {
    redirect: 'follow',
    headers: { 'user-agent': process.env.TENNISRECORD_USER_AGENT?.trim() || 'TenAceIQ collector (+contact@tenaceiq.com)', accept: 'text/html,application/xhtml+xml' },
    signal: AbortSignal.timeout(20_000),
  })
  const html = await response.text()
  const blockReason = isTennisRecordBlock(response.status, html)
  return { url: url.toString(), status: response.status, html: blockReason ? '' : html, blockReason, contentHash: createHash('sha256').update(html).digest('hex') }
}

import { createHash } from 'node:crypto'
import { isTennisRecordBlock } from './reconcile'

const allowedHosts = new Set(['tennisrecord.com', 'www.tennisrecord.com'])
const MAX_TRANSIENT_FETCH_ATTEMPTS = 2

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

export function assertAllowedTennisRecordUrl(input: string) {
  const url = new URL(input)
  if (!['https:', 'http:'].includes(url.protocol) || !allowedHosts.has(url.hostname.toLowerCase())) {
    throw new Error('TennisRecord collector accepts only normal TennisRecord HTTP(S) URLs.')
  }
  return url
}

export async function fetchTennisRecordPage(input: string, minIntervalMs: number) {
  const url = assertAllowedTennisRecordUrl(input)
  const intervalMs = Math.max(1000, minIntervalMs)

  // Per-process pacing. A thrown network error gets one ordinary, equally paced retry.
  // Responses (especially access blocks) never retry: no proxies, login, CAPTCHA handling,
  // or bypass behavior is permitted.
  for (let attempt = 0; attempt < MAX_TRANSIENT_FETCH_ATTEMPTS; attempt += 1) {
    await wait(intervalMs)
    try {
      const response = await fetch(url, {
        redirect: 'follow',
        headers: { 'user-agent': process.env.TENNISRECORD_USER_AGENT?.trim() || 'TenAceIQ collector (+contact@tenaceiq.com)', accept: 'text/html,application/xhtml+xml' },
        signal: AbortSignal.timeout(20_000),
      })
      const html = await response.text()
      const blockReason = isTennisRecordBlock(response.status, html)
      return {
        url: url.toString(),
        status: response.status,
        html: blockReason ? '' : html,
        blockReason,
        contentHash: createHash('sha256').update(html).digest('hex'),
        transientRetries: attempt,
      }
    } catch (error) {
      if (attempt === MAX_TRANSIENT_FETCH_ATTEMPTS - 1) throw error
    }
  }

  throw new Error('TennisRecord collector retry loop completed without a response.')
}

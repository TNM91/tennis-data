import { createHash } from 'node:crypto'
import { isTennisRecordBlock } from './reconcile'

const allowedHosts = new Set(['tennisrecord.com', 'www.tennisrecord.com'])
const MAX_TRANSIENT_FETCH_ATTEMPTS = 2

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

// Leave two minutes of the five-minute route allowance for reconciliation,
// baseline updates and saving the checkpoint. This is a source-work budget,
// not permission to cancel already captured evidence or skip reconciliation.
export const TENNISRECORD_SOURCE_WORK_BUDGET_MS = 3 * 60_000

export class TennisRecordCheckpointBudgetError extends Error {
  constructor() {
    super('Checkpoint source-work budget reached; continue on the next pass.')
    this.name = 'TennisRecordCheckpointBudgetError'
  }
}

export function hasTennisRecordFetchBudget(deadlineAt: number | undefined, minIntervalMs: number, now = Date.now()) {
  return deadlineAt === undefined || (Number.isFinite(deadlineAt) && deadlineAt - now > Math.max(1000, minIntervalMs))
}

export function assertAllowedTennisRecordUrl(input: string) {
  const url = new URL(input)
  if (!['https:', 'http:'].includes(url.protocol) || !allowedHosts.has(url.hostname.toLowerCase())) {
    throw new Error('TennisRecord collector accepts only normal TennisRecord HTTP(S) URLs.')
  }
  return url
}

export async function fetchTennisRecordPage(input: string, minIntervalMs: number, deadlineAt?: number) {
  const url = assertAllowedTennisRecordUrl(input)
  const intervalMs = Math.max(1000, minIntervalMs)

  // Per-process pacing. A thrown network error gets one ordinary, equally paced retry.
  // Responses (especially access blocks) never retry: no proxies, login, CAPTCHA handling,
  // or bypass behavior is permitted.
  for (let attempt = 0; attempt < MAX_TRANSIENT_FETCH_ATTEMPTS; attempt += 1) {
    if (!hasTennisRecordFetchBudget(deadlineAt, intervalMs)) throw new TennisRecordCheckpointBudgetError()
    await wait(intervalMs)
    const remainingMs = deadlineAt === undefined ? 20_000 : Math.floor(deadlineAt - Date.now())
    if (remainingMs <= 0) throw new TennisRecordCheckpointBudgetError()
    try {
      const response = await fetch(url, {
        redirect: 'follow',
        headers: { 'user-agent': process.env.TENNISRECORD_USER_AGENT?.trim() || 'TenAceIQ collector (+contact@tenaceiq.com)', accept: 'text/html,application/xhtml+xml' },
        signal: AbortSignal.timeout(Math.min(20_000, remainingMs)),
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
      if (deadlineAt !== undefined && Date.now() >= deadlineAt) throw new TennisRecordCheckpointBudgetError()
      if (attempt === MAX_TRANSIENT_FETCH_ATTEMPTS - 1) throw error
    }
  }

  throw new Error('TennisRecord collector retry loop completed without a response.')
}

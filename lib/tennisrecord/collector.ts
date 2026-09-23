import { createHash } from 'node:crypto'
import { rootCertificates } from 'node:tls'
import { Agent } from 'undici'
import { isTennisRecordBlock } from './reconcile'
import { emitImporterTelemetry, reportSourceAttempt, sourceTransportCodes, sourceTransportFailure, type SourceAttemptSample } from './telemetry'
import { GODADDY_TLS_ROOT_R1_PEM } from './godaddy-tls-root-r1'

const allowedHosts = new Set(['tennisrecord.com', 'www.tennisrecord.com'])
const MAX_TRANSIENT_FETCH_ATTEMPTS = 2
// Keep below the 20-second per-request deadline. The Undici default (10s)
// expires first on slow source handshakes, even when AbortSignal allows longer.
const TENNISRECORD_CONNECT_TIMEOUT_MS = 18_000

// TennisRecord now presents GoDaddy's R1 chain, which Node 22 does not yet
// trust by default. Extend the normal CA set only for this source; TLS hostname
// and certificate verification remain enabled. Never use a global dispatcher.
const tennisRecordDispatcher = new Agent({
  connect: { ca: [...rootCertificates, GODADDY_TLS_ROOT_R1_PEM], timeout: TENNISRECORD_CONNECT_TIMEOUT_MS },
})

// These events belong to this source-only Agent. Report connection outcomes
// and allowlisted codes, never origins, resolved addresses, headers or bodies.
tennisRecordDispatcher.on('connect', () => {
  emitImporterTelemetry({ event: 'tennisrecord_connection', outcome: 'connected' })
})
tennisRecordDispatcher.on('connectionError', (_origin, _targets, error) => {
  emitImporterTelemetry({ event: 'tennisrecord_connection', outcome: 'failed', category: sourceTransportFailure(error), transport_codes: sourceTransportCodes(error) })
})

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

export async function fetchTennisRecordPage(input: string, minIntervalMs: number, deadlineAt?: number, onAttempt?: (sample: SourceAttemptSample) => void) {
  const url = assertAllowedTennisRecordUrl(input)
  const intervalMs = Math.max(1000, minIntervalMs)

  // Per-process pacing. A thrown network error gets one ordinary, equally paced retry.
  // Responses (especially access blocks) never retry: no proxies, login, CAPTCHA handling,
  // or bypass behavior is permitted.
  for (let attempt = 0; attempt < MAX_TRANSIENT_FETCH_ATTEMPTS; attempt += 1) {
    if (!hasTennisRecordFetchBudget(deadlineAt, intervalMs)) throw new TennisRecordCheckpointBudgetError()
    const pacingStarted = performance.now()
    await wait(intervalMs)
    const fetchStarted = performance.now()
    const pacingMs = Math.max(0, Math.round(fetchStarted - pacingStarted))
    const remainingMs = deadlineAt === undefined ? 20_000 : Math.floor(deadlineAt - Date.now())
    if (remainingMs <= 0) throw new TennisRecordCheckpointBudgetError()
    try {
      const response = await fetch(url, {
        redirect: 'follow',
        headers: { 'user-agent': process.env.TENNISRECORD_USER_AGENT?.trim() || 'TenAceIQ collector (+contact@tenaceiq.com)', accept: 'text/html,application/xhtml+xml' },
        signal: AbortSignal.timeout(Math.min(20_000, remainingMs)),
        dispatcher: tennisRecordDispatcher,
      } as RequestInit & { dispatcher: Agent })
      const html = await response.text()
      const blockReason = isTennisRecordBlock(response.status, html)
      reportSourceAttempt(onAttempt, { attempt: attempt + 1, outcome: blockReason ? 'blocked' : response.ok ? 'success' : 'http_error', status: response.status, pacing_ms: pacingMs, fetch_ms: Math.max(0, Math.round(performance.now() - fetchStarted)) })
      return {
        url: url.toString(),
        status: response.status,
        html: blockReason ? '' : html,
        blockReason,
        contentHash: createHash('sha256').update(html).digest('hex'),
        transientRetries: attempt,
      }
    } catch (error) {
      reportSourceAttempt(onAttempt, { attempt: attempt + 1, outcome: sourceTransportFailure(error), status: null, pacing_ms: pacingMs, fetch_ms: Math.max(0, Math.round(performance.now() - fetchStarted)), transport_codes: sourceTransportCodes(error) })
      if (deadlineAt !== undefined && Date.now() >= deadlineAt) throw new TennisRecordCheckpointBudgetError()
      if (attempt === MAX_TRANSIENT_FETCH_ATTEMPTS - 1) throw error
    }
  }

  throw new Error('TennisRecord collector retry loop completed without a response.')
}

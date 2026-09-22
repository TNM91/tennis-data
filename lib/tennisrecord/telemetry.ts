import type { RecalcPhase } from '../recalculateRatings'

export type SourceAttemptSample = {
  attempt: number
  outcome: 'success' | 'http_error' | 'blocked' | 'timeout' | 'dns' | 'connection' | 'tls' | 'network'
  status: number | null
  pacing_ms: number
  fetch_ms: number
  transport_codes?: string[]
}

const SAFE_TRANSPORT_CODES = new Set([
  'ETIMEDOUT', 'UND_ERR_CONNECT_TIMEOUT', 'UND_ERR_HEADERS_TIMEOUT', 'UND_ERR_BODY_TIMEOUT',
  'ENOTFOUND', 'EAI_AGAIN', 'ECONNRESET', 'ECONNREFUSED', 'ECONNABORTED', 'EPIPE',
  'ENETUNREACH', 'EHOSTUNREACH', 'UND_ERR_SOCKET', 'UND_ERR_CONNECT',
  'CERT_HAS_EXPIRED', 'DEPTH_ZERO_SELF_SIGNED_CERT', 'UNABLE_TO_VERIFY_LEAF_SIGNATURE',
  'ERR_TLS_CERT_ALTNAME_INVALID', 'ERR_SSL_TLSV1_ALERT_INTERNAL_ERROR',
  'ERR_SSL_SSLV3_ALERT_HANDSHAKE_FAILURE', 'ERR_SSL_TLSV1_ALERT_ACCESS_DENIED',
  'ERR_SSL_TLSV1_ALERT_HANDSHAKE_FAILURE', 'ERR_SSL_WRONG_VERSION_NUMBER',
  'ERR_SSL_UNEXPECTED_EOF_WHILE_READING', 'ERR_SSL_EE_KEY_TOO_SMALL',
  'ERR_TLS_HANDSHAKE_TIMEOUT',
])

function isSafeTransportCode(code: string) {
  return SAFE_TRANSPORT_CODES.has(code)
    || (/^(ERR_SSL|ERR_TLS|UND_ERR)_[A-Z0-9_]{1,64}$/.test(code) && code.length <= 80)
}

/** Inspect wrapped and aggregate fetch causes, but emit only known Node error codes. */
export function sourceTransportCodes(error: unknown): string[] {
  const found = new Set<string>()
  const seen = new Set<object>()
  const inspect = (value: unknown, depth: number) => {
    if (!value || typeof value !== 'object' || seen.has(value) || depth > 3) return
    seen.add(value)
    const item = value as { code?: unknown; cause?: unknown; errors?: unknown }
    if (typeof item.code === 'string' && isSafeTransportCode(item.code)) found.add(item.code)
    inspect(item.cause, depth + 1)
    if (Array.isArray(item.errors)) item.errors.slice(0, 4).forEach(child => inspect(child, depth + 1))
  }
  inspect(error, 0)
  return [...found]
}

/** Allowlisted categories only: never log error messages, URLs or source bodies. */
export function sourceTransportFailure(error: unknown): SourceAttemptSample['outcome'] {
  const item = error as { name?: string } | null
  const code = sourceTransportCodes(error)[0]
  if (item?.name === 'TimeoutError' || item?.name === 'AbortError' || ['ETIMEDOUT', 'UND_ERR_CONNECT_TIMEOUT', 'UND_ERR_HEADERS_TIMEOUT', 'UND_ERR_BODY_TIMEOUT'].includes(code || '')) return 'timeout'
  if (['ENOTFOUND', 'EAI_AGAIN'].includes(code || '')) return 'dns'
  if (['ECONNRESET', 'ECONNREFUSED', 'ECONNABORTED', 'EPIPE', 'ENETUNREACH', 'EHOSTUNREACH', 'UND_ERR_SOCKET', 'UND_ERR_CONNECT'].includes(code || '')) return 'connection'
  if (code && (code.startsWith('ERR_SSL_') || code.startsWith('ERR_TLS_') || ['CERT_HAS_EXPIRED', 'DEPTH_ZERO_SELF_SIGNED_CERT', 'UNABLE_TO_VERIFY_LEAF_SIGNATURE'].includes(code))) return 'tls'
  return 'network'
}

export function emitImporterTelemetry(event: Record<string, unknown>) {
  // Observability must never alter retries, persistence, or lock cleanup.
  try { console.info(JSON.stringify({ level: 'info', ...event })) } catch { /* best effort */ }
}

export function reportSourceAttempt(observer: ((sample: SourceAttemptSample) => void) | undefined, sample: SourceAttemptSample) {
  try { observer?.(sample) } catch { /* instrumentation is not source work */ }
}

const elapsed = (start: number, end: number) => Math.max(0, Math.round(end - start))

export function createRatingTimingObserver(runId: string, clock = () => performance.now(), emit = emitImporterTelemetry) {
  const started = clock()
  let phase: Exclude<RecalcPhase, 'done'> | null = null
  let phaseStarted = started
  let finished = false
  const durations: Partial<Record<RecalcPhase, number>> = {}
  const safeEmit = (event: Record<string, unknown>) => {
    try { emit({ event: 'tennisrecord_rating_timing', run_id: runId, ...event }) } catch { /* best effort */ }
  }
  const closePhase = (now: number, status: 'completed' | 'failed') => {
    if (!phase) return
    const duration = elapsed(phaseStarted, now)
    durations[phase] = (durations[phase] || 0) + duration
    safeEmit({ kind: 'phase_finished', phase, status, duration_ms: duration })
    phase = null
  }
  return {
    onPhase(next: RecalcPhase) {
      if (finished) return
      const now = clock()
      closePhase(now, 'completed')
      if (next !== 'done') {
        phase = next
        phaseStarted = now
        safeEmit({ kind: 'phase_started', phase })
      }
    },
    finish(status: 'completed' | 'failed') {
      if (finished) return
      const now = clock()
      closePhase(now, status)
      finished = true
      safeEmit({ kind: 'engine_finished', status, duration_ms: elapsed(started, now), phases_ms: { ...durations } })
    },
  }
}

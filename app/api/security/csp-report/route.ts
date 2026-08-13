const MAX_REPORT_BYTES = 16_384

type UnknownRecord = Record<string, unknown>

function asRecord(value: unknown): UnknownRecord {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
    ? value as UnknownRecord
    : {}
}

function firstString(record: UnknownRecord, ...keys: string[]) {
  for (const key of keys) {
    const value = record[key]
    if (typeof value === 'string' && value.trim()) return value.trim().slice(0, 512)
  }
  return ''
}

function safeResource(value: string) {
  if (!value) return 'unknown'
  if (['inline', 'eval', 'data', 'blob'].includes(value)) return value

  try {
    return new URL(value).origin.slice(0, 256)
  } catch {
    return 'invalid'
  }
}

function normalizeReport(value: unknown) {
  const envelope = asRecord(value)
  const legacyBody = asRecord(envelope['csp-report'])
  const body = Object.keys(legacyBody).length ? legacyBody : asRecord(envelope.body)

  return {
    directive: (firstString(body, 'effective-directive', 'effectiveDirective', 'violated-directive', 'violatedDirective') || 'unknown').slice(0, 120),
    blockedResource: safeResource(firstString(body, 'blocked-uri', 'blockedURL', 'blockedUrl')),
    documentOrigin: safeResource(firstString(body, 'document-uri', 'documentURL', 'documentUrl', 'url')),
    sourceOrigin: safeResource(firstString(body, 'source-file', 'sourceFile')),
    disposition: (firstString(body, 'disposition') || 'report').slice(0, 40),
  }
}

export async function POST(request: Request) {
  const declaredLength = Number(request.headers.get('content-length') || 0)
  if (declaredLength > MAX_REPORT_BYTES) {
    return new Response(null, { status: 413 })
  }

  const rawBody = await request.text()
  if (new TextEncoder().encode(rawBody).byteLength > MAX_REPORT_BYTES) {
    return new Response(null, { status: 413 })
  }

  let payload: unknown
  try {
    payload = JSON.parse(rawBody)
  } catch {
    return new Response(null, { status: 400 })
  }

  const reports = Array.isArray(payload) ? payload : [payload]
  for (const report of reports.slice(0, 20)) {
    console.warn('[security:csp-report]', normalizeReport(report))
  }

  return new Response(null, {
    status: 204,
    headers: { 'Cache-Control': 'no-store' },
  })
}

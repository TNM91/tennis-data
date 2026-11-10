import { createHash } from 'node:crypto'

const validId = /^[a-zA-Z0-9_-]{1,80}$/
const validDigest = /^[a-f0-9]{64}$/

export function reviewedRevisionDigest(value: unknown) {
  const canonical = JSON.stringify(value, (_key, item: unknown) => {
    if (!item || typeof item !== 'object' || Array.isArray(item)) return item
    const record = item as Record<string, unknown>
    return Object.fromEntries(Object.keys(record).sort().map(key => [key, record[key]]))
  })
  return createHash('sha256').update(canonical).digest('hex')
}

export function readReviewedRevisions<K extends string>(
  config: string | undefined,
  detailKey: K,
): ReadonlyMap<string, Record<'summary' | K, string>> {
  const approvals = new Map<string, Record<'summary' | K, string>>()
  if (!config?.trim()) return approvals
  const value: unknown = JSON.parse(config)
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw Error('Invalid first-party approval list')
  }

  const entries = Object.entries(value) as [string, unknown][]
  if (entries.length > 50) throw Error('Too many first-party approvals')
  for (const [id, entry] of entries) {
    if (!validId.test(id) || !entry || typeof entry !== 'object' || Array.isArray(entry)) {
      throw Error('Invalid first-party approval')
    }
    const { summary, [detailKey]: detail } = entry as Record<string, unknown>
    if (typeof summary !== 'string' || typeof detail !== 'string' ||
        !validDigest.test(summary) || !validDigest.test(detail)) {
      throw Error('Invalid first-party revision')
    }
    approvals.set(id, { summary, [detailKey]: detail } as Record<'summary' | K, string>)
  }
  return approvals
}

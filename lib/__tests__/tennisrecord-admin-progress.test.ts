import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const read = (file: string) => readFileSync(join(process.cwd(), file), 'utf8')
const adminPage = read('app/admin/tennisrecord/page.tsx')
const service = read('lib/tennisrecord/service.ts')

describe('TennisRecord Admin import progress', () => {
  it('returns scoped campaign queue states for an active historical import', () => {
    expect(service).toContain('campaignProgress: {')
    expect(service).toContain("countCampaignPages('pending')")
    expect(service).toContain("countCampaignPages('done')")
  })

  it('shows a single delivery-style progress bar and transparent estimate', () => {
    expect(adminPage).toContain('aria-label="Historical import progress"')
    expect(adminPage).toContain('progressPercent')
    expect(adminPage).toContain('estimatedRemaining')
    expect(adminPage).toContain('Newly discovered public match pages can extend the queue.')
  })
})

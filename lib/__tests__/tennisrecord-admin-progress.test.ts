import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const read = (file: string) => readFileSync(join(process.cwd(), file), 'utf8')
const adminPage = read('app/admin/tennisrecord/page.tsx')
const service = read('lib/tennisrecord/service.ts')
const globalStyles = read('app/globals.css')

describe('TennisRecord Admin import progress', () => {
  it('returns scoped campaign queue states for an active historical import', () => {
    expect(service).toContain('campaignProgress: {')
    expect(service).toContain('weeklyProgress: {')
    expect(service).toContain("countCampaignPages('pending')")
    expect(service).toContain("countCampaignPages('done')")
    expect(service).toContain('seedTennisRecordCampaignFrontier')
    expect(service).toContain("return emptySummary('awaiting_seed')")
  })

  it('shows separate live historical and weekly delivery-style trackers', () => {
    expect(adminPage).toContain('ariaLabel="Historical import progress"')
    expect(adminPage).toContain('ariaLabel="Weekly refresh progress"')
    expect(adminPage).toContain('progressPercent')
    expect(adminPage).toContain('weeklyPercent')
    expect(adminPage).toContain('window.setInterval')
    expect(adminPage).toContain('newly discovered public match pages can extend the queue.')
    expect(adminPage).toContain('Seed Missouri frontier')
    expect(adminPage).toContain('Ready to start Missouri history')
  })

  it('keeps metric cards responsive instead of forcing phone screens into columns', () => {
    expect(globalStyles).toContain('repeat(auto-fit, minmax(min(100%, 210px), 1fr))')
    expect(globalStyles).toContain('@media (max-width: 767px)')
    expect(globalStyles).not.toContain('.metric-grid {\n    grid-template-columns: repeat(3, minmax(0, 1fr));')
  })
})

import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const sharedSource = readFileSync(join(process.cwd(), 'app/admin/_components/admin-review-ui.tsx'), 'utf8')
const dataAssistSource = readFileSync(join(process.cwd(), 'app/admin/data-assist/page.tsx'), 'utf8')
const matchReportsSource = readFileSync(join(process.cwd(), 'app/admin/match-reports/page.tsx'), 'utf8')
const productEventsSource = readFileSync(join(process.cwd(), 'app/admin/product-events/page.tsx'), 'utf8')
const missingScorecardsSource = readFileSync(join(process.cwd(), 'app/admin/missing-scorecards/page.tsx'), 'utf8')
const importQueueSource = readFileSync(join(process.cwd(), 'app/admin/import-queue/page.tsx'), 'utf8')

describe('admin review UI system', () => {
  it('centralizes common review queue surfaces', () => {
    expect(sharedSource).toContain('export function AdminReviewFrame')
    expect(sharedSource).toContain('export function AdminReviewHero')
    expect(sharedSource).toContain('export function AdminReviewGrid')
    expect(sharedSource).toContain('export function AdminReviewPanel')
    expect(sharedSource).toContain('export function AdminStatusPanel')
    expect(sharedSource).toContain('export function AdminEmptyState')
    expect(sharedSource).toContain('export function AdminFact')
  })

  it('keeps Data Assist and Match Reports on the shared admin review shell', () => {
    expect(dataAssistSource).toContain("from '@/app/admin/_components/admin-review-ui'")
    expect(matchReportsSource).toContain("from '@/app/admin/_components/admin-review-ui'")
    expect(dataAssistSource).toContain('<AdminReviewHero')
    expect(matchReportsSource).toContain('<AdminReviewHero')
    expect(dataAssistSource).toContain('<AdminReviewGrid>')
    expect(matchReportsSource).toContain('<AdminReviewGrid>')
  })

  it('keeps Product Events on the shared admin review shell', () => {
    expect(productEventsSource).toContain("from '@/app/admin/_components/admin-review-ui'")
    expect(productEventsSource).toContain('<AdminReviewFrame>')
    expect(productEventsSource).toContain('<AdminReviewHero')
    expect(productEventsSource).toContain('<AdminReviewPanel>')
    expect(productEventsSource).toContain('<AdminEmptyState')
  })

  it('keeps Missing Scorecards on the shared admin review shell', () => {
    expect(missingScorecardsSource).toContain("from '@/app/admin/_components/admin-review-ui'")
    expect(missingScorecardsSource).toContain('<AdminReviewFrame>')
    expect(missingScorecardsSource).toContain('<AdminReviewHero')
    expect(missingScorecardsSource).toContain('<AdminReviewPanel')
    expect(missingScorecardsSource).toContain('<AdminEmptyState')
    expect(missingScorecardsSource).toContain('className="metric-card"')
  })

  it('keeps Import Queue on the shared admin review shell', () => {
    expect(importQueueSource).toContain("from '@/app/admin/_components/admin-review-ui'")
    expect(importQueueSource).toContain('<AdminReviewFrame>')
    expect(importQueueSource).toContain('<AdminReviewHero')
    expect(importQueueSource).toContain('<AdminReviewPanel')
    expect(importQueueSource).toContain('<AdminStatusPanel')
    expect(importQueueSource).toContain('<AdminEmptyState')
    expect(importQueueSource).toContain('adminSubPanelStyle')
  })
})

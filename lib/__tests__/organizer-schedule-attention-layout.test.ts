import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const source = readFileSync(join(process.cwd(), 'app/components/organizer-schedule-attention.tsx'), 'utf8')

describe('Organizer schedule attention mobile layout', () => {
  it('turns each mobile row into one readable decision and action', () => {
    expect(source).toContain('function getDecisionSummary(item: OrganizerScheduleAttentionItem)')
    expect(source).toContain('still needed')
    expect(source).toContain('const decisionSummary = getDecisionSummary(item)')
    expect(source).toContain('aria-label={`${item.matchLabel}: ${decisionSummary}. ${copy.action}.`}')
    expect(source).toContain('<span style={compactDecisionStyle}>')
    expect(source).toContain('<span>{decisionSummary}</span>')
    expect(source).toContain('const compactDecisionStyle: CSSProperties')
    expect(source).toContain("overflowWrap: 'anywhere'")
    expect(source).toContain("background: 'rgba(163, 230, 53, 0.1)'")
  })
})

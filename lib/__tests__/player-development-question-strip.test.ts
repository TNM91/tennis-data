import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const systemSource = readFileSync(join(process.cwd(), 'app/player-development/_components/player-development-system.tsx'), 'utf8')
const stylesSource = readFileSync(join(process.cwd(), 'app/player-development/_components/player-development.module.css'), 'utf8')

describe('player development question strip', () => {
  it('frames the public player-development page around player questions', () => {
    expect(systemSource).toContain("import { DATA_ASSIST_STORY, PRODUCT_MOTTO, getMembershipTier } from '@/lib/product-story'")
    expect(systemSource).toContain('{PRODUCT_MOTTO} Choose what to work on, prove one habit, and keep the next step visible')
    expect(systemSource).toContain('PlayerQuestionStrip')
    expect(systemSource).toContain('Find the next useful tennis move.')
    expect(systemSource).toContain('Start with the question in your head')
    expect(systemSource).toContain('What should I work on?')
    expect(systemSource).toContain('How am I improving?')
    expect(systemSource).toContain('What matchups matter?')
    expect(systemSource).toContain('What drills or resources can help me level up faster?')
  })

  it('links each player question to a practical action path', () => {
    expect(systemSource).toContain("href: `/player-development/${identity.slug}#weekly-action-plan`")
    expect(systemSource).toContain("href: `/player-development/${identity.slug}#toolbelt`")
    expect(systemSource).toContain("href: `/player-development/${identity.slug}#match-card`")
    expect(systemSource).toContain("href: `/player-development/${identity.slug}/level-up`")
    expect(systemSource).toContain("cta: 'Choose a focus'")
    expect(systemSource).toContain("cta: 'Check progress'")
    expect(systemSource).toContain("cta: 'Prep the match'")
    expect(systemSource).toContain("cta: 'Open Level Up'")
  })

  it('keeps the question cards mobile-safe and tappable', () => {
    expect(stylesSource).toContain('.playerQuestionStrip')
    expect(stylesSource).toContain('.playerQuestionGrid')
    expect(stylesSource).toContain('grid-template-columns: repeat(4, minmax(0, 1fr))')
    expect(stylesSource).toContain('grid-template-columns: repeat(2, minmax(0, 1fr))')
    expect(stylesSource).toContain('.playerQuestionGrid,\n  .auditGrid')
    expect(stylesSource).toContain('overflow-wrap: anywhere')
    expect(stylesSource).toContain('min-width: 0')
  })
})

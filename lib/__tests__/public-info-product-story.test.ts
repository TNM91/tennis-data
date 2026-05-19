import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const aboutSource = readFileSync(join(process.cwd(), 'app/about/page.tsx'), 'utf8')
const faqSource = readFileSync(join(process.cwd(), 'app/faq/page.tsx'), 'utf8')
const howItWorksSource = readFileSync(join(process.cwd(), 'app/how-it-works/page.tsx'), 'utf8')

describe('public info product story copy', () => {
  it('reuses centralized Data Assist language on explainer pages', () => {
    for (const source of [aboutSource, faqSource, howItWorksSource]) {
      expect(source).toContain("import { DATA_ASSIST_STORY")
      expect(source).toContain('DATA_ASSIST_STORY.')
      expect(source).not.toContain('direct USTA API feed')
      expect(source).not.toContain('direct feed')
      expect(source).not.toContain('upload TennisLink exports')
    }

    expect(aboutSource).toContain('DATA_ASSIST_STORY.shortCue')
    expect(faqSource).toContain('DATA_ASSIST_STORY.shortCue')
    expect(faqSource).toContain('DATA_ASSIST_STORY.cta')
    expect(howItWorksSource).toContain('DATA_ASSIST_STORY.cta')
  })
})

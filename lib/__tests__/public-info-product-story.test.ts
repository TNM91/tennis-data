import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const aboutSource = readFileSync(join(process.cwd(), 'app/about/page.tsx'), 'utf8')
const contactSource = readFileSync(join(process.cwd(), 'app/contact/page.tsx'), 'utf8')
const faqSource = readFileSync(join(process.cwd(), 'app/faq/page.tsx'), 'utf8')
const howItWorksSource = readFileSync(join(process.cwd(), 'app/how-it-works/page.tsx'), 'utf8')
const methodologySource = readFileSync(join(process.cwd(), 'app/methodology/page.tsx'), 'utf8')
const resourcesSource = readFileSync(join(process.cwd(), 'app/resources/page.tsx'), 'utf8')
const globalsSource = readFileSync(join(process.cwd(), 'app/globals.css'), 'utf8')
const advertisingSource = readFileSync(join(process.cwd(), 'app/advertising-disclosure/page.tsx'), 'utf8')

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

  it('uses public workspace names on the About explainer', () => {
    expect(aboutSource).toContain('before choosing paid tools.')
    expect(aboutSource).toContain('How TenAceIQ adds value')
    expect(aboutSource).toContain('Team Hub and League Office reduce scattered work')
    expect(aboutSource).toContain('Team Hub,')
    expect(aboutSource).toContain('and League Office into one place')
    expect(aboutSource).not.toContain('before the next tennis job needs a hub')
    expect(aboutSource).not.toContain('before the next tennis job needs a home base')
    expect(aboutSource).not.toContain('before you need a paid workspace')
    expect(aboutSource).not.toContain('How the platform adds value')
    expect(aboutSource).not.toContain('Captain and League workspaces')
    expect(aboutSource).not.toContain('League workspaces into one place')
  })

  it('uses public workspace names on the How It Works explainer', () => {
    expect(howItWorksSource).toContain('repeatable tennis tools when the need grows')
    expect(howItWorksSource).toContain('before choosing the right paid tools')
    expect(howItWorksSource).toContain('Team Hub and Captain Tools')
    expect(howItWorksSource).toContain('Team Hub is built around actual weekly operations')
    expect(howItWorksSource).toContain('League Office is for organizers')
    expect(howItWorksSource).toContain('matchup context, team pages, or Team Hub')
    expect(howItWorksSource).not.toContain('repeatable workspaces when the work grows')
    expect(howItWorksSource).not.toContain('before the next tennis job needs a hub')
    expect(howItWorksSource).not.toContain('before the next tennis job needs a home base')
    expect(howItWorksSource).not.toContain('before they need a personal workspace')
    expect(howItWorksSource).not.toContain('Captain workflow')
    expect(howItWorksSource).not.toContain('team workspaces')
  })

  it('uses public tool names on FAQ and advertising pages', () => {
    expect(faqSource).toContain('Team Hub leads teams')
    expect(faqSource).toContain('League Office runs seasons')
    expect(faqSource).toContain('Coach Hub')
    expect(faqSource).toContain('Tournament Desk')
    expect(faqSource).toContain('changes tennis context')
    expect(faqSource).toContain('Common questions about TenAceIQ.')
    expect(faqSource).toContain('Start with the tennis need, account, and data context together.')
    expect(faqSource).toContain('League Office gives leagues, ladders, and tournaments organized competition tools.')
    expect(faqSource).not.toContain('Captain leads')
    expect(faqSource).not.toContain('League operates')
    expect(faqSource).not.toContain('Captain adds')
    expect(faqSource).not.toContain('League Office adds the workspace for leagues of players or teams.')
    expect(faqSource).not.toContain('changes platform data')
    expect(faqSource).not.toContain('Common questions about the platform.')
    expect(faqSource).not.toContain('so account and data context stays together.')
    expect(faqSource).not.toContain('season home base')

    expect(advertisingSource).toContain('Team Hub screens')
    expect(advertisingSource).toContain('tennis tools, and private user areas')
    expect(advertisingSource).not.toContain('Team Hub workflow screens')
    expect(advertisingSource).not.toContain('private user workflows')
    expect(advertisingSource).toContain('Ads are not intended for admin tools')
    expect(advertisingSource).not.toContain('captain workflow screens')
    expect(advertisingSource).not.toContain('navigation, workspaces, and private user workflows')
    expect(advertisingSource).not.toContain('admin workspaces')
  })

  it('keeps methodology review copy tied to tennis context', () => {
    expect(methodologySource).toContain('changing tennis context unchecked')
    expect(methodologySource).not.toContain('changing the platform unchecked')
  })

  it('keeps optional public info copy out of closed mobile layout', () => {
    for (const source of [aboutSource, contactSource, faqSource, howItWorksSource, methodologySource, resourcesSource]) {
      expect(source).toContain('className="publicInfoDetailsSection"')
    }

    expect(globalsSource).toContain('.publicInfoDetailsSection:not([open]) > :not(summary)')
  })
})

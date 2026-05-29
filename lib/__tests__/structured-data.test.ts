import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import {
  buildBreadcrumbJsonLd,
  buildFaqJsonLd,
  buildOrganizationJsonLd,
  buildPublicSectionBreadcrumbJsonLd,
  buildWebSiteJsonLd,
} from '../structured-data'

const layoutSource = readFileSync(join(process.cwd(), 'app/layout.tsx'), 'utf8')
const resourcesSource = readFileSync(join(process.cwd(), 'app/resources/page.tsx'), 'utf8')
const teamsSource = readFileSync(join(process.cwd(), 'app/teams/page.tsx'), 'utf8')
const leaguesSource = readFileSync(join(process.cwd(), 'app/leagues/page.tsx'), 'utf8')
const pricingSource = readFileSync(join(process.cwd(), 'app/pricing/page.tsx'), 'utf8')
const publicToolPages = [
  ['app/explore/page.tsx', 'explore-breadcrumb-jsonld'],
  ['app/players/page.tsx', 'players-breadcrumb-jsonld'],
  ['app/explore/leagues/page.tsx', 'explore-leagues-breadcrumb-jsonld'],
  ['app/explore/search/page.tsx', 'explore-search-breadcrumb-jsonld'],
  ['app/matchup/page.tsx', 'matchup-breadcrumb-jsonld'],
  ['app/player-development/page.tsx', 'player-development-breadcrumb-jsonld'],
  ['app/data-assist/page.tsx', 'data-assist-breadcrumb-jsonld'],
  ['app/rankings/page.tsx', 'rankings-breadcrumb-jsonld'],
] as const
const supportAndLegalPages = [
  ['app/about/page.tsx', 'about-breadcrumb-jsonld'],
  ['app/how-it-works/page.tsx', 'how-it-works-breadcrumb-jsonld'],
  ['app/methodology/page.tsx', 'methodology-breadcrumb-jsonld'],
  ['app/faq/page.tsx', 'faq-breadcrumb-jsonld'],
  ['app/contact/page.tsx', 'contact-breadcrumb-jsonld'],
  ['app/advertising-disclosure/page.tsx', 'advertising-disclosure-breadcrumb-jsonld'],
  ['app/legal/privacy/page.tsx', 'privacy-breadcrumb-jsonld'],
  ['app/legal/terms/page.tsx', 'terms-breadcrumb-jsonld'],
  ['app/legal/billing/page.tsx', 'billing-breadcrumb-jsonld'],
  ['app/legal/cookies/page.tsx', 'cookies-breadcrumb-jsonld'],
  ['app/legal/disclaimer/page.tsx', 'disclaimer-breadcrumb-jsonld'],
  ['app/legal/data-policy/page.tsx', 'data-policy-breadcrumb-jsonld'],
  ['app/legal/copyright/page.tsx', 'copyright-breadcrumb-jsonld'],
] as const

describe('structured data', () => {
  it('builds organization and website search schema for the public site', () => {
    expect(buildOrganizationJsonLd()).toMatchObject({
      '@context': 'https://schema.org',
      '@type': 'Organization',
      name: 'TenAceIQ',
      url: 'https://tenaceiq.com',
      slogan: 'More Tennis. Less Chaos.',
    })

    expect(buildWebSiteJsonLd()).toMatchObject({
      '@context': 'https://schema.org',
      '@type': 'WebSite',
      name: 'TenAceIQ',
      potentialAction: {
        '@type': 'SearchAction',
        target: 'https://tenaceiq.com/explore?q={search_term_string}',
        'query-input': 'required name=search_term_string',
      },
    })
  })

  it('builds breadcrumb and FAQ schema for public sections', () => {
    expect(buildPublicSectionBreadcrumbJsonLd('Coaches', '/coaches')).toEqual(buildBreadcrumbJsonLd([
      { name: 'Home', path: '/' },
      { name: 'Coaches', path: '/coaches' },
    ]))

    expect(buildFaqJsonLd([
      { question: 'How do I fix data?', answer: 'Use Data Assist.' },
    ])).toMatchObject({
      '@type': 'FAQPage',
      mainEntity: [
        {
          '@type': 'Question',
          name: 'How do I fix data?',
          acceptedAnswer: {
            '@type': 'Answer',
            text: 'Use Data Assist.',
          },
        },
      ],
    })
  })

  it('renders structured data scripts from layout and resources', () => {
    expect(layoutSource).toContain('tenaceiq-organization-jsonld')
    expect(layoutSource).toContain('tenaceiq-website-jsonld')
    expect(resourcesSource).toContain('resources-breadcrumb-jsonld')
    expect(resourcesSource).toContain('resources-faq-jsonld')
    expect(teamsSource).toContain('teams-breadcrumb-jsonld')
    expect(leaguesSource).toContain('leagues-breadcrumb-jsonld')
    expect(pricingSource).toContain('pricing-breadcrumb-jsonld')
  })

  it('renders breadcrumb schema on public support and legal pages', () => {
    for (const [path, scriptId] of supportAndLegalPages) {
      const source = readFileSync(join(process.cwd(), path), 'utf8')

      expect(source, path).toContain('JsonLd')
      expect(source, path).toContain('buildPublicSectionBreadcrumbJsonLd')
      expect(source, path).toContain(scriptId)
    }
  })

  it('renders breadcrumb schema on public command-center tools', () => {
    for (const [path, scriptId] of publicToolPages) {
      const source = readFileSync(join(process.cwd(), path), 'utf8')

      expect(source, path).toContain('JsonLd')
      expect(source, path).toContain('buildPublicSectionBreadcrumbJsonLd')
      expect(source, path).toContain(scriptId)
    }
  })

  it('renders FAQ schema from the public FAQ page answers', () => {
    const source = readFileSync(join(process.cwd(), 'app/faq/page.tsx'), 'utf8')

    expect(source).toContain('faq-page-jsonld')
    expect(source).toContain('buildFaqJsonLd(faqSchemaItems)')
    expect(source).toContain('Is TenAceIQ only for captains?')
    expect(source).toContain('How should I report a data issue?')
  })
})

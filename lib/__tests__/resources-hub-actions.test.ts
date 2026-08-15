import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const source = readFileSync(join(process.cwd(), 'app/resources/page.tsx'), 'utf8')
const commandCenterSource = readFileSync(join(process.cwd(), 'app/components/public-command-center.tsx'), 'utf8')

describe('Help and Resources', () => {
  it('states a clear purpose and keeps the page focused on help', () => {
    expect(source).toContain('Find the help you need.')
    expect(source).toContain('Learn the platform, set up your account, improve your game, add tennis data, or contact support.')
    expect(source).toContain('showSearch={false}')
    expect(source).toContain('showBoard={false}')
    expect(source).not.toContain('I need to...')
    expect(source).not.toContain('resourceNeedPath')
    expect(source).not.toContain('courts, clubs')
  })

  it('offers five short next steps without a split directory', () => {
    for (const title of [
      'Learn how TenAceIQ works',
      'Work on your game',
      'Set up your tennis profile',
      'Add or fix tennis data',
      'Get help from TenAceIQ',
    ]) {
      expect(source).toContain(`title: '${title}'`)
    }

    expect(source).toContain('<ActionGrid cards={resourceActions} />')
    expect(commandCenterSource).toContain("gridTemplateColumns: 'minmax(0, 1fr)'")
    expect(commandCenterSource).toContain('<p style={actionRowBodyStyle}>{card.body}</p>')
  })

  it('routes setup, data, FAQ, and support to working destinations', () => {
    expect(source).toContain("href: '/resources/platform-tour'")
    expect(source).toContain("secondaryHref: '/how-it-works'")
    expect(source).toContain("href: '/profile'")
    expect(source).toContain("href: '/resources/usta-upload'")
    expect(source).toContain("secondaryHref: '/data-assist?intent=upload-source&context=Resources'")
    expect(source).toContain("href: '/faq'")
    expect(source).toContain("secondaryHref: '/messages?compose=support'")
  })

  it('keeps canonical metadata and breadcrumb schema', () => {
    expect(source).toContain('buildRouteMetadata')
    expect(source).toContain("path: '/resources'")
    expect(source).toContain('resources-breadcrumb-jsonld')
    expect(source).toContain("buildPublicSectionBreadcrumbJsonLd('Help', '/resources')")
  })
})

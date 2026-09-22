import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const routeFiles = [
  ['app/player-development/workbook/page.tsx', '/player-development/workbook', 'player-development-workbook-breadcrumb-jsonld'],
  ['app/player-development/coach-planner/page.tsx', '/player-development/coach-planner', 'player-development-coach-planner-breadcrumb-jsonld'],
  ['app/player-development/[identity]/page.tsx', '/player-development/${identity.slug}', 'player-development-identity-breadcrumb-jsonld'],
  ['app/player-development/[identity]/workbook/page.tsx', '/player-development/${identity.slug}/workbook', 'player-development-identity-workbook-breadcrumb-jsonld'],
  ['app/player-development/[identity]/coach-planner/page.tsx', '/player-development/${identity.slug}/coach-planner', 'player-development-identity-coach-planner-breadcrumb-jsonld'],
] as const

describe('player development metadata', () => {
  it('keeps workbook and coach planner routes on shared canonical/social metadata', () => {
    for (const [file, path] of routeFiles) {
      const source = readFileSync(join(process.cwd(), file), 'utf8')

      expect(source, file).toContain('buildRouteMetadata')
      expect(
        source.includes(`path: '${path}'`) || source.includes(`path: \`${path}\``),
        file,
      ).toBe(true)
      expect(source, file).not.toContain('openGraph: {')
      expect(source, file).not.toContain('twitter: {')
    }
  })

  it('positions print routes as optional backups instead of workbook-first products', () => {
    const playerWorkbookSource = readFileSync(join(process.cwd(), 'app/player-development/workbook/page.tsx'), 'utf8')
    const identityWorkbookSource = readFileSync(
      join(process.cwd(), 'app/player-development/[identity]/workbook/page.tsx'),
      'utf8',
    )
    const coachPlannerSource = readFileSync(
      join(process.cwd(), 'app/player-development/coach-planner/page.tsx'),
      'utf8',
    )
    const identityCoachPlannerSource = readFileSync(
      join(process.cwd(), 'app/player-development/[identity]/coach-planner/page.tsx'),
      'utf8',
    )

    expect(playerWorkbookSource).toContain('Player Print Backup | TenAceIQ Player Development')
    expect(playerWorkbookSource).toContain('Optional TenAceIQ print backup pages')
    expect(playerWorkbookSource).toContain('Player Print Backup')
    expect(playerWorkbookSource).not.toContain('Player Workbook | TenAceIQ Player Development')
    expect(playerWorkbookSource).not.toContain('Printable TenAceIQ player workbook pages')

    expect(identityWorkbookSource).toContain('${identity.title} Print Backup | TenAceIQ Player Development')
    expect(identityWorkbookSource).toContain('Optional TenAceIQ print backup pages for ${identity.title}.')
    expect(identityWorkbookSource).toContain("name: 'Print Backup'")
    expect(identityWorkbookSource).not.toContain('${identity.title} Workbook | TenAceIQ Player Development')
    expect(identityWorkbookSource).not.toContain('Printable TenAceIQ workbook pages')

    for (const source of [coachPlannerSource, identityCoachPlannerSource]) {
      expect(source).toContain('Optional TenAceIQ coach planner print pages')
      expect(source).not.toContain('Printable TenAceIQ coach planner pages')
    }
  })

  it('renders breadcrumb schema on workbook and coach planner routes', () => {
    for (const [file, , scriptId] of routeFiles) {
      const source = readFileSync(join(process.cwd(), file), 'utf8')

      expect(source, file).toContain('JsonLd')
      expect(source, file).toContain('buildBreadcrumbJsonLd')
      expect(source, file).toContain(scriptId)
    }
  })
})

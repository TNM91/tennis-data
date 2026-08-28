import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const source = readFileSync(join(process.cwd(), 'app/teams/[team]/page.tsx'), 'utf8')

describe('team format-aware roster', () => {
  it('uses the registered match format before presenting discipline-specific team insights', () => {
    expect(source).toContain("from '@/lib/competition-format-registry'")
    expect(source).toContain('const isDoublesOnlyTeam = teamFormatSummary.singles === 0 && teamFormatSummary.doubles > 0')
    expect(source).toContain("isDoublesOnlyTeam ? 'Doubles Core' : 'Singles Core'")
    expect(source).toContain("isDoublesOnlyTeam ? 'Top Doubles Options' : 'Top Singles Options'")
    expect(source).toContain('!isDoublesOnlyTeam && bestDoubles.length')
    expect(source).toContain("if (!isDoublesOnlyTeam) options.push({ key: 'singles'")
  })

  it('makes the roster a captain-safe team people hub with private contact actions', () => {
    expect(source).toContain("from '@/lib/captain-roster-contacts'")
    expect(source).toContain('const teamContactsHref =')
    expect(source).toContain('private captain contacts saved for this team')
    expect(source).toContain('Text {contact.phone}')
    expect(source).toContain('TiQ Team Chat')
  })

  it('gives captains a private contact-readiness hub with direct contact actions', () => {
    expect(source).toContain('const captainContactCoverage = useMemo')
    expect(source).toContain('Contact readiness for match week')
    expect(source).toContain('Private to captains.')
    expect(source).toContain('Add missing mobiles')
    expect(source).toContain('mailto:${email}')
    expect(source).toContain('captainContactPreviewGridStyle')
    expect(source).toContain('const captainContactHrefFor = (playerName: string)')
    expect(source).toContain('href={captainContactHrefFor(player.name)}')
  })

  it('lets linked teammates open a direct TiQ message from a roster card', () => {
    expect(source).toContain('triggerLabel="Message in TiQ"')
    expect(source).toContain('recipientPlayerId={player.id}')
    expect(source).toContain('player.id !== linkedPlayerId')
  })
})

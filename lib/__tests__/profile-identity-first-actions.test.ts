import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const source = readFileSync(join(process.cwd(), 'app/profile/page.tsx'), 'utf8')

describe('profile identity first actions', () => {
  it('keeps unlinked users on a create-and-start flow', () => {
    expect(source).toContain('Set profile')
    expect(source).toContain('Start your TIQ')
    expect(source).toContain('Save your name, then add the first verified tennis signal.')
    expect(source).toContain('{profileComplete ? (')
  })

  it('keeps the self-rated profile path and first tennis moves visible', () => {
    expect(source).toContain('Self-rated profiles show an S until verified data replaces it.')
    expect(source).toContain('Create new self-rated profile')
    expect(source).toContain('Start with your name. Existing records appear only when they look relevant.')
    expect(source).toContain('matches.some((player) => player.id === selected.id)')
    expect(source).toContain('return merged.slice(0, 8)')
    expect(source).not.toContain('Choose existing record')
    expect(source).toContain("const dataAssistProfileHref = '/data-assist?intent=upload-source&context=Profile'")
    expect(source).toContain('Upload scorecard')
    expect(source).toContain('Local leagues')
    expect(source).toContain('Create TIQ league')
    expect(source).toContain('Find players')
  })

  it('keeps completed profiles on a useful next-move path', () => {
    expect(source).toContain('const profileNextMoves = [')
    expect(source).toContain("title: 'Start Level Up'")
    expect(source).toContain('href: PROFILE_LEVEL_UP_HREF')
    expect(source).toContain("title: 'Open development path'")
    expect(source).toContain('href: PROFILE_PLAYER_DEVELOPMENT_HREF')
    expect(source).toContain("title: 'Prep matchup'")
    expect(source).toContain("title: 'Fix tennis info'")
    expect(source).toContain("href: dataAssistProfileHref")
    expect(source).toContain('Self-rated is live. Add a scorecard or match signal when you are ready.')
    expect(source).toContain('Your player identity is ready across the portal.')
    expect(source).toContain('const nextMovePathStyle')
  })

  it('explains what the player ID powers after setup', () => {
    expect(source).toContain('const profilePlayerIdBenefits = [')
    expect(source).toContain('Player ID powers')
    expect(source).toContain('One tennis identity keeps Level Up, My Lab, matchup prep, and public records aligned.')
    expect(source).toContain('Recommended Level Up cards start from this player ID.')
    expect(source).toContain('Notes and follows stay attached to the right player.')
    expect(source).toContain('Self-rated starts now; verified data can replace it later.')
    expect(source).toContain("import { getPlayerDevelopmentIdentity, getPlayerDevelopmentIdentityActionRead } from '@/lib/player-development'")
    expect(source).toContain("const PROFILE_PLAYER_IDENTITY = getPlayerDevelopmentIdentity('relentless-competitor-4-0')")
    expect(source).toContain('const PROFILE_LEVEL_UP_HREF = `/level-up/${PROFILE_PLAYER_IDENTITY.slug}`')
    expect(source).toContain('const PROFILE_PLAYER_DEVELOPMENT_HREF = `/player-development/${PROFILE_PLAYER_IDENTITY.slug}`')
    expect(source).toContain('Player ID starter path')
    expect(source).toContain('aria-label="Profile Player ID starter read"')
    expect(source).toContain('Train first')
    expect(source).toContain('Proof target')
    expect(source).toContain('Match test')
    expect(source).toContain('Read Player ID')
    expect(source).toContain('const playerIdPowersStyle')
  })
})

import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

import { createTacticalTemplate } from '../tactical/templates'

const gateSource = readFileSync(join(process.cwd(), 'components/tactical/TiqTacticalStudioGate.tsx'), 'utf8')
const studioSource = readFileSync(join(process.cwd(), 'components/tactical/TiqTacticalStudio.tsx'), 'utf8')
const studioStyles = readFileSync(join(process.cwd(), 'components/tactical/TiqTacticalStudio.module.css'), 'utf8')
const markerIconsSource = readFileSync(join(process.cwd(), 'components/tactical/icons/TiqIcons.tsx'), 'utf8')
const courtOverlaySource = readFileSync(join(process.cwd(), 'components/tactical/TiqCourtOverlay.tsx'), 'utf8')
const tokenSource = readFileSync(join(process.cwd(), 'components/tactical/TiqTokens.tsx'), 'utf8')
const toolbarSource = readFileSync(join(process.cwd(), 'components/tactical/TiqToolbar.tsx'), 'utf8')
const boardSource = readFileSync(join(process.cwd(), 'components/tactical/TiqCourtBoard.tsx'), 'utf8')
const tacticalTypesSource = readFileSync(join(process.cwd(), 'lib/tactical/types.ts'), 'utf8')
const tacticalTemplatesSource = readFileSync(join(process.cwd(), 'lib/tactical/templates.ts'), 'utf8')

const TENNIS_BALL_ASSET = '/tiq/tokens/tennis-ball-reference.png'

describe('Tactical Studio player access', () => {
  it('lets Player users open Tactics Tools without requiring Coach', () => {
    expect(gateSource).toContain('access.canUseAdvancedPlayerInsights')
    expect(gateSource).toContain('Loading your tactical board.')
    expect(gateSource).not.toContain('Loading your tactical workspace.')
    expect(gateSource).toContain('TIQ Tactical Studio is part of Player, Coach, Captain, and Full-Court access.')
    expect(gateSource).toContain('planId="player_plus"')
    expect(gateSource).toContain('Unlock TIQ Tactical Studio with Player.')
    expect(gateSource).toContain('Player includes My Lab, Level Up, Tactics Tools')
  })

  it('keeps the opened studio chrome on the current Player tier name', () => {
    expect(studioSource).toContain('Player ready')
    expect(studioSource).not.toContain('Player+ ready')
  })

  it('opens player-ready starter boards from Improve links', () => {
    expect(studioSource).toContain('readTacticalEntryIntent')
    expect(studioSource).toContain("params.get('source')")
    expect(studioSource).toContain("params.get('template')")
    expect(studioSource).toContain("params.get('role')")
    expect(studioSource).toContain('setTemplateKey(nextEntryIntent.templateKey)')
    expect(studioSource).toContain('setRole(nextEntryIntent.role)')
    expect(studioSource).toContain('setBriefingRole(nextEntryIntent.role)')
    expect(studioSource).toContain('Improve board ready')
    expect(studioSource).toContain('styles.entryCallout')
    expect(studioSource).toContain('Improve starter')
    expect(studioSource).toContain('href="/player-development"')
    expect(studioSource).toContain('href="/mylab#player-workshop"')
    expect(studioStyles).toContain('.entryCallout')
    expect(studioStyles).toContain('.entryCalloutActions')
    expect(studioStyles).toContain('.entryCalloutLink')
  })

  it('connects Tactical Studio to a Player ID starter path before the unlock prompt', () => {
    expect(gateSource).toContain("import { getPlayerDevelopmentIdentity, getPlayerDevelopmentIdentityActionRead } from '@/lib/player-development'")
    expect(gateSource).toContain("const TACTICS_PLAYER_IDENTITY = getPlayerDevelopmentIdentity('smart-attacker-4-0-to-4-5')")
    expect(gateSource).toContain('const TACTICS_LEVEL_UP_HREF = `/level-up/${TACTICS_PLAYER_IDENTITY.slug}#level-up-flow`')
    expect(gateSource).toContain('const TACTICS_PLAYER_DEVELOPMENT_HREF = `/player-development/${TACTICS_PLAYER_IDENTITY.slug}`')
    expect(gateSource).toContain("const TACTICS_MY_LAB_HREF = '/mylab#level-up-proof'")
    expect(gateSource).toContain("const TACTICS_IMPROVE_HREF = '/tactics?source=improve&template=crosscourt&role=player'")
    expect(gateSource).toContain("ctaHref={getPlanUnlockHref('player_plus', TACTICS_IMPROVE_HREF)}")
    expect(gateSource).toContain('Tactics Player ID starter path')
    expect(gateSource).toContain('Tactics Player ID starter read')
    expect(gateSource).toContain('Start with the player read, then build the board.')
    expect(gateSource).toContain("label: 'Board starter'")
    expect(gateSource).toContain('Crosscourt pattern board')
    expect(gateSource).toContain('Start Level Up')
    expect(gateSource).toContain('Build starter board')
    expect(gateSource).toContain("href={getPlanUnlockHref('player_plus', TACTICS_IMPROVE_HREF)}")
    expect(gateSource).toContain('Read Player ID')
    expect(gateSource).toContain('href={TACTICS_MY_LAB_HREF}')
    expect(gateSource.indexOf('Tactics Player ID starter path')).toBeLessThan(gateSource.indexOf('Unlock TIQ Tactical Studio with Player.'))
  })

  it('keeps the Tactics Player ID bridge compact for phone layouts', () => {
    expect(gateSource).toContain('styles.tacticsPlayerIdTrail')
    expect(gateSource).toContain('styles.tacticsPlayerIdGrid')
    expect(gateSource).toContain('styles.tacticsPlayerIdActions')
    expect(studioStyles).toContain('grid-template-columns: repeat(auto-fit, minmax(min(100%, 180px), 1fr));')
    expect(gateSource).not.toContain('gateStats gateStats')
  })

  it('keeps the phone tactical board shrink-safe inside the viewport', () => {
    expect(studioStyles).toContain('.workspace > section')
    expect(studioStyles).toContain('max-width: 100svw;')
    expect(studioStyles).toContain('max-width: 100%;')
    expect(studioStyles).toContain('overflow-x: hidden;')
    expect(studioStyles).toContain('grid-template-columns: repeat(3, minmax(0, 1fr));')
    expect(studioStyles).toContain('max-height: none;')
    expect(studioStyles).toContain('width: 100%;')
  })

  it('uses the uploaded tennis ball image asset for tactical ball markers', () => {
    expect(tokenSource).toContain(TENNIS_BALL_ASSET)
    expect(markerIconsSource).toContain(TENNIS_BALL_ASSET)
    expect(courtOverlaySource).toContain('<symbol id="tiq-ball-marker"')
    expect(courtOverlaySource).toContain(TENNIS_BALL_ASSET)
    expect(studioStyles).toContain('.ballToken')
    expect(studioStyles).toContain('.ballTokenImage')
    expect(studioStyles).toContain('.ballPaletteButton')
  })

  it('keeps the Basic Board ball token separated from the server token', () => {
    const basicBoard = createTacticalTemplate('basicDoubles')
    const server = basicBoard.tokens.find((token) => token.type === 'player' && token.role === 'Server')
    const ball = basicBoard.tokens.find((token) => token.type === 'ball')

    expect(server).toBeDefined()
    expect(ball).toBeDefined()
    expect(ball!.x).toBeLessThan(server!.x - 4)
    expect(ball!.y).toBeLessThan(server!.y - 4)
  })

  it('keeps the upgraded tactical board workflow controls available', () => {
    expect(studioSource).toContain('boardFocusMode')
    expect(studioSource).toContain('presentationMode')
    expect(studioSource).toContain('downloadBoardPng')
    expect(studioSource).toContain('ScenarioThumbnail')
    expect(studioSource).toContain('applySnapPreset')
    expect(studioSource).toContain('addPathPreset')
    expect(studioSource).toContain('undoLastPath')
    expect(studioSource).toContain('BoardToolDock')
    expect(studioSource).toContain('clearBoardMarks')
    expect(toolbarSource).toContain('Token size')
    expect(toolbarSource).toContain('Snap spots')
    expect(toolbarSource).toContain('Export PNG')
    expect(toolbarSource).toContain('Present')
    expect(boardSource).toContain('roleView')
    expect(boardSource).toContain('readOnly')
    expect(boardSource).toContain('tokenScaleClass')
    expect(studioStyles).toContain('.boardFocusActive')
    expect(studioStyles).toContain('.presentationStage')
    expect(studioStyles).toContain('.scenarioThumbnail')
    expect(studioStyles).toContain('.tokenScaleLarge')
    expect(studioStyles).toContain('.boardToolDock')
    expect(studioStyles).toContain('position: sticky;')
    expect(tacticalTypesSource).toContain("export type TacticalTokenScale = 'small' | 'medium' | 'large'")
    expect(tacticalTemplatesSource).toContain('tacticalSnapPresets')
    expect(tacticalTemplatesSource).toContain('tacticalPathPresets')
  })
})

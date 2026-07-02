import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { LEVEL_UP_CARDS } from '../level-up/level-up-cards'
import { IDENTITY_LEVEL_UP_PROFILES } from '../level-up/identity-recommendations'
import { LEVEL_UP_MODULES } from '../level-up/level-up-modules'
import { getRecommendedCardsForIdentity, getRecommendedModulesForIdentity } from '../level-up/recommendations'
import {
  PLAYER_DEVELOPMENT_DIAGRAMS,
  PLAYER_DEVELOPMENT_IDENTITIES,
  getPlayerDevelopmentIdentityActionRead,
  getPlayerDevelopmentIdentityCourtsideRead,
} from '../player-development'
import { MEMBERSHIP_TIERS } from '../product-story'

const EMPTY_COPY_PATTERNS = [
  /body\s*toolkit/i,
  /body\s*toolbelt/i,
  /\btbd\b/i,
  /practice this skill/i,
  /do the drill/i,
  /improve your game/i,
  /generic/i,
]

const REQUIRED_LANE_TAGS = [
  'serve-target',
  'serve-plus-one',
  'return-intent',
  'return-recovery',
  'recovery-after-contact',
  'light-feet',
  'forehand',
  'backhand',
  'volley',
  'crosscourt-build',
  'doubles-communication',
  'pressure-reset',
  'conditioning',
  'mobility',
]

const TENNIS_TRANSFER_WORDS = [
  'tennis',
  'serve',
  'return',
  'ball',
  'point',
  'match',
  'rally',
  'contact',
  'recovery',
  'ready',
  'posture',
  'decision',
  'target',
  'split',
  'court',
  'forehand',
  'backhand',
  'volley',
]

describe('Level Up content quality', () => {
  it('keeps a deep tennis-specific card library across the main training lanes', () => {
    expect(LEVEL_UP_CARDS.length).toBeGreaterThanOrEqual(60)
    expect(new Set(LEVEL_UP_CARDS.map((card) => card.id)).size).toBe(LEVEL_UP_CARDS.length)

    for (const tag of REQUIRED_LANE_TAGS) {
      expect(LEVEL_UP_CARDS.some((card) => card.tags.includes(tag)), `missing lane tag: ${tag}`).toBe(true)
    }
  })

  it('keeps every player-facing card actionable, scoreable, and specific', () => {
    for (const card of LEVEL_UP_CARDS) {
      expect(card.title.trim(), card.id).not.toHaveLength(0)
      expect(card.useWhen.trim(), card.id).not.toHaveLength(0)
      expect(card.tennisGoal.trim(), card.id).not.toHaveLength(0)
      expect(card.cue.trim(), card.id).not.toHaveLength(0)
      expect(card.reward.trim(), card.id).not.toHaveLength(0)
      expect(card.proof, card.id).toMatch(/0-5/)
      expect(card.routine.length, card.id).toBeGreaterThanOrEqual(3)
      expect(card.tags.length, card.id).toBeGreaterThanOrEqual(2)
      expect(card.setting.length, card.id).toBeGreaterThanOrEqual(1)
      expect(card.equipment.length, card.id).toBeGreaterThanOrEqual(1)
      expect(card.progression?.trim(), card.id).not.toHaveLength(0)
      expect(card.regression?.trim(), card.id).not.toHaveLength(0)
      expect(card.qualityChecks?.length ?? 0, card.id).toBeGreaterThanOrEqual(3)
      expect(card.commonMiss?.miss.trim(), card.id).not.toHaveLength(0)
      expect(card.commonMiss?.fix.trim(), card.id).not.toHaveLength(0)
      expect(card.proofAnchors?.low.trim(), card.id).not.toHaveLength(0)
      expect(card.proofAnchors?.mid.trim(), card.id).not.toHaveLength(0)
      expect(card.proofAnchors?.high.trim(), card.id).not.toHaveLength(0)

      const playerCopy = [
        card.title,
        card.useWhen,
        card.tennisGoal,
        card.cue,
        ...card.routine,
        card.reward,
        card.proof,
        ...(card.qualityChecks ?? []),
        card.commonMiss?.miss ?? '',
        card.commonMiss?.fix ?? '',
        card.proofAnchors?.low ?? '',
        card.proofAnchors?.mid ?? '',
        card.proofAnchors?.high ?? '',
        card.progression ?? '',
        card.regression ?? '',
        card.safetyNote ?? '',
      ].join(' ')

      for (const pattern of EMPTY_COPY_PATTERNS) {
        expect(playerCopy, card.id).not.toMatch(pattern)
      }
    }
  })

  it('connects body, movement, and recovery work back to tennis transfer', () => {
    const performanceCards = LEVEL_UP_CARDS.filter((card) =>
      ['movement-engine', 'strength-stability', 'conditioning', 'mobility-stretch', 'recovery-reset'].includes(card.category)
    )

    expect(performanceCards.length).toBeGreaterThanOrEqual(20)

    for (const card of performanceCards) {
      const copy = [card.useWhen, card.tennisGoal, card.cue, card.reward, card.proof, ...(card.qualityChecks ?? [])]
        .join(' ')
        .toLowerCase()

      expect(
        TENNIS_TRANSFER_WORDS.some((word) => copy.includes(word)),
        `${card.id} should explain how the work transfers to tennis`
      ).toBe(true)

      if (card.category === 'conditioning' || card.category === 'strength-stability' || card.intensity === 'high') {
        expect(card.safetyNote?.trim(), `${card.id} needs technique-first safety copy`).not.toHaveLength(0)
      }
    }
  })

  it('keeps modules curated, linked to real cards, and usable as mini training blocks', () => {
    const cardIds = new Set(LEVEL_UP_CARDS.map((card) => card.id))

    expect(LEVEL_UP_MODULES.length).toBeGreaterThanOrEqual(12)
    expect(new Set(LEVEL_UP_MODULES.map((module) => module.id)).size).toBe(LEVEL_UP_MODULES.length)

    for (const levelUpModule of LEVEL_UP_MODULES) {
      expect(levelUpModule.subtitle.trim(), levelUpModule.id).not.toHaveLength(0)
      expect(levelUpModule.description.trim(), levelUpModule.id).not.toHaveLength(0)
      expect(levelUpModule.useWhen?.trim(), levelUpModule.id).not.toHaveLength(0)
      expect(levelUpModule.sessionPlan?.length ?? 0, levelUpModule.id).toBeGreaterThanOrEqual(3)
      expect(levelUpModule.successCriteria?.trim(), levelUpModule.id).not.toHaveLength(0)
      expect(levelUpModule.cardIds.length, levelUpModule.id).toBeGreaterThanOrEqual(2)
      expect(levelUpModule.tags.length, levelUpModule.id).toBeGreaterThanOrEqual(2)
      expect(levelUpModule.proof, levelUpModule.id).toMatch(/0-5/)

      for (const cardId of levelUpModule.cardIds) {
        expect(cardIds.has(cardId), `${levelUpModule.id} references missing card ${cardId}`).toBe(true)
      }
    }
  })

  it('keeps every player identity connected to recommended modules and starter cards', () => {
    const moduleIds = new Set(LEVEL_UP_MODULES.map((module) => module.id))
    const cardIds = new Set(LEVEL_UP_CARDS.map((card) => card.id))

    for (const identity of PLAYER_DEVELOPMENT_IDENTITIES) {
      const profile = IDENTITY_LEVEL_UP_PROFILES[identity.slug] ?? IDENTITY_LEVEL_UP_PROFILES.default
      expect(profile.recommendationCopy.trim(), identity.slug).not.toHaveLength(0)
      expect(getRecommendedModulesForIdentity(identity.slug).length, identity.slug).toBeGreaterThan(0)
      expect(getRecommendedCardsForIdentity(identity.slug).length, identity.slug).toBeGreaterThan(0)

      for (const moduleId of profile.featuredModuleIds) {
        expect(moduleIds.has(moduleId), `${identity.slug} references missing module ${moduleId}`).toBe(true)
      }

      for (const cardId of profile.starterCardIds) {
        expect(cardIds.has(cardId), `${identity.slug} references missing card ${cardId}`).toBe(true)
      }
    }
  })

  it('turns every player identity into a practical Player ID action read', () => {
    for (const identity of PLAYER_DEVELOPMENT_IDENTITIES) {
      const actionRead = getPlayerDevelopmentIdentityActionRead(identity)
      const actionCopy = [
        actionRead.label,
        actionRead.title,
        actionRead.trainingPriority,
        actionRead.proofTarget,
        actionRead.leakWatch,
        actionRead.matchTrigger,
        actionRead.coachPrompt,
        actionRead.nextCue,
        actionRead.levelUpNudge,
      ].join(' ')

      expect(actionRead.label, identity.slug).toContain('Player ID')
      expect(actionRead.trainingPriority.trim(), identity.slug).not.toHaveLength(0)
      expect(actionRead.proofTarget.trim(), identity.slug).not.toHaveLength(0)
      expect(actionRead.coachPrompt.trim(), identity.slug).not.toHaveLength(0)
      expect(actionRead.levelUpNudge, identity.slug).toContain('score the proof')
      expect(
        TENNIS_TRANSFER_WORDS.some((word) => actionCopy.toLowerCase().includes(word)),
        `${identity.slug} action read should stay tennis-specific`
      ).toBe(true)
    }
  })

  it('turns every player identity into a phone-courtside read', () => {
    for (const identity of PLAYER_DEVELOPMENT_IDENTITIES) {
      const courtsideRead = getPlayerDevelopmentIdentityCourtsideRead(identity)
      const values = [
        courtsideRead.trainFirst,
        courtsideRead.proof,
        courtsideRead.leak,
        courtsideRead.nextCue,
        courtsideRead.starterRep,
        courtsideRead.starterProofCue,
        courtsideRead.starterLeakWatch,
        courtsideRead.starterSmartNext,
      ]
      const joined = values.join(' ')

      for (const value of values) {
        expect(value.trim(), identity.slug).not.toHaveLength(0)
      }

      expect(courtsideRead.trainFirst, identity.slug).toContain(':')
      expect(courtsideRead.proof.split(':').length, identity.slug).toBe(2)
      expect(courtsideRead.starterRep, identity.slug).toMatch(/^Run one .+ rep where .+\.$/)
      expect(courtsideRead.starterProofCue, identity.slug).toMatch(/^Score it only when .+\.$/)
      expect(courtsideRead.starterLeakWatch, identity.slug).toMatch(/^Repeat slower if .+\.$/)
      expect(courtsideRead.starterSmartNext, identity.slug).toContain('4/5')
      expect(
        TENNIS_TRANSFER_WORDS.some((word) => joined.toLowerCase().includes(word)),
        `${identity.slug} courtside read should stay tennis-specific`
      ).toBe(true)
      expect(joined, identity.slug).not.toMatch(/\b(todo|tbd|placeholder|generic)\b/i)
    }
  })

  it('keeps every Player ID workbook module tied to a complete tactic-board read', () => {
    const diagramIds = new Set(Object.keys(PLAYER_DEVELOPMENT_DIAGRAMS))

    for (const identity of PLAYER_DEVELOPMENT_IDENTITIES) {
      expect(identity.weeks.length, identity.slug).toBeGreaterThanOrEqual(6)
      expect(new Set(identity.weeks.map((week) => week.week)).size, identity.slug).toBe(identity.weeks.length)

      for (const week of identity.weeks) {
        const meta = PLAYER_DEVELOPMENT_DIAGRAMS[week.diagram]
        expect(diagramIds.has(week.diagram), `${identity.slug} module ${week.week} references a missing diagram`).toBe(true)
        expect(meta.title.trim(), week.diagram).not.toHaveLength(0)
        expect(meta.intent.trim(), week.diagram).not.toHaveLength(0)
        expect(meta.setup.trim(), week.diagram).not.toHaveLength(0)
        expect(meta.read.trim(), week.diagram).not.toHaveLength(0)

        const moduleCopy = [
          week.title,
          week.objective,
          week.mainDrill,
          week.pressureGame,
          week.accountability,
          week.coachCue,
          week.tiqPrompt,
          meta.title,
          meta.intent,
          meta.setup,
          meta.read,
        ].join(' ')

        expect(moduleCopy, `${identity.slug} module ${week.week}`).not.toMatch(/\b(todo|tbd|placeholder|generic)\b/i)
        expect(
          TENNIS_TRANSFER_WORDS.some((word) => moduleCopy.toLowerCase().includes(word)),
          `${identity.slug} module ${week.week} should stay tennis-specific`
        ).toBe(true)
      }
    }
  })

  it('keeps tactic-board visual data wired into the shared printable renderer', () => {
    const systemSource = readFileSync(join(process.cwd(), 'app/player-development/_components/player-development-system.tsx'), 'utf8')
    const overlaySource = readFileSync(join(process.cwd(), 'components/tactical/TiqCourtOverlay.tsx'), 'utf8')
    const styleSource = readFileSync(join(process.cwd(), 'app/player-development/_components/player-development.module.css'), 'utf8')

    expect(systemSource).toContain('const overlay = getWorkbookCourtOverlay(tacticalOverlay)')
    expect(systemSource).toContain('const identityHeroDiagram = getIdentityHeroDiagram(identity)')
    expect(systemSource).toContain('function getIdentityHeroDiagram(identity: PlayerDevelopmentIdentity): PlayerDevelopmentDiagram')
    expect(systemSource).toContain("identity.weeks.find((week) => week.diagram !== 'player-led-review')?.diagram")
    expect(systemSource).toContain('const players = overlay.players?.map')
    expect(systemSource).toContain('players,')
    expect(systemSource).toContain('getDiagramStats(tacticalOverlay)')
    expect(overlaySource).toContain('function Label({')
    expect(overlaySource).toContain('tiq-overlay-label-shadow')
    expect(styleSource).toContain('.courtFigureStats')
    expect(styleSource).toContain('.courtFigure figcaption {')
    expect(styleSource).toContain('grid-template-columns: minmax(0, 1fr);')
    expect(styleSource).toContain('.printBook .courtFigureStats')
  })

  it('keeps player-development tier copy aligned to the Player plan name', () => {
    const metricActions = PLAYER_DEVELOPMENT_IDENTITIES.flatMap((identity) =>
      identity.metrics.map((metric) => metric.playerPlusAction)
    )
    const allIdentityCopy = PLAYER_DEVELOPMENT_IDENTITIES.map((identity) =>
      [
        identity.title,
        identity.archetype,
        identity.ratingBand,
        identity.programLabel,
        identity.audience,
        identity.promise,
        identity.mantra,
        identity.levelPath.context,
        ...identity.traits,
        ...identity.outcomes,
        ...identity.sections.flatMap((section) => [section.title, section.cue, ...section.drills, ...section.tracker]),
        ...identity.phases.flatMap((phase) => [phase.title, phase.weeks, phase.focus, phase.proof]),
        ...identity.metrics.flatMap((metric) => [
          metric.skill,
          metric.baseline,
          metric.target,
          metric.evidence,
          metric.playerPlusAction,
        ]),
        ...identity.weeks.flatMap((week) => [
          week.title,
          week.objective,
          week.mainDrill,
          week.pressureGame,
          week.accountability,
          week.coachCue,
          week.tiqPrompt,
        ]),
        ...identity.coachLessons.flatMap((plan) => [plan.focus, plan.objective, ...plan.blocks, plan.homework]),
        ...identity.reusableSheets,
        ...identity.tiqPrompts.flatMap((prompt) => [prompt.title, prompt.cue, prompt.href]),
        ...identity.identityProfile.primaryWeapons,
        ...identity.identityProfile.pressureHabits,
        ...identity.identityProfile.styleLeaks,
        ...identity.identityProfile.matchTriggers,
        ...identity.identityProfile.coachQuestions,
      ].join(' ')
    ).join(' ')

    expect(metricActions).toContain(`Log a ${MEMBERSHIP_TIERS.player_plus.name} note on restraint under pressure.`)
    expect(allIdentityCopy).not.toContain('Player+')
  })
})

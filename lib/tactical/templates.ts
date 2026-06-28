import type { TacticalFormationMode, TacticalPathPreset, TacticalScenario, TacticalSnapPreset, TacticalTemplateKey, TacticalToken } from './types'

export function createTacticalTemplate(key: TacticalTemplateKey): TacticalScenario {
  let idIndex = 0
  const id = (prefix: string) => `${key}-${prefix}-${idIndex += 1}`

  if (key === 'basicDoubles') {
    return {
      id: id('scenario'),
      name: 'Basic Doubles Board',
      category: 'practice',
      audience: ['captain', 'coach', 'player'],
      duration: 'Open',
      level: 'All levels',
      focus: 'Setup',
      note: 'Start with two players on each side and one ball. Add only the tactical marks, lines, and targets needed for the point.',
      tokens: [
        { id: id('token'), type: 'player', label: 'S', role: 'Server', x: 61, y: 82, team: 'green', handedness: 'righty' },
        { id: id('token'), type: 'player', label: 'N', role: 'Net', x: 39, y: 58, team: 'green', handedness: 'righty' },
        { id: id('token'), type: 'player', label: 'R', role: 'Returner', x: 36, y: 20, team: 'blue', handedness: 'righty' },
        { id: id('token'), type: 'player', label: 'P', role: 'Partner', x: 62, y: 42, team: 'blue', handedness: 'righty' },
        { id: id('token'), type: 'ball', label: '', x: 52, y: 74 },
      ],
      paths: [],
      zones: [],
      cues: [
        { id: id('cue'), role: 'coach', text: 'Keep the board clean first, then draw the point intention: ball, movement, recovery.' },
      ],
    }
  }

  if (key === 'australian') {
    return {
      id: id('scenario'),
      name: 'Australian Serve Pattern',
      category: 'match',
      audience: ['captain', 'coach'],
      duration: '10 min',
      level: '4.0+',
      focus: 'Formation',
      note: 'Stack near the center line, serve to the planned target, and take away the comfortable crosscourt return.',
      tokens: [
        { id: id('token'), type: 'player', label: 'S', role: 'Server', x: 56, y: 82, team: 'green', handedness: 'righty' },
        { id: id('token'), type: 'player', label: 'N', role: 'Net', x: 53, y: 58, team: 'green', handedness: 'lefty' },
        { id: id('token'), type: 'player', label: 'R', role: 'Returner', x: 70, y: 18, team: 'blue', handedness: 'righty' },
        { id: id('token'), type: 'ball', label: '', x: 55, y: 75 },
        { id: id('token'), type: 'cone', label: '', x: 34, y: 38 },
      ],
      paths: [
        { id: id('path'), kind: 'ball', label: 'Serve target', from: { x: 55, y: 75 }, to: { x: 34, y: 38 } },
        { id: id('path'), kind: 'move', label: 'Close', from: { x: 53, y: 58 }, to: { x: 43, y: 51 } },
        { id: id('path'), kind: 'recover', label: 'Cover', from: { x: 56, y: 82 }, to: { x: 66, y: 67 } },
      ],
      zones: [{ id: id('zone'), label: 'Target', x: 31, y: 34, width: 12, height: 8, tone: 'green' }],
      cues: [
        { id: id('cue'), role: 'coach', text: 'Server names the target before the point. Net player closes only after the return shape is clear.' },
      ],
    }
  }

  if (key === 'crosscourt') {
    return {
      id: id('scenario'),
      name: 'Crosscourt Pressure',
      category: 'practice',
      audience: ['coach', 'player'],
      duration: '18 min',
      level: '3.5+',
      focus: 'Rally Pattern',
      note: 'Build the crosscourt rally with depth, recover through the center, then attack when the ball lands short.',
      tokens: [
        { id: id('token'), type: 'player', label: 'A', role: 'Attacker', x: 37, y: 80, team: 'green', handedness: 'righty' },
        { id: id('token'), type: 'player', label: 'D', role: 'Defender', x: 68, y: 19, team: 'blue', handedness: 'righty' },
        { id: id('token'), type: 'ball', label: '', x: 41, y: 69 },
        { id: id('token'), type: 'cone', label: '', x: 28, y: 35 },
        { id: id('token'), type: 'cone', label: '', x: 72, y: 35 },
      ],
      paths: [
        { id: id('path'), kind: 'ball', label: 'Heavy cross', from: { x: 41, y: 69 }, to: { x: 68, y: 24 } },
        { id: id('path'), kind: 'recover', label: 'Recover', from: { x: 37, y: 80 }, to: { x: 51, y: 70 } },
        { id: id('path'), kind: 'move', label: 'Attack short', from: { x: 51, y: 70 }, to: { x: 60, y: 57 } },
      ],
      zones: [{ id: id('zone'), label: 'Open court', x: 28, y: 36, width: 16, height: 10, tone: 'green' }],
      cues: [
        { id: id('cue'), role: 'player', text: 'Win with height and depth first. Attack only after the ball lands short or stretches the opponent.' },
      ],
    }
  }

  if (key === 'coachProgression') {
    return {
      id: id('scenario'),
      name: 'Feed, Recover, Attack',
      category: 'practice',
      audience: ['coach', 'player'],
      duration: '15 min',
      level: '4.0',
      focus: 'Movement + Finish',
      note: 'Coach feeds a recoverable ball, player resets through the middle, attacks the short ball, and finishes balanced.',
      tokens: [
        { id: id('token'), type: 'player', label: 'P', role: 'Player', x: 47, y: 80, team: 'green', handedness: 'righty' },
        { id: id('token'), type: 'player', label: 'C', role: 'Coach', x: 74, y: 20, team: 'blue', handedness: 'righty' },
        { id: id('token'), type: 'ball', label: '', x: 72, y: 28 },
        { id: id('token'), type: 'cone', label: '', x: 60, y: 53 },
      ],
      paths: [
        { id: id('path'), kind: 'ball', label: 'Feed', from: { x: 72, y: 28 }, to: { x: 42, y: 70 } },
        { id: id('path'), kind: 'recover', label: 'Reset', from: { x: 42, y: 70 }, to: { x: 51, y: 68 } },
        { id: id('path'), kind: 'move', label: 'Attack', from: { x: 51, y: 68 }, to: { x: 60, y: 53 } },
      ],
      zones: [{ id: id('zone'), label: 'Attack lane', x: 56, y: 48, width: 15, height: 9, tone: 'green' }],
      cues: [
        { id: id('cue'), role: 'coach', text: 'Score the rep only if the player recovers before attacking.' },
      ],
    }
  }

  return {
    id: id('scenario'),
    name: 'Serve + Poach',
    category: 'match',
    audience: ['captain', 'coach', 'player'],
    duration: '12 min',
    level: '4.0+',
    focus: 'Serve Pattern',
    note: 'Serve to a real box target, net player reads the return lane, and server covers the next ball.',
    tokens: [
      { id: id('token'), type: 'player', label: 'S', role: 'Server', x: 63, y: 82, team: 'green', handedness: 'righty' },
      { id: id('token'), type: 'player', label: 'N', role: 'Net', x: 40, y: 58, team: 'green', handedness: 'lefty' },
      { id: id('token'), type: 'player', label: 'R', role: 'Returner', x: 67, y: 18, team: 'blue', handedness: 'righty' },
      { id: id('token'), type: 'ball', label: '', x: 50, y: 75 },
      { id: id('token'), type: 'cone', label: '', x: 70, y: 32 },
    ],
    paths: [
      { id: id('path'), kind: 'ball', label: 'Serve', from: { x: 50, y: 75 }, to: { x: 70, y: 32 } },
      { id: id('path'), kind: 'ball', label: 'Return lane', from: { x: 67, y: 22 }, to: { x: 56, y: 49 } },
      { id: id('path'), kind: 'move', label: 'Poach', from: { x: 40, y: 58 }, to: { x: 55, y: 49 } },
      { id: id('path'), kind: 'recover', label: 'Cover', from: { x: 63, y: 82 }, to: { x: 58, y: 66 } },
    ],
    zones: [{ id: id('zone'), label: 'Poach window', x: 57, y: 48, width: 16, height: 8, tone: 'green' }],
    cues: [
      { id: id('cue'), role: 'captain', text: 'Use when the returner is floating crosscourt or starting late.' },
      { id: id('cue'), role: 'player', text: 'Server hits the target first. Net player moves on the read, not the hope.' },
    ],
  }
}

export const tacticalTemplateMeta: Array<{ key: TacticalTemplateKey; name: string; category: 'match' | 'practice'; description: string }> = [
  { key: 'basicDoubles', name: 'Basic Board', category: 'practice', description: 'Two players each side, one ball, clean slate.' },
  { key: 'poach', name: 'Serve + Poach', category: 'match', description: 'Serve target, poach lane, cover the next ball.' },
  { key: 'australian', name: 'Australian', category: 'match', description: 'Stack near center and disrupt crosscourt comfort.' },
  { key: 'crosscourt', name: 'Crosscourt Pressure', category: 'practice', description: 'Build consistency, open space, then attack.' },
  { key: 'coachProgression', name: 'Coach Progression', category: 'practice', description: 'Feed, recover, attack, and finish at net.' },
]

export const tacticalFormationPresets: Array<{
  key: TacticalFormationMode
  label: string
  shortLabel: string
  description: string
  players: Array<Omit<TacticalToken, 'id' | 'type'>>
}> = [
  {
    key: 'singlesDeuce',
    label: 'Singles Deuce',
    shortLabel: '1 Deuce',
    description: 'Singles server and returner starting on the deuce side.',
    players: [
      { label: 'S', role: 'Server', x: 61, y: 82, team: 'green', handedness: 'righty' },
      { label: 'R', role: 'Returner', x: 36, y: 20, team: 'blue', handedness: 'righty' },
    ],
  },
  {
    key: 'singlesAd',
    label: 'Singles Ad',
    shortLabel: '1 Ad',
    description: 'Singles server and returner starting on the ad side.',
    players: [
      { label: 'S', role: 'Server', x: 39, y: 82, team: 'green', handedness: 'righty' },
      { label: 'R', role: 'Returner', x: 64, y: 20, team: 'blue', handedness: 'righty' },
    ],
  },
  {
    key: 'doublesDeuce',
    label: 'Doubles Deuce',
    shortLabel: '2 Deuce',
    description: 'Doubles server, net player, returner, and partner set for the deuce side.',
    players: [
      { label: 'S', role: 'Server', x: 61, y: 82, team: 'green', handedness: 'righty' },
      { label: 'N', role: 'Net', x: 39, y: 58, team: 'green', handedness: 'righty' },
      { label: 'R', role: 'Returner', x: 36, y: 20, team: 'blue', handedness: 'righty' },
      { label: 'P', role: 'Partner', x: 62, y: 42, team: 'blue', handedness: 'righty' },
    ],
  },
  {
    key: 'doublesAd',
    label: 'Doubles Ad',
    shortLabel: '2 Ad',
    description: 'Doubles server, net player, returner, and partner set for the ad side.',
    players: [
      { label: 'S', role: 'Server', x: 39, y: 82, team: 'green', handedness: 'righty' },
      { label: 'N', role: 'Net', x: 61, y: 58, team: 'green', handedness: 'righty' },
      { label: 'R', role: 'Returner', x: 64, y: 20, team: 'blue', handedness: 'righty' },
      { label: 'P', role: 'Partner', x: 38, y: 42, team: 'blue', handedness: 'righty' },
    ],
  },
]

export const tacticalSnapPresets: TacticalSnapPreset[] = [
  { key: 'baseline', label: 'Baseline', point: { x: 50, y: 80 } },
  { key: 'net', label: 'Net', point: { x: 50, y: 50 } },
  { key: 'deuceBox', label: 'Deuce box', point: { x: 64, y: 34 } },
  { key: 'adBox', label: 'Ad box', point: { x: 36, y: 34 } },
  { key: 'middle', label: 'Middle', point: { x: 50, y: 66 } },
  { key: 'alley', label: 'Alley', point: { x: 22, y: 58 } },
  { key: 'poachLane', label: 'Poach lane', point: { x: 57, y: 49 } },
]

export const tacticalPathPresets: TacticalPathPreset[] = [
  { key: 'serve', label: 'Serve', kind: 'ball', from: { x: 52, y: 75 }, to: { x: 68, y: 32 } },
  { key: 'return', label: 'Return', kind: 'ball', from: { x: 68, y: 22 }, to: { x: 45, y: 63 } },
  { key: 'recovery', label: 'Recovery', kind: 'recover', from: { x: 62, y: 79 }, to: { x: 52, y: 68 } },
  { key: 'poach', label: 'Poach', kind: 'move', from: { x: 39, y: 58 }, to: { x: 56, y: 49 } },
  { key: 'lob', label: 'Lob', kind: 'ball', from: { x: 37, y: 70 }, to: { x: 72, y: 20 } },
  { key: 'approach', label: 'Approach', kind: 'move', from: { x: 48, y: 75 }, to: { x: 55, y: 55 } },
]

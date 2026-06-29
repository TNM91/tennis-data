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
        { id: id('token'), type: 'player', label: 'S', role: 'Server', x: 62, y: 88, team: 'green', handedness: 'righty' },
        { id: id('token'), type: 'player', label: 'N', role: 'Net', x: 42, y: 60, team: 'green', handedness: 'righty' },
        { id: id('token'), type: 'player', label: 'R', role: 'Returner', x: 36, y: 12, team: 'blue', handedness: 'righty' },
        { id: id('token'), type: 'player', label: 'P', role: 'Partner', x: 62, y: 39, team: 'blue', handedness: 'righty' },
        { id: id('token'), type: 'ball', label: '', x: 51, y: 75 },
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
        { id: id('token'), type: 'player', label: 'S', role: 'Server', x: 56, y: 88, team: 'green', handedness: 'righty' },
        { id: id('token'), type: 'player', label: 'N', role: 'Net', x: 53, y: 60, team: 'green', handedness: 'lefty' },
        { id: id('token'), type: 'player', label: 'R', role: 'Returner', x: 70, y: 12, team: 'blue', handedness: 'righty' },
        { id: id('token'), type: 'ball', label: '', x: 55, y: 76 },
        { id: id('token'), type: 'cone', label: '', x: 34, y: 40 },
      ],
      paths: [
        { id: id('path'), kind: 'ball', label: 'Serve target', from: { x: 55, y: 76 }, to: { x: 34, y: 40 } },
        { id: id('path'), kind: 'move', label: 'Close', from: { x: 53, y: 60 }, to: { x: 43, y: 54 } },
        { id: id('path'), kind: 'recover', label: 'Cover', from: { x: 56, y: 88 }, to: { x: 66, y: 72 } },
      ],
      zones: [{ id: id('zone'), label: 'Target', x: 31, y: 37, width: 12, height: 8, tone: 'green' }],
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
        { id: id('token'), type: 'player', label: 'A', role: 'Attacker', x: 37, y: 86, team: 'green', handedness: 'righty' },
        { id: id('token'), type: 'player', label: 'D', role: 'Defender', x: 68, y: 14, team: 'blue', handedness: 'righty' },
        { id: id('token'), type: 'ball', label: '', x: 41, y: 70 },
        { id: id('token'), type: 'cone', label: '', x: 28, y: 38 },
        { id: id('token'), type: 'cone', label: '', x: 72, y: 38 },
      ],
      paths: [
        { id: id('path'), kind: 'ball', label: 'Heavy cross', from: { x: 41, y: 70 }, to: { x: 68, y: 20 } },
        { id: id('path'), kind: 'recover', label: 'Recover', from: { x: 37, y: 86 }, to: { x: 51, y: 72 } },
        { id: id('path'), kind: 'move', label: 'Attack short', from: { x: 51, y: 72 }, to: { x: 60, y: 58 } },
      ],
      zones: [{ id: id('zone'), label: 'Open court', x: 28, y: 39, width: 16, height: 10, tone: 'green' }],
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
        { id: id('token'), type: 'player', label: 'P', role: 'Player', x: 47, y: 86, team: 'green', handedness: 'righty' },
        { id: id('token'), type: 'player', label: 'C', role: 'Coach', x: 74, y: 15, team: 'blue', handedness: 'righty' },
        { id: id('token'), type: 'ball', label: '', x: 72, y: 26 },
        { id: id('token'), type: 'cone', label: '', x: 60, y: 55 },
      ],
      paths: [
        { id: id('path'), kind: 'ball', label: 'Feed', from: { x: 72, y: 26 }, to: { x: 42, y: 72 } },
        { id: id('path'), kind: 'recover', label: 'Reset', from: { x: 42, y: 72 }, to: { x: 51, y: 70 } },
        { id: id('path'), kind: 'move', label: 'Attack', from: { x: 51, y: 70 }, to: { x: 60, y: 55 } },
      ],
      zones: [{ id: id('zone'), label: 'Attack lane', x: 56, y: 50, width: 15, height: 9, tone: 'green' }],
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
      { id: id('token'), type: 'player', label: 'S', role: 'Server', x: 63, y: 88, team: 'green', handedness: 'righty' },
      { id: id('token'), type: 'player', label: 'N', role: 'Net', x: 40, y: 60, team: 'green', handedness: 'lefty' },
      { id: id('token'), type: 'player', label: 'R', role: 'Returner', x: 67, y: 12, team: 'blue', handedness: 'righty' },
      { id: id('token'), type: 'ball', label: '', x: 50, y: 76 },
      { id: id('token'), type: 'cone', label: '', x: 70, y: 35 },
    ],
    paths: [
      { id: id('path'), kind: 'ball', label: 'Serve', from: { x: 50, y: 76 }, to: { x: 70, y: 35 } },
      { id: id('path'), kind: 'ball', label: 'Return lane', from: { x: 67, y: 18 }, to: { x: 56, y: 52 } },
      { id: id('path'), kind: 'move', label: 'Poach', from: { x: 40, y: 60 }, to: { x: 55, y: 52 } },
      { id: id('path'), kind: 'recover', label: 'Cover', from: { x: 63, y: 88 }, to: { x: 58, y: 72 } },
    ],
    zones: [{ id: id('zone'), label: 'Poach window', x: 57, y: 50, width: 16, height: 8, tone: 'green' }],
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
      { label: 'S', role: 'Server', x: 62, y: 88, team: 'green', handedness: 'righty' },
      { label: 'R', role: 'Returner', x: 36, y: 12, team: 'blue', handedness: 'righty' },
    ],
  },
  {
    key: 'singlesAd',
    label: 'Singles Ad',
    shortLabel: '1 Ad',
    description: 'Singles server and returner starting on the ad side.',
    players: [
      { label: 'S', role: 'Server', x: 38, y: 88, team: 'green', handedness: 'righty' },
      { label: 'R', role: 'Returner', x: 64, y: 12, team: 'blue', handedness: 'righty' },
    ],
  },
  {
    key: 'doublesDeuce',
    label: 'Doubles Deuce',
    shortLabel: '2 Deuce',
    description: 'Doubles server, net player, returner, and partner set for the deuce side.',
    players: [
      { label: 'S', role: 'Server', x: 62, y: 88, team: 'green', handedness: 'righty' },
      { label: 'N', role: 'Net', x: 42, y: 60, team: 'green', handedness: 'righty' },
      { label: 'R', role: 'Returner', x: 36, y: 12, team: 'blue', handedness: 'righty' },
      { label: 'P', role: 'Partner', x: 62, y: 39, team: 'blue', handedness: 'righty' },
    ],
  },
  {
    key: 'doublesAd',
    label: 'Doubles Ad',
    shortLabel: '2 Ad',
    description: 'Doubles server, net player, returner, and partner set for the ad side.',
    players: [
      { label: 'S', role: 'Server', x: 38, y: 88, team: 'green', handedness: 'righty' },
      { label: 'N', role: 'Net', x: 58, y: 60, team: 'green', handedness: 'righty' },
      { label: 'R', role: 'Returner', x: 64, y: 12, team: 'blue', handedness: 'righty' },
      { label: 'P', role: 'Partner', x: 38, y: 39, team: 'blue', handedness: 'righty' },
    ],
  },
]

export const tacticalSnapPresets: TacticalSnapPreset[] = [
  { key: 'baseline', label: 'Baseline', point: { x: 50, y: 88 } },
  { key: 'net', label: 'Net', point: { x: 50, y: 50 } },
  { key: 'deuceBox', label: 'Deuce box', point: { x: 64, y: 38 } },
  { key: 'adBox', label: 'Ad box', point: { x: 36, y: 38 } },
  { key: 'middle', label: 'Middle', point: { x: 50, y: 70 } },
  { key: 'alley', label: 'Alley', point: { x: 22, y: 60 } },
  { key: 'poachLane', label: 'Poach lane', point: { x: 57, y: 52 } },
]

export const tacticalPathPresets: TacticalPathPreset[] = [
  { key: 'serve', label: 'Serve', kind: 'ball', from: { x: 52, y: 76 }, to: { x: 68, y: 35 } },
  { key: 'return', label: 'Return', kind: 'ball', from: { x: 68, y: 18 }, to: { x: 45, y: 65 } },
  { key: 'recovery', label: 'Recovery', kind: 'recover', from: { x: 62, y: 86 }, to: { x: 52, y: 70 } },
  { key: 'poach', label: 'Poach', kind: 'move', from: { x: 39, y: 60 }, to: { x: 56, y: 52 } },
  { key: 'lob', label: 'Lob', kind: 'ball', from: { x: 37, y: 72 }, to: { x: 72, y: 16 } },
  { key: 'approach', label: 'Approach', kind: 'move', from: { x: 48, y: 76 }, to: { x: 55, y: 57 } },
]

import type { DrillOverlay } from '../types'
import { courtSpots, courtZones } from '../coordinates'

export const sampleServePlusOne: DrillOverlay = {
  arrows: [
    {
      curved: true,
      from: courtSpots.serverDeuce,
      id: 'serve-wide',
      label: 'serve',
      to: courtSpots.deuceServeWide,
      type: 'ball',
    },
    {
      curved: true,
      from: courtSpots.deuceServeWide,
      id: 'return-middle',
      label: 'return',
      to: courtSpots.attackBall,
      type: 'ball',
    },
    {
      from: courtSpots.serverDeuce,
      id: 'recover',
      to: courtSpots.attackBall,
      type: 'recovery',
    },
  ],
  markers: [
    { id: 'serve-ball', type: 'ball', ...courtSpots.deuceServeWide },
    { id: 'attack-ball', label: '+1', type: 'ball', ...courtSpots.attackBall },
    { id: 'cone-target', type: 'cone', ...courtSpots.netPlayer },
  ],
  players: [
    { handedness: 'righty', id: 'server', label: 'S', pose: 'serve', team: 'home', ...courtSpots.serverDeuce },
    { handedness: 'righty', id: 'receiver', label: 'R', pose: 'ready', team: 'away', ...courtSpots.returnerDeuce },
    { handedness: 'righty', id: 'net-player', label: 'P', pose: 'volley', team: 'home', ...courtSpots.netPlayer },
  ],
  zones: [{ ...courtZones.deuceServiceTargets, id: 'serve-target-window' }],
}

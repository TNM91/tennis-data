import type { ArrowType, DrillArrow, DrillMarker, DrillOverlay, DrillPlayer, DrillZone, PlayerTeam } from './types'

type TiqCourtOverlayProps = {
  overlay?: DrillOverlay
  showLabels?: boolean
}

const arrowColor: Record<ArrowType, string> = {
  ball: '#9be11d',
  movement: '#35a7ff',
  recovery: '#f8fbff',
}

const arrowDash: Record<ArrowType, string> = {
  ball: '7 5',
  movement: '4 5',
  recovery: '3 6',
}

const teamColor: Record<PlayerTeam, string> = {
  A: '#9be11d',
  B: '#35a7ff',
  away: '#35a7ff',
  home: '#9be11d',
  neutral: '#f8fbff',
}

export default function TiqCourtOverlay({ overlay, showLabels = true }: TiqCourtOverlayProps) {
  if (!overlay) return null

  return (
    <svg
      aria-hidden="true"
      preserveAspectRatio="none"
      style={{ height: '100%', inset: 0, pointerEvents: 'none', position: 'absolute', width: '100%' }}
      viewBox="0 0 100 100"
    >
      <defs>
        <filter id="tiq-overlay-glow" x="-30%" y="-30%" width="160%" height="160%">
          <feDropShadow dx="0" dy="0" stdDeviation="1.2" floodColor="#9be11d" floodOpacity="0.55" />
        </filter>
        {Object.entries(arrowColor).map(([type, color]) => (
          <marker id={`tiq-arrow-head-${type}`} key={type} markerHeight="4" markerWidth="4" orient="auto" refX="3.2" refY="2" viewBox="0 0 4 4">
            <path d="M0 0 4 2 0 4Z" fill={color} />
          </marker>
        ))}
        <symbol id="tiq-player-head" viewBox="-6 -6 12 12">
          <circle cx="0" cy="0" fill="#07101e" r="5.1" stroke="currentColor" strokeWidth="0.95" />
          <path d="M-4.8 0.2C-2.6 -3.15 0 -2.45 2.05 0.25C3.25 1.8 4.55 1.85 5.2 0.55" fill="none" stroke="currentColor" strokeLinecap="round" strokeWidth="1.05" />
        </symbol>
        <symbol id="tiq-ball-marker" viewBox="-5 -5 10 10">
          <circle cx="0" cy="0" fill="#dfff73" r="3.35" stroke="#07101e" strokeWidth="0.85" />
          <path d="M-3.1 0.1C-1.45 -2.55 1 -1.95 2.35 0.05C3.15 1.25 3.85 1.2 4.25 0.35" fill="none" stroke="#9be11d" strokeLinecap="round" strokeWidth="0.85" />
        </symbol>
        <symbol id="tiq-cone-marker" viewBox="-5 -5 10 10">
          <path d="M0 -3.8L3.35 3.2H-3.35Z" fill="#ffc257" stroke="#07101e" strokeLinejoin="round" strokeWidth="0.7" />
          <path d="M-4.1 3.2H4.1" stroke="#9be11d" strokeLinecap="round" strokeWidth="0.7" />
        </symbol>
        <marker id="tiq-arrow-head" markerHeight="4" markerWidth="4" orient="auto" refX="3.2" refY="2" viewBox="0 0 4 4">
          <path d="M0 0 4 2 0 4Z" fill="#9be11d" />
        </marker>
      </defs>
      {overlay.zones?.map((zone) => <Zone key={zone.id} zone={zone} showLabel={showLabels} />)}
      {overlay.arrows?.map((arrow) => <Arrow key={arrow.id} arrow={arrow} showLabel={showLabels} />)}
      {overlay.markers?.map((marker) => <Marker key={marker.id} marker={marker} showLabel={showLabels} />)}
      {overlay.players?.map((player) => <Player key={player.id} player={player} showLabel={showLabels} />)}
      {showLabels && overlay.labels?.map((label) => (
        <text
          fill={label.tone === 'danger' ? '#ffc257' : label.tone === 'muted' ? 'rgba(248,251,255,0.72)' : '#f8fbff'}
          fontSize="2.8"
          fontWeight="800"
          key={label.id}
          paintOrder="stroke"
          stroke="rgba(2,8,18,0.78)"
          strokeLinejoin="round"
          strokeWidth="0.7"
          textAnchor="middle"
          x={label.x}
          y={label.y}
        >
          {label.text}
        </text>
      ))}
    </svg>
  )
}

function Zone({ zone, showLabel }: { zone: DrillZone; showLabel: boolean }) {
  const centerX = zone.x + zone.width / 2
  const centerY = zone.y + zone.height / 2
  const fill = {
    blue: 'rgba(53,167,255,0.18)',
    green: 'rgba(155,225,29,0.18)',
    white: 'rgba(248,251,255,0.14)',
  }[zone.tone ?? 'green']
  const stroke = {
    blue: 'rgba(53,167,255,0.72)',
    green: 'rgba(155,225,29,0.72)',
    white: 'rgba(248,251,255,0.7)',
  }[zone.tone ?? 'green']

  return (
    <g>
      <rect
        fill={fill}
        height={zone.height}
        rx="1.2"
        stroke={stroke}
        strokeWidth="0.45"
        width={zone.width}
        x={zone.x}
        y={zone.y}
      />
      {zone.marker === 'cone' ? <use href="#tiq-cone-marker" height="7" width="7" x={centerX - 3.5} y={centerY - 3.5} /> : null}
      {zone.marker === 'target' ? (
        <g filter="url(#tiq-overlay-glow)">
          <circle cx={centerX} cy={centerY} fill="none" r="3.6" stroke="#9be11d" strokeWidth="0.7" />
          <circle cx={centerX} cy={centerY} fill="rgba(155,225,29,0.18)" r="1.6" stroke="#dfff73" strokeWidth="0.5" />
        </g>
      ) : null}
      {showLabel && zone.label ? (
        <text fill="#dff8c2" fontSize="2.35" fontWeight="800" textAnchor="middle" x={centerX} y={centerY}>
          {zone.label}
        </text>
      ) : null}
    </g>
  )
}

function Arrow({ arrow, showLabel }: { arrow: DrillArrow; showLabel: boolean }) {
  const type = arrow.type ?? 'movement'
  const color = arrowColor[type]
  const midX = (arrow.from.x + arrow.to.x) / 2
  const midY = (arrow.from.y + arrow.to.y) / 2
  const curveY = type === 'ball' ? -6 : -3
  const path = `M ${arrow.from.x} ${arrow.from.y} Q ${midX} ${midY + curveY} ${arrow.to.x} ${arrow.to.y}`

  return (
    <g filter={type === 'ball' ? 'url(#tiq-overlay-glow)' : undefined}>
      {arrow.curved ? (
        <path
          d={path}
          fill="none"
          markerEnd={`url(#tiq-arrow-head-${type})`}
          stroke={color}
          strokeDasharray={arrowDash[type]}
          strokeLinecap="round"
          strokeWidth={type === 'ball' ? 1.05 : 0.75}
        />
      ) : (
        <line
          markerEnd={`url(#tiq-arrow-head-${type})`}
          stroke={color}
          strokeDasharray={arrowDash[type]}
          strokeLinecap="round"
          strokeWidth={type === 'ball' ? 1.05 : 0.75}
          x1={arrow.from.x}
          x2={arrow.to.x}
          y1={arrow.from.y}
          y2={arrow.to.y}
        />
      )}
      {type === 'ball' ? <use href="#tiq-ball-marker" height="4.6" width="4.6" x={arrow.to.x - 2.3} y={arrow.to.y - 2.3} /> : null}
      {showLabel && arrow.label ? (
        <text fill={color} fontSize="2.35" fontWeight="800" paintOrder="stroke" stroke="rgba(2,8,18,0.82)" strokeWidth="0.6" textAnchor="middle" x={midX} y={midY + (arrow.curved ? curveY : -1.5)}>
          {arrow.label}
        </text>
      ) : null}
    </g>
  )
}

function Marker({ marker, showLabel }: { marker: DrillMarker; showLabel: boolean }) {
  const size = marker.size ?? (marker.type === 'ball' ? 5 : 7)
  const symbol = marker.type === 'ball' ? '#tiq-ball-marker' : '#tiq-cone-marker'

  return (
    <g filter="url(#tiq-overlay-glow)">
      <use href={symbol} height={size} width={size} x={marker.x - size / 2} y={marker.y - size / 2} />
      {showLabel && marker.label ? (
        <text fill="#f8fbff" fontSize="2.15" fontWeight="800" paintOrder="stroke" stroke="rgba(2,8,18,0.86)" strokeWidth="0.55" textAnchor="middle" x={marker.x} y={marker.y + size / 2 + 3}>
          {marker.label}
        </text>
      ) : null}
    </g>
  )
}

function Player({ player, showLabel }: { player: DrillPlayer; showLabel: boolean }) {
  const stroke = teamColor[player.team ?? 'A']
  const handednessScale = player.handedness === 'lefty' ? -1 : 1
  const pose = player.pose ?? 'ready'
  const size = player.size ?? 1
  const posePath = {
    forehand: 'M0 -1.1V4.6M0 0.7L-3.1 2.4M0 0.7L3.8 0.4M0 4.6L-2.6 8M0 4.6L3 7.6',
    ready: 'M0 -1.1V4.6M0 0.7L-3.3 2.35M0 0.7L3.3 2.35M0 4.6L-2.7 8.1M0 4.6L2.8 8.1',
    serve: 'M0 -1.1V4.5M0 0.6L-3.1 2.4M0 0.5L3.4 -4.1M0 4.5L-2.5 8M0 4.5L2.5 8',
    volley: 'M0 -1.1V4.3M0 0.7L-3.2 1.2M0 0.7L3.8 -1.2M0 4.3L-2.6 7.8M0 4.3L2.7 7.8',
  }[pose]
  const racquet = {
    forehand: { cx: 5.85, cy: -0.2, handle: 'M3.45 0.2C4.4 -0.1 5 -0.25 5.35 -0.25' },
    ready: { cx: 5.85, cy: -2.25, handle: 'M3.05 1.8C4.65 0.7 5.45 -0.5 5.65 -1.9' },
    serve: { cx: 4.15, cy: -6.25, handle: 'M2.7 -3.85L3.85 -5.75' },
    volley: { cx: 5.85, cy: -2.2, handle: 'M3.35 -0.95L5.25 -1.95' },
  }[pose]

  return (
    <g color={stroke} filter="url(#tiq-overlay-glow)" transform={`translate(${player.x} ${player.y}) scale(${size})`}>
      <ellipse cx="0" cy="2.4" fill={stroke} opacity="0.25" rx="4.2" ry="1" />
      <g transform={`scale(${handednessScale} 1)`}>
        <use href="#tiq-player-head" height="5.8" width="5.8" x="-2.9" y="-7.1" />
        <path d={posePath} fill="none" stroke="#07101e" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.55" />
        <path d={racquet.handle} fill="none" stroke="#07101e" strokeLinecap="round" strokeWidth="1.12" />
        <circle cx={racquet.cx} cy={racquet.cy} fill="none" r="1.15" stroke="#07101e" strokeWidth="1.02" />
        <path d={posePath} fill="none" stroke={stroke} strokeLinecap="round" strokeLinejoin="round" strokeWidth="0.85" />
        <path d={racquet.handle} fill="none" stroke={stroke} strokeLinecap="round" strokeWidth="0.58" />
        <circle cx={racquet.cx} cy={racquet.cy} fill="none" r="1.15" stroke={stroke} strokeWidth="0.48" />
      </g>
      {showLabel ? (
        <text fill="#f8fbff" fontSize="2.15" fontWeight="800" paintOrder="stroke" stroke="rgba(2,8,18,0.86)" strokeWidth="0.55" textAnchor="middle" y="7.4">
          {player.label}
        </text>
      ) : null}
    </g>
  )
}

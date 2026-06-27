'use client'

import Image from 'next/image'
import { useRef, useState } from 'react'
import type { TacticalPath, TacticalPathKind, TacticalPoint, TacticalScenario, TacticalSelection, TacticalToken, TacticalTokenType, TacticalZone } from '@/lib/tactical/types'
import { pointFromPointer } from '@/lib/tactical/utils'
import TiqTokenIcon from './TiqTokens'
import styles from './TiqTacticalStudio.module.css'

type TiqCourtBoardProps = {
  scenario: TacticalScenario
  selected: TacticalSelection
  showLabels: boolean
  showPaths: boolean
  showZones: boolean
  snapToGrid: boolean
  drawingKind: TacticalPathKind | null
  placementTokenType: TacticalTokenType | null
  onMoveToken: (id: string, x: number, y: number) => void
  onMovePathPoint: (id: string, endpoint: 'from' | 'to', x: number, y: number) => void
  onMoveZone: (id: string, x: number, y: number) => void
  onCreatePath: (kind: TacticalPathKind, from: TacticalPoint, to: TacticalPoint) => void
  onPlaceToken: (type: TacticalTokenType, point: TacticalPoint) => void
  onSelect: (selection: TacticalSelection) => void
}

const pathColor: Record<TacticalPath['kind'], string> = {
  ball: '#9be11d',
  move: '#20b7ff',
  recover: '#f8fbff',
}

const pathDash: Record<TacticalPath['kind'], string> = {
  ball: '7 5',
  move: '4 5',
  recover: '3 6',
}

export default function TiqCourtBoard({
  scenario,
  selected,
  showLabels,
  showPaths,
  showZones,
  snapToGrid,
  drawingKind,
  placementTokenType,
  onMoveToken,
  onMovePathPoint,
  onMoveZone,
  onCreatePath,
  onPlaceToken,
  onSelect,
}: TiqCourtBoardProps) {
  const boardRef = useRef<HTMLDivElement>(null)
  const [draftStart, setDraftStart] = useState<TacticalPoint | null>(null)

  function startTokenDrag(token: TacticalToken, event: React.PointerEvent<HTMLButtonElement>) {
    event.stopPropagation()
    event.currentTarget.setPointerCapture(event.pointerId)
    onSelect({ type: 'token', id: token.id })
  }

  function moveToken(token: TacticalToken, event: React.PointerEvent<HTMLButtonElement>) {
    if (!event.currentTarget.hasPointerCapture(event.pointerId) || !boardRef.current) return
    const point = pointFromPointer(event.clientX, event.clientY, boardRef.current, snapToGrid)
    onMoveToken(token.id, point.x, point.y)
  }

  function startZoneDrag(zone: TacticalZone, event: React.PointerEvent<HTMLButtonElement>) {
    event.stopPropagation()
    event.currentTarget.setPointerCapture(event.pointerId)
    onSelect({ type: 'zone', id: zone.id })
  }

  function moveZone(zone: TacticalZone, event: React.PointerEvent<HTMLButtonElement>) {
    if (!event.currentTarget.hasPointerCapture(event.pointerId) || !boardRef.current) return
    const point = pointFromPointer(event.clientX, event.clientY, boardRef.current, snapToGrid)
    onMoveZone(zone.id, point.x, point.y)
  }

  function startPathPointDrag(path: TacticalPath, endpoint: 'from' | 'to', event: React.PointerEvent<SVGCircleElement>) {
    event.stopPropagation()
    event.currentTarget.setPointerCapture(event.pointerId)
    onSelect({ type: 'path', id: path.id })
  }

  function movePathPoint(path: TacticalPath, endpoint: 'from' | 'to', event: React.PointerEvent<SVGCircleElement>) {
    if (!event.currentTarget.hasPointerCapture(event.pointerId) || !boardRef.current) return
    const point = pointFromPointer(event.clientX, event.clientY, boardRef.current, snapToGrid)
    onMovePathPoint(path.id, endpoint, point.x, point.y)
  }

  function handleBoardPointerDown(event: React.PointerEvent<HTMLDivElement>) {
    if (!boardRef.current) return
    if ((event.target as HTMLElement).closest('button')) return
    if (placementTokenType) {
      const point = pointFromPointer(event.clientX, event.clientY, boardRef.current, snapToGrid)
      onPlaceToken(placementTokenType, point)
      setDraftStart(null)
      return
    }

    if (!drawingKind) {
      onSelect({ type: 'scenario', id: 'scenario' })
      return
    }

    const point = pointFromPointer(event.clientX, event.clientY, boardRef.current, snapToGrid)
    if (!draftStart) {
      setDraftStart(point)
      return
    }

    onCreatePath(drawingKind, draftStart, point)
    setDraftStart(null)
  }

  return (
    <div className={styles.boardFrame}>
      <div
        className={`${styles.board} ${drawingKind || placementTokenType ? styles.drawing : ''}`}
        ref={boardRef}
        onPointerDown={handleBoardPointerDown}
      >
        <Image alt="TenAceIQ master tactical court" className={styles.courtImage} draggable={false} fill priority sizes="(max-width: 900px) 100vw, 1080px" src="/tiq/courts/tiq-court-master-v2.png" />
        <svg aria-hidden="true" className={styles.overlay} preserveAspectRatio="none" viewBox="0 0 100 100">
          <defs>
            <filter id="tiq-studio-glow" x="-30%" y="-30%" width="160%" height="160%">
              <feDropShadow dx="0" dy="0" floodColor="#9be11d" floodOpacity="0.58" stdDeviation="1.2" />
            </filter>
            {Object.entries(pathColor).map(([kind, color]) => (
              <marker id={`studio-arrow-${kind}`} key={kind} markerHeight="5" markerWidth="5" orient="auto" refX="4" refY="2.5" viewBox="0 0 5 5">
                <path d="M0 0 5 2.5 0 5Z" fill={color} />
              </marker>
            ))}
          </defs>
          {showPaths && scenario.paths.map((path) => (
            <BoardPath
              key={path.id}
              path={path}
              selected={selected.type === 'path' && selected.id === path.id}
              showLabel={showLabels}
              onMovePoint={movePathPoint}
              onSelect={onSelect}
              onStartPointDrag={startPathPointDrag}
            />
          ))}
          {drawingKind && draftStart ? (
            <circle cx={draftStart.x} cy={draftStart.y} fill="#020814" r="2.25" stroke={pathColor[drawingKind]} strokeWidth="0.75" />
          ) : null}
        </svg>
        {placementTokenType ? (
          <div className={styles.drawHint}>
            Tap court to place {placementTokenType === 'player' ? 'player' : placementTokenType}
          </div>
        ) : drawingKind ? (
          <div className={styles.drawHint}>
            {draftStart ? 'Tap the end point' : `Tap start for ${drawingKind === 'ball' ? 'ball' : drawingKind} line`}
          </div>
        ) : null}
        {showZones && scenario.zones.map((zone) => (
          <button
            className={`${styles.zoneHandle} ${selected.type === 'zone' && selected.id === zone.id ? styles.selected : ''}`}
            key={zone.id}
            onClick={(event) => {
              event.stopPropagation()
              onSelect({ type: 'zone', id: zone.id })
            }}
            onPointerDown={(event) => startZoneDrag(zone, event)}
            onPointerMove={(event) => moveZone(zone, event)}
            style={{ height: `${zone.height}%`, left: `${zone.x}%`, top: `${zone.y}%`, width: `${zone.width}%` }}
            type="button"
          >
            {showLabels ? zone.label : ''}
          </button>
        ))}
        {scenario.tokens.map((token) => (
          <button
            className={`${styles.token} ${selected.type === 'token' && selected.id === token.id ? styles.selected : ''}`}
            key={token.id}
            onClick={(event) => {
              event.stopPropagation()
              onSelect({ type: 'token', id: token.id })
            }}
            onPointerDown={(event) => startTokenDrag(token, event)}
            onPointerMove={(event) => moveToken(token, event)}
            style={{ left: `${token.x}%`, top: `${token.y}%` }}
            title={token.role || token.label || token.type}
            type="button"
          >
            <TiqTokenIcon token={token} />
            {showLabels && token.label ? <span className={styles.tokenLabel}>{token.label}</span> : null}
          </button>
        ))}
      </div>
    </div>
  )
}

function BoardPath({
  path,
  selected,
  showLabel,
  onMovePoint,
  onSelect,
  onStartPointDrag,
}: {
  path: TacticalPath
  selected: boolean
  showLabel: boolean
  onMovePoint: (path: TacticalPath, endpoint: 'from' | 'to', event: React.PointerEvent<SVGCircleElement>) => void
  onSelect: (selection: TacticalSelection) => void
  onStartPointDrag: (path: TacticalPath, endpoint: 'from' | 'to', event: React.PointerEvent<SVGCircleElement>) => void
}) {
  const color = pathColor[path.kind]
  const midX = (path.from.x + path.to.x) / 2
  const midY = (path.from.y + path.to.y) / 2
  const curveY = path.kind === 'ball' ? -7 : -4
  const d = `M ${path.from.x} ${path.from.y} Q ${midX} ${midY + curveY} ${path.to.x} ${path.to.y}`

  return (
    <g onClick={(event) => {
      event.stopPropagation()
      onSelect({ type: 'path', id: path.id })
    }}>
      <path
        d={d}
        fill="none"
        filter={path.kind === 'ball' ? 'url(#tiq-studio-glow)' : undefined}
        markerEnd={`url(#studio-arrow-${path.kind})`}
        stroke={color}
        strokeDasharray={pathDash[path.kind]}
        strokeLinecap="round"
        strokeWidth={selected ? 1.55 : path.kind === 'ball' ? 1.15 : 0.85}
      />
      {showLabel ? (
        <text fill={color} fontSize="2.35" fontWeight="900" paintOrder="stroke" stroke="rgba(2,8,18,.86)" strokeWidth=".65" textAnchor="middle" x={midX} y={midY + curveY - 1}>
          {path.label}
        </text>
      ) : null}
      {selected ? (
        <>
          <circle
            className={styles.pathHandle}
            cx={path.from.x}
            cy={path.from.y}
            fill="#020814"
            onPointerDown={(event) => onStartPointDrag(path, 'from', event)}
            onPointerMove={(event) => onMovePoint(path, 'from', event)}
            r="2.2"
            stroke={color}
            strokeWidth="0.65"
          />
          <circle
            className={styles.pathHandle}
            cx={path.to.x}
            cy={path.to.y}
            fill="#020814"
            onPointerDown={(event) => onStartPointDrag(path, 'to', event)}
            onPointerMove={(event) => onMovePoint(path, 'to', event)}
            r="2.2"
            stroke={color}
            strokeWidth="0.65"
          />
        </>
      ) : null}
    </g>
  )
}

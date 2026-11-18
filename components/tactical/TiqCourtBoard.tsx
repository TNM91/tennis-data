'use client'

import {StudioImage as Image} from './TiqStudioPlatform'
import { useEffect, useRef, useState } from 'react'
import type { TacticalPath, TacticalPathKind, TacticalPoint, TacticalRole, TacticalScenario, TacticalSelection, TacticalToken, TacticalTokenScale, TacticalTokenType, TacticalZone } from '@/lib/tactical/types'
import { pointFromPointer, tacticalPlayerInitials } from '@/lib/tactical/utils'
import { courtDiagramBounds, courtDiagramLines, courtDiagramPoint, projectCourtPoint, projectCourtZone, unprojectCourtPoint, type CourtView } from '@/lib/tactical/courtProjection'
import TiqTokenIcon from './TiqTokens'
import styles from './TiqTacticalStudio.module.css'

type TiqCourtBoardProps = {
  scenario: TacticalScenario
  selected: TacticalSelection
  showLabels: boolean
  showPaths: boolean
  showZones: boolean
  snapToGrid: boolean
  tokenScale: TacticalTokenScale
  roleView: TacticalRole
  drawingKind: TacticalPathKind | null
  placementTokenType: TacticalTokenType | null
  dragDraw?:boolean
  readOnly?: boolean
  playback?: { pathId: string; paused: boolean; onAdvance: () => void }
  view?: CourtView
  onStartMove?: () => void
  onMoveToken: (id: string, x: number, y: number) => void
  onDeleteToken: (id: string) => void
  onMovePathPoint: (id: string, endpoint: 'from' | 'to', x: number, y: number) => void
  onMoveZone: (id: string, x: number, y: number) => void
  onCreatePath: (kind: TacticalPathKind, from: TacticalPoint, to: TacticalPoint) => void
  onPlaceToken: (type: TacticalTokenType, point: TacticalPoint) => void
  onSelect: (selection: TacticalSelection) => void
  onCancelTool: () => void
  onClearSelection: () => void
  onDeleteSelected: () => void
  onDuplicateSelected: () => void
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

const tokenScaleClass: Record<TacticalTokenScale, string> = {
  small: styles.tokenScaleSmall,
  medium: styles.tokenScaleMedium,
  large: styles.tokenScaleLarge,
}

export default function TiqCourtBoard({
  scenario,
  selected,
  showLabels,
  showPaths,
  showZones,
  snapToGrid,
  tokenScale,
  roleView,
  drawingKind,
  placementTokenType,
  readOnly = false,
  playback,
  dragDraw=false,
  view = 'perspective',
  onStartMove,
  onMoveToken,
  onDeleteToken,
  onMovePathPoint,
  onMoveZone,
  onCreatePath,
  onPlaceToken,
  onSelect,
  onCancelTool,
  onClearSelection,
  onDeleteSelected,
  onDuplicateSelected,
}: TiqCourtBoardProps) {
  const boardRef = useRef<HTMLDivElement>(null)
  const surfaceRef = useRef<HTMLDivElement>(null)
  const tokenDragRef = useRef<string | null>(null)
  const moveRef = useRef<{ pointer: number; x: number; y: number; offsetX: number; offsetY: number; started: boolean } | null>(null)
  const [draftStart, setDraftStart] = useState<TacticalPoint | null>(null)
  const drawingRef=useRef<{from:TacticalPoint;end:TacticalPoint;moved:boolean;pointer:number}|null>(null)
  const [draftEnd,setDraftEnd]=useState<TacticalPoint|null>(null)
  const modeHint = getModeHint(placementTokenType, drawingKind, draftStart)
  const selectedAnchor = !readOnly && !dragDraw && selected.type !== 'token' ? getSelectedAnchor(scenario, selected) : null
  const quickMenuBelow = selectedAnchor ? selectedAnchor.y < 24 : false
  const start = draftStart ? projectCourtPoint(draftStart, view) : null
  const end = draftEnd ? projectCourtPoint(draftEnd, view) : null
  const playbackPath = playback ? scenario.paths.find(path => path.id === playback.pathId) : undefined

  function pointerAt(clientX: number, clientY: number, surface: HTMLElement) {
    return unprojectCourtPoint(pointFromPointer(clientX, clientY, surface, snapToGrid), view)
  }

  function startMove(event: React.PointerEvent, anchor: TacticalPoint) {
    if (!onStartMove || !surfaceRef.current) return
    const rect = surfaceRef.current.getBoundingClientRect()
    const point = projectCourtPoint(anchor, view)
    moveRef.current = {
      pointer: event.pointerId, x: event.clientX, y: event.clientY,
      offsetX: event.clientX - (rect.left + rect.width * point.x / 100),
      offsetY: event.clientY - (rect.top + rect.height * point.y / 100),
      started: false,
    }
  }

  function movedPoint(event: React.PointerEvent) {
    if (!surfaceRef.current || !event.currentTarget.hasPointerCapture(event.pointerId)) return null
    if (!onStartMove) return pointerAt(event.clientX, event.clientY, surfaceRef.current)
    const move = moveRef.current
    if (!move || move.pointer !== event.pointerId) return null
    if (!move.started) {
      if (Math.hypot(event.clientX - move.x, event.clientY - move.y) < 5) return null
      move.started = true
      onStartMove()
    }
    return pointerAt(event.clientX - move.offsetX, event.clientY - move.offsetY, surfaceRef.current)
  }

  function startTokenDrag(token: TacticalToken, event: React.PointerEvent<HTMLButtonElement>) {
    if (readOnly || !event.isPrimary) return
    event.stopPropagation()
    event.currentTarget.setPointerCapture(event.pointerId)
    tokenDragRef.current = token.id
    startMove(event, token)
    onSelect({ type: 'token', id: token.id })
  }

  function moveToken(token: TacticalToken, event: React.PointerEvent<HTMLButtonElement>) {
    if (readOnly) return
    const point = movedPoint(event)
    if (point) onMoveToken(token.id, point.x, point.y)
  }

  function finishTokenDrag(token: TacticalToken, event: React.PointerEvent<HTMLButtonElement>) {
    if (readOnly || !event.isPrimary) return
    event.stopPropagation()
    const dragState = tokenDragRef.current
    tokenDragRef.current = null
    if (dragDraw || !boardRef.current || dragState !== token.id) return

    if (isPointerOutsideElement(event.clientX, event.clientY, boardRef.current)) {
      onDeleteToken(token.id)
    }
  }

  function startZoneDrag(zone: TacticalZone, event: React.PointerEvent<HTMLButtonElement>) {
    if (readOnly || !event.isPrimary) return
    event.stopPropagation()
    event.currentTarget.setPointerCapture(event.pointerId)
    startMove(event, zone)
    onSelect({ type: 'zone', id: zone.id })
  }

  function moveZone(zone: TacticalZone, event: React.PointerEvent<HTMLButtonElement>) {
    if (readOnly) return
    const point = movedPoint(event)
    if (point) onMoveZone(zone.id, point.x, point.y)
  }

  function startPathPointDrag(path: TacticalPath, endpoint: 'from' | 'to', event: React.PointerEvent<SVGCircleElement>) {
    if (readOnly || !event.isPrimary) return
    event.stopPropagation()
    event.currentTarget.setPointerCapture(event.pointerId)
    startMove(event, path[endpoint])
    onSelect({ type: 'path', id: path.id })
  }

  function movePathPoint(path: TacticalPath, endpoint: 'from' | 'to', event: React.PointerEvent<SVGCircleElement>) {
    if (readOnly) return
    const point = movedPoint(event)
    if (point) onMovePathPoint(path.id, endpoint, point.x, point.y)
  }

  function handleBoardPointerDown(event: React.PointerEvent<HTMLDivElement>) {
    if (readOnly || !event.isPrimary) return
    if (!surfaceRef.current) return
    if ((event.target as HTMLElement).closest('button')) return
    if (placementTokenType) {
      const point = pointerAt(event.clientX, event.clientY, surfaceRef.current)
      onPlaceToken(placementTokenType, point)
      setDraftStart(null)
      return
    }

    if (!drawingKind) {
      onSelect({ type: 'scenario', id: 'scenario' })
      return
    }

    const point = pointerAt(event.clientX, event.clientY, surfaceRef.current)
    if (!draftStart) {
      if(dragDraw){event.currentTarget.setPointerCapture(event.pointerId);drawingRef.current={from:point,end:point,moved:false,pointer:event.pointerId}}
      setDraftStart(point)
      return
    }

    if (!dragDraw || draftStart.x !== point.x || draftStart.y !== point.y) {
      onCreatePath(drawingKind, draftStart, point)
    }
    setDraftStart(null)
  }

  return (
    <div className={styles.boardFrame} data-tiq-board-frame>
      <div
        className={`${styles.board} ${tokenScaleClass[tokenScale]} ${drawingKind || placementTokenType ? styles.drawing : ''} ${readOnly ? styles.readOnlyBoard : ''}`}
        data-testid="tiq-court-board"
        data-tiq-court-view={view}
        data-tiq-active-tool={dragDraw && (drawingKind || placementTokenType) ? '' : undefined}
        data-tiq-pattern-active={playbackPath ? '' : undefined}
        ref={boardRef}
        onPointerDown={handleBoardPointerDown}
        onPointerMove={event=>{const draft=drawingRef.current;if(!draft||!surfaceRef.current||event.pointerId!==draft.pointer)return;draft.end=pointerAt(event.clientX,event.clientY,surfaceRef.current);draft.moved=draft.moved||Math.hypot(draft.end.x-draft.from.x,draft.end.y-draft.from.y)>2;if(draft.moved)setDraftEnd(draft.end)}}
        onPointerUp={event=>{const draft=drawingRef.current;if(!draft||draft.pointer!==event.pointerId)return;drawingRef.current=null;if(draft.moved&&drawingKind){onCreatePath(drawingKind,draft.from,draft.end);setDraftStart(null)}setDraftEnd(null)}}
        onPointerCancel={()=>{drawingRef.current=null;setDraftStart(null);setDraftEnd(null)}}
      >
        <div className={styles.courtSurface} data-testid="tiq-court-surface" ref={surfaceRef}>
          {view === 'perspective' ? (
            <Image alt="TenAceIQ master tactical court" className={styles.courtImage} draggable={false} fill priority sizes="(max-width: 900px) 100vw, 1080px" src="/brand/courts/tiq-court-approved-20261024-v2.png" />
          ) : <OverheadCourt landscape={view === 'overhead-landscape'} />}
          <svg aria-hidden="true" className={styles.overlay} data-tiq-board-lines preserveAspectRatio="none" viewBox="0 0 100 100">
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
                view={view}
                selected={selected.type === 'path' && selected.id === path.id}
                showLabel={showLabels}
                onMovePoint={movePathPoint}
                onSelect={readOnly ? undefined : onSelect}
                onStartPointDrag={startPathPointDrag}
                touchTarget={!readOnly && dragDraw && !drawingKind && !placementTokenType}
                playing={playbackPath?.id === path.id}
              />
            ))}
            {drawingKind && start && end ? <line x1={start.x} y1={start.y} x2={end.x} y2={end.y} stroke={pathColor[drawingKind]} strokeWidth="1" strokeDasharray="3 2" /> : null}
            {drawingKind && start ? (
              <circle cx={start.x} cy={start.y} fill="#020814" r="2.25" stroke={pathColor[drawingKind]} strokeWidth="0.75" />
            ) : null}
          </svg>
          {playbackPath && playback ? (
            <PlaybackMarker key={playbackPath.id} path={playbackPath} view={view} paused={playback.paused} onAdvance={playback.onAdvance} />
          ) : null}
          {dragDraw && drawingKind && draftStart && !draftEnd ? (
            <p data-tiq-next-point role="status">Tap the end point</p>
          ) : null}
          {!dragDraw && modeHint ? (
            <div className={styles.drawHint}>
              <span>{modeHint}</span>
              <button
                className={styles.drawHintCancel}
                onClick={(event) => {
                  event.stopPropagation()
                  setDraftStart(null)
                  onCancelTool()
                }}
                type="button"
              >
                Cancel
              </button>
            </div>
          ) : null}
          {showZones && scenario.zones.map((zone) => {
            const [a, b] = projectCourtZone(zone, view)
            const overheadLabel = view === 'perspective' ? undefined : b.x <= 72 ? 'right' : a.x >= 28 ? 'left' : 'center'
            return (
            <button
              className={`${styles.zoneHandle} ${selected.type === 'zone' && selected.id === zone.id ? styles.selected : ''}`}
              key={zone.id}
              onClick={(event) => {
                event.stopPropagation()
                onSelect({ type: 'zone', id: zone.id })
              }}
              onPointerDown={(event) => startZoneDrag(zone, event)}
              onPointerMove={(event) => moveZone(zone, event)}
              style={rectangleBounds(a, b)}
              data-tiq-board-zone
              data-tiq-zone-tone={zone.tone}
              data-tiq-zone-label-side={overheadLabel}
              aria-label={zone.label || 'Target zone'}
              aria-pressed={selected.type === 'zone' && selected.id === zone.id}
              disabled={Boolean(playback)}
              type="button"
            >
              {showLabels && overheadLabel ? <span data-tiq-overhead-zone-name>{zone.label}</span> : showLabels ? zone.label : null}
            </button>
            )
          })}
          {scenario.tokens.map((token) => {
            const point = projectCourtPoint(token, view)
            return (
            <button
              className={`${styles.token} ${token.type === 'ball' ? styles.ballToken : ''} ${selected.type === 'token' && selected.id === token.id ? styles.selected : ''}`}
              data-token-role={token.role ?? token.type}
              data-tiq-board-team={token.team}
              data-tiq-board-marker={token.type}
              data-tiq-label-side={view !== 'perspective' && point.y > 85 ? 'above' : undefined}
              data-tiq-label-edge={view === 'perspective' ? undefined : point.x < 15 ? 'start' : point.x > 85 ? 'end' : undefined}
              aria-label={token.role || token.label || token.type}
              aria-pressed={selected.type === 'token' && selected.id === token.id}
              data-testid={`tiq-token-${token.role?.toLowerCase() ?? token.type}`}
              disabled={readOnly}
              key={token.id}
              onClick={(event) => {
                event.stopPropagation()
                onSelect({ type: 'token', id: token.id })
              }}
              onPointerDown={(event) => startTokenDrag(token, event)}
              onPointerMove={(event) => moveToken(token, event)}
              onPointerUp={(event) => finishTokenDrag(token, event)}
              onPointerCancel={() => {
                tokenDragRef.current = null
              }}
              style={{ left: `${point.x}%`, top: `${point.y}%` }}
              title={token.role || token.label || token.type}
              type="button"
            >
              {view !== 'perspective' && token.type === 'player' ? (
                <span data-tiq-overhead-player aria-hidden="true">{tacticalPlayerInitials(token)}</span>
              ) : <TiqTokenIcon token={token} />}
              {showLabels ? <TokenLabel token={token} roleView={roleView} /> : null}
            </button>
            )
          })}
          {selectedAnchor ? (
            <div
              className={`${styles.selectedQuickMenu} ${quickMenuBelow ? styles.selectedQuickMenuBelow : ''}`}
              onClick={(event) => event.stopPropagation()}
              onPointerDown={(event) => event.stopPropagation()}
              style={{
                left: `${Math.min(Math.max(selectedAnchor.x, 18), 82)}%`,
                top: quickMenuBelow ? `${Math.min(selectedAnchor.y + 8, 86)}%` : `${Math.max(selectedAnchor.y - 6, 14)}%`,
              }}
            >
              <button onClick={onDuplicateSelected} type="button">Duplicate</button>
              <button onClick={onDeleteSelected} type="button">Delete</button>
              <button onClick={onClearSelection} type="button">Done</button>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  )
}

function rectangleBounds(a: TacticalPoint, b: TacticalPoint) {
  return {
    left: `${Math.min(a.x, b.x)}%`, top: `${Math.min(a.y, b.y)}%`,
    width: `${Math.abs(a.x - b.x)}%`, height: `${Math.abs(a.y - b.y)}%`,
  }
}

function OverheadCourt({ landscape }: { landscape: boolean }) {
  const [left, far, right, near] = courtDiagramBounds
  return (
    <div data-tiq-overhead-court role="img" aria-label="Overhead doubles court with singles and service lines">
      <div data-tiq-court-bounds style={rectangleBounds(courtDiagramPoint(left, far, landscape), courtDiagramPoint(right, near, landscape))} />
      {courtDiagramLines.map(([x1, y1, x2, y2, kind], index) => {
        const a = courtDiagramPoint(x1, y1, landscape)
        const b = courtDiagramPoint(x2, y2, landscape)
        return <span key={index} data-tiq-court-line={kind} data-tiq-court-axis={a.x === b.x ? 'vertical' : 'horizontal'} style={rectangleBounds(a, b)} />
      })}
    </div>
  )
}

function isPointerOutsideElement(clientX: number, clientY: number, element: HTMLElement) {
  const rect = element.getBoundingClientRect()
  const buffer = 12
  return clientX < rect.left - buffer
    || clientX > rect.right + buffer
    || clientY < rect.top - buffer
    || clientY > rect.bottom + buffer
}

function getModeHint(placementTokenType: TacticalTokenType | null, drawingKind: TacticalPathKind | null, draftStart: TacticalPoint | null) {
  if (placementTokenType) return `Tap court to place ${placementTokenType === 'player' ? 'player' : placementTokenType}`
  if (!drawingKind) return ''
  if (draftStart) return 'Tap the end point'
  return `Tap start for ${drawingKind === 'ball' ? 'ball' : drawingKind} line`
}

function getSelectedAnchor(scenario: TacticalScenario, selected: TacticalSelection): TacticalPoint | null {
  if (selected.type === 'token') {
    const token = scenario.tokens.find((item) => item.id === selected.id)
    return token ? { x: token.x, y: token.y } : null
  }

  if (selected.type === 'path') {
    const path = scenario.paths.find((item) => item.id === selected.id)
    return path ? { x: (path.from.x + path.to.x) / 2, y: (path.from.y + path.to.y) / 2 } : null
  }

  if (selected.type === 'zone') {
    const zone = scenario.zones.find((item) => item.id === selected.id)
    return zone ? { x: zone.x + zone.width / 2, y: zone.y + zone.height / 2 } : null
  }

  return null
}

function TokenLabel({ token, roleView }: { token: TacticalToken; roleView: TacticalRole }) {
  const label = getTokenLabel(token, roleView)
  return label ? <span className={styles.tokenLabel}>{label}</span> : null
}

function getTokenLabel(token: TacticalToken, roleView: TacticalRole) {
  if (token.type !== 'player') return token.label
  if (roleView === 'coach') return token.role || token.label
  if (roleView === 'player') return token.team === 'green' ? token.label : ''
  return token.label
}

function getPathGeometry(path: TacticalPath, view: CourtView) {
  const from = projectCourtPoint(path.from, view)
  const to = projectCourtPoint(path.to, view)
  const curveY = view === 'perspective' ? (path.kind === 'ball' ? -7 : -4) : 0
  const control = { x: (from.x + to.x) / 2, y: (from.y + to.y) / 2 + curveY }
  return { from, to, control }
}

const PLAYBACK_STEP_MS = 1800

function PlaybackMarker({ path, view, paused, onAdvance }: {
  path: TacticalPath
  view: CourtView
  paused: boolean
  onAdvance: () => void
}) {
  const markerRef = useRef<HTMLSpanElement>(null)
  const animationRef = useRef<Animation | null>(null)

  useEffect(() => {
    const marker = markerRef.current
    if (!marker) return
    const { from, to, control } = getPathGeometry(path, view)
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    const sampleCount = 12
    const frames = reducedMotion ? [{ opacity: 0 }, { opacity: 0 }] : Array.from({ length: sampleCount + 2 }, (_, index) => {
      // Leave a beat at the target so the coach can call it out.
      if (index > sampleCount) return { left: `${to.x}%`, top: `${to.y}%`, offset: 1 }
      const t = index / sampleCount
      const inverse = 1 - t
      const x = inverse * inverse * from.x + 2 * inverse * t * control.x + t * t * to.x
      const y = inverse * inverse * from.y + 2 * inverse * t * control.y + t * t * to.y
      return { left: `${x}%`, top: `${y}%`, offset: t * .7 }
    })
    const animation = marker.animate(frames, { duration: PLAYBACK_STEP_MS, fill: 'both' })
    animationRef.current = animation
    animation.onfinish = onAdvance
    return () => {
      animation.onfinish = null
      animation.cancel()
      animationRef.current = null
    }
  }, [path, view, onAdvance])

  useEffect(() => {
    const animation = animationRef.current
    if (paused) animation?.pause()
    else animation?.play()
  }, [paused, path, view, onAdvance])

  return <span aria-hidden="true" data-tiq-playback-marker={path.kind} ref={markerRef} style={{ color: pathColor[path.kind] }} />
}

function BoardPath({
  path,
  view,
  selected,
  showLabel,
  onMovePoint,
  onSelect,
  onStartPointDrag,
  touchTarget,
  playing,
}: {
  path: TacticalPath
  view: CourtView
  selected: boolean
  showLabel: boolean
  onMovePoint: (path: TacticalPath, endpoint: 'from' | 'to', event: React.PointerEvent<SVGCircleElement>) => void
  onSelect?: (selection: TacticalSelection) => void
  onStartPointDrag: (path: TacticalPath, endpoint: 'from' | 'to', event: React.PointerEvent<SVGCircleElement>) => void
  touchTarget: boolean
  playing: boolean
}) {
  const color = pathColor[path.kind]
  const { from, to, control } = getPathGeometry(path, view)
  const d = `M ${from.x} ${from.y} Q ${control.x} ${control.y} ${to.x} ${to.y}`
  const dash = view === 'perspective' ? pathDash[path.kind] : path.kind === 'ball' ? undefined : '2.4 2.1'
  const width = view === 'perspective'
    ? selected || playing ? 1.55 : path.kind === 'ball' ? 1.15 : .85
    : selected || playing ? .95 : path.kind === 'ball' ? .7 : .55

  return (
    <g data-tactical-path={path.id} data-tiq-path-playing={playing ? '' : undefined} onClick={onSelect ? (event) => {
      event.stopPropagation()
      onSelect({ type: 'path', id: path.id })
    } : undefined}>
      {touchTarget ? <path d={d} fill="none" pointerEvents="stroke" stroke="transparent" strokeWidth="22" vectorEffect="non-scaling-stroke" /> : null}
      <path
        d={d}
        fill="none"
        filter={view === 'perspective' && path.kind === 'ball' ? 'url(#tiq-studio-glow)' : undefined}
        markerEnd={`url(#studio-arrow-${path.kind})`}
        stroke={color}
        strokeDasharray={dash}
        strokeLinecap="round"
        strokeWidth={width}
      />
      {showLabel ? (
        <text fill={color} fontSize={view === 'perspective' ? '2.35' : '2.6'} fontWeight="900" paintOrder="stroke" stroke="rgba(2,8,18,.86)" strokeWidth=".65" textAnchor="middle" x={control.x} y={control.y - (view === 'perspective' ? 1 : 1.4)}>
          {path.label}
        </text>
      ) : null}
      {selected ? (
        <>
          <circle
            className={styles.pathHandleHitTarget}
            cx={from.x}
            cy={from.y}
            fill="transparent"
            onPointerDown={(event) => onStartPointDrag(path, 'from', event)}
            onPointerMove={(event) => onMovePoint(path, 'from', event)}
            r="5.8"
            stroke="transparent"
            strokeWidth="0"
          />
          <circle
            className={styles.pathHandle}
            cx={from.x}
            cy={from.y}
            fill="#020814"
            onPointerDown={(event) => onStartPointDrag(path, 'from', event)}
            onPointerMove={(event) => onMovePoint(path, 'from', event)}
            r="2.2"
            stroke={color}
            strokeWidth="0.65"
          />
          <circle
            className={styles.pathHandleHitTarget}
            cx={to.x}
            cy={to.y}
            fill="transparent"
            onPointerDown={(event) => onStartPointDrag(path, 'to', event)}
            onPointerMove={(event) => onMovePoint(path, 'to', event)}
            r="5.8"
            stroke="transparent"
            strokeWidth="0"
          />
          <circle
            className={styles.pathHandle}
            cx={to.x}
            cy={to.y}
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

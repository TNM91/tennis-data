'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import TiqCourtBoard from './TiqCourtBoard'
import TiqToolbar from './TiqToolbar'
import TiqInspector from './TiqInspector'
import TiqTimeline from './TiqTimeline'
import TiqBriefingPanel from './TiqBriefingPanel'
import { MarkerIcon } from './icons/TiqIcons'
import styles from './TiqTacticalStudio.module.css'
import { scenarioBriefing, scenarioToJson } from '@/lib/tactical/scenarioExport'
import { isTacticalScenario, type TacticalScenarioSummary } from '@/lib/tactical/scenarioStorage'
import { createTacticalTemplate, tacticalFormationPresets, tacticalPathPresets, tacticalSnapPresets } from '@/lib/tactical/templates'
import type { TacticalFormationMode, TacticalPathKind, TacticalPathPreset, TacticalRole, TacticalScenario, TacticalSelection, TacticalSnapPreset, TacticalTemplateKey, TacticalTokenScale, TacticalTokenType } from '@/lib/tactical/types'
import { clampPercent, countScenarioObjects, defaultPathLabel, defaultTokenLabel, makeTacticalId, scoreScenarioReadiness, tacticalSuggestions } from '@/lib/tactical/utils'

const LOCAL_LIBRARY_KEY = 'tiq-tactical-studio-library-v1'
const LOCAL_DRAFT_KEY = 'tiq-tactical-studio-draft-v1'
const MAX_UNDO_STEPS = 24
const BOARD_EXPORT_WIDTH = 1448
const BOARD_EXPORT_HEIGHT = 1600
const COURT_ASSET_HEIGHT = 1086
const INLINE_TOKEN_TOOLS: TacticalTokenType[] = ['player', 'ball', 'cone', 'x', 'o']
const INLINE_PATH_TOOLS: TacticalPathKind[] = ['ball', 'move', 'recover']
const BOARD_TOOL_MODES = ['add', 'lines', 'snap', 'edit'] as const
const TACTICAL_TEMPLATE_KEYS: TacticalTemplateKey[] = ['basicDoubles', 'poach', 'australian', 'crosscourt', 'coachProgression']
const TACTICAL_ROLES: TacticalRole[] = ['captain', 'coach', 'player']

type BoardToolMode = (typeof BOARD_TOOL_MODES)[number]
type TacticalEntryIntent = {
  role: TacticalRole
  source: string | null
  templateKey: TacticalTemplateKey
  identitySlug: string | null
  identityLabel: string | null
  cardId: string | null
  cardTitle: string | null
}

export default function TiqTacticalStudio() {
  const [templateKey, setTemplateKey] = useState<TacticalTemplateKey>('basicDoubles')
  const [scenario, setScenario] = useState<TacticalScenario>(() => createTacticalTemplate('basicDoubles'))
  const scenarioRef = useRef(scenario)
  const [role, setRole] = useState<TacticalRole>('captain')
  const [briefingRole, setBriefingRole] = useState<TacticalRole>('captain')
  const [selected, setSelected] = useState<TacticalSelection>({ type: 'scenario', id: 'scenario' })
  const [drawingKind, setDrawingKind] = useState<TacticalPathKind | null>(null)
  const [placementType, setPlacementType] = useState<TacticalTokenType | null>(null)
  const [showLabels, setShowLabels] = useState(true)
  const [showPaths, setShowPaths] = useState(true)
  const [showZones, setShowZones] = useState(true)
  const [snapToGrid, setSnapToGrid] = useState(true)
  const [tokenScale, setTokenScale] = useState<TacticalTokenScale>('medium')
  const [boardFocusMode, setBoardFocusMode] = useState(false)
  const [presentationMode, setPresentationMode] = useState(false)
  const [activeFormation, setActiveFormation] = useState<TacticalFormationMode | null>(null)
  const [stepIndex, setStepIndex] = useState(99)
  const [library, setLibrary] = useState<TacticalScenario[]>([])
  const [cloudLibrary, setCloudLibrary] = useState<TacticalScenarioSummary[]>([])
  const [cloudStatus, setCloudStatus] = useState('Sign in to save scenarios across devices.')
  const [lastClearedScenario, setLastClearedScenario] = useState<TacticalScenario | null>(null)
  const [undoStack, setUndoStack] = useState<TacticalScenario[]>([])
  const [entryIntent, setEntryIntent] = useState<TacticalEntryIntent | null>(null)
  const [toast, setToast] = useState('')
  const autoBoardFocusApplied = useRef(false)
  const draftReady = useRef(false)
  const readiness = scoreScenarioReadiness(scenario)
  const suggestions = useMemo(() => tacticalSuggestions(scenario), [scenario])
  const visibleScenario = useMemo(() => ({
    ...scenario,
    paths: stepIndex >= scenario.paths.length ? scenario.paths : scenario.paths.slice(0, stepIndex + 1),
  }), [scenario, stepIndex])
  const boardStatus = getBoardStatus(placementType, drawingKind, selected)
  const canUndoBoardAction = undoStack.length > 0 || scenario.paths.length > 0
  const entryIdentityLabel = entryIntent?.identityLabel ?? 'Player ID'
  const entryCardTitle = entryIntent?.cardTitle ?? 'Crosscourt pattern card'

  const getAccessToken = useCallback(async () => {
    const { data } = await supabase.auth.getSession()
    return data.session?.access_token ?? ''
  }, [])

  const loadCloudLibrary = useCallback(async () => {
    const token = await getAccessToken()
    if (!token) {
      setCloudStatus('Sign in to save scenarios across devices.')
      return
    }

    const response = await fetch('/api/tactics/scenarios', {
      headers: { Authorization: `Bearer ${token}` },
    })
    const body = await response.json().catch(() => null) as
      | { ok?: boolean; message?: string; scenarios?: TacticalScenarioSummary[] }
      | null

    if (!response.ok || !body?.ok) {
      setCloudStatus(body?.message ?? 'Cloud scenario library is not ready yet.')
      return
    }

    setCloudLibrary(body.scenarios ?? [])
    setCloudStatus(body.scenarios?.length ? 'Cloud scenarios' : 'No cloud scenarios saved yet.')
  }, [getAccessToken])

  useEffect(() => {
    const nextEntryIntent = readTacticalEntryIntent()
    setEntryIntent(nextEntryIntent)

    try {
      const stored = window.localStorage.getItem(LOCAL_LIBRARY_KEY)
      const parsed = stored ? JSON.parse(stored) : []
      if (Array.isArray(parsed)) setLibrary(parsed.filter(isTacticalScenario))
    } catch {
      setLibrary([])
    }
    try {
      const storedDraft = window.localStorage.getItem(LOCAL_DRAFT_KEY)
      const parsedDraft = storedDraft ? JSON.parse(storedDraft) : null
      if (!nextEntryIntent && isTacticalScenario(parsedDraft)) {
        scenarioRef.current = parsedDraft
        setScenario(parsedDraft)
        notify('Draft restored')
      }
    } catch {
      window.localStorage.removeItem(LOCAL_DRAFT_KEY)
    }
    if (nextEntryIntent) {
      const nextScenario = createTacticalTemplate(nextEntryIntent.templateKey)
      scenarioRef.current = nextScenario
      setTemplateKey(nextEntryIntent.templateKey)
      setScenario(nextScenario)
      setRole(nextEntryIntent.role)
      setBriefingRole(nextEntryIntent.role)
      setSelected({ type: 'scenario', id: 'scenario' })
      setStepIndex(99)
      notify(nextEntryIntent.source === 'improve' ? 'Improve board ready' : 'Starter board ready')
    }
    draftReady.current = true
    void loadCloudLibrary()
  }, [loadCloudLibrary])

  useEffect(() => {
    scenarioRef.current = scenario
    if (!draftReady.current) return

    const timeout = window.setTimeout(() => {
      window.localStorage.setItem(LOCAL_DRAFT_KEY, JSON.stringify(scenario))
    }, 700)

    return () => window.clearTimeout(timeout)
  }, [scenario])

  useEffect(() => {
    if (typeof window.matchMedia !== 'function') return

    const mobileBoardQuery = window.matchMedia('(max-width: 820px)')
    const applyMobileBoardFocus = () => {
      if (!mobileBoardQuery.matches || autoBoardFocusApplied.current) return
      autoBoardFocusApplied.current = true
      setBoardFocusMode(true)
    }

    applyMobileBoardFocus()
    mobileBoardQuery.addEventListener('change', applyMobileBoardFocus)
    return () => mobileBoardQuery.removeEventListener('change', applyMobileBoardFocus)
  }, [])

  function notify(message: string) {
    setToast(message)
    window.setTimeout(() => setToast(''), 2600)
  }

  function recordUndoSnapshot(snapshot = scenarioRef.current) {
    setUndoStack((current) => [snapshot, ...current].slice(0, MAX_UNDO_STEPS))
  }

  function loadTemplate(key: TacticalTemplateKey) {
    recordUndoSnapshot()
    setTemplateKey(key)
    setScenario(createTacticalTemplate(key))
    setSelected({ type: 'scenario', id: 'scenario' })
    setDrawingKind(null)
    setPlacementType(null)
    setActiveFormation(null)
    setStepIndex(99)
    setLastClearedScenario(null)
  }

  async function copyText(text: string) {
    await navigator.clipboard?.writeText(text)
    notify('Copied')
  }

  async function shareScenario() {
    const text = scenarioBriefing(scenario, briefingRole)
    try {
      if (navigator.share) {
        await navigator.share({
          title: scenario.name,
          text,
        })
        notify('Share sheet opened')
        return
      }

      await copyText(text)
    } catch {
      notify('Share canceled')
    }
  }

  function saveLibrary(nextLibrary: TacticalScenario[]) {
    setLibrary(nextLibrary)
    window.localStorage.setItem(LOCAL_LIBRARY_KEY, JSON.stringify(nextLibrary))
  }

  function saveScenarioLocal() {
    const nextScenario = { ...scenario, id: scenario.id || makeTacticalId('scenario') }
    const nextLibrary = [nextScenario, ...library.filter((item) => item.id !== nextScenario.id)].slice(0, 16)
    saveLibrary(nextLibrary)
    notify('Scenario saved locally')
  }

  async function saveScenarioCloud() {
    const token = await getAccessToken()
    if (!token) {
      setCloudStatus('Sign in to save scenarios across devices.')
      notify('Sign in required')
      return
    }

    const response = await fetch('/api/tactics/scenarios', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ scenario }),
    })
    const body = await response.json().catch(() => null) as
      | { ok?: boolean; message?: string; scenario?: TacticalScenarioSummary }
      | null

    if (!response.ok || !body?.ok) {
      setCloudStatus(body?.message ?? 'Cloud save failed.')
      notify('Cloud save failed')
      return
    }

    await loadCloudLibrary()
    notify('Saved to cloud')
  }

  async function deleteCloudScenario(id: string) {
    const token = await getAccessToken()
    if (!token) return

    const response = await fetch(`/api/tactics/scenarios?id=${encodeURIComponent(id)}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${token}` },
    })

    if (response.ok) {
      setCloudLibrary((current) => current.filter((item) => item.id !== id))
      notify('Cloud scenario deleted')
    }
  }

  function loadScenario(nextScenario: TacticalScenario) {
    recordUndoSnapshot()
    setScenario(nextScenario)
    setTemplateKey('basicDoubles')
    setSelected({ type: 'scenario', id: 'scenario' })
    setDrawingKind(null)
    setPlacementType(null)
    setStepIndex(99)
    setLastClearedScenario(null)
    notify('Scenario loaded')
  }

  async function importScenario(file: File) {
    try {
      const text = await file.text()
      const parsed = JSON.parse(text) as unknown
      if (!isTacticalScenario(parsed)) throw new Error('Invalid tactical scenario')
      loadScenario(parsed)
    } catch {
      notify('Import failed')
    }
  }

  function downloadScenario() {
    const blob = new Blob([scenarioToJson(scenario)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `${slugify(scenario.name)}.json`
    document.body.append(link)
    link.click()
    link.remove()
    URL.revokeObjectURL(url)
    notify('Downloaded')
  }

  async function downloadBoardPng() {
    try {
      await exportScenarioPng(scenario, tokenScale, showLabels, showPaths, showZones)
      notify('PNG exported')
    } catch {
      notify('PNG export failed')
    }
  }

  function applySnapPreset(preset: TacticalSnapPreset) {
    if (selected.type === 'token') {
      recordUndoSnapshot()
      setScenario((current) => ({
        ...current,
        tokens: current.tokens.map((token) => token.id === selected.id ? { ...token, ...preset.point } : token),
      }))
      notify(`Moved to ${preset.label}`)
      return
    }

    if (selected.type === 'path') {
      recordUndoSnapshot()
      setScenario((current) => ({
        ...current,
        paths: current.paths.map((path) => path.id === selected.id ? { ...path, to: preset.point } : path),
      }))
      notify(`Moved line end to ${preset.label}`)
      return
    }

    if (selected.type === 'zone') {
      recordUndoSnapshot()
      setScenario((current) => ({
        ...current,
        zones: current.zones.map((zone) => zone.id === selected.id ? {
          ...zone,
          x: clampPercent(preset.point.x - zone.width / 2),
          y: clampPercent(preset.point.y - zone.height / 2),
        } : zone),
      }))
      notify(`Moved zone to ${preset.label}`)
      return
    }

    addTokenAt(placementType ?? 'player', preset.point.x, preset.point.y)
    notify(`Placed at ${preset.label}`)
  }

  function addPathPreset(preset: TacticalPathPreset) {
    recordUndoSnapshot()
    const nextId = makeTacticalId('path')
    setScenario((current) => ({
      ...current,
      paths: [
        ...current.paths,
        {
          id: nextId,
          kind: preset.kind,
          label: preset.label,
          from: preset.from,
          to: preset.to,
        },
      ],
    }))
    setSelected({ type: 'path', id: nextId })
    setStepIndex(99)
    notify(`${preset.label} path added`)
  }

  function undoLastPath() {
    if (undoStack.length) {
      const [previous, ...rest] = undoStack
      setScenario(previous)
      setUndoStack(rest)
      setSelected({ type: 'scenario', id: 'scenario' })
      setDrawingKind(null)
      setPlacementType(null)
      setStepIndex(99)
      setLastClearedScenario(null)
      notify('Board change undone')
      return
    }

    setScenario((current) => ({ ...current, paths: current.paths.slice(0, -1) }))
    setSelected({ type: 'scenario', id: 'scenario' })
    setStepIndex(99)
    notify('Last line removed')
  }

  function captureClearSnapshot() {
    if (countScenarioObjects(scenario) > 0) setLastClearedScenario(scenario)
  }

  function restoreLastClear() {
    if (!lastClearedScenario) return
    setScenario(lastClearedScenario)
    setSelected({ type: 'scenario', id: 'scenario' })
    setDrawingKind(null)
    setPlacementType(null)
    setActiveFormation(null)
    setStepIndex(99)
    setLastClearedScenario(null)
    notify('Board restored')
  }

  function clearBoardMarks() {
    captureClearSnapshot()
    recordUndoSnapshot()
    setScenario((current) => ({ ...current, paths: [], zones: [] }))
    setSelected({ type: 'scenario', id: 'scenario' })
    setDrawingKind(null)
    setStepIndex(99)
    notify('Board marks cleared')
  }

  function clearBoardLines() {
    captureClearSnapshot()
    recordUndoSnapshot()
    setScenario((current) => ({ ...current, paths: [] }))
    setSelected({ type: 'scenario', id: 'scenario' })
    setDrawingKind(null)
    setStepIndex(99)
    notify('Lines cleared')
  }

  function clearBoardZones() {
    captureClearSnapshot()
    recordUndoSnapshot()
    setScenario((current) => ({ ...current, zones: [] }))
    setSelected({ type: 'scenario', id: 'scenario' })
    setStepIndex(99)
    notify('Zones cleared')
  }

  function clearBoardAll() {
    captureClearSnapshot()
    recordUndoSnapshot()
    setScenario((current) => ({ ...current, tokens: [], paths: [], zones: [] }))
    setSelected({ type: 'scenario', id: 'scenario' })
    setDrawingKind(null)
    setPlacementType(null)
    setStepIndex(99)
    notify('Board cleared')
  }

  function cancelActiveTool() {
    setDrawingKind(null)
    setPlacementType(null)
  }

  function deleteSelected() {
    if (selected.type === 'scenario') return
    recordUndoSnapshot()
    setScenario((current) => ({
      ...current,
      tokens: selected.type === 'token' ? current.tokens.filter((token) => token.id !== selected.id) : current.tokens,
      paths: selected.type === 'path' ? current.paths.filter((path) => path.id !== selected.id) : current.paths,
      zones: selected.type === 'zone' ? current.zones.filter((zone) => zone.id !== selected.id) : current.zones,
    }))
    setSelected({ type: 'scenario', id: 'scenario' })
    notify('Removed')
  }

  function deleteTokenById(id: string) {
    recordUndoSnapshot()
    setScenario((current) => ({
      ...current,
      tokens: current.tokens.filter((token) => token.id !== id),
    }))
    if (selected.type === 'token' && selected.id === id) {
      setSelected({ type: 'scenario', id: 'scenario' })
    }
    notify('Removed')
  }

  function duplicateSelected() {
    recordUndoSnapshot()
    setScenario((current) => {
      if (selected.type === 'token') {
        const token = current.tokens.find((item) => item.id === selected.id)
        return token ? { ...current, tokens: [...current.tokens, { ...token, id: makeTacticalId('token'), x: Math.min(token.x + 4, 96), y: Math.min(token.y + 4, 96) }] } : current
      }
      if (selected.type === 'path') {
        const path = current.paths.find((item) => item.id === selected.id)
        return path ? { ...current, paths: [...current.paths, { ...path, id: makeTacticalId('path'), from: { x: path.from.x + 3, y: path.from.y + 3 }, to: { x: path.to.x + 3, y: path.to.y + 3 } }] } : current
      }
      if (selected.type === 'zone') {
        const zone = current.zones.find((item) => item.id === selected.id)
        return zone ? { ...current, zones: [...current.zones, { ...zone, id: makeTacticalId('zone'), x: Math.min(zone.x + 3, 94), y: Math.min(zone.y + 3, 94) }] } : current
      }
      return current
    })
    notify('Duplicated')
  }

  function addToken(type: TacticalTokenType) {
    const tokenPosition = getDefaultTokenPosition(type)
    addTokenAt(type, tokenPosition.x, tokenPosition.y)
  }

  function addTokenAt(type: TacticalTokenType, x: number, y: number) {
    recordUndoSnapshot()
    const nextId = makeTacticalId('token')
    setScenario((current) => ({
      ...current,
      tokens: [
        ...current.tokens,
        {
          id: nextId,
          type,
          label: defaultTokenLabel(type),
          role: type === 'player' ? 'Player' : undefined,
          team: type === 'player' ? 'green' : undefined,
          handedness: type === 'player' ? 'righty' : undefined,
          x,
          y,
        },
      ],
    }))
    setSelected({ type: 'token', id: nextId })
  }

  function applyFormation(mode: TacticalFormationMode) {
    const formation = tacticalFormationPresets.find((preset) => preset.key === mode)
    if (!formation) return

    recordUndoSnapshot()
    setScenario((current) => ({
      ...current,
      tokens: [
        ...formation.players.map((player) => ({
          ...player,
          id: makeTacticalId('token'),
          type: 'player' as const,
        })),
        ...current.tokens.filter((token) => token.type !== 'player'),
      ],
    }))
    setSelected({ type: 'scenario', id: 'scenario' })
    setDrawingKind(null)
    setPlacementType(null)
    setActiveFormation(mode)
    setStepIndex(99)
    setLastClearedScenario(null)
    notify(`${formation.label} setup applied`)
  }

  function flipBoardEnds() {
    recordUndoSnapshot()
    setScenario((current) => ({
      ...current,
      tokens: current.tokens.map((token) => ({
        ...token,
        x: 100 - token.x,
        y: 100 - token.y,
      })),
      paths: current.paths.map((path) => ({
        ...path,
        from: { x: 100 - path.from.x, y: 100 - path.from.y },
        to: { x: 100 - path.to.x, y: 100 - path.to.y },
      })),
      zones: current.zones.map((zone) => ({
        ...zone,
        x: 100 - zone.x - zone.width,
        y: 100 - zone.y - zone.height,
      })),
    }))
    setSelected({ type: 'scenario', id: 'scenario' })
    setDrawingKind(null)
    setPlacementType(null)
    setActiveFormation(null)
    setStepIndex(99)
    notify('Board ends swapped')
  }

  function addPath(kind: TacticalPathKind) {
    recordUndoSnapshot()
    setScenario((current) => ({
      ...current,
      paths: [
        ...current.paths,
        {
          id: makeTacticalId('path'),
          kind,
          label: defaultPathLabel(kind),
          from: { x: 45, y: 72 },
          to: { x: 60, y: 45 },
        },
      ],
    }))
    setStepIndex(99)
  }

  function addZone() {
    recordUndoSnapshot()
    setScenario((current) => ({
      ...current,
      zones: [...current.zones, { id: makeTacticalId('zone'), label: 'Target window', x: 52, y: 42, width: 16, height: 9, tone: 'green' }],
    }))
  }

  if (presentationMode) {
    return (
      <div className={`${styles.studio} ${styles.presentationMode}`}>
        <div className={styles.topbar}>
          <BrandLockup />
          <button className={styles.button} onClick={() => setPresentationMode(false)} type="button">Exit presentation</button>
        </div>
        <section className={styles.presentationStage}>
          <div className={styles.presentationHeader}>
            <div>
              <div className={styles.eyebrow}>TIQ Presentation Board</div>
              <h1>{scenario.name}</h1>
              <p>{getRoleBoardCopy(role)}</p>
            </div>
            <div className={styles.presentationRole}>{role}</div>
          </div>
          <TiqCourtBoard
            scenario={visibleScenario}
            selected={{ type: 'scenario', id: 'scenario' }}
            showLabels={showLabels}
            showPaths={showPaths}
            showZones={showZones}
            snapToGrid={snapToGrid}
            tokenScale={tokenScale}
            roleView={role}
            drawingKind={null}
            placementTokenType={null}
            readOnly
            onCreatePath={() => undefined}
            onPlaceToken={() => undefined}
            onMovePathPoint={() => undefined}
            onMoveToken={() => undefined}
            onDeleteToken={() => undefined}
            onMoveZone={() => undefined}
            onSelect={() => undefined}
            onCancelTool={() => undefined}
            onClearSelection={() => undefined}
            onDeleteSelected={() => undefined}
            onDuplicateSelected={() => undefined}
          />
          <div className={styles.presentationBriefing}>
            {scenarioBriefing(scenario, role)}
          </div>
        </section>
      </div>
    )
  }

  return (
    <div className={`${styles.studio} ${boardFocusMode ? styles.boardFocusActive : ''}`}>
      <div className={styles.topbar}>
        <BrandLockup />
        <div className={styles.navPills}>
          <button className={`${styles.button} ${styles.active}`} type="button">Tactics</button>
          <button className={styles.button} type="button">Coach beta</button>
          <button className={styles.button} type="button">Player ready</button>
        </div>
      </div>

      <header className={styles.hero}>
        <div>
          <div className={styles.eyebrow}>TIQ Tactical Studio</div>
          <h1>Build the point before you play it.</h1>
          <p>Locked TenAceIQ court asset, reusable overlay data, and role-specific briefs for players, coaches, and captains.</p>
        </div>
        <div className={styles.heroStats}>
          <Stat label="Pattern" value={scenario.name} tone="green" />
          <Stat label="Objects" value={String(countScenarioObjects(scenario))} />
          <Stat label="Paths" value={String(scenario.paths.length)} tone="blue" />
          <Stat label="Ready" value={`${readiness}%`} tone="green" />
        </div>
      </header>

      <div className={styles.workspace}>
        <TiqToolbar
          activeTemplate={templateKey}
          activeDrawKind={drawingKind}
          activePlacementType={placementType}
          tokenScale={tokenScale}
          role={role}
          onApplyFormation={applyFormation}
          onAddPath={addPath}
          onAddPathPreset={addPathPreset}
          onAddToken={addToken}
          onAddZone={addZone}
          onCopyBriefing={() => copyText(scenarioBriefing(scenario, briefingRole))}
          onCopyJson={() => copyText(scenarioToJson(scenario))}
          onDownloadJson={downloadScenario}
          onDownloadPng={downloadBoardPng}
          onImportJson={importScenario}
          onPresent={() => setPresentationMode(true)}
          onReset={() => loadTemplate(templateKey)}
          onDrawKindChange={(kind) => {
            setDrawingKind(kind)
            if (kind) setPlacementType(null)
          }}
          onPlacementTypeChange={(type) => {
            setPlacementType(type)
            if (type) setDrawingKind(null)
          }}
          activeFormation={activeFormation}
          onRoleChange={setRole}
          onTokenScaleChange={setTokenScale}
          onFlipBoardEnds={flipBoardEnds}
          onSnapPreset={applySnapPreset}
          onUndoPath={undoLastPath}
          onSaveCloud={saveScenarioCloud}
          onSaveLocal={saveScenarioLocal}
          onShareScenario={shareScenario}
          onTemplateChange={loadTemplate}
          canUndoPath={canUndoBoardAction}
        />

        <section>
          <div className={styles.scenarioBar}>
            <div>
              <div className={styles.scenarioTitleLabel}>Scenario</div>
              <div className={styles.scenarioTitle}>{scenario.name}</div>
              <div className={styles.scenarioNote}>{scenario.note}</div>
              {entryIntent?.source === 'improve' ? (
                <div className={styles.entryCallout}>
                  <div>
                    <strong>Improve starter</strong>
                    <span>{entryIdentityLabel} sent {entryCardTitle} into {scenario.name}. Save the board, copy the brief, or send the proof back to My Lab.</span>
                  </div>
                  <div className={styles.entryCalloutActions}>
                    <Link href="/player-development" className={styles.entryCalloutLink}>Improve</Link>
                    <Link href="/mylab#level-up-proof" className={styles.entryCalloutLink}>My Lab proof</Link>
                  </div>
                </div>
              ) : null}
              <div className={styles.roleBoardCallout}>
                <strong>{role} view</strong>
                <span>{getRoleBoardCopy(role)}</span>
              </div>
              <div className={styles.activeToolPill}>
                {boardStatus}
              </div>
              {entryIntent?.source === 'improve' ? (
                <div className={styles.entryStarterStrip} aria-label="Improve starter board steps">
                  <div className={styles.entryStarterContext} aria-label="Improve board handoff context">
                    <article>
                      <span>Player ID</span>
                      <strong>{entryIdentityLabel}</strong>
                    </article>
                    <article>
                      <span>Level Up card</span>
                      <strong>{entryCardTitle}</strong>
                    </article>
                  </div>
                  <div className={styles.entryStarterStep}>
                    <span>1</span>
                    <strong>Read the pattern</strong>
                    <p>Heavy cross, recover through middle, attack the short ball.</p>
                  </div>
                  <div className={styles.entryStarterStep}>
                    <span>2</span>
                    <strong>Adjust the court</strong>
                    <p>Drag the attacker, defender, target window, or path handles to match your next rep.</p>
                  </div>
                  <div className={styles.entryStarterStep}>
                    <span>3</span>
                    <strong>Capture proof</strong>
                    <p>Copy the player brief or save the board before sending the work back to My Lab.</p>
                  </div>
                  <div className={styles.entryStarterActions}>
                    <button className={styles.entryStarterButton} onClick={() => setBoardFocusMode(true)} type="button">
                      Court mode
                    </button>
                    <button className={styles.entryStarterButton} onClick={() => copyText(scenarioBriefing(scenario, briefingRole))} type="button">
                      Copy brief
                    </button>
                    <button className={styles.entryStarterButton} onClick={saveScenarioLocal} type="button">
                      Save board
                    </button>
                    <Link href="/mylab#level-up-proof" className={styles.entryStarterButton}>
                      My Lab proof
                    </Link>
                  </div>
                </div>
              ) : null}
            </div>
            <div className={styles.metaGrid}>
              <Meta label="Duration" value={scenario.duration} />
              <Meta label="Level" value={scenario.level} />
              <Meta label="Focus" value={scenario.focus} />
            </div>
          </div>
          <div className={styles.mobileCourtActions} aria-label="Mobile court shortcuts">
            <div className={styles.mobileCourtStatus} aria-live="polite">
              <span>Board status</span>
              <strong>{boardStatus}</strong>
            </div>
            <div className={styles.mobileCourtButtonGroup}>
              <button
                aria-pressed={boardFocusMode}
                className={`${styles.boardActionButton} ${styles.primaryBoardAction}`}
                onClick={() => setBoardFocusMode((value) => !value)}
                type="button"
              >
                {boardFocusMode ? 'Full studio' : 'Court mode'}
              </button>
              {drawingKind || placementType ? (
                <button className={styles.boardActionButton} onClick={cancelActiveTool} type="button">
                  Done
                </button>
              ) : null}
            </div>
          </div>
          <BoardToolDock
            activeDrawKind={drawingKind}
            activePlacementType={placementType}
            boardFocusMode={boardFocusMode}
            canRestoreClear={Boolean(lastClearedScenario)}
            canUndoPath={canUndoBoardAction}
            hasSelection={selected.type !== 'scenario'}
            activeFormation={activeFormation}
            onAddPath={addPath}
            onAddPathPreset={addPathPreset}
            onAddZone={addZone}
            onApplyFormation={applyFormation}
            onClearAll={clearBoardAll}
            onClearLines={clearBoardLines}
            onClearMarks={clearBoardMarks}
            onClearZones={clearBoardZones}
            onCopyBriefing={() => copyText(scenarioBriefing(scenario, briefingRole))}
            onDeleteSelected={deleteSelected}
            onDone={cancelActiveTool}
            onDownloadPng={downloadBoardPng}
            onDuplicateSelected={duplicateSelected}
            onDrawKindChange={(kind) => {
              setDrawingKind(drawingKind === kind ? null : kind)
              setPlacementType(null)
            }}
            onFlipBoardEnds={flipBoardEnds}
            onPlacementTypeChange={(type) => {
              setPlacementType(placementType === type ? null : type)
              setDrawingKind(null)
            }}
            onReset={() => loadTemplate('basicDoubles')}
            onRestoreClear={restoreLastClear}
            onSaveLocal={saveScenarioLocal}
            onShareScenario={shareScenario}
            onSnapPreset={applySnapPreset}
            onToggleBoardFocus={() => setBoardFocusMode((value) => !value)}
            onUndoPath={undoLastPath}
          />
          <TiqCourtBoard
            scenario={visibleScenario}
            selected={selected}
            showLabels={showLabels}
            showPaths={showPaths}
            showZones={showZones}
            snapToGrid={snapToGrid}
            tokenScale={tokenScale}
            roleView={role}
            drawingKind={drawingKind}
            placementTokenType={placementType}
            onCreatePath={(kind, from, to) => {
              recordUndoSnapshot()
              setScenario((current) => ({
                ...current,
                paths: [
                  ...current.paths,
                  {
                    id: makeTacticalId('path'),
                    kind,
                    label: defaultPathLabel(kind),
                    from,
                    to,
                  },
                ],
              }))
              setStepIndex(99)
            }}
            onPlaceToken={(type, point) => addTokenAt(type, point.x, point.y)}
            onMovePathPoint={(id, endpoint, x, y) => setScenario((current) => ({ ...current, paths: current.paths.map((path) => path.id === id ? { ...path, [endpoint]: { x, y } } : path) }))}
            onMoveToken={(id, x, y) => setScenario((current) => ({ ...current, tokens: current.tokens.map((token) => token.id === id ? { ...token, x, y } : token) }))}
            onDeleteToken={deleteTokenById}
            onMoveZone={(id, x, y) => setScenario((current) => ({ ...current, zones: current.zones.map((zone) => zone.id === id ? { ...zone, x, y } : zone) }))}
            onSelect={setSelected}
            onCancelTool={cancelActiveTool}
            onClearSelection={() => setSelected({ type: 'scenario', id: 'scenario' })}
            onDeleteSelected={deleteSelected}
            onDuplicateSelected={duplicateSelected}
          />
          <TiqTimeline activeIndex={stepIndex} paths={scenario.paths} onStep={setStepIndex} />
        </section>

        <TiqInspector
          readiness={readiness}
          scenario={scenario}
          selected={selected}
          showLabels={showLabels}
          showPaths={showPaths}
          showZones={showZones}
          snapToGrid={snapToGrid}
          suggestions={suggestions}
          onPathChange={(id, patch) => setScenario((current) => ({ ...current, paths: current.paths.map((path) => path.id === id ? { ...path, ...patch } : path) }))}
          onScenarioChange={(patch) => setScenario((current) => ({ ...current, ...patch }))}
          onToggle={(key) => {
            if (key === 'showLabels') setShowLabels((value) => !value)
            if (key === 'showPaths') setShowPaths((value) => !value)
            if (key === 'showZones') setShowZones((value) => !value)
            if (key === 'snapToGrid') setSnapToGrid((value) => !value)
          }}
          onTokenChange={(id, patch) => setScenario((current) => ({ ...current, tokens: current.tokens.map((token) => token.id === id ? { ...token, ...patch } : token) }))}
          onZoneChange={(id, patch) => setScenario((current) => ({ ...current, zones: current.zones.map((zone) => zone.id === id ? { ...zone, ...patch } : zone) }))}
        />
      </div>

      <section className={styles.panel}>
        <div className={styles.actions}>
          <button className={styles.button} disabled={selected.type === 'scenario'} onClick={duplicateSelected} type="button">Duplicate selected</button>
          <button className={styles.button} disabled={selected.type === 'scenario'} onClick={deleteSelected} type="button">Delete selected</button>
          {toast ? <span className={styles.toast}>{toast}</span> : null}
        </div>
        <div className={styles.panelTitle}>Local scenario library</div>
        <div className={styles.libraryList}>
          {library.length ? library.map((item) => (
            <button className={styles.libraryItem} key={item.id} onClick={() => loadScenario(item)} type="button">
              <ScenarioThumbnail scenario={item} />
              <span className={styles.libraryCopy}>
                <strong>{item.name}</strong>
                <span>{item.focus} · {item.level}</span>
              </span>
            </button>
          )) : <p className={styles.scenarioNote}>Saved scenarios stay in this browser. Use cloud save when signed in.</p>}
        </div>
        <div className={styles.panelTitle}>Cloud scenario library</div>
        <div className={styles.libraryList}>
          {cloudLibrary.length ? cloudLibrary.map((item) => (
            <div className={styles.libraryRow} key={item.id}>
              <button className={styles.libraryItem} onClick={() => loadScenario(item.scenario)} type="button">
                <ScenarioThumbnail scenario={item.scenario} />
                <span className={styles.libraryCopy}>
                  <strong>{item.name}</strong>
                  <span>{item.focus} · {new Date(item.updatedAt).toLocaleDateString()}</span>
                </span>
              </button>
              <button className={styles.libraryDelete} onClick={() => deleteCloudScenario(item.id)} type="button">Delete</button>
            </div>
          )) : <p className={styles.scenarioNote}>{cloudStatus}</p>}
        </div>
      </section>

      <TiqBriefingPanel briefingRole={briefingRole} scenario={scenario} onBriefingRoleChange={setBriefingRole} />
    </div>
  )
}

function BoardToolDock({
  activeFormation,
  activeDrawKind,
  activePlacementType,
  boardFocusMode,
  canRestoreClear,
  canUndoPath,
  hasSelection,
  onAddPath,
  onAddPathPreset,
  onAddZone,
  onApplyFormation,
  onClearAll,
  onClearLines,
  onClearMarks,
  onClearZones,
  onCopyBriefing,
  onDeleteSelected,
  onDone,
  onDownloadPng,
  onDrawKindChange,
  onFlipBoardEnds,
  onDuplicateSelected,
  onPlacementTypeChange,
  onReset,
  onRestoreClear,
  onSaveLocal,
  onShareScenario,
  onSnapPreset,
  onToggleBoardFocus,
  onUndoPath,
}: {
  activeFormation: TacticalFormationMode | null
  activeDrawKind: TacticalPathKind | null
  activePlacementType: TacticalTokenType | null
  boardFocusMode: boolean
  canRestoreClear: boolean
  canUndoPath: boolean
  hasSelection: boolean
  onAddPath: (kind: TacticalPathKind) => void
  onAddPathPreset: (preset: TacticalPathPreset) => void
  onAddZone: () => void
  onApplyFormation: (mode: TacticalFormationMode) => void
  onClearAll: () => void
  onClearLines: () => void
  onClearMarks: () => void
  onClearZones: () => void
  onCopyBriefing: () => void
  onDeleteSelected: () => void
  onDone: () => void
  onDownloadPng: () => void
  onDrawKindChange: (kind: TacticalPathKind) => void
  onFlipBoardEnds: () => void
  onDuplicateSelected: () => void
  onPlacementTypeChange: (type: TacticalTokenType) => void
  onReset: () => void
  onRestoreClear: () => void
  onSaveLocal: () => void
  onShareScenario: () => void
  onSnapPreset: (preset: TacticalSnapPreset) => void
  onToggleBoardFocus: () => void
  onUndoPath: () => void
}) {
  const hasActiveTool = Boolean(activeDrawKind || activePlacementType)
  const canSnap = hasSelection || Boolean(activePlacementType)
  const [preferredMobileGroup, setPreferredMobileGroup] = useState<BoardToolMode>('add')
  const [quickClearPending, setQuickClearPending] = useState(false)
  const activeMobileGroup: BoardToolMode = activeDrawKind
    ? 'lines'
    : activePlacementType
      ? 'add'
      : preferredMobileGroup

  useEffect(() => {
    if (!quickClearPending) return
    const timeout = window.setTimeout(() => setQuickClearPending(false), 2400)
    return () => window.clearTimeout(timeout)
  }, [quickClearPending])

  function handleQuickClearAll() {
    if (!quickClearPending) {
      setQuickClearPending(true)
      return
    }

    setQuickClearPending(false)
    onClearAll()
  }

  function handleUndoOrRestore() {
    setQuickClearPending(false)
    if (canRestoreClear) {
      onRestoreClear()
      return
    }

    onUndoPath()
  }

  return (
    <div className={styles.boardToolDock} aria-label="Board tools" data-active-mode={activeMobileGroup}>
      <div className={styles.boardToolModeTabs} aria-label="Mobile board tool groups">
        {BOARD_TOOL_MODES.map((mode) => (
          <button
            aria-pressed={activeMobileGroup === mode}
            className={`${styles.boardToolModeTab} ${activeMobileGroup === mode ? styles.activeBoardToolMode : ''}`}
            data-testid={`board-tool-mode-${mode}`}
            key={mode}
            onClick={() => setPreferredMobileGroup(mode)}
            type="button"
          >
            {mode === 'add' ? 'Add' : mode === 'lines' ? 'Lines' : mode === 'snap' ? 'Snap' : 'Edit'}
          </button>
        ))}
      </div>

      <div className={styles.boardQuickActions} aria-label="Board quick actions">
        <button
          className={styles.boardActionButton}
          data-testid="board-quick-undo"
          disabled={!canUndoPath && !canRestoreClear}
          onClick={handleUndoOrRestore}
          type="button"
        >
          {canRestoreClear ? 'Restore' : 'Undo'}
        </button>
        <button
          aria-pressed={quickClearPending}
          className={`${styles.boardActionButton} ${quickClearPending ? styles.confirmBoardAction : ''}`}
          data-testid="board-quick-clear"
          onClick={handleQuickClearAll}
          type="button"
        >
          {quickClearPending ? 'Confirm clear' : 'Clear all'}
        </button>
        <button className={`${styles.boardActionButton} ${hasActiveTool ? styles.primaryBoardAction : ''}`} disabled={!hasActiveTool} onClick={onDone} type="button">Done</button>
      </div>

      <div className={`${styles.boardToolGroup} ${activeMobileGroup === 'add' ? '' : styles.mobileDockHidden}`}>
        <span className={styles.boardToolLabel}>Add</span>
        {tacticalFormationPresets.map((formation) => (
          <button
            aria-pressed={activeFormation === formation.key}
            className={`${styles.boardActionButton} ${activeFormation === formation.key ? styles.activeBoardAction : ''}`}
            data-testid={`board-formation-${formation.key}`}
            key={formation.key}
            onClick={() => onApplyFormation(formation.key)}
            title={formation.description}
            type="button"
          >
            {formation.shortLabel}
          </button>
        ))}
        <button className={styles.boardActionButton} data-testid="board-flip-ends" onClick={onFlipBoardEnds} type="button">
          Swap ends
        </button>
        {INLINE_TOKEN_TOOLS.map((type) => (
          <button
            aria-label={`Place ${type}`}
            className={`${styles.boardIconTool} ${activePlacementType === type ? styles.activeBoardTool : ''}`}
            key={type}
            onClick={() => onPlacementTypeChange(type)}
            type="button"
          >
            <BoardToolIcon type={type} />
            <span>{type === 'player' ? 'Player' : type.toUpperCase()}</span>
          </button>
        ))}
        <button className={styles.boardIconTool} onClick={onAddZone} type="button">
          <span className={styles.zonePreview} />
          <span>Zone</span>
        </button>
      </div>

      <div className={`${styles.boardToolGroup} ${activeMobileGroup === 'lines' ? '' : styles.mobileDockHidden}`}>
        <span className={styles.boardToolLabel}>Lines</span>
        {INLINE_PATH_TOOLS.map((kind) => (
          <button
            className={`${styles.boardActionButton} ${activeDrawKind === kind ? styles.primaryBoardAction : ''}`}
            key={kind}
            onClick={() => onDrawKindChange(kind)}
            type="button"
          >
            {kind === 'ball' ? 'Ball line' : kind === 'move' ? 'Move' : 'Recover'}
          </button>
        ))}
        <button className={styles.boardActionButton} onClick={() => onAddPath('ball')} type="button">Quick line</button>
        {tacticalPathPresets.map((preset) => (
          <button
            className={styles.boardActionButton}
            data-testid={`board-path-preset-${preset.key}`}
            key={preset.key}
            onClick={() => onAddPathPreset(preset)}
            title={`${preset.label} ${preset.kind} pattern`}
            type="button"
          >
            {preset.label}
          </button>
        ))}
      </div>

      <div className={`${styles.boardToolGroup} ${activeMobileGroup === 'snap' ? '' : styles.mobileDockHidden}`}>
        <span className={styles.boardToolLabel}>Snap</span>
        {tacticalSnapPresets.map((preset) => (
          <button
            className={styles.boardActionButton}
            disabled={!canSnap}
            key={preset.key}
            onClick={() => onSnapPreset(preset)}
            type="button"
          >
            {preset.label}
          </button>
        ))}
      </div>

      <div className={`${styles.boardToolGroup} ${activeMobileGroup === 'edit' ? '' : styles.mobileDockHidden}`}>
        <span className={styles.boardToolLabel}>Edit</span>
        <button
          className={styles.boardActionButton}
          data-testid="board-edit-undo"
          disabled={!canUndoPath && !canRestoreClear}
          onClick={handleUndoOrRestore}
          type="button"
        >
          {canRestoreClear ? 'Restore clear' : 'Undo'}
        </button>
        <button className={styles.boardActionButton} onClick={onClearLines} type="button">Clear lines</button>
        <button className={styles.boardActionButton} onClick={onClearZones} type="button">Clear zones</button>
        <button className={styles.boardActionButton} onClick={onClearMarks} type="button">Clear marks</button>
        <button
          aria-pressed={quickClearPending}
          className={`${styles.boardActionButton} ${quickClearPending ? styles.confirmBoardAction : ''}`}
          data-testid="board-edit-clear"
          onClick={handleQuickClearAll}
          type="button"
        >
          {quickClearPending ? 'Confirm clear' : 'Clear all'}
        </button>
        <button className={styles.boardActionButton} disabled={!hasSelection} onClick={onDuplicateSelected} type="button">Duplicate</button>
        <button className={styles.boardActionButton} disabled={!hasSelection} onClick={onDeleteSelected} type="button">Delete</button>
        {hasActiveTool ? (
          <button className={`${styles.boardActionButton} ${styles.primaryBoardAction}`} onClick={onDone} type="button">Done</button>
        ) : (
          <button className={styles.boardActionButton} onClick={onReset} type="button">Reset</button>
        )}
        <button className={styles.boardActionButton} onClick={onToggleBoardFocus} type="button">
          {boardFocusMode ? 'Full studio' : 'Board only'}
        </button>
        <button className={styles.boardActionButton} data-testid="board-copy-brief" onClick={onCopyBriefing} type="button">Copy brief</button>
        <button className={styles.boardActionButton} data-testid="board-save-local" onClick={onSaveLocal} type="button">Save local</button>
        <button className={styles.boardActionButton} data-testid="board-share-scenario" onClick={onShareScenario} type="button">Share</button>
        <button className={styles.boardActionButton} onClick={onDownloadPng} type="button">Export PNG</button>
      </div>
    </div>
  )
}

function BoardToolIcon({ type }: { type: TacticalTokenType }) {
  if (type === 'player') {
    return <Image alt="" aria-hidden="true" className={styles.paletteQIcon} height={34} src="/tiq/logo/tiq-app-icon.png" width={34} />
  }

  return <MarkerIcon type={type} />
}

function slugify(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '') || 'tiq-scenario'
}

function getDefaultTokenPosition(type: TacticalTokenType) {
  if (type === 'player') return { x: 50, y: 86 }
  if (type === 'ball') return { x: 55, y: 72 }
  if (type === 'cone') return { x: 82, y: 54 }
  if (type === 'x') return { x: 88, y: 46 }
  return { x: 88, y: 58 }
}

function getBoardStatus(
  placementType: TacticalTokenType | null,
  drawingKind: TacticalPathKind | null,
  selected: TacticalSelection,
) {
  if (placementType) return `Placing ${placementType === 'player' ? 'player' : placementType}`
  if (drawingKind) return `Drawing ${drawingKind === 'ball' ? 'ball line' : `${drawingKind} line`}`
  if (selected.type === 'token') return 'Token selected'
  if (selected.type === 'path') return 'Line selected'
  if (selected.type === 'zone') return 'Zone selected'
  return 'Select, drag, or choose a tool'
}

function Stat({ label, value, tone }: { label: string; value: string; tone?: 'green' | 'blue' }) {
  return (
    <div className={styles.stat}>
      <div className={styles.statLabel}>{label}</div>
      <div className={`${styles.statValue} ${tone === 'green' ? styles.green : ''}`}>{value}</div>
    </div>
  )
}

function Meta({ label, value }: { label: string; value: string }) {
  return (
    <div className={styles.metaPill}>
      <small>{label}</small>
      <b>{value}</b>
    </div>
  )
}

function BrandLockup() {
  return (
    <div className={styles.brand}>
      <Image
        alt=""
        height={1024}
        src="/tiq/logo/tiq-app-icon.png"
        width={1024}
        className={styles.brandIcon}
      />
      <Image
        alt="TenAceIQ"
        height={537}
        src="/tiq/logo/tiq-lockup-light.png"
        width={2048}
        className={styles.brandLockup}
      />
    </div>
  )
}

function getRoleBoardCopy(role: TacticalRole) {
  if (role === 'coach') return 'Coach view shows teaching cues and full role labels for instruction.'
  if (role === 'player') return 'Player view strips the board down to readable movement, ball intent, and teammate labels.'
  return 'Captain view keeps assignments, pattern purpose, and match-readiness visible.'
}

function readTacticalEntryIntent(): TacticalEntryIntent | null {
  const params = new URLSearchParams(window.location.search)
  const source = params.get('source')
  const template = params.get('template')
  const role = params.get('role')
  const identitySlug = params.get('identity')
  const identityLabel = params.get('identityLabel')
  const cardId = params.get('card')
  const cardTitle = params.get('cardTitle')
  if (!source && !template && !role && !identitySlug && !identityLabel && !cardId && !cardTitle) return null

  return {
    role: isTacticalRole(role) ? role : 'player',
    source,
    templateKey: isTacticalTemplateKey(template) ? template : 'crosscourt',
    identitySlug: cleanEntryIntentValue(identitySlug),
    identityLabel: cleanEntryIntentValue(identityLabel),
    cardId: cleanEntryIntentValue(cardId),
    cardTitle: cleanEntryIntentValue(cardTitle),
  }
}

function cleanEntryIntentValue(value: string | null) {
  const trimmed = value?.trim()
  if (!trimmed) return null
  return trimmed.slice(0, 80)
}

function isTacticalTemplateKey(value: string | null): value is TacticalTemplateKey {
  return Boolean(value && TACTICAL_TEMPLATE_KEYS.includes(value as TacticalTemplateKey))
}

function isTacticalRole(value: string | null): value is TacticalRole {
  return Boolean(value && TACTICAL_ROLES.includes(value as TacticalRole))
}

function ScenarioThumbnail({ scenario }: { scenario: TacticalScenario }) {
  return (
    <span className={styles.scenarioThumbnail} aria-hidden="true">
      <Image alt="" fill sizes="92px" src="/tiq/courts/tiq-court-master.png" />
      {scenario.zones.slice(0, 3).map((zone) => (
        <span
          className={styles.thumbnailZone}
          key={zone.id}
          style={{ height: `${zone.height}%`, left: `${zone.x}%`, top: `${zone.y}%`, width: `${zone.width}%` }}
        />
      ))}
      {scenario.paths.slice(0, 4).map((path) => (
        <span
          className={`${styles.thumbnailPath} ${path.kind === 'ball' ? styles.thumbnailBallPath : ''}`}
          key={path.id}
          style={{
            height: `${Math.max(1, Math.abs(path.to.y - path.from.y))}%`,
            left: `${Math.min(path.from.x, path.to.x)}%`,
            top: `${Math.min(path.from.y, path.to.y)}%`,
            width: `${Math.max(1, Math.abs(path.to.x - path.from.x))}%`,
          }}
        />
      ))}
      {scenario.tokens.slice(0, 7).map((token) => (
        <span
          className={`${styles.thumbnailToken} ${token.type === 'ball' ? styles.thumbnailBall : ''}`}
          key={token.id}
          style={{ left: `${token.x}%`, top: `${token.y}%` }}
        />
      ))}
    </span>
  )
}

async function exportScenarioPng(
  scenario: TacticalScenario,
  tokenScale: TacticalTokenScale,
  showLabels: boolean,
  showPaths: boolean,
  showZones: boolean,
) {
  const canvas = document.createElement('canvas')
  canvas.width = BOARD_EXPORT_WIDTH
  canvas.height = BOARD_EXPORT_HEIGHT
  const context = canvas.getContext('2d')
  if (!context) throw new Error('Canvas unavailable')

  const [court, qIcon, ballIcon] = await Promise.all([
    loadCanvasImage('/tiq/courts/tiq-court-master.png'),
    loadCanvasImage('/tiq/logo/tiq-app-icon.png'),
    loadCanvasImage('/tiq/tokens/tennis-ball-reference.png'),
  ])

  context.fillStyle = '#020814'
  context.fillRect(0, 0, canvas.width, canvas.height)
  context.drawImage(court, 0, (canvas.height - COURT_ASSET_HEIGHT) / 2, canvas.width, COURT_ASSET_HEIGHT)

  if (showZones) {
    scenario.zones.forEach((zone) => {
      const rect = toCanvasRect(zone.x, zone.y, zone.width, zone.height, canvas)
      context.fillStyle = 'rgba(155, 225, 29, 0.17)'
      context.strokeStyle = 'rgba(155, 225, 29, 0.86)'
      context.lineWidth = 4
      context.fillRect(rect.x, rect.y, rect.width, rect.height)
      context.strokeRect(rect.x, rect.y, rect.width, rect.height)
      if (showLabels) {
        context.fillStyle = '#dff8c2'
        context.font = '700 26px Arial'
        context.fillText(zone.label, rect.x + 10, rect.y + 30)
      }
    })
  }

  if (showPaths) {
    scenario.paths.forEach((path) => drawExportPath(context, path, canvas, showLabels))
  }

  const tokenSize = tokenScale === 'small' ? 58 : tokenScale === 'large' ? 82 : 68
  scenario.tokens.forEach((token) => {
    const x = (token.x / 100) * canvas.width
    const y = (token.y / 100) * canvas.height
    const size = token.type === 'ball' ? tokenSize * 0.62 : tokenSize
    if (token.type === 'ball') {
      context.drawImage(ballIcon, x - size / 2, y - size / 2, size, size)
    } else if (token.type === 'player') {
      context.beginPath()
      context.arc(x, y, size / 2, 0, Math.PI * 2)
      context.fillStyle = 'rgba(2, 8, 18, 0.9)'
      context.fill()
      context.lineWidth = 4
      context.strokeStyle = '#9be11d'
      context.stroke()
      context.drawImage(qIcon, x - size * 0.34, y - size * 0.34, size * 0.68, size * 0.68)
    } else {
      context.beginPath()
      context.arc(x, y, size * 0.36, 0, Math.PI * 2)
      context.fillStyle = token.type === 'cone' ? '#ffc257' : '#f8fbff'
      context.fill()
      context.strokeStyle = '#07111f'
      context.lineWidth = 3
      context.stroke()
    }

    if (showLabels && token.label) {
      context.fillStyle = '#f8fbff'
      context.font = '900 26px Arial'
      context.textAlign = 'center'
      context.fillText(token.label, x, y + size * 0.78)
    }
  })

  const url = canvas.toDataURL('image/png')
  const link = document.createElement('a')
  link.href = url
  link.download = `${slugify(scenario.name)}-board.png`
  document.body.append(link)
  link.click()
  link.remove()
}

function drawExportPath(context: CanvasRenderingContext2D, path: TacticalScenario['paths'][number], canvas: HTMLCanvasElement, showLabel: boolean) {
  const from = toCanvasPoint(path.from.x, path.from.y, canvas)
  const to = toCanvasPoint(path.to.x, path.to.y, canvas)
  const mid = { x: (from.x + to.x) / 2, y: (from.y + to.y) / 2 - (path.kind === 'ball' ? 72 : 44) }
  const color = path.kind === 'ball' ? '#9be11d' : path.kind === 'move' ? '#20b7ff' : '#f8fbff'
  context.save()
  context.strokeStyle = color
  context.lineWidth = path.kind === 'ball' ? 8 : 6
  context.setLineDash(path.kind === 'ball' ? [34, 22] : path.kind === 'move' ? [24, 20] : [16, 20])
  context.lineCap = 'round'
  context.beginPath()
  context.moveTo(from.x, from.y)
  context.quadraticCurveTo(mid.x, mid.y, to.x, to.y)
  context.stroke()
  context.setLineDash([])
  context.beginPath()
  context.arc(to.x, to.y, 10, 0, Math.PI * 2)
  context.fillStyle = color
  context.fill()
  if (showLabel) {
    context.fillStyle = color
    context.font = '900 27px Arial'
    context.textAlign = 'center'
    context.fillText(path.label, mid.x, mid.y - 10)
  }
  context.restore()
}

function toCanvasPoint(x: number, y: number, canvas: HTMLCanvasElement) {
  return { x: (x / 100) * canvas.width, y: (y / 100) * canvas.height }
}

function toCanvasRect(x: number, y: number, width: number, height: number, canvas: HTMLCanvasElement) {
  return {
    x: (x / 100) * canvas.width,
    y: (y / 100) * canvas.height,
    width: (width / 100) * canvas.width,
    height: (height / 100) * canvas.height,
  }
}

function loadCanvasImage(src: string) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new window.Image()
    image.onload = () => resolve(image)
    image.onerror = reject
    image.src = src
  })
}

'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import Image from 'next/image'
import { supabase } from '@/lib/supabase'
import TiqCourtBoard from './TiqCourtBoard'
import TiqToolbar from './TiqToolbar'
import TiqInspector from './TiqInspector'
import TiqTimeline from './TiqTimeline'
import TiqBriefingPanel from './TiqBriefingPanel'
import styles from './TiqTacticalStudio.module.css'
import { scenarioBriefing, scenarioToJson } from '@/lib/tactical/scenarioExport'
import { isTacticalScenario, type TacticalScenarioSummary } from '@/lib/tactical/scenarioStorage'
import { createTacticalTemplate } from '@/lib/tactical/templates'
import type { TacticalPathKind, TacticalRole, TacticalScenario, TacticalSelection, TacticalTemplateKey, TacticalTokenType } from '@/lib/tactical/types'
import { countScenarioObjects, defaultPathLabel, defaultTokenLabel, makeTacticalId, scoreScenarioReadiness, tacticalSuggestions } from '@/lib/tactical/utils'

const LOCAL_LIBRARY_KEY = 'tiq-tactical-studio-library-v1'

export default function TiqTacticalStudio() {
  const [templateKey, setTemplateKey] = useState<TacticalTemplateKey>('basicDoubles')
  const [scenario, setScenario] = useState<TacticalScenario>(() => createTacticalTemplate('basicDoubles'))
  const [role, setRole] = useState<TacticalRole>('captain')
  const [briefingRole, setBriefingRole] = useState<TacticalRole>('captain')
  const [selected, setSelected] = useState<TacticalSelection>({ type: 'scenario', id: 'scenario' })
  const [drawingKind, setDrawingKind] = useState<TacticalPathKind | null>(null)
  const [placementType, setPlacementType] = useState<TacticalTokenType | null>(null)
  const [showLabels, setShowLabels] = useState(true)
  const [showPaths, setShowPaths] = useState(true)
  const [showZones, setShowZones] = useState(true)
  const [snapToGrid, setSnapToGrid] = useState(true)
  const [stepIndex, setStepIndex] = useState(99)
  const [library, setLibrary] = useState<TacticalScenario[]>([])
  const [cloudLibrary, setCloudLibrary] = useState<TacticalScenarioSummary[]>([])
  const [cloudStatus, setCloudStatus] = useState('Sign in to save scenarios across devices.')
  const [toast, setToast] = useState('')
  const readiness = scoreScenarioReadiness(scenario)
  const suggestions = useMemo(() => tacticalSuggestions(scenario), [scenario])
  const visibleScenario = useMemo(() => ({
    ...scenario,
    paths: stepIndex >= scenario.paths.length ? scenario.paths : scenario.paths.slice(0, stepIndex + 1),
  }), [scenario, stepIndex])

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
    try {
      const stored = window.localStorage.getItem(LOCAL_LIBRARY_KEY)
      const parsed = stored ? JSON.parse(stored) : []
      if (Array.isArray(parsed)) setLibrary(parsed.filter(isTacticalScenario))
    } catch {
      setLibrary([])
    }
    void loadCloudLibrary()
  }, [loadCloudLibrary])

  function notify(message: string) {
    setToast(message)
    window.setTimeout(() => setToast(''), 2600)
  }

  function loadTemplate(key: TacticalTemplateKey) {
    setTemplateKey(key)
    setScenario(createTacticalTemplate(key))
    setSelected({ type: 'scenario', id: 'scenario' })
    setDrawingKind(null)
    setPlacementType(null)
    setStepIndex(99)
  }

  async function copyText(text: string) {
    await navigator.clipboard?.writeText(text)
    notify('Copied')
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
    setScenario(nextScenario)
    setTemplateKey('basicDoubles')
    setSelected({ type: 'scenario', id: 'scenario' })
    setDrawingKind(null)
    setPlacementType(null)
    setStepIndex(99)
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

  function deleteSelected() {
    if (selected.type === 'scenario') return
    setScenario((current) => ({
      ...current,
      tokens: selected.type === 'token' ? current.tokens.filter((token) => token.id !== selected.id) : current.tokens,
      paths: selected.type === 'path' ? current.paths.filter((path) => path.id !== selected.id) : current.paths,
      zones: selected.type === 'zone' ? current.zones.filter((zone) => zone.id !== selected.id) : current.zones,
    }))
    setSelected({ type: 'scenario', id: 'scenario' })
    notify('Removed')
  }

  function duplicateSelected() {
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

  function addPath(kind: TacticalPathKind) {
    setScenario((current) => ({
      ...current,
      paths: [
        ...current.paths,
        {
          id: makeTacticalId('path'),
          kind,
          label: defaultPathLabel(kind),
          from: { x: 45, y: 70 },
          to: { x: 60, y: 42 },
        },
      ],
    }))
    setStepIndex(99)
  }

  function addZone() {
    setScenario((current) => ({
      ...current,
      zones: [...current.zones, { id: makeTacticalId('zone'), label: 'Target window', x: 52, y: 42, width: 16, height: 9, tone: 'green' }],
    }))
  }

  return (
    <div className={styles.studio}>
      <div className={styles.topbar}>
        <div className={styles.brand}>
          <Image alt="" height={34} src="/tiq/logo/tiq-logo-small.png" width={34} />
          <div className={styles.brandWord}>TenAce<span>IQ</span></div>
        </div>
        <div className={styles.navPills}>
          <button className={`${styles.button} ${styles.active}`} type="button">Tactics</button>
          <button className={styles.button} type="button">Coach beta</button>
          <button className={styles.button} type="button">Player+ ready</button>
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
          role={role}
          onAddPath={addPath}
          onAddToken={addToken}
          onAddZone={addZone}
          onCopyBriefing={() => copyText(scenarioBriefing(scenario, briefingRole))}
          onCopyJson={() => copyText(scenarioToJson(scenario))}
          onDownloadJson={downloadScenario}
          onImportJson={importScenario}
          onReset={() => loadTemplate(templateKey)}
          onDrawKindChange={(kind) => {
            setDrawingKind(kind)
            if (kind) setPlacementType(null)
          }}
          onPlacementTypeChange={(type) => {
            setPlacementType(type)
            if (type) setDrawingKind(null)
          }}
          onRoleChange={setRole}
          onSaveCloud={saveScenarioCloud}
          onSaveLocal={saveScenarioLocal}
          onTemplateChange={loadTemplate}
        />

        <section>
          <div className={styles.scenarioBar}>
            <div>
              <div className={styles.scenarioTitleLabel}>Scenario</div>
              <div className={styles.scenarioTitle}>{scenario.name}</div>
              <div className={styles.scenarioNote}>{scenario.note}</div>
            </div>
            <div className={styles.metaGrid}>
              <Meta label="Duration" value={scenario.duration} />
              <Meta label="Level" value={scenario.level} />
              <Meta label="Focus" value={scenario.focus} />
            </div>
          </div>
          <TiqCourtBoard
            scenario={visibleScenario}
            selected={selected}
            showLabels={showLabels}
            showPaths={showPaths}
            showZones={showZones}
            snapToGrid={snapToGrid}
            drawingKind={drawingKind}
            placementTokenType={placementType}
            onCreatePath={(kind, from, to) => {
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
            onMoveZone={(id, x, y) => setScenario((current) => ({ ...current, zones: current.zones.map((zone) => zone.id === id ? { ...zone, x, y } : zone) }))}
            onSelect={setSelected}
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
              <strong>{item.name}</strong>
              <span>{item.focus} · {item.level}</span>
            </button>
          )) : <p className={styles.scenarioNote}>Saved scenarios stay in this browser until cloud saving is added.</p>}
        </div>
        <div className={styles.panelTitle}>Cloud scenario library</div>
        <div className={styles.libraryList}>
          {cloudLibrary.length ? cloudLibrary.map((item) => (
            <div className={styles.libraryRow} key={item.id}>
              <button className={styles.libraryItem} onClick={() => loadScenario(item.scenario)} type="button">
                <strong>{item.name}</strong>
                <span>{item.focus} · {new Date(item.updatedAt).toLocaleDateString()}</span>
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

function slugify(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '') || 'tiq-scenario'
}

function getDefaultTokenPosition(type: TacticalTokenType) {
  if (type === 'player') return { x: 50, y: 75 }
  if (type === 'ball') return { x: 55, y: 68 }
  if (type === 'cone') return { x: 82, y: 52 }
  if (type === 'x') return { x: 88, y: 46 }
  return { x: 88, y: 58 }
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

'use client'

import type { TacticalPath, TacticalScenario, TacticalSelection, TacticalToken, TacticalZone } from '@/lib/tactical/types'
import styles from './TiqTacticalStudio.module.css'

type TiqInspectorProps = {
  scenario: TacticalScenario
  selected: TacticalSelection
  onScenarioChange: (patch: Partial<TacticalScenario>) => void
  onTokenChange: (id: string, patch: Partial<TacticalToken>) => void
  onPathChange: (id: string, patch: Partial<TacticalPath>) => void
  onZoneChange: (id: string, patch: Partial<TacticalZone>) => void
  showLabels: boolean
  showPaths: boolean
  showZones: boolean
  snapToGrid: boolean
  onToggle: (key: 'showLabels' | 'showPaths' | 'showZones' | 'snapToGrid') => void
  readiness: number
  suggestions: string[]
}

export default function TiqInspector({
  scenario,
  selected,
  onScenarioChange,
  onTokenChange,
  onPathChange,
  onZoneChange,
  showLabels,
  showPaths,
  showZones,
  snapToGrid,
  onToggle,
  readiness,
  suggestions,
}: TiqInspectorProps) {
  const token = selected.type === 'token' ? scenario.tokens.find((item) => item.id === selected.id) : undefined
  const path = selected.type === 'path' ? scenario.paths.find((item) => item.id === selected.id) : undefined
  const zone = selected.type === 'zone' ? scenario.zones.find((item) => item.id === selected.id) : undefined

  return (
    <aside className={styles.panel}>
      <div className={styles.panelTitle}>Inspector</div>
      {token ? <TokenEditor token={token} onChange={(patch) => onTokenChange(token.id, patch)} /> : null}
      {path ? <PathEditor path={path} onChange={(patch) => onPathChange(path.id, patch)} /> : null}
      {zone ? <ZoneEditor zone={zone} onChange={(patch) => onZoneChange(zone.id, patch)} /> : null}
      {!token && !path && !zone ? <ScenarioEditor scenario={scenario} onChange={onScenarioChange} /> : null}

      <div className={styles.panelTitle}>View controls</div>
      <div className={styles.controlRow}>
        <ControlCheck checked={showPaths} label="Paths" onChange={() => onToggle('showPaths')} />
        <ControlCheck checked={showZones} label="Zones" onChange={() => onToggle('showZones')} />
        <ControlCheck checked={showLabels} label="Labels" onChange={() => onToggle('showLabels')} />
        <ControlCheck checked={snapToGrid} label="Snap" onChange={() => onToggle('snapToGrid')} />
      </div>

      <div className={styles.panelTitle}>Scenario readiness</div>
      <div className={styles.meterTrack}>
        <div className={styles.meterFill} style={{ width: `${readiness}%` }} />
      </div>
      <ul className={styles.suggestions}>
        {suggestions.map((suggestion) => <li key={suggestion}>{suggestion}</li>)}
      </ul>
    </aside>
  )
}

function ScenarioEditor({ scenario, onChange }: { scenario: TacticalScenario; onChange: (patch: Partial<TacticalScenario>) => void }) {
  return (
    <>
      <Field label="Scenario name" value={scenario.name} onChange={(name) => onChange({ name })} />
      <Field label="Focus" value={scenario.focus} onChange={(focus) => onChange({ focus })} />
      <div className={styles.twoCol}>
        <Field label="Level" value={scenario.level} onChange={(level) => onChange({ level })} />
        <Field label="Duration" value={scenario.duration} onChange={(duration) => onChange({ duration })} />
      </div>
      <TextArea label="Brief note" value={scenario.note} onChange={(note) => onChange({ note })} />
    </>
  )
}

function TokenEditor({ token, onChange }: { token: TacticalToken; onChange: (patch: Partial<TacticalToken>) => void }) {
  return (
    <>
      <Field label="Label" value={token.label} onChange={(label) => onChange({ label })} />
      <Field label="Role" value={token.role ?? ''} onChange={(role) => onChange({ role })} />
      {token.type === 'player' ? (
        <div className={styles.field}>
          <label>Handedness</label>
          <select value={token.handedness ?? 'righty'} onChange={(event) => onChange({ handedness: event.target.value as 'righty' | 'lefty' })}>
            <option value="righty">Righty</option>
            <option value="lefty">Lefty</option>
          </select>
        </div>
      ) : null}
    </>
  )
}

function PathEditor({ path, onChange }: { path: TacticalPath; onChange: (patch: Partial<TacticalPath>) => void }) {
  return (
    <>
      <Field label="Path label" value={path.label} onChange={(label) => onChange({ label })} />
      <div className={styles.field}>
        <label>Path type</label>
        <select value={path.kind} onChange={(event) => onChange({ kind: event.target.value as TacticalPath['kind'] })}>
          <option value="ball">Ball</option>
          <option value="move">Movement</option>
          <option value="recover">Recovery</option>
        </select>
      </div>
    </>
  )
}

function ZoneEditor({ zone, onChange }: { zone: TacticalZone; onChange: (patch: Partial<TacticalZone>) => void }) {
  return (
    <>
      <Field label="Zone label" value={zone.label} onChange={(label) => onChange({ label })} />
      <div className={styles.twoCol}>
        <NumberField label="Width" value={zone.width} onChange={(width) => onChange({ width })} />
        <NumberField label="Height" value={zone.height} onChange={(height) => onChange({ height })} />
      </div>
    </>
  )
}

function Field({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  return (
    <div className={styles.field}>
      <label>{label}</label>
      <input value={value} onChange={(event) => onChange(event.target.value)} />
    </div>
  )
}

function NumberField({ label, value, onChange }: { label: string; value: number; onChange: (value: number) => void }) {
  return (
    <div className={styles.field}>
      <label>{label}</label>
      <input min="4" max="60" type="number" value={value} onChange={(event) => onChange(Number(event.target.value))} />
    </div>
  )
}

function TextArea({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  return (
    <div className={styles.field}>
      <label>{label}</label>
      <textarea value={value} onChange={(event) => onChange(event.target.value)} />
    </div>
  )
}

function ControlCheck({ checked, label, onChange }: { checked: boolean; label: string; onChange: () => void }) {
  return (
    <label className={styles.controlCheck}>
      {label}
      <input checked={checked} onChange={onChange} type="checkbox" />
    </label>
  )
}

'use client'

import Image from 'next/image'
import type { TacticalFormationMode, TacticalPathKind, TacticalPathPreset, TacticalRole, TacticalSnapPreset, TacticalTemplateKey, TacticalTokenScale, TacticalTokenType } from '@/lib/tactical/types'
import { tacticalFormationPresets, tacticalPathPresets, tacticalSnapPresets, tacticalTemplateMeta } from '@/lib/tactical/templates'
import { MarkerIcon } from './icons/TiqIcons'
import styles from './TiqTacticalStudio.module.css'

type TiqToolbarProps = {
  activeTemplate: TacticalTemplateKey
  activeFormation: TacticalFormationMode | null
  activeDrawKind: TacticalPathKind | null
  activePlacementType: TacticalTokenType | null
  tokenScale: TacticalTokenScale
  role: TacticalRole
  onRoleChange: (role: TacticalRole) => void
  onTokenScaleChange: (scale: TacticalTokenScale) => void
  onTemplateChange: (key: TacticalTemplateKey) => void
  onApplyFormation: (mode: TacticalFormationMode) => void
  onFlipBoardEnds: () => void
  onAddToken: (type: TacticalTokenType) => void
  onPlacementTypeChange: (type: TacticalTokenType | null) => void
  onAddPath: (kind: 'ball' | 'move' | 'recover') => void
  onAddPathPreset: (preset: TacticalPathPreset) => void
  onSnapPreset: (preset: TacticalSnapPreset) => void
  onUndoPath: () => void
  onDrawKindChange: (kind: TacticalPathKind | null) => void
  onAddZone: () => void
  onCopyJson: () => void
  onCopyBriefing: () => void
  onDownloadJson: () => void
  onDownloadPng: () => void
  onImportJson: (file: File) => void
  onPresent: () => void
  onSaveCloud: () => void
  onSaveLocal: () => void
  onShareScenario: () => void
  canUndoPath: boolean
  onReset: () => void
}

export default function TiqToolbar({
  activeTemplate,
  activeFormation,
  activeDrawKind,
  activePlacementType,
  tokenScale,
  role,
  onRoleChange,
  onTokenScaleChange,
  onTemplateChange,
  onApplyFormation,
  onFlipBoardEnds,
  onAddToken,
  onPlacementTypeChange,
  onAddPath,
  onAddPathPreset,
  onSnapPreset,
  onUndoPath,
  onDrawKindChange,
  onAddZone,
  onCopyJson,
  onCopyBriefing,
  onDownloadJson,
  onDownloadPng,
  onImportJson,
  onPresent,
  onSaveCloud,
  onSaveLocal,
  onShareScenario,
  canUndoPath,
  onReset,
}: TiqToolbarProps) {
  return (
    <aside className={styles.panel}>
      <div className={styles.panelTitle}>Board view</div>
      <div className={styles.segment}>
        {(['captain', 'coach', 'player'] as const).map((roleId) => (
          <button className={`${styles.modeButton} ${role === roleId ? styles.active : ''}`} key={roleId} onClick={() => onRoleChange(roleId)} type="button">
            {roleId}
          </button>
        ))}
      </div>

      <div className={styles.panelTitle}>Token size</div>
      <div className={styles.segment}>
        {(['small', 'medium', 'large'] as const).map((scale) => (
          <button className={`${styles.modeButton} ${tokenScale === scale ? styles.active : ''}`} key={scale} onClick={() => onTokenScaleChange(scale)} type="button">
            {scale}
          </button>
        ))}
      </div>

      <div className={styles.panelTitle}>Templates</div>
      {tacticalTemplateMeta.map((template) => (
        <button className={`${styles.template} ${activeTemplate === template.key ? styles.active : ''}`} key={template.key} onClick={() => onTemplateChange(template.key)} type="button">
          <strong>{template.name}</strong>
          <span>{template.description}</span>
        </button>
      ))}

      <div className={styles.panelTitle}>Starting setup</div>
      <div className={styles.toolGrid}>
        {tacticalFormationPresets.map((formation) => (
          <button
            aria-pressed={activeFormation === formation.key}
            className={`${styles.toolButton} ${activeFormation === formation.key ? styles.active : ''}`}
            key={formation.key}
            onClick={() => onApplyFormation(formation.key)}
            type="button"
          >
            {formation.label}
          </button>
        ))}
        <button className={styles.toolButton} onClick={onFlipBoardEnds} type="button">
          Swap ends
        </button>
      </div>

      <div className={styles.panelTitle}>Add elements</div>
      <p className={styles.toolHint}>Tap an icon, then tap the court where it belongs. Tap the active icon again to cancel.</p>
      <div className={styles.tokenPalette}>
        <TokenTool active={activePlacementType === 'player'} label="Player" onClick={() => onPlacementTypeChange(activePlacementType === 'player' ? null : 'player')} primary type="player" />
        <TokenTool active={activePlacementType === 'ball'} label="Ball" onClick={() => onPlacementTypeChange(activePlacementType === 'ball' ? null : 'ball')} type="ball" />
        <TokenTool active={activePlacementType === 'cone'} label="Cone" onClick={() => onPlacementTypeChange(activePlacementType === 'cone' ? null : 'cone')} type="cone" />
        <TokenTool active={activePlacementType === 'x'} label="X" onClick={() => onPlacementTypeChange(activePlacementType === 'x' ? null : 'x')} type="x" />
        <TokenTool active={activePlacementType === 'o'} label="O" onClick={() => onPlacementTypeChange(activePlacementType === 'o' ? null : 'o')} type="o" />
        <button aria-label="Add target zone" className={styles.paletteButton} onClick={onAddZone} type="button">
          <span className={styles.zonePreview} />
          <span>Zone</span>
        </button>
      </div>
      <button className={styles.quickAddButton} onClick={() => onAddToken('player')} type="button">Quick add player</button>

      <div className={styles.panelTitle}>Snap spots</div>
      <div className={styles.snapPresetGrid}>
        {tacticalSnapPresets.map((preset) => (
          <button className={styles.toolButton} key={preset.key} onClick={() => onSnapPreset(preset)} type="button">
            {preset.label}
          </button>
        ))}
      </div>

      <div className={styles.panelTitle}>Draw lines</div>
      <div className={styles.toolGrid}>
        {(['ball', 'move', 'recover'] as const).map((kind) => (
          <button
            className={`${styles.toolButton} ${activeDrawKind === kind ? styles.active : ''}`}
            key={kind}
            onClick={() => onDrawKindChange(activeDrawKind === kind ? null : kind)}
            type="button"
          >
            {kind === 'ball' ? 'Ball line' : kind === 'move' ? 'Move line' : 'Recover'}
          </button>
        ))}
        <button className={styles.toolButton} onClick={() => onAddPath('ball')} type="button">Quick line</button>
        <button className={styles.toolButton} disabled={!canUndoPath} onClick={onUndoPath} type="button">Undo line</button>
      </div>
      <div className={styles.pathPresetGrid}>
        {tacticalPathPresets.map((preset) => (
          <button className={styles.toolButton} key={preset.key} onClick={() => onAddPathPreset(preset)} type="button">
            {preset.label}
          </button>
        ))}
      </div>

      <div className={styles.panelTitle}>Scenario actions</div>
      <div className={styles.toolGrid}>
        <button className={styles.toolButton} onClick={onCopyJson} type="button">Copy JSON</button>
        <button className={styles.toolButton} onClick={onCopyBriefing} type="button">Copy brief</button>
        <button className={styles.toolButton} onClick={onDownloadJson} type="button">Download JSON</button>
        <button className={styles.toolButton} onClick={onDownloadPng} type="button">Export PNG</button>
        <button className={styles.toolButton} onClick={onPresent} type="button">Present</button>
        <button className={styles.toolButton} onClick={onShareScenario} type="button">Share</button>
        <label className={styles.importButton}>
          Import
          <input
            accept="application/json,.json"
            onChange={(event) => {
              const file = event.target.files?.[0]
              if (file) onImportJson(file)
              event.target.value = ''
            }}
            type="file"
          />
        </label>
        <button className={styles.toolButton} onClick={onSaveLocal} type="button">Save local</button>
        <button className={styles.toolButton} onClick={onSaveCloud} type="button">Save cloud</button>
        <button className={styles.toolButton} onClick={onReset} type="button">Reset</button>
      </div>
    </aside>
  )
}

function TokenTool({
  label,
  onClick,
  active,
  primary = false,
  type,
}: {
  label: string
  onClick: () => void
  active?: boolean
  primary?: boolean
  type: TacticalTokenType
}) {
  return (
    <button
      aria-label={`Add ${label.toLowerCase()}`}
      className={`${styles.paletteButton} ${type === 'ball' ? styles.ballPaletteButton : ''} ${primary ? styles.primaryPaletteButton : ''} ${active ? styles.activePaletteButton : ''}`}
      onClick={onClick}
      type="button"
    >
      {type === 'player' ? (
        <Image alt="" aria-hidden="true" className={styles.paletteQIcon} height={34} src="/tiq/logo/tiq-app-icon.png" width={34} />
      ) : (
        <MarkerIcon type={type} />
      )}
      <span>{label}</span>
    </button>
  )
}

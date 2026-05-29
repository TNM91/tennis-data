'use client'

import type { TacticalPathKind, TacticalRole, TacticalTemplateKey, TacticalTokenType } from '@/lib/tactical/types'
import { tacticalTemplateMeta } from '@/lib/tactical/templates'
import { MarkerIcon, PlayerIcon } from './icons/TiqIcons'
import styles from './TiqTacticalStudio.module.css'

type TiqToolbarProps = {
  activeTemplate: TacticalTemplateKey
  activeDrawKind: TacticalPathKind | null
  activePlacementType: TacticalTokenType | null
  role: TacticalRole
  onRoleChange: (role: TacticalRole) => void
  onTemplateChange: (key: TacticalTemplateKey) => void
  onAddToken: (type: TacticalTokenType) => void
  onPlacementTypeChange: (type: TacticalTokenType | null) => void
  onAddPath: (kind: 'ball' | 'move' | 'recover') => void
  onDrawKindChange: (kind: TacticalPathKind | null) => void
  onAddZone: () => void
  onCopyJson: () => void
  onCopyBriefing: () => void
  onDownloadJson: () => void
  onImportJson: (file: File) => void
  onSaveCloud: () => void
  onSaveLocal: () => void
  onReset: () => void
}

export default function TiqToolbar({
  activeTemplate,
  activeDrawKind,
  activePlacementType,
  role,
  onRoleChange,
  onTemplateChange,
  onAddToken,
  onPlacementTypeChange,
  onAddPath,
  onDrawKindChange,
  onAddZone,
  onCopyJson,
  onCopyBriefing,
  onDownloadJson,
  onImportJson,
  onSaveCloud,
  onSaveLocal,
  onReset,
}: TiqToolbarProps) {
  return (
    <aside className={styles.panel}>
      <div className={styles.panelTitle}>Template type</div>
      <div className={styles.segment}>
        {(['captain', 'coach', 'player'] as const).map((roleId) => (
          <button className={`${styles.modeButton} ${role === roleId ? styles.active : ''}`} key={roleId} onClick={() => onRoleChange(roleId)} type="button">
            {roleId}
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
      </div>

      <div className={styles.panelTitle}>Scenario actions</div>
      <div className={styles.toolGrid}>
        <button className={styles.toolButton} onClick={onCopyJson} type="button">Copy JSON</button>
        <button className={styles.toolButton} onClick={onCopyBriefing} type="button">Copy brief</button>
        <button className={styles.toolButton} onClick={onDownloadJson} type="button">Download</button>
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
      className={`${styles.paletteButton} ${primary ? styles.primaryPaletteButton : ''} ${active ? styles.activePaletteButton : ''}`}
      onClick={onClick}
      type="button"
    >
      {type === 'player' ? <PlayerIcon /> : <MarkerIcon type={type} />}
      <span>{label}</span>
    </button>
  )
}

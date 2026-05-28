'use client'

import type { TacticalRole, TacticalTemplateKey } from '@/lib/tactical/types'
import { tacticalTemplateMeta } from '@/lib/tactical/templates'
import styles from './TiqTacticalStudio.module.css'

type TiqToolbarProps = {
  activeTemplate: TacticalTemplateKey
  role: TacticalRole
  onRoleChange: (role: TacticalRole) => void
  onTemplateChange: (key: TacticalTemplateKey) => void
  onAddToken: (type: 'player' | 'ball' | 'cone') => void
  onAddPath: (kind: 'ball' | 'move' | 'recover') => void
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
  role,
  onRoleChange,
  onTemplateChange,
  onAddToken,
  onAddPath,
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
      <div className={styles.toolGrid}>
        <button className={`${styles.toolButton} ${styles.primary}`} onClick={() => onAddToken('player')} type="button">Player</button>
        <button className={styles.toolButton} onClick={() => onAddToken('ball')} type="button">Ball</button>
        <button className={styles.toolButton} onClick={() => onAddToken('cone')} type="button">Cone</button>
        <button className={styles.toolButton} onClick={onAddZone} type="button">Zone</button>
        <button className={styles.toolButton} onClick={() => onAddPath('ball')} type="button">Ball path</button>
        <button className={styles.toolButton} onClick={() => onAddPath('move')} type="button">Move path</button>
        <button className={styles.toolButton} onClick={() => onAddPath('recover')} type="button">Recovery</button>
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

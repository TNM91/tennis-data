'use client'

import { useState } from 'react'
import {
  AdminActionRow,
  AdminFact,
  AdminReviewFrame,
  AdminReviewGrid,
  AdminReviewHero,
  AdminReviewPanel,
  AdminStatusPanel,
  adminFactGridStyle,
} from '@/app/admin/_components/admin-review-ui'
import AdminGate from '@/app/components/admin-gate'
import SiteShell from '@/app/components/site-shell'
import {
  TENACEIQ_BACKUP_DRIVE_URL,
  TENACEIQ_BACKUP_PROMPT,
  TENACEIQ_LAST_VERIFIED_BACKUP,
} from '@/lib/admin-backup-center'

export default function AdminBackupsPage() {
  const [copyState, setCopyState] = useState<'idle' | 'copied' | 'error'>('idle')

  async function copyBackupPrompt() {
    try {
      await navigator.clipboard.writeText(TENACEIQ_BACKUP_PROMPT)
      setCopyState('copied')
    } catch {
      setCopyState('error')
    }
  }

  return (
    <SiteShell active="/admin">
      <AdminGate>
        <AdminReviewFrame>
          <AdminReviewHero
            kicker="Admin safety"
            title="Backup Center"
            actions={
              <>
                <button type="button" className="button-primary" onClick={copyBackupPrompt}>
                  Copy backup prompt
                </button>
                <a
                  className="button-secondary"
                  href={TENACEIQ_BACKUP_DRIVE_URL}
                  target="_blank"
                  rel="noreferrer"
                >
                  Open Google Drive
                </a>
              </>
            }
          >
            Keep a private, tested copy of production data without adding a paid backup plan.
          </AdminReviewHero>

          {copyState === 'copied' ? (
            <AdminStatusPanel tone="success" text="Backup prompt copied. Paste it into your TenAceIQ Codex workspace to run and verify a fresh backup." />
          ) : null}
          {copyState === 'error' ? (
            <AdminStatusPanel tone="error" text="The browser could not copy automatically. Select the prompt below and copy it manually." />
          ) : null}

          <AdminReviewGrid>
            <AdminReviewPanel compact ariaLabel="Run a production backup">
              <div className="section-kicker">Run now</div>
              <h2 className="section-title" style={{ marginTop: 6 }}>One prompt handles the full backup</h2>
              <p className="subtle-text" style={{ marginTop: 8, lineHeight: 1.6 }}>
                The backup stays read-only, encrypts before upload, verifies the Drive copy, and keeps the recovery key separate.
              </p>
              <textarea
                aria-label="TenAceIQ production backup prompt"
                readOnly
                value={TENACEIQ_BACKUP_PROMPT}
                onFocus={(event) => event.currentTarget.select()}
                style={promptStyle}
              />
              <AdminActionRow>
                <button type="button" className="button-primary" onClick={copyBackupPrompt}>
                  Copy prompt
                </button>
              </AdminActionRow>
            </AdminReviewPanel>

            <AdminReviewPanel compact ariaLabel="Backup status and routine">
              <div className="section-kicker">Current protection</div>
              <h2 className="section-title" style={{ marginTop: 6 }}>Launch backup verified</h2>
              <div style={{ ...adminFactGridStyle, marginTop: 16 }}>
                <AdminFact label="Verified" value={TENACEIQ_LAST_VERIFIED_BACKUP.label} />
                <AdminFact label="Storage" value={TENACEIQ_LAST_VERIFIED_BACKUP.storage} />
                <AdminFact label="Encryption" value={TENACEIQ_LAST_VERIFIED_BACKUP.encryption} />
                <AdminFact label="Integrity" value={TENACEIQ_LAST_VERIFIED_BACKUP.verification} />
              </div>

              <div style={routineStyle}>
                <h3 style={{ margin: 0, fontSize: 16 }}>Simple routine</h3>
                <ol style={listStyle}>
                  <li>Run the copied prompt once a week.</li>
                  <li>Run it again before a major release or database migration.</li>
                  <li>Keep the recovery key in the TenAceIQ password manager, never in Drive.</li>
                  <li>Keep several dated folders so an older clean copy remains available.</li>
                </ol>
              </div>
            </AdminReviewPanel>
          </AdminReviewGrid>
        </AdminReviewFrame>
      </AdminGate>
    </SiteShell>
  )
}

const promptStyle = {
  width: '100%',
  minHeight: 210,
  marginTop: 16,
  padding: 14,
  resize: 'vertical',
  borderRadius: 14,
  border: '1px solid var(--shell-panel-border)',
  background: 'var(--shell-chip-bg)',
  color: 'var(--foreground-strong)',
  font: 'inherit',
  fontSize: 14,
  lineHeight: 1.55,
} as const

const routineStyle = {
  marginTop: 18,
  padding: 16,
  borderRadius: 16,
  border: '1px solid var(--shell-panel-border)',
  background: 'var(--shell-chip-bg)',
} as const

const listStyle = {
  margin: '10px 0 0',
  paddingLeft: 20,
  color: 'var(--shell-copy-muted)',
  lineHeight: 1.7,
} as const


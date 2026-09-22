import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import {
  TENACEIQ_BACKUP_DRIVE_URL,
  TENACEIQ_BACKUP_PROMPT,
  TENACEIQ_LAST_VERIFIED_BACKUP,
} from '../admin-backup-center'

const adminPageSource = readFileSync(join(process.cwd(), 'app/admin/page.tsx'), 'utf8')
const backupPageSource = readFileSync(join(process.cwd(), 'app/admin/backups/page.tsx'), 'utf8')
const vercelIgnoreSource = readFileSync(join(process.cwd(), '.vercelignore'), 'utf8')

describe('admin backup center', () => {
  it('keeps the reusable prompt read-only and security specific', () => {
    expect(TENACEIQ_BACKUP_PROMPT).toContain('Encrypt it with the existing TenAceIQ recovery key before upload')
    expect(TENACEIQ_BACKUP_PROMPT).toContain('verify its SHA-256 checksum')
    expect(TENACEIQ_BACKUP_PROMPT).toContain('Do not modify production data')
    expect(TENACEIQ_BACKUP_PROMPT).toContain('leave temporary plaintext restore files behind')
    expect(TENACEIQ_BACKUP_PROMPT).not.toContain('LTTKLp9L')
  })

  it('uses a generic authenticated Drive entrypoint instead of exposing a private folder id', () => {
    expect(TENACEIQ_BACKUP_DRIVE_URL).toBe('https://drive.google.com/drive/my-drive')
    expect(backupPageSource).not.toContain('1JYKM2GOIZg0o5FhomTm6HHMMK63GmM1S')
  })

  it('surfaces the verified launch backup and weekly routine behind the admin gate', () => {
    expect(TENACEIQ_LAST_VERIFIED_BACKUP.verification).toBe('Cloud SHA-256 matched')
    expect(backupPageSource).toContain('<AdminGate>')
    expect(backupPageSource).toContain('title="Backup Center"')
    expect(backupPageSource).toContain('Run the copied prompt once a week.')
    expect(backupPageSource).toContain('Keep the recovery key in the TenAceIQ password manager')
  })

  it('links the Backup Center from the main admin tools', () => {
    expect(adminPageSource).toContain("href: '/admin/backups'")
    expect(adminPageSource).toContain("title: 'Backups'")
  })

  it('keeps the admin route in Vercel builds while excluding root backup artifacts', () => {
    const ignoreLines = vercelIgnoreSource.split(/\r?\n/).map((line) => line.trim())
    expect(ignoreLines).toContain('/backups')
    expect(ignoreLines).not.toContain('backups')
  })
})

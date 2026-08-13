export const TENACEIQ_BACKUP_PROMPT = `Create a fresh TenAceIQ production database backup. Encrypt it with the existing TenAceIQ recovery key before upload, place it in Google Drive under TenAceIQ Backups in a dated folder, download the cloud copy, verify its SHA-256 checksum matches the local encrypted artifact, and report the backup date, private file link, size, and verification result. Do not modify production data, print the recovery key, place the recovery key in Google Drive, or leave temporary plaintext restore files behind. If the recovery key is not available through an approved secure source, stop before creating or uploading the encrypted backup.`

export const TENACEIQ_BACKUP_DRIVE_URL = 'https://drive.google.com/drive/my-drive'

export const TENACEIQ_LAST_VERIFIED_BACKUP = {
  label: 'August 13, 2026',
  storage: 'Private Google Drive',
  encryption: 'AES-256-GCM',
  verification: 'Cloud SHA-256 matched',
} as const


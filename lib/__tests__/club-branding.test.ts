import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import {
  buildClubLogoStoragePath,
  getManagedClubLogoPath,
  hasValidClubLogoSignature,
  MAX_CLUB_LOGO_BYTES,
  validateClubLogoFile,
} from '../club-branding'

describe('Club branding uploads', () => {
  it('accepts supported logo images within the upload limit', () => {
    expect(validateClubLogoFile({ type: 'image/png', size: 1200 })).toBe('')
    expect(validateClubLogoFile({ type: 'image/svg+xml', size: 1200 })).toBe('Upload a JPG, PNG, or WebP image.')
    expect(validateClubLogoFile({ type: 'image/jpeg', size: MAX_CLUB_LOGO_BYTES + 1 })).toBe('Club logos need to be 5 MB or smaller.')
  })

  it('checks image signatures instead of trusting the file extension', () => {
    expect(hasValidClubLogoSignature(Uint8Array.from([0x89, 0x50, 0x4e, 0x47]), 'image/png')).toBe(true)
    expect(hasValidClubLogoSignature(Uint8Array.from([0xff, 0xd8, 0xff]), 'image/jpeg')).toBe(true)
    expect(hasValidClubLogoSignature(Uint8Array.from([0x89, 0x50, 0, 0]), 'image/png')).toBe(false)
  })

  it('builds isolated club paths and only removes managed logo files', () => {
    expect(buildClubLogoStoragePath('club-1', 'image/webp', 'upload-1')).toBe('club-1/logo-upload-1.webp')
    expect(getManagedClubLogoPath('https://example.supabase.co/storage/v1/object/public/club-branding/club-1/logo-a.png', 'club-1')).toBe('club-1/logo-a.png')
    expect(getManagedClubLogoPath('https://example.supabase.co/storage/v1/object/public/club-branding/club-2/logo-a.png', 'club-1')).toBe('')
    expect(getManagedClubLogoPath('https://images.example.com/logo.png', 'club-1')).toBe('')
  })

  it('connects the manager-only upload route, Club editor, and storage bucket', () => {
    const route = readFileSync(join(process.cwd(), 'app/api/clubs/[clubId]/branding/route.ts'), 'utf8')
    const workspace = readFileSync(join(process.cwd(), 'app/components/club-workspace.tsx'), 'utf8')
    const migration = readFileSync(join(process.cwd(), 'supabase/migrations/20260809000100_create_club_branding_bucket.sql'), 'utf8')

    expect(route).toContain('isClubManager')
    expect(route).toContain('hasValidClubLogoSignature')
    expect(route).toContain("storage.from(CLUB_BRANDING_BUCKET).upload")
    expect(workspace).toContain('Upload logo')
    expect(workspace).toContain('Use an image URL instead')
    expect(migration).toContain("'club-branding'")
  })
})

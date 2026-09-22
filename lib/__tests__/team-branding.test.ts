import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import {
  buildTeamLogoStoragePath,
  inspectTeamLogoImage,
  TEAM_LOGO_MAX_BYTES,
  validateTeamLogoDimensions,
  validateTeamLogoFile,
} from '../team-branding'

describe('Team branding uploads', () => {
  it('accepts larger supported files within the team-logo limit', () => {
    expect(validateTeamLogoFile({ type: 'image/png', size: 5 * 1024 * 1024 })).toBe('')
    expect(validateTeamLogoFile({ type: 'image/svg+xml', size: 1200 })).toBe('Use a JPG, PNG, or WebP team logo.')
    expect(validateTeamLogoFile({ type: 'image/jpeg', size: TEAM_LOGO_MAX_BYTES + 1 })).toBe('Team logos must be 8 MB or smaller.')
  })

  it('reads genuine PNG dimensions instead of trusting the browser MIME label', () => {
    const png = Uint8Array.from([
      0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a,
      0, 0, 0, 13, 0x49, 0x48, 0x44, 0x52,
      0, 0, 4, 0, 0, 0, 2, 0,
    ])
    expect(inspectTeamLogoImage(png, 'image/png')).toEqual({ width: 1024, height: 512 })
    expect(inspectTeamLogoImage(Uint8Array.from([0x89, 0x50, 0, 0]), 'image/png')).toBeNull()
  })

  it('blocks extreme or unsafe logo dimensions while allowing common wordmarks', () => {
    expect(validateTeamLogoDimensions({ width: 1600, height: 400 })).toBe('')
    expect(validateTeamLogoDimensions({ width: 2000, height: 100 })).toContain('extra-long banner')
    expect(validateTeamLogoDimensions({ width: 6001, height: 1000 })).toContain('no larger than 6,000')
  })

  it('builds a team-scoped storage path', () => {
    expect(buildTeamLogoStoragePath('room-1', 'image/webp', 'upload-1')).toBe('team-logos/room-1/upload-1.webp')
  })

  it('wires the validated upload limit through Team Room and storage', () => {
    const route = readFileSync(join(process.cwd(), 'app/api/team-rooms/branding/route.ts'), 'utf8')
    const room = readFileSync(join(process.cwd(), 'app/team-room/page.tsx'), 'utf8')
    const migration = readFileSync(join(process.cwd(), 'supabase/migrations/20260908000600_expand_team_logo_uploads.sql'), 'utf8')

    expect(route).toContain('inspectTeamLogoImage')
    expect(route).toContain('validateTeamLogoDimensions')
    expect(room).toContain('up to 8 MB')
    expect(migration).toContain('10485760')
  })
})

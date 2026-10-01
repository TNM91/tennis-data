import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const workspaceSource = readFileSync(join(process.cwd(), 'app/components/league-coordinator-workspace.tsx'), 'utf8')
const pickerSource = readFileSync(join(process.cwd(), 'app/components/venue-location-picker.tsx'), 'utf8')

describe('League Office default-site search', () => {
  it('replaces the free-form-only field with verified site lookup', () => {
    expect(workspaceSource).toContain("import VenueLocationPicker from '@/app/components/venue-location-picker'")
    expect(workspaceSource).toContain('<VenueLocationPicker')
    expect(workspaceSource).toContain("token={session?.access_token || ''}")
    expect(workspaceSource).toContain('Search and confirm the playing address.')
  })

  it('keeps exact selection, manual address confirmation, and mobile wrapping available', () => {
    expect(pickerSource).toContain('Find correct site')
    expect(pickerSource).toContain('Choose the correct site and address.')
    expect(pickerSource).toContain('Check Google Maps ↗')
    expect(pickerSource).toContain('Use this address')
    expect(pickerSource).toContain("flexWrap: 'wrap'")
    expect(pickerSource).toContain('Correct site saved. GPS directions are ready.')
  })
})

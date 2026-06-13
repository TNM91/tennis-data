import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

describe('personal quest photo privacy', () => {
  it('uses signed URLs and private storage policies for personal quest photos', () => {
    const clientSource = readFileSync('app/level-up/my-quest/my-quest-client.tsx', 'utf8')
    const migrationSource = readFileSync('supabase/migrations/20260612000100_create_personal_quest.sql', 'utf8')

    expect(clientSource).toContain('createSignedUrls')
    expect(clientSource).not.toContain('getPublicUrl')
    expect(clientSource).not.toContain('publicUrl')
    expect(migrationSource).toContain("'personal-quest-photos'")
    expect(migrationSource).toContain('public = false')
    expect(migrationSource).toContain('(storage.foldername(name))[1] = auth.uid()::text')
  })
})

'use client'

import { supabase } from '@/lib/supabase'

export type PlayerDirectoryOption = {
  id: string
  name: string
  location: string
  label: string
}

function cleanText(value: string | null | undefined) {
  return (value || '').trim()
}

type PlayerDirectoryRow = {
  id?: string | null
  name?: string | null
  location?: string | null
}

export async function listPlayerDirectoryOptions(): Promise<PlayerDirectoryOption[]> {
  const { data, error } = await supabase
    .from('players')
    .select('id, name, location')
    .order('name', { ascending: true })
    .limit(400)

  if (error) throw new Error(error.message)

  return ((data || []) as PlayerDirectoryRow[])
    .map((row) => {
      const id = cleanText(row.id)
      const name = cleanText(row.name)
      const location = cleanText(row.location)
      if (!id || !name) return null

      return {
        id,
        name,
        location,
        label: [name, location].filter(Boolean).join(' | ') || name,
      }
    })
    .filter((option): option is PlayerDirectoryOption => Boolean(option))
}

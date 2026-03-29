'use client'

export const dynamic = 'force-dynamic'

import Link from 'next/link'
import { useEffect, useMemo, useState } from 'react'
import { supabase } from '@/lib/supabase'

/* ================= TYPES ================= */

type MatchRow = {
  id: string
  league_name: string | null
  flight: string | null
  home_team: string | null
  away_team: string | null
  match_date: string
}

type AvailabilityStatus =
  | 'available'
  | 'unavailable'
  | 'singles_only'
  | 'doubles_only'
  | 'limited'

type RosterPlayer = {
  id: string
  name: string
  singles: number | null
  doubles: number | null
  preferredRole: string | null
  availability: AvailabilityStatus
}

type BuilderSlots = {
  s1: string
  s2: string
  d1p1: string
  d1p2: string
  d2p1: string
  d2p2: string
  d3p1: string
  d3p2: string
}

const EMPTY_SLOTS: BuilderSlots = {
  s1: '',
  s2: '',
  d1p1: '',
  d1p2: '',
  d2p1: '',
  d2p2: '',
  d3p1: '',
  d3p2: '',
}

/* ================= HELPERS ================= */

function formatRating(v: number | null) {
  if (!v) return '—'
  return v.toFixed(2)
}

function getAvailabilityLabel(a: AvailabilityStatus) {
  return a.replace('_', ' ')
}

/* ================= MAIN ================= */

export default function LineupBuilderPage() {
  const [matches, setMatches] = useState<MatchRow[]>([])
  const [roster, setRoster] = useState<RosterPlayer[]>([])
  const [slots, setSlots] = useState<BuilderSlots>(EMPTY_SLOTS)

  const [league, setLeague] = useState('')
  const [team, setTeam] = useState('')
  const [date, setDate] = useState('')

  useEffect(() => {
    loadMatches()
  }, [])

  useEffect(() => {
    if (league && team) loadRoster()
  }, [league, team, date])

  async function loadMatches() {
    const { data } = await supabase.from('matches').select('*')
    setMatches((data || []) as MatchRow[])
  }

  async function loadRoster() {
    const { data } = await supabase
      .from('players')
      .select('*')

    const list: RosterPlayer[] = (data || []).map((p: any) => ({
      id: p.id,
      name: p.name,
      singles: p.singles_dynamic_rating,
      doubles: p.doubles_dynamic_rating,
      preferredRole: p.preferred_role,
      availability: 'available',
    }))

    setRoster(list)
    setSlots(EMPTY_SLOTS)
  }

  const playersById = useMemo(() => {
    const m = new Map<string, RosterPlayer>()
    roster.forEach(p => m.set(p.id, p))
    return m
  }, [roster])

  function update(slot: keyof BuilderSlots, value: string) {
    setSlots(prev => ({ ...prev, [slot]: value }))
  }

/* ================= STRENGTH ================= */

function calcStrength(slots: BuilderSlots) {
  const s = [slots.s1, slots.s2].map(id => playersById.get(id)).filter(Boolean) as RosterPlayer[]
  const d = [
    [slots.d1p1, slots.d1p2],
    [slots.d2p1, slots.d2p2],
    [slots.d3p1, slots.d3p2],
  ]

  const singles = s.length
    ? s.reduce((sum, p) => sum + (p.singles || 0), 0) / s.length
    : null

  const doubles = d.map(pair => {
    const a = playersById.get(pair[0])
    const b = playersById.get(pair[1])
    if (!a || !b) return null
    return ((a.doubles || 0) + (b.doubles || 0)) / 2
  }).filter(Boolean) as number[]

  const dAvg = doubles.length
    ? doubles.reduce((a, b) => a + b, 0) / doubles.length
    : null

  const overall =
    singles || dAvg
      ? (((singles || 0) * 2) + ((dAvg || 0) * 3)) / 5
      : null

  return { singles, dAvg, overall }
}

const strength = useMemo(() => calcStrength(slots), [slots, playersById])

/* ================= SUGGESTED ================= */

function buildSuggested() {
  const singles = [...roster]
    .sort((a, b) => (b.singles || 0) - (a.singles || 0))

  const used = new Set<string>()

  const s1 = singles[0]?.id || ''
  const s2 = singles[1]?.id || ''
  used.add(s1)
  used.add(s2)

  const doubles = [...roster]
    .filter(p => !used.has(p.id))
    .sort((a, b) => (b.doubles || 0) - (a.doubles || 0))

  return {
    s1,
    s2,
    d1p1: doubles[0]?.id || '',
    d1p2: doubles[1]?.id || '',
    d2p1: doubles[2]?.id || '',
    d2p2: doubles[3]?.id || '',
    d3p1: doubles[4]?.id || '',
    d3p2: doubles[5]?.id || '',
  }
}

const suggested = useMemo(() => buildSuggested(), [roster])
const suggestedStrength = useMemo(() => calcStrength(suggested), [suggested])

/* ================= UI ================= */

return (
<main style={{ padding: 24, maxWidth: 1200, margin: '0 auto' }}>

<div style={{ marginBottom: 20 }}>
<Link href="/">Home</Link> | <Link href="/captains-corner">Captain's Corner</Link>
</div>

<h1>Lineup Builder</h1>

<select onChange={e => setLeague(e.target.value)}>
<option>Select League</option>
</select>

<select onChange={e => setTeam(e.target.value)}>
<option>Select Team</option>
</select>

<select onChange={e => setDate(e.target.value)}>
<option>Date</option>
</select>

<div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>

<div>
<h3>Singles</h3>
<select onChange={e => update('s1', e.target.value)}>
<option>S1</option>
{roster.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
</select>

<select onChange={e => update('s2', e.target.value)}>
<option>S2</option>
{roster.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
</select>
</div>
<div>
<h3>Doubles</h3>

{(['d1p1','d1p2','d2p1','d2p2','d3p1','d3p2'] as (keyof BuilderSlots)[]).map(k => (
<select key={k} onChange={e => update(k, e.target.value)}>
<option>{k}</option>
{roster.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
</select>
))}
</div>

</div>

<hr />

<h2>Your Lineup Strength</h2>
<div>Singles: {formatRating(strength.singles)}</div>
<div>Doubles: {formatRating(strength.dAvg)}</div>
<div>Overall: {formatRating(strength.overall)}</div>

<hr />

<h2>Suggested Lineup Strength</h2>
<div>Singles: {formatRating(suggestedStrength.singles)}</div>
<div>Doubles: {formatRating(suggestedStrength.dAvg)}</div>
<div>Overall: {formatRating(suggestedStrength.overall)}</div>

<hr />

<h2>Comparison</h2>
<div>
Difference: {
strength.overall && suggestedStrength.overall
? (strength.overall - suggestedStrength.overall).toFixed(2)
: '—'
}
</div>

</main>
)
}
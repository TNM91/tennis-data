// FULL FILE: app/teams/[team]/page.tsx
'use client'

export const dynamic = 'force-dynamic'

import Image from 'next/image'
import Link from 'next/link'
import { useParams } from 'next/navigation'
import { useEffect, useMemo, useState } from 'react'
import { supabase } from '@/lib/supabase'

type TeamMatch = {
  id: string
  home_team: string
  away_team: string
  match_date: string
  match_type: 'singles' | 'doubles'
  winner_side: 'A' | 'B'
  score: string | null
}

type Player = {
  id: string
  name: string
  singles_dynamic_rating: number | null
  doubles_dynamic_rating: number | null
}

type MatchPlayer = {
  match_id: string
  side: 'A' | 'B'
  player_id: string
  players: Player
}

export default function TeamPage() {
  const params = useParams()
  const team = decodeURIComponent(String(params.team || ''))

  const [matches, setMatches] = useState<TeamMatch[]>([])
  const [players, setPlayers] = useState<MatchPlayer[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    load()
  }, [team])

  async function load() {
    setLoading(true)

    const { data: matchData } = await supabase
      .from('matches')
      .select('*')
      .or(`home_team.eq.${team},away_team.eq.${team}`)
      .order('match_date', { ascending: false })

    setMatches(matchData || [])

    const ids = (matchData || []).map((m) => m.id)

    const { data: playerData } = await supabase
      .from('match_players')
      .select(`
        match_id,
        side,
        player_id,
        players (*)
      `)
      .in('match_id', ids)

    setPlayers(playerData || [])
    setLoading(false)
  }

  const roster = useMemo(() => {
    const map = new Map()

    players.forEach((p) => {
      const player = p.players
      if (!player) return

      if (!map.has(player.id)) {
        map.set(player.id, {
          ...player,
          appearances: 0,
        })
      }

      const entry = map.get(player.id)
      entry.appearances++
    })

    return Array.from(map.values())
  }, [players])

  const bestSingles = [...roster]
    .sort((a, b) => (b.singles_dynamic_rating || 0) - (a.singles_dynamic_rating || 0))
    .slice(0, 4)

  const pairings = useMemo(() => {
    const map = new Map()

    matches.forEach((match) => {
      if (match.match_type !== 'doubles') return

      const pair = players
        .filter((p) => p.match_id === match.id)
        .slice(0, 2)

      if (pair.length < 2) return

      const key = pair.map((p) => p.player_id).sort().join('-')

      if (!map.has(key)) {
        map.set(key, {
          names: pair.map((p) => p.players.name),
        })
      }
    })

    return Array.from(map.values())
  }, [matches, players])

  return (
    <main className="page-shell">

      <header className="site-header">
        <Link href="/" className="brand">
          <Image src="/logo-icon.png" width={36} height={36} alt="" />
          <span>TenAce<span className="iq">IQ</span></span>
        </Link>
      </header>

      <section className="hero-panel">
        <h1>{team}</h1>
        <p>Team intelligence & lineup insights</p>
      </section>

      <section className="section">
        <h2>Lineup Intelligence</h2>

        <div className="card-grid">

          <div className="surface-card">
            <h3>Top Singles</h3>
            {bestSingles.map((p) => (
              <div key={p.id}>
                {p.name} ({p.singles_dynamic_rating?.toFixed(2)})
              </div>
            ))}
          </div>

          <div className="surface-card">
            <h3>Best Pairs</h3>
            {pairings.map((p, i) => (
              <div key={i}>
                {p.names.join(' / ')}
              </div>
            ))}
          </div>

        </div>
      </section>

      <section className="section">
        <h2>Matches</h2>

        {matches.map((m) => (
          <div key={m.id} className="surface-card">
            {m.home_team} vs {m.away_team}
          </div>
        ))}
      </section>

      <footer className="site-footer">
        © {new Date().getFullYear()} TenAceIQ
      </footer>

    </main>
  )
}

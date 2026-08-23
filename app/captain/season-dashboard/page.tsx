"use client"

import Link from 'next/link'
import { useEffect, useMemo, useState } from 'react'
import SiteShell from '@/app/components/site-shell'
import { readCaptainResumeState } from '@/lib/captain-memory'
import { supabase } from '@/lib/supabase'

export default function CaptainSeasonDashboardPage() {
  const scope = useMemo(() => readCaptainResumeState(), [])
  const [matchCount, setMatchCount] = useState<number | null>(null)
  const [nextMatch, setNextMatch] = useState<{ match_date: string | null; home_team: string | null; away_team: string | null } | null>(null)
  useEffect(() => {
    if (!scope?.team) return
    void supabase.from('matches').select('id', { count: 'exact', head: true }).or(`home_team.eq.${scope.team},away_team.eq.${scope.team}`).then(({ count }) => setMatchCount(count ?? 0))
    void supabase.from('matches').select('match_date, home_team, away_team').or(`home_team.eq.${scope.team},away_team.eq.${scope.team}`).gte('match_date', new Date().toISOString().slice(0, 10)).order('match_date', { ascending: true }).limit(1).then(({ data }) => setNextMatch(data?.[0] ?? null))
  }, [scope?.team])
  return (
    <SiteShell active="/captain">
      <main style={{ width: 'min(100% - 32px, 1100px)', margin: '0 auto', padding: '28px 0 64px', minWidth: 0 }}>
        <section style={{ display: 'grid', gap: 16, padding: 24, borderRadius: 28, border: '1px solid var(--shell-panel-border)', background: 'var(--shell-panel-bg-strong)', minWidth: 0 }}>
          <p style={{ margin: 0, color: 'var(--brand-blue-2)', fontWeight: 900, textTransform: 'uppercase', letterSpacing: '.1em' }}>Captain season</p>
          <h1 style={{ margin: 0, color: 'var(--foreground-strong)', fontSize: 'clamp(2rem, 7vw, 4rem)', lineHeight: 1 }}>Your team season.</h1>
          <p style={{ margin: 0, color: 'var(--shell-copy-muted)', lineHeight: 1.5 }}>{scope?.team ? `${scope.team}${scope.league ? ` · ${scope.league}` : ''}${scope.flight ? ` · ${scope.flight}` : ''}` : 'Choose a team in Captain to load your season context.'}</p>
          <strong style={{ color: 'var(--foreground-strong)' }}>{matchCount === null ? 'Loading match inventory…' : `${matchCount} matches in this team record`}</strong>
          <span style={{ color: 'var(--shell-copy-muted)' }}>{nextMatch ? `Next: ${nextMatch.home_team === scope?.team ? nextMatch.away_team : nextMatch.home_team} · ${new Date(nextMatch.match_date || '').toLocaleDateString()}` : 'No upcoming match is scheduled in the current record.'}</span>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, minWidth: 0 }}>
            <Link href="/captain/weekly-brief" style={actionStyle}>Open Match Week</Link>
            <Link href="/captain/availability" style={actionStyle}>Availability</Link>
            <Link href="/captain/lineup-builder" style={actionStyle}>Build lineup</Link>
          </div>
        </section>
      </main>
    </SiteShell>
  )
}

const actionStyle = { padding: '12px 16px', borderRadius: 999, border: '1px solid var(--shell-panel-border)', background: 'var(--shell-chip-bg)', color: 'var(--foreground-strong)', textDecoration: 'none', fontWeight: 900 } as const

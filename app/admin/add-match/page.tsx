'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import SiteShell from '@/app/components/site-shell'
import { supabase } from '../../../lib/supabase'
import { recalculateDynamicRatings } from '../../../lib/recalculateRatings'

type MatchType = 'singles' | 'doubles'
type MatchSide = 'A' | 'B'

type Player = {
  id: string
  name: string
}

const ADMIN_ID = 'accc3471-8912-491c-b8d9-4a84dcc7c42e'

export default function AddMatchPage() {
  const router = useRouter()

  const [user, setUser] = useState<any>(null)
  const [authLoading, setAuthLoading] = useState(true)

  const [players, setPlayers] = useState<Player[]>([])
  const [playersLoading, setPlayersLoading] = useState(true)

  const [matchType, setMatchType] = useState<MatchType>('singles')
  const [matchDate, setMatchDate] = useState('')
  const [score, setScore] = useState('')
  const [winnerSide, setWinnerSide] = useState<MatchSide>('A')
  const [lineNumber, setLineNumber] = useState('')
  const [source, setSource] = useState('manual')
  const [externalMatchId, setExternalMatchId] = useState('')

  const [sideA1, setSideA1] = useState('')
  const [sideA2, setSideA2] = useState('')
  const [sideB1, setSideB1] = useState('')
  const [sideB2, setSideB2] = useState('')

  const [createMissingPlayers, setCreateMissingPlayers] = useState(true)

  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')

  useEffect(() => {
    const checkUser = async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser()

      setUser(user)
      setAuthLoading(false)

      if (!user || user.id !== ADMIN_ID) {
        router.push('/admin')
      }
    }

    void checkUser()
  }, [router])

  useEffect(() => {
    if (!user || user.id !== ADMIN_ID) return

    const loadPlayers = async () => {
      setPlayersLoading(true)

      const { data, error } = await supabase
        .from('players')
        .select('id, name')
        .order('name', { ascending: true })

      if (error) {
        setError(error.message)
      } else {
        setPlayers((data || []) as Player[])
      }

      setPlayersLoading(false)
    }

    void loadPlayers()
  }, [user])

  useEffect(() => {
    if (matchType === 'singles') {
      setSideA2('')
      setSideB2('')
    }
  }, [matchType])

  const playerOptions = useMemo(() => players.map((player) => player.name), [players])

  const sideANames = useMemo(
    () =>
      [sideA1, sideA2]
        .map(normalizeName)
        .filter(Boolean)
        .slice(0, matchType === 'singles' ? 1 : 2),
    [sideA1, sideA2, matchType]
  )

  const sideBNames = useMemo(
    () =>
      [sideB1, sideB2]
        .map(normalizeName)
        .filter(Boolean)
        .slice(0, matchType === 'singles' ? 1 : 2),
    [sideB1, sideB2, matchType]
  )

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')
    setMessage('')

    try {
      validateMatchInput({
        matchType,
        matchDate,
        score,
        sideA: sideANames,
        sideB: sideBNames,
      })

      const allNames = [...sideANames, ...sideBNames]
      const existingPlayers = await fetchPlayersByNames(allNames)
      const missingNames = allNames.filter((name) => !existingPlayers[name.toLowerCase()])

      if (missingNames.length > 0 && !createMissingPlayers) {
        throw new Error(`Missing players: ${missingNames.join(', ')}`)
      }

      if (missingNames.length > 0 && createMissingPlayers) {
        await createPlayersByNames(missingNames)
      }

      const playerMap = await fetchPlayersByNames(allNames)

      const preparedRow = {
        date: normalizeDate(matchDate),
        matchType,
        score: normalizeScore(score),
        winnerSide,
        sideA: sideANames,
        sideB: sideBNames,
        source: normalizeSource(source),
        externalMatchId: normalizeNullableText(externalMatchId),
        lineNumber: normalizeNullableText(lineNumber),
      }

      const dedupeKey = buildDedupeKey(preparedRow)

      const { data: existingMatch, error: existingMatchError } = await supabase
        .from('matches')
        .select('id')
        .eq('dedupe_key', dedupeKey)
        .maybeSingle()

      if (existingMatchError) {
        throw new Error(existingMatchError.message)
      }

      if (existingMatch) {
        throw new Error('This match already exists in the database.')
      }

      const { data: insertedMatch, error: matchError } = await supabase
        .from('matches')
        .insert({
          match_date: preparedRow.date,
          match_type: preparedRow.matchType,
          score: preparedRow.score,
          winner_side: preparedRow.winnerSide,
          line_number: preparedRow.lineNumber,
          source: preparedRow.source,
          external_match_id: preparedRow.externalMatchId,
          dedupe_key: dedupeKey,
        })
        .select('id')
        .single()

      if (matchError) {
        throw new Error(matchError.message)
      }

      const participantRows = [
        ...preparedRow.sideA.map((name, index) => {
          const player = playerMap[name.toLowerCase()]
          if (!player) throw new Error(`Unable to resolve player: ${name}`)
          return {
            match_id: insertedMatch.id,
            player_id: player.id,
            side: 'A' as const,
            seat: index + 1,
          }
        }),
        ...preparedRow.sideB.map((name, index) => {
          const player = playerMap[name.toLowerCase()]
          if (!player) throw new Error(`Unable to resolve player: ${name}`)
          return {
            match_id: insertedMatch.id,
            player_id: player.id,
            side: 'B' as const,
            seat: index + 1,
          }
        }),
      ]

      const { error: matchPlayersError } = await supabase
        .from('match_players')
        .insert(participantRows)

      if (matchPlayersError) {
        await supabase.from('matches').delete().eq('id', insertedMatch.id)
        throw new Error(matchPlayersError.message)
      }

      let ratingsRecalculated = false
      try {
        await recalculateDynamicRatings()
        ratingsRecalculated = true
      } catch (recalcError) {
        console.error('Rating recalculation failed:', recalcError)
      }

      setMessage(
        ratingsRecalculated
          ? 'Match added successfully. Ratings recalculated.'
          : 'Match added successfully. Ratings were not recalculated.'
      )

      resetForm()
      await refreshPlayers()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to add match.')
    } finally {
      setLoading(false)
    }
  }

  async function refreshPlayers() {
    const { data, error } = await supabase
      .from('players')
      .select('id, name')
      .order('name', { ascending: true })

    if (!error) {
      setPlayers((data || []) as Player[])
    }
  }

  function resetForm() {
    setMatchType('singles')
    setMatchDate('')
    setScore('')
    setWinnerSide('A')
    setLineNumber('')
    setSource('manual')
    setExternalMatchId('')
    setSideA1('')
    setSideA2('')
    setSideB1('')
    setSideB2('')
  }

  if (authLoading) {
    return (
      <SiteShell active="/admin">
        <section
          style={{
            width: '100%',
            maxWidth: '1280px',
            margin: '0 auto',
            padding: '18px 24px 0',
          }}
        >
          <section className="hero-panel">
            <div className="hero-inner">
              <div className="section-kicker">Admin Tool</div>
              <h1 className="page-title">Checking access...</h1>
              <p className="page-subtitle">
                Verifying administrator permissions and loading match tools.
              </p>
            </div>
          </section>
        </section>
      </SiteShell>
    )
  }

  if (!user || user.id !== ADMIN_ID) {
    return null
  }

  return (
    <SiteShell active="/admin">
      <section
        style={{
          width: '100%',
          maxWidth: '1280px',
          margin: '0 auto',
          padding: '18px 24px 0',
        }}
      >
        <section className="hero-panel">
          <div className="hero-inner">
            <div className="section-kicker">Admin Tool</div>
            <h1 className="page-title">Add Match</h1>
            <p className="page-subtitle">
              Add a singles or doubles result into the matches and match_players structure,
              create missing players when needed, and recalculate ratings.
            </p>
          </div>
        </section>

        <section
          className="surface-card panel-pad section"
          style={{
            position: 'relative',
            overflow: 'hidden',
          }}
        >
          <div
            style={{
              position: 'absolute',
              top: '-90px',
              right: '-70px',
              width: '240px',
              height: '240px',
              borderRadius: '999px',
              background:
                'radial-gradient(circle, rgba(74,163,255,0.14) 0%, transparent 72%)',
              pointerEvents: 'none',
            }}
          />
          <div
            style={{
              position: 'absolute',
              bottom: '-120px',
              left: '-60px',
              width: '220px',
              height: '220px',
              borderRadius: '999px',
              background:
                'radial-gradient(circle, rgba(155,225,29,0.10) 0%, transparent 74%)',
              pointerEvents: 'none',
            }}
          />

          <div
            style={{
              position: 'relative',
              zIndex: 1,
              display: 'flex',
              flexWrap: 'wrap',
              justifyContent: 'space-between',
              gap: '16px',
              alignItems: 'flex-start',
            }}
          >
            <div>
              <h2 className="section-title">Match Details</h2>
              <p className="subtle-text" style={{ marginTop: 8, maxWidth: 760 }}>
                Enter the match metadata first, then assign players to Side A and Side B.
                This page checks for duplicate matches before inserting.
              </p>
            </div>

            <div
              style={{
                display: 'flex',
                flexWrap: 'wrap',
                gap: '10px',
              }}
            >
              <span className="badge badge-blue">
                {playersLoading ? 'Loading players…' : `${players.length} players loaded`}
              </span>
              <span className="badge badge-slate">
                {matchType === 'singles' ? 'Singles mode' : 'Doubles mode'}
              </span>
            </div>
          </div>

          <form onSubmit={handleSubmit} style={{ marginTop: 24, position: 'relative', zIndex: 1 }}>
            <div className="card-grid two">
              <Field label="Match Type">
                <select
                  value={matchType}
                  onChange={(e) => setMatchType(e.target.value as MatchType)}
                  className="select"
                  disabled={loading}
                >
                  <option value="singles">Singles</option>
                  <option value="doubles">Doubles</option>
                </select>
              </Field>

              <Field label="Match Date">
                <input
                  type="date"
                  value={matchDate}
                  onChange={(e) => setMatchDate(e.target.value)}
                  className="input"
                  disabled={loading}
                />
              </Field>

              <Field label="Score">
                <input
                  type="text"
                  value={score}
                  onChange={(e) => setScore(e.target.value)}
                  placeholder="6-3 6-4"
                  className="input"
                  disabled={loading}
                />
              </Field>

              <Field label="Winner">
                <select
                  value={winnerSide}
                  onChange={(e) => setWinnerSide(e.target.value as MatchSide)}
                  className="select"
                  disabled={loading}
                >
                  <option value="A">Side A</option>
                  <option value="B">Side B</option>
                </select>
              </Field>

              <Field label="Line Number">
                <input
                  type="text"
                  value={lineNumber}
                  onChange={(e) => setLineNumber(e.target.value)}
                  placeholder="1S or 2D"
                  className="input"
                  disabled={loading}
                />
              </Field>

              <Field label="Source">
                <input
                  type="text"
                  value={source}
                  onChange={(e) => setSource(e.target.value)}
                  placeholder="manual"
                  className="input"
                  disabled={loading}
                />
              </Field>

              <Field label="External Match ID">
                <input
                  type="text"
                  value={externalMatchId}
                  onChange={(e) => setExternalMatchId(e.target.value)}
                  placeholder="Optional"
                  className="input"
                  disabled={loading}
                />
              </Field>
            </div>

            <div className="card-grid two section">
              <section
                className="surface-card"
                style={{
                  padding: 20,
                  background:
                    'linear-gradient(180deg, rgba(17,34,63,0.74) 0%, rgba(9,18,34,0.92) 100%)',
                  border: '1px solid rgba(116,190,255,0.14)',
                }}
              >
                <div className="section-kicker" style={{ marginBottom: 14 }}>
                  Team Entry
                </div>
                <h3
                  style={{
                    margin: 0,
                    fontSize: '1.2rem',
                    fontWeight: 800,
                    color: '#F8FBFF',
                    letterSpacing: '-0.03em',
                  }}
                >
                  Side A
                </h3>
                <p className="subtle-text" style={{ marginTop: 8, marginBottom: 18 }}>
                  Enter the player or team on the A side.
                </p>

                <div style={{ display: 'grid', gap: 16 }}>
                  <Field label="Player 1">
                    <input
                      list="player-options"
                      value={sideA1}
                      onChange={(e) => setSideA1(e.target.value)}
                      className="input"
                      placeholder="Enter player name"
                      disabled={loading || playersLoading}
                    />
                  </Field>

                  {matchType === 'doubles' && (
                    <Field label="Player 2">
                      <input
                        list="player-options"
                        value={sideA2}
                        onChange={(e) => setSideA2(e.target.value)}
                        className="input"
                        placeholder="Enter player name"
                        disabled={loading || playersLoading}
                      />
                    </Field>
                  )}
                </div>
              </section>

              <section
                className="surface-card"
                style={{
                  padding: 20,
                  background:
                    'linear-gradient(180deg, rgba(17,34,63,0.74) 0%, rgba(9,18,34,0.92) 100%)',
                  border: '1px solid rgba(116,190,255,0.14)',
                }}
              >
                <div className="section-kicker" style={{ marginBottom: 14 }}>
                  Team Entry
                </div>
                <h3
                  style={{
                    margin: 0,
                    fontSize: '1.2rem',
                    fontWeight: 800,
                    color: '#F8FBFF',
                    letterSpacing: '-0.03em',
                  }}
                >
                  Side B
                </h3>
                <p className="subtle-text" style={{ marginTop: 8, marginBottom: 18 }}>
                  Enter the player or team on the B side.
                </p>

                <div style={{ display: 'grid', gap: 16 }}>
                  <Field label="Player 1">
                    <input
                      list="player-options"
                      value={sideB1}
                      onChange={(e) => setSideB1(e.target.value)}
                      className="input"
                      placeholder="Enter player name"
                      disabled={loading || playersLoading}
                    />
                  </Field>

                  {matchType === 'doubles' && (
                    <Field label="Player 2">
                      <input
                        list="player-options"
                        value={sideB2}
                        onChange={(e) => setSideB2(e.target.value)}
                        className="input"
                        placeholder="Enter player name"
                        disabled={loading || playersLoading}
                      />
                    </Field>
                  )}
                </div>
              </section>
            </div>

            <datalist id="player-options">
              {playerOptions.map((name) => (
                <option key={name} value={name} />
              ))}
            </datalist>

            <section
              className="surface-card section"
              style={{
                padding: 20,
                borderStyle: 'dashed',
                background:
                  'linear-gradient(180deg, rgba(17,34,63,0.58) 0%, rgba(9,18,34,0.86) 100%)',
                borderColor: 'rgba(155,225,29,0.18)',
              }}
            >
              <h3
                style={{
                  margin: 0,
                  fontSize: '1.05rem',
                  fontWeight: 800,
                  color: '#F8FBFF',
                  letterSpacing: '-0.02em',
                }}
              >
                Import Behavior
              </h3>

              <label
                htmlFor="create-missing-players"
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 12,
                  marginTop: 16,
                  color: '#D8E9FF',
                  fontWeight: 600,
                  cursor: loading ? 'not-allowed' : 'pointer',
                }}
              >
                <input
                  id="create-missing-players"
                  type="checkbox"
                  checked={createMissingPlayers}
                  onChange={(e) => setCreateMissingPlayers(e.target.checked)}
                  disabled={loading}
                  style={{ width: 16, height: 16 }}
                />
                Automatically create missing players
              </label>

              <p className="subtle-text" style={{ marginTop: 10, marginBottom: 0 }}>
                Leave this on to create any new player names at default starting ratings.
              </p>
            </section>

            {message && (
              <div
                className="badge badge-green"
                style={{
                  marginTop: 18,
                  minHeight: 44,
                  padding: '10px 14px',
                  justifyContent: 'flex-start',
                  width: '100%',
                }}
              >
                {message}
              </div>
            )}

            {error && (
              <div
                className="badge"
                style={{
                  marginTop: 18,
                  minHeight: 44,
                  padding: '10px 14px',
                  justifyContent: 'flex-start',
                  width: '100%',
                  background: 'rgba(220,38,38,0.12)',
                  color: '#fca5a5',
                  border: '1px solid rgba(248,113,113,0.18)',
                }}
              >
                {error}
              </div>
            )}

            <div
              style={{
                marginTop: 22,
                display: 'flex',
                gap: 12,
                flexWrap: 'wrap',
              }}
            >
              <button
                type="submit"
                className="button-primary"
                style={{
                  opacity: loading ? 0.7 : 1,
                  cursor: loading ? 'not-allowed' : 'pointer',
                }}
                disabled={loading}
              >
                {loading ? 'Saving...' : 'Add Match'}
              </button>

              <button
                type="button"
                onClick={resetForm}
                className="button-secondary"
                disabled={loading}
                style={{
                  opacity: loading ? 0.7 : 1,
                  cursor: loading ? 'not-allowed' : 'pointer',
                }}
              >
                Clear
              </button>
            </div>
          </form>
        </section>
      </section>
    </SiteShell>
  )
}

function Field({
  label,
  children,
}: {
  label: string
  children: React.ReactNode
}) {
  return (
    <div>
      <label className="label">{label}</label>
      {children}
    </div>
  )
}

async function fetchPlayersByNames(names: string[]): Promise<Record<string, Player>> {
  const playerMap: Record<string, Player> = {}
  const uniqueNames = [...new Set(names.map(normalizeName))]

  for (const chunk of chunkArray(uniqueNames, 500)) {
    const { data, error } = await supabase
      .from('players')
      .select('id, name')
      .in('name', chunk)

    if (error) {
      throw new Error(error.message)
    }

    for (const player of (data || []) as Player[]) {
      playerMap[normalizeName(player.name).toLowerCase()] = player
    }
  }

  return playerMap
}

async function createPlayersByNames(names: string[]) {
  const uniqueNames = [...new Set(names.map(normalizeName))]

  if (uniqueNames.length === 0) return

  const { error } = await supabase
    .from('players')
    .insert(
      uniqueNames.map((name) => ({
        name,
        singles_rating: 3.5,
        singles_dynamic_rating: 3.5,
        doubles_rating: 3.5,
        doubles_dynamic_rating: 3.5,
        overall_rating: 3.5,
        overall_dynamic_rating: 3.5,
      }))
    )

  if (error) {
    const alreadyExists =
      error.code === '23505' ||
      error.message.toLowerCase().includes('duplicate') ||
      error.message.toLowerCase().includes('unique')

    if (!alreadyExists) {
      throw new Error(error.message)
    }
  }
}

function validateMatchInput(params: {
  matchType: MatchType
  matchDate: string
  score: string
  sideA: string[]
  sideB: string[]
}) {
  const { matchType, matchDate, score, sideA, sideB } = params

  if (!matchDate.trim()) {
    throw new Error('Match date is required.')
  }

  normalizeDate(matchDate)

  if (!normalizeScore(score)) {
    throw new Error('Score is required.')
  }

  if (matchType === 'singles') {
    if (sideA.length !== 1 || sideB.length !== 1) {
      throw new Error('Singles requires exactly 1 player on each side.')
    }
  }

  if (matchType === 'doubles') {
    if (sideA.length !== 2 || sideB.length !== 2) {
      throw new Error('Doubles requires exactly 2 players on each side.')
    }
  }

  const allNames = [...sideA, ...sideB]
  if (allNames.some((name) => !name)) {
    throw new Error('All player names are required.')
  }

  const duplicates = findDuplicateNames(allNames)
  if (duplicates.length > 0) {
    throw new Error(`A player appears more than once in the same match: ${duplicates.join(', ')}`)
  }
}

function buildDedupeKey(row: {
  date: string
  matchType: MatchType
  score: string
  winnerSide: MatchSide
  sideA: string[]
  sideB: string[]
}) {
  const winningTeam =
    row.winnerSide === 'A'
      ? normalizeTeamForKey(row.sideA)
      : normalizeTeamForKey(row.sideB)

  const losingTeam =
    row.winnerSide === 'A'
      ? normalizeTeamForKey(row.sideB)
      : normalizeTeamForKey(row.sideA)

  return [
    row.date,
    row.matchType,
    normalizeScore(row.score).toLowerCase(),
    winningTeam,
    losingTeam,
  ].join('|')
}

function normalizeTeamForKey(names: string[]) {
  return [...names]
    .map((name) => normalizeName(name).toLowerCase())
    .sort()
    .join('+')
}

function findDuplicateNames(names: string[]) {
  const seen = new Set<string>()
  const duplicates = new Set<string>()

  for (const name of names) {
    const key = normalizeName(name).toLowerCase()
    if (seen.has(key)) {
      duplicates.add(name)
    } else {
      seen.add(key)
    }
  }

  return [...duplicates]
}

function normalizeName(name: string) {
  return name.trim().replace(/\s+/g, ' ')
}

function normalizeScore(score: string) {
  return score.trim().replace(/\s+/g, ' ')
}

function normalizeSource(value: string) {
  const normalized = value.trim()
  return normalized || 'manual'
}

function normalizeNullableText(value: string | null | undefined) {
  const normalized = (value ?? '').trim()
  return normalized ? normalized : null
}

function normalizeDate(date: string) {
  const value = date.trim()

  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return value
  }

  const parsed = new Date(value)

  if (Number.isNaN(parsed.getTime())) {
    throw new Error(`Invalid date: ${date}`)
  }

  const year = parsed.getUTCFullYear()
  const month = String(parsed.getUTCMonth() + 1).padStart(2, '0')
  const day = String(parsed.getUTCDate()).padStart(2, '0')

  return `${year}-${month}-${day}`
}

function chunkArray<T>(items: T[], size: number): T[][] {
  const chunks: T[][] = []
  for (let i = 0; i < items.length; i += size) {
    chunks.push(items.slice(i, i + size))
  }
  return chunks
}

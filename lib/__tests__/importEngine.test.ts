import { describe, expect, it } from 'vitest'
import { buildVerifiedPlayerRatingUpdate, createImportEngine } from '../ingestion/importEngine'

describe('scorecard official rating updates', () => {
  it('replaces a stale 3.5 baseline and untouched dynamics with line-level 4.0 evidence', () => {
    expect(buildVerifiedPlayerRatingUpdate({
      singlesRating: 3.5,
      doublesRating: 3.5,
      overallRating: 3.5,
      singlesDynamicRating: 3.5,
      doublesDynamicRating: 3.5,
      overallDynamicRating: 3.5,
    }, 4)).toEqual({
      singles_rating: 4,
      doubles_rating: 4,
      overall_rating: 4,
      singles_dynamic_rating: 4,
      doubles_dynamic_rating: 4,
      overall_dynamic_rating: 4,
    })
  })

  it('preserves in-season dynamic movement while correcting the official baseline', () => {
    expect(buildVerifiedPlayerRatingUpdate({
      singlesRating: 3.5,
      doublesRating: 3.5,
      overallRating: 3.5,
      singlesDynamicRating: 3.72,
      doublesDynamicRating: 3.81,
      overallDynamicRating: 3.76,
    }, 4)).toEqual({
      singles_rating: 4,
      doubles_rating: 4,
      overall_rating: 4,
    })
  })
})

describe('importTeamSummary', () => {
  it('fails closed without writing players when an official roster rating is missing', async () => {
    const insertedPlayers: Array<Record<string, unknown>> = []
    const rosterMemberships: Array<Record<string, unknown>> = []

    const supabase = {
      from(table: string) {
        if (table === 'players') {
          return {
            select() {
              return {
                in(column: string, values: string[]) {
                  const data = insertedPlayers.filter((player) => values.includes(String(player[column])))
                  return { data, error: null }
                },
              }
            },
            insert(payload: Array<Record<string, unknown>>) {
              for (const row of payload) {
                insertedPlayers.push({ id: `player-${insertedPlayers.length + 1}`, ...row })
              }
              return { error: null }
            },
          }
        }

        if (table === 'team_roster_members') {
          return {
            upsert(payload: Array<Record<string, unknown>>) {
              rosterMemberships.push(...payload)
              return { error: null }
            },
          }
        }

        if (table === 'team_summary_teams') {
          return {
            upsert() {
              return { error: null }
            },
          }
        }

        throw new Error(`Unexpected table ${table}`)
      },
    }

    const engine = createImportEngine(supabase as never, { hasNormalizedPlayerNameColumn: true })
    const result = await engine.importTeamSummary(
      [
        {
          leagueName: '2026 Adult 18 & Over Spring',
          flight: '4.5 Men',
          rosterTeamName: 'Huchet/Ariston',
          teams: [{ name: 'Huchet/Ariston' }],
          players: [{ name: 'Roster Only Player', ntrp: null, teamName: 'Huchet/Ariston' }],
        },
      ],
      'commit',
    )

    expect(result.createdCount).toBe(0)
    expect(result.failedCount).toBe(1)
    expect(result.errors[0]?.message).toContain('official NTRP rating is missing or invalid')
    expect(insertedPlayers).toEqual([])
    expect(rosterMemberships).toEqual([])
  })

  it('fails the entire roster before writes when the same player has conflicting ratings', async () => {
    const engine = createImportEngine({
      from(table: string) {
        throw new Error(`Unexpected write to ${table}`)
      },
    } as never, { hasNormalizedPlayerNameColumn: true })

    const result = await engine.importTeamSummary([
      {
        leagueName: '2026 Adult 18 & Over',
        flight: 'Men 4.0',
        rosterTeamName: 'Example Aces',
        teams: [],
        players: [{ name: 'Alex Player', ntrp: 4, teamName: 'Example Aces' }],
      },
      {
        leagueName: '2026 Adult 18 & Over',
        flight: 'Men 4.0',
        rosterTeamName: 'Example Aces',
        teams: [],
        players: [{ name: 'Alex Player', ntrp: 3.5, teamName: 'Example Aces' }],
      },
    ], 'commit')

    expect(result.createdCount).toBe(0)
    expect(result.updatedCount).toBe(0)
    expect(result.failedCount).toBe(1)
    expect(result.errors[0]?.message).toContain('conflicting official NTRP ratings 4.0 and 3.5')
  })

  it('persists official roster eligibility evidence', async () => {
    const players: Array<Record<string, unknown>> = []
    const rosterMemberships: Array<Record<string, unknown>> = []
    const supabase = {
      from(table: string) {
        if (table === 'players') return {
          select() {
            return {
              in(column: string, values: string[]) {
                return { data: players.filter((player) => values.includes(String(player[column]))), error: null }
              },
            }
          },
          insert(payload: Array<Record<string, unknown>>) {
            payload.forEach((row) => players.push({ id: `player-${players.length + 1}`, ...row }))
            return { error: null }
          },
        }
        if (table === 'team_roster_members') return {
          upsert(payload: Array<Record<string, unknown>>) {
            rosterMemberships.push(...payload)
            return { error: null }
          },
        }
        if (table === 'team_summary_teams') return { upsert() { return { error: null } } }
        throw new Error(`Unexpected table ${table}`)
      },
    }
    const engine = createImportEngine(supabase as never, { hasNormalizedPlayerNameColumn: true })
    await engine.importTeamSummary([{
      leagueName: '2026 Adult 40 & Over',
      flight: 'Women 4.0',
      rosterTeamName: 'Example Aces',
      teams: [],
      players: [{
        name: 'Alex Player',
        ntrp: 4,
        teamName: 'Example Aces',
        ratingSource: 'verified',
        mixedPairRole: 'woman',
        ageDivision: '40 & Over',
      }],
    }], 'commit')

    expect(players[0]).toMatchObject({ rating_source: 'verified', mixed_pair_role: 'woman' })
    expect(rosterMemberships[0]).toMatchObject({
      rating_source: 'verified',
      mixed_pair_role: 'woman',
      age_division: '40 & Over',
    })
  })

  it('links roster memberships for existing players missing normalized names', async () => {
    const players: Array<Record<string, unknown>> = [
      {
        id: 'player-existing-1',
        name: 'Nathan Meinert',
        normalized_name: null,
        singles_rating: 4.5,
        doubles_rating: 4.5,
        overall_rating: 4.5,
        singles_dynamic_rating: 4.5,
        doubles_dynamic_rating: 4.5,
        overall_dynamic_rating: 4.5,
      },
    ]
    const rosterMemberships: Array<Record<string, unknown>> = []

    const supabase = {
      from(table: string) {
        if (table === 'players') {
          return {
            select() {
              return {
                in(column: string, values: string[]) {
                  const data = players.filter((player) => values.includes(String(player[column])))
                  return { data, error: null }
                },
              }
            },
            update(update: Record<string, unknown>) {
              return {
                eq(column: string, value: string) {
                  const player = players.find((row) => row[column] === value)
                  if (player) Object.assign(player, update)
                  return { error: null }
                },
              }
            },
          }
        }

        if (table === 'team_roster_members') {
          return {
            upsert(payload: Array<Record<string, unknown>>) {
              rosterMemberships.push(...payload)
              return { error: null }
            },
          }
        }

        if (table === 'team_summary_teams') {
          return {
            upsert() {
              return { error: null }
            },
          }
        }

        throw new Error(`Unexpected table ${table}`)
      },
    }

    const engine = createImportEngine(supabase as never, { hasNormalizedPlayerNameColumn: true })
    const result = await engine.importTeamSummary(
      [
        {
          leagueName: '2026 Adult 18 & Over Spring',
          flight: 'Men 4.5',
          rosterTeamName: 'Meinert/The Other Guys',
          teams: [{ name: 'Meinert/The Other Guys' }],
          players: [{ name: 'Nathan Meinert', ntrp: 4.5, teamName: 'Meinert/The Other Guys' }],
        },
      ],
      'commit',
    )

    expect(result.updatedCount).toBe(1)
    expect(rosterMemberships).toMatchObject([
      {
        team_name: 'Meinert/The Other Guys',
        normalized_team_name: 'meinert/the other guys',
        player_id: 'player-existing-1',
        player_name: 'Nathan Meinert',
      },
    ])
  })

  it('fails loudly when roster memberships cannot be saved', async () => {
    const players: Array<Record<string, unknown>> = []
    const supabase = {
      from(table: string) {
        if (table === 'players') {
          return {
            select() {
              return {
                in(column: string, values: string[]) {
                  return { data: players.filter((player) => values.includes(String(player[column]))), error: null }
                },
              }
            },
            insert(payload: Array<Record<string, unknown>>) {
              for (const row of payload) {
                players.push({ id: `player-${players.length + 1}`, ...row })
              }
              return { error: null }
            },
          }
        }

        if (table === 'team_summary_teams') {
          return {
            upsert() {
              return { error: null }
            },
          }
        }

        if (table === 'team_roster_members') {
          return {
            upsert() {
              return { error: { message: 'relation does not exist' } }
            },
          }
        }

        throw new Error(`Unexpected table ${table}`)
      },
    }

    const engine = createImportEngine(supabase as never, { hasNormalizedPlayerNameColumn: true })

    await expect(engine.importTeamSummary(
      [
        {
          leagueName: '2026 Adult 18 & Over Spring',
          flight: 'Men 4.5',
          rosterTeamName: 'Meinert/The Other Guys',
          teams: [{ name: 'Meinert/The Other Guys' }],
          players: [{ name: 'Nathan Meinert', ntrp: 4.5, teamName: 'Meinert/The Other Guys' }],
        },
      ],
      'commit',
    )).rejects.toThrow('team_roster_members upsert failed')
  })

  it('still saves roster memberships when the optional team summary table is not deployed', async () => {
    const players: Array<Record<string, unknown>> = []
    const rosterMemberships: Array<Record<string, unknown>> = []
    const supabase = {
      from(table: string) {
        if (table === 'players') {
          return {
            select() {
              return {
                in(column: string, values: string[]) {
                  return { data: players.filter((player) => values.includes(String(player[column]))), error: null }
                },
              }
            },
            insert(payload: Array<Record<string, unknown>>) {
              for (const row of payload) {
                players.push({ id: `player-${players.length + 1}`, ...row })
              }
              return { error: null }
            },
          }
        }

        if (table === 'team_summary_teams') {
          return {
            upsert() {
              return { error: { message: "Could not find the table 'public.team_summary_teams' in the schema cache" } }
            },
          }
        }

        if (table === 'team_roster_members') {
          return {
            upsert(payload: Array<Record<string, unknown>>) {
              rosterMemberships.push(...payload)
              return { error: null }
            },
          }
        }

        throw new Error(`Unexpected table ${table}`)
      },
    }

    const engine = createImportEngine(supabase as never, { hasNormalizedPlayerNameColumn: true })
    const result = await engine.importTeamSummary(
      [
        {
          leagueName: '2026 Adult 18 & Over Spring',
          flight: 'Men 4.5',
          rosterTeamName: 'Meinert/The Other Guys',
          teams: [{ name: 'Meinert/The Other Guys' }],
          players: [{ name: 'Nathan Meinert', ntrp: 4.5, teamName: 'Meinert/The Other Guys' }],
        },
      ],
      'commit',
    )

    expect(result.createdCount).toBe(1)
    expect(rosterMemberships).toMatchObject([
      {
        team_name: 'Meinert/The Other Guys',
        normalized_team_name: 'meinert/the other guys',
        player_name: 'Nathan Meinert',
      },
    ])
  })
})

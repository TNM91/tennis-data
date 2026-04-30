import { describe, expect, it } from 'vitest'
import { createImportEngine } from '../ingestion/importEngine'

describe('importTeamSummary', () => {
  it('creates roster memberships for team summary players without ratings', async () => {
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

    expect(result.createdCount).toBe(1)
    expect(insertedPlayers).toMatchObject([
      {
        name: 'Roster Only Player',
        normalized_name: 'roster only player',
        overall_rating: 3.5,
      },
    ])
    expect(rosterMemberships).toMatchObject([
      {
        team_name: 'Huchet/Ariston',
        normalized_team_name: 'huchet/ariston',
        player_name: 'Roster Only Player',
        league_name: '2026 Adult 18 & Over Spring',
        flight: '4.5 Men',
        ntrp: null,
      },
    ])
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
})

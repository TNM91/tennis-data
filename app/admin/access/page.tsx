'use client'

export const dynamic = 'force-dynamic'


import { useCallback, useDeferredValue, useEffect, useMemo, useState, type ReactNode } from 'react'
import AdminGate from '@/app/components/admin-gate'
import SiteShell from '@/app/components/site-shell'
import {
  buildProductAccessState,
  CAPTAIN_SUBSCRIPTION_PRICE_LABEL,
  TIQ_SEASON_FEE_PRICE_LABEL,
  type CaptainSubscriptionStatus,
  type ProductEntitlementSnapshot,
} from '@/lib/access-model'
import { normalizeUserRole, type UserRole } from '@/lib/roles'
import { supabase } from '@/lib/supabase'
import type { PricingPlanId } from '@/lib/pricing-plans'

type ProfileAccessRow = {
  id: string
  role: string | null
  player_plus_subscription_active: boolean | null
  player_plus_subscription_status: CaptainSubscriptionStatus | null
  captain_subscription_active: boolean | null
  captain_subscription_status: CaptainSubscriptionStatus | null
  tiq_team_league_entry_enabled: boolean | null
  tiq_individual_league_creator_enabled: boolean | null
}

type EditableProfileAccess = {
  player_plus_subscription_active: boolean
  player_plus_subscription_status: CaptainSubscriptionStatus
  captain_subscription_active: boolean
  captain_subscription_status: CaptainSubscriptionStatus
  tiq_team_league_entry_enabled: boolean
  tiq_individual_league_creator_enabled: boolean
}

type AccessPreset = 'player_plus' | 'captain' | 'league'

type ConvertedUpgradeRequestRow = {
  id: string
  plan_id: string | null
  requester_email: string | null
  requester_user_id: string | null
  created_at: string | null
  updated_at: string | null
}

type ConvertedUpgradeRequest = {
  id: string
  planId: PricingPlanId
  email: string
  changedAt: string
}

type AccessAudit = {
  currentPlan: string
  activePlans: string
  sources: string[]
  warnings: string[]
  lastConvertedRequest: ConvertedUpgradeRequest | null
}

const STATUS_OPTIONS: CaptainSubscriptionStatus[] = [
  'inactive',
  'trial',
  'active',
  'past_due',
  'canceled',
]

function normalizeEditable(row: ProfileAccessRow): EditableProfileAccess {
  return {
    player_plus_subscription_active: Boolean(row.player_plus_subscription_active),
    player_plus_subscription_status: STATUS_OPTIONS.includes(
      row.player_plus_subscription_status ?? 'inactive',
    )
      ? (row.player_plus_subscription_status ?? 'inactive')
      : 'inactive',
    captain_subscription_active: Boolean(row.captain_subscription_active),
    captain_subscription_status: STATUS_OPTIONS.includes(
      row.captain_subscription_status ?? 'inactive',
    )
      ? (row.captain_subscription_status ?? 'inactive')
      : 'inactive',
    tiq_team_league_entry_enabled: Boolean(row.tiq_team_league_entry_enabled),
    tiq_individual_league_creator_enabled: Boolean(row.tiq_individual_league_creator_enabled),
  }
}

function compactUserId(value: string) {
  const trimmed = value.trim()
  if (trimmed.length <= 18) return trimmed
  return `${trimmed.slice(0, 8)}...${trimmed.slice(-6)}`
}

function roleLabel(value: string | null | undefined) {
  const normalized = (value || '').trim().toLowerCase()
  if (normalized === 'admin') return 'Admin'
  if (normalized === 'captain') return 'Captain'
  if (normalized === 'member') return 'Member'
  return 'Public'
}

function formatAccessPreset(value: AccessPreset) {
  if (value === 'player_plus') return 'Player'
  if (value === 'captain') return 'Captain'
  return 'Coordinator'
}

export default function AdminAccessPage() {
  const [profiles, setProfiles] = useState<ProfileAccessRow[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [savingId, setSavingId] = useState<string | null>(null)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const [search, setSearch] = useState('')
  const [handoffSearch, setHandoffSearch] = useState('')
  const [playerEntitlementsAvailable, setPlayerEntitlementsAvailable] = useState(true)
  const [roleFilter, setRoleFilter] = useState<'all' | 'admin' | 'captain' | 'member' | 'public'>(
    'all',
  )
  const [editedProfiles, setEditedProfiles] = useState<Record<string, EditableProfileAccess>>({})
  const [convertedRequestsByUser, setConvertedRequestsByUser] = useState<Record<string, ConvertedUpgradeRequest>>({})
  const [convertedRequestsAvailable, setConvertedRequestsAvailable] = useState(true)

  const deferredSearch = useDeferredValue(search)

  const loadConvertedRequests = useCallback(async () => {
    const { data, error } = await supabase
      .from('upgrade_requests')
      .select('id, plan_id, requester_email, requester_user_id, created_at, updated_at')
      .eq('status', 'converted')
      .not('requester_user_id', 'is', null)
      .order('updated_at', { ascending: false })
      .limit(500)

    if (error) {
      setConvertedRequestsAvailable(false)
      return {}
    }

    setConvertedRequestsAvailable(true)
    return ((data ?? []) as ConvertedUpgradeRequestRow[]).reduce<Record<string, ConvertedUpgradeRequest>>(
      (acc, row) => {
        const userId = row.requester_user_id ?? ''
        const planId = normalizePricingPlanId(row.plan_id)
        if (!userId || !planId || acc[userId]) return acc

        acc[userId] = {
          id: row.id,
          planId,
          email: row.requester_email ?? '',
          changedAt: row.updated_at ?? row.created_at ?? '',
        }
        return acc
      },
      {},
    )
  }, [])

  const loadProfiles = useCallback(async (showRefreshing = false) => {
    if (showRefreshing) {
      setRefreshing(true)
    } else {
      setLoading(true)
    }

    setError('')

    try {
      const result = await supabase
        .from('profiles')
        .select(
          'id, role, player_plus_subscription_active, player_plus_subscription_status, captain_subscription_active, captain_subscription_status, tiq_team_league_entry_enabled, tiq_individual_league_creator_enabled',
        )
        .limit(500)

      let data = result.data
      if (result.error) {
        setPlayerEntitlementsAvailable(false)
        const legacyResult = await supabase
          .from('profiles')
          .select(
            'id, role, captain_subscription_active, captain_subscription_status, tiq_team_league_entry_enabled, tiq_individual_league_creator_enabled',
          )
          .limit(500)

        if (legacyResult.error) throw new Error(legacyResult.error.message)
        data = (legacyResult.data ?? []).map((row) => ({
          ...row,
          player_plus_subscription_active: false,
          player_plus_subscription_status: 'inactive' as CaptainSubscriptionStatus,
        }))
        setMessage('Player entitlement columns are not migrated yet. Showing legacy access fields.')
      } else {
        setPlayerEntitlementsAvailable(true)
      }

      const rows = ((data || []) as ProfileAccessRow[]).sort((a, b) =>
        compactUserId(a.id).localeCompare(compactUserId(b.id)),
      )
      const convertedRequests = await loadConvertedRequests()

      setProfiles(rows)
      setConvertedRequestsByUser(convertedRequests)
      setEditedProfiles(
        rows.reduce<Record<string, EditableProfileAccess>>((acc, row) => {
          acc[row.id] = normalizeEditable(row)
          return acc
        }, {}),
      )
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Failed to load profile entitlements.',
      )
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [loadConvertedRequests])

  useEffect(() => {
    const initialSearch = new URLSearchParams(window.location.search).get('search')
    if (initialSearch) {
      setSearch(initialSearch)
      setHandoffSearch(initialSearch)
    }
    void loadProfiles()
  }, [loadProfiles])

  function updateProfileField<K extends keyof EditableProfileAccess>(
    profileId: string,
    field: K,
    value: EditableProfileAccess[K],
  ) {
    setEditedProfiles((current) => ({
      ...current,
      [profileId]: {
        ...(current[profileId] || {
          captain_subscription_active: false,
          captain_subscription_status: 'inactive',
          player_plus_subscription_active: false,
          player_plus_subscription_status: 'inactive',
          tiq_team_league_entry_enabled: false,
          tiq_individual_league_creator_enabled: false,
        }),
        [field]: value,
      },
    }))
  }

  function isDirty(profile: ProfileAccessRow) {
    const current = editedProfiles[profile.id]
    if (!current) return false

    return JSON.stringify(current) !== JSON.stringify(normalizeEditable(profile))
  }

  function applyAccessPreset(profileId: string, preset: AccessPreset) {
    const profile = profiles.find((item) => item.id === profileId)
    if (!profile) return

    setEditedProfiles((current) => {
      const base = current[profileId] ?? normalizeEditable(profile)
      const grantsPlayerAccess = preset === 'player_plus' || preset === 'captain'

      return {
        ...current,
        [profileId]: {
          ...base,
          player_plus_subscription_active: grantsPlayerAccess ? true : base.player_plus_subscription_active,
          player_plus_subscription_status: grantsPlayerAccess ? 'active' : base.player_plus_subscription_status,
          captain_subscription_active: preset === 'captain' ? true : base.captain_subscription_active,
          captain_subscription_status: preset === 'captain' ? 'active' : base.captain_subscription_status,
          tiq_team_league_entry_enabled: preset === 'league' ? true : base.tiq_team_league_entry_enabled,
          tiq_individual_league_creator_enabled:
            preset === 'league' ? true : base.tiq_individual_league_creator_enabled,
        },
      }
    })
    setMessage(`Drafted ${formatAccessPreset(preset)} access. Save the row to apply it.`)
    setError('')
  }

  async function saveProfile(profile: ProfileAccessRow) {
    const draft = editedProfiles[profile.id]
    if (!draft) return

    setSavingId(profile.id)
    setMessage('')
    setError('')

    try {
      const payload: Record<string, boolean | CaptainSubscriptionStatus> = {
        captain_subscription_active: draft.captain_subscription_active,
        captain_subscription_status: draft.captain_subscription_status,
        tiq_team_league_entry_enabled: draft.tiq_team_league_entry_enabled,
        tiq_individual_league_creator_enabled: draft.tiq_individual_league_creator_enabled,
      }
      if (playerEntitlementsAvailable) {
        payload.player_plus_subscription_active = draft.player_plus_subscription_active
        payload.player_plus_subscription_status = draft.player_plus_subscription_status
      }

      const { error: updateError } = await supabase
        .from('profiles')
        .update(payload)
        .eq('id', profile.id)

      if (updateError) throw new Error(updateError.message)

      setProfiles((current) =>
        current.map((row) => (row.id === profile.id ? { ...row, ...payload } : row)),
      )
      setMessage(`Updated access for ${compactUserId(profile.id)}.`)
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Failed to save profile entitlements.',
      )
    } finally {
      setSavingId(null)
    }
  }

  const filteredProfiles = useMemo(() => {
    const normalizedSearch = deferredSearch.trim().toLowerCase()

    return profiles.filter((profile) => {
      const normalizedRole = (profile.role || 'public').trim().toLowerCase()
      if (roleFilter !== 'all' && normalizedRole !== roleFilter) return false

      if (!normalizedSearch) return true

      return [profile.id, normalizedRole, compactUserId(profile.id)]
        .join(' ')
        .toLowerCase()
        .includes(normalizedSearch)
    })
  }, [deferredSearch, profiles, roleFilter])

  const activeCaptainCount = profiles.filter((profile) =>
    Boolean(profile.captain_subscription_active),
  ).length
  const activePlayerCount = profiles.filter((profile) =>
    Boolean(profile.player_plus_subscription_active || profile.captain_subscription_active),
  ).length
  const teamEntryCount = profiles.filter((profile) =>
    Boolean(profile.tiq_team_league_entry_enabled),
  ).length
  const individualCreatorCount = profiles.filter((profile) =>
    Boolean(profile.tiq_individual_league_creator_enabled),
  ).length
  const auditWarningCount = profiles.filter((profile) =>
    buildAccessAudit(
      normalizeUserRole(profile.role),
      normalizeEditable(profile),
      convertedRequestsByUser[profile.id] ?? null,
    ).warnings.length > 0,
  ).length
  const handoffProfile = handoffSearch && filteredProfiles.length === 1 ? filteredProfiles[0] : null

  return (
    <SiteShell active="/admin">
      <AdminGate>
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
              <div className="section-kicker">Admin Access</div>
              <h1 className="page-title">Player, Captain, and Coordinator entitlements</h1>
              <p className="page-subtitle" style={{ maxWidth: 860 }}>
                Control who has the {CAPTAIN_SUBSCRIPTION_PRICE_LABEL} captain workflow and who
                can run TIQ team or individual leagues at {TIQ_SEASON_FEE_PRICE_LABEL} without
                forcing Player or Captain access.
              </p>
              <div
                style={{
                  display: 'flex',
                  flexWrap: 'wrap',
                  gap: 10,
                  marginTop: 18,
                }}
              >
                <span className="badge badge-green">Captain subscription control</span>
                <span className="badge badge-blue">Team coordinator access</span>
                <span className="badge badge-slate">Individual coordinator access</span>
              </div>
            </div>
          </section>

          <section className="surface-card panel-pad section" style={{ marginTop: 18 }}>
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
                gap: 16,
              }}
            >
              <MetricCard label="Profiles Loaded" value={profiles.length} />
              <MetricCard label="Player Active" value={activePlayerCount} />
              <MetricCard label="Captain Active" value={activeCaptainCount} />
              <MetricCard label="Team Coordinator" value={teamEntryCount} />
              <MetricCard label="Individual Coordinator" value={individualCreatorCount} />
              <MetricCard label="Audit Flags" value={auditWarningCount} />
            </div>

            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
                gap: 16,
                marginTop: 18,
              }}
            >
              <Field label="Search profiles" htmlFor="admin-access-search">
                <input
                  id="admin-access-search"
                  type="text"
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="Search by user id or role"
                  className="input"
                  disabled={loading || refreshing}
                />
              </Field>

              <Field label="Role filter" htmlFor="admin-access-role-filter">
                <select
                  id="admin-access-role-filter"
                  value={roleFilter}
                  onChange={(event) =>
                    setRoleFilter(
                      event.target.value as 'all' | 'admin' | 'captain' | 'member' | 'public',
                    )
                  }
                  className="select"
                  disabled={loading || refreshing}
                >
                  <option value="all">All roles</option>
                  <option value="admin">Admin</option>
                  <option value="captain">Captain</option>
                  <option value="member">Member</option>
                  <option value="public">Public</option>
                </select>
              </Field>
            </div>

            <div
              style={{
                display: 'flex',
                gap: 12,
                flexWrap: 'wrap',
                marginTop: 16,
              }}
            >
              <button
                type="button"
                onClick={() => void loadProfiles(true)}
                className="button-ghost"
                style={{
                  background: 'var(--shell-chip-bg)',
                  color: 'var(--foreground)',
                  border: '1px solid var(--shell-panel-border)',
                }}
                disabled={loading || refreshing}
              >
                {refreshing ? 'Refreshing...' : 'Refresh profiles'}
              </button>
            </div>

            <p className="subtle-text" style={{ marginTop: 14, maxWidth: 860 }}>
              This page is the monetization control point for TenAceIQ. Coordinator access can be
              granted by itself, without enabling Player or Captain tools.
              {convertedRequestsAvailable
                ? ' Converted checkout requests are shown beside each profile when available.'
                : ' Converted checkout requests are not available yet, so this view is showing profile fields only.'}
            </p>

            {handoffSearch ? (
              <div style={handoffPanelStyle}>
                <div>
                  <div className="section-kicker">Upgrade request handoff</div>
                  <h2 style={handoffTitleStyle}>
                    {handoffProfile ? 'One account is in scope.' : 'Review the filtered account set.'}
                  </h2>
                  <p style={handoffTextStyle}>
                    Search was prefilled from the upgrade request queue. Use the presets when one
                    linked account is visible, then save the row.
                  </p>
                </div>
                {handoffProfile ? (
                  <div style={handoffActionStyle}>
                    <button
                      type="button"
                      className="button-secondary"
                      onClick={() => applyAccessPreset(handoffProfile.id, 'player_plus')}
                    >
                      Draft Player
                    </button>
                    <button
                      type="button"
                      className="button-secondary"
                      onClick={() => applyAccessPreset(handoffProfile.id, 'captain')}
                    >
                      Draft Captain
                    </button>
                    <button
                      type="button"
                      className="button-secondary"
                      onClick={() => applyAccessPreset(handoffProfile.id, 'league')}
                    >
                      Draft Coordinator
                    </button>
                  </div>
                ) : (
                  <span className="badge badge-slate">{filteredProfiles.length} matches</span>
                )}
              </div>
            ) : null}

            {message ? (
              <div
                className="badge badge-green"
                style={{
                  marginTop: 16,
                  minHeight: 44,
                  width: '100%',
                  justifyContent: 'flex-start',
                  padding: '10px 14px',
                }}
              >
                {message}
              </div>
            ) : null}

            {error ? (
              <div
                className="badge"
                style={{
                  marginTop: 16,
                  minHeight: 44,
                  width: '100%',
                  justifyContent: 'flex-start',
                  padding: '10px 14px',
                  background: 'rgba(220,38,38,0.10)',
                  color: '#fca5a5',
                  border: '1px solid rgba(220,38,38,0.18)',
                }}
              >
                {error}
              </div>
            ) : null}

            {loading ? (
              <p className="subtle-text" style={{ marginTop: 18 }}>
                Loading profile entitlements...
              </p>
            ) : filteredProfiles.length === 0 ? (
              <div
                style={{
                  marginTop: 18,
                  borderRadius: 20,
                  border: '1px solid var(--shell-panel-border)',
                  background: 'var(--shell-chip-bg)',
                  padding: '18px 20px',
                }}
              >
                <div className="section-title" style={{ fontSize: '1.05rem' }}>
                  No profiles match the current filters
                </div>
                <p className="subtle-text" style={{ marginTop: 8 }}>
                  Clear the search or broaden the role filter to bring more entitlement rows back
                  into scope.
                </p>
              </div>
            ) : (
              <div className="table-wrap" style={{ marginTop: 20 }}>
                <table className="data-table" style={{ minWidth: 1760 }}>
                  <thead>
                    <tr>
                      <th>User</th>
                      <th>Role</th>
                      <th>Access Result</th>
                      <th>Why</th>
                      <th>Player Active</th>
                      <th>Player Status</th>
                      <th>Captain Active</th>
                      <th>Captain Status</th>
                      <th>Team Coordinator</th>
                      <th>Individual Coordinator</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredProfiles.map((profile) => {
                      const draft = editedProfiles[profile.id] || normalizeEditable(profile)
                      const dirty = isDirty(profile)
                      const audit = buildAccessAudit(
                        normalizeUserRole(profile.role),
                        draft,
                        convertedRequestsByUser[profile.id] ?? null,
                      )

                      return (
                        <tr key={profile.id}>
                          <td>
                            <div style={{ color: '#f8fbff', fontWeight: 800 }}>
                              {compactUserId(profile.id)}
                            </div>
                            <div className="subtle-text" style={{ marginTop: 4 }}>
                              {profile.id}
                            </div>
                          </td>
                          <td>{roleLabel(profile.role)}</td>
                          <td>
                            <div style={accessResultWrapStyle}>
                              <span className="badge badge-green">{audit.currentPlan}</span>
                              <span className="subtle-text">{audit.activePlans}</span>
                              {audit.lastConvertedRequest ? (
                                <span className="badge badge-blue">
                                  Checkout: {formatPlanLabel(audit.lastConvertedRequest.planId)}
                                </span>
                              ) : null}
                            </div>
                          </td>
                          <td>
                            <div style={auditReasonWrapStyle}>
                              {audit.sources.map((source) => (
                                <span key={source} style={auditReasonStyle}>
                                  {source}
                                </span>
                              ))}
                              {audit.warnings.map((warning) => (
                                <span key={warning} style={auditWarningStyle}>
                                  {warning}
                                </span>
                              ))}
                            </div>
                          </td>
                          <td>
                            <label style={toggleWrap}>
                              <input
                                type="checkbox"
                                checked={draft.player_plus_subscription_active}
                                onChange={(event) =>
                                  updateProfileField(
                                    profile.id,
                                    'player_plus_subscription_active',
                                    event.target.checked,
                                  )
                                }
                                disabled={savingId === profile.id || !playerEntitlementsAvailable}
                              />
                              <span>{draft.player_plus_subscription_active ? 'Active' : 'Inactive'}</span>
                            </label>
                          </td>
                          <td>
                            <select
                              value={draft.player_plus_subscription_status}
                              onChange={(event) =>
                                updateProfileField(
                                  profile.id,
                                  'player_plus_subscription_status',
                                  event.target.value as CaptainSubscriptionStatus,
                                )
                              }
                              className="select"
                              style={{ minWidth: 140 }}
                              disabled={savingId === profile.id || !playerEntitlementsAvailable}
                            >
                              {STATUS_OPTIONS.map((status) => (
                                <option key={status} value={status}>
                                  {status}
                                </option>
                              ))}
                            </select>
                          </td>
                          <td>
                            <label style={toggleWrap}>
                              <input
                                type="checkbox"
                                checked={draft.captain_subscription_active}
                                onChange={(event) =>
                                  updateProfileField(
                                    profile.id,
                                    'captain_subscription_active',
                                    event.target.checked,
                                  )
                                }
                                disabled={savingId === profile.id}
                              />
                              <span>{draft.captain_subscription_active ? 'Active' : 'Inactive'}</span>
                            </label>
                          </td>
                          <td>
                            <select
                              value={draft.captain_subscription_status}
                              onChange={(event) =>
                                updateProfileField(
                                  profile.id,
                                  'captain_subscription_status',
                                  event.target.value as CaptainSubscriptionStatus,
                                )
                              }
                              className="select"
                              style={{ minWidth: 140 }}
                              disabled={savingId === profile.id}
                            >
                              {STATUS_OPTIONS.map((status) => (
                                <option key={status} value={status}>
                                  {status}
                                </option>
                              ))}
                            </select>
                          </td>
                          <td>
                            <label style={toggleWrap}>
                              <input
                                type="checkbox"
                                checked={draft.tiq_team_league_entry_enabled}
                                onChange={(event) =>
                                  updateProfileField(
                                    profile.id,
                                    'tiq_team_league_entry_enabled',
                                    event.target.checked,
                                  )
                                }
                                disabled={savingId === profile.id}
                              />
                              <span>
                                {draft.tiq_team_league_entry_enabled ? 'Enabled' : 'Disabled'}
                              </span>
                            </label>
                          </td>
                          <td>
                            <label style={toggleWrap}>
                              <input
                                type="checkbox"
                                checked={draft.tiq_individual_league_creator_enabled}
                                onChange={(event) =>
                                  updateProfileField(
                                    profile.id,
                                    'tiq_individual_league_creator_enabled',
                                    event.target.checked,
                                  )
                                }
                                disabled={savingId === profile.id}
                              />
                              <span>
                                {draft.tiq_individual_league_creator_enabled ? 'Enabled' : 'Disabled'}
                              </span>
                            </label>
                          </td>
                          <td>
                            <button
                              type="button"
                              onClick={() => void saveProfile(profile)}
                              className="button-secondary"
                              style={{
                                minHeight: 40,
                                padding: '0 14px',
                                opacity: savingId === profile.id || !dirty ? 0.7 : 1,
                                cursor:
                                  savingId === profile.id || !dirty ? 'not-allowed' : 'pointer',
                              }}
                              disabled={savingId === profile.id || !dirty}
                            >
                              {savingId === profile.id ? 'Saving...' : 'Save access'}
                            </button>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        </section>
      </AdminGate>
    </SiteShell>
  )
}

function normalizePricingPlanId(value: string | null | undefined): PricingPlanId | null {
  if (value === 'free' || value === 'player_plus' || value === 'captain' || value === 'league') {
    return value
  }

  return null
}

function toEntitlementSnapshot(draft: EditableProfileAccess): ProductEntitlementSnapshot {
  return {
    playerPlusSubscriptionActive: draft.player_plus_subscription_active,
    playerPlusSubscriptionStatus: draft.player_plus_subscription_status,
    captainSubscriptionActive: draft.captain_subscription_active,
    captainSubscriptionStatus: draft.captain_subscription_status,
    tiqTeamLeagueEntryEnabled: draft.tiq_team_league_entry_enabled,
    tiqIndividualLeagueCreatorEnabled: draft.tiq_individual_league_creator_enabled,
  }
}

function buildAccessAudit(
  role: UserRole,
  draft: EditableProfileAccess,
  lastConvertedRequest: ConvertedUpgradeRequest | null,
): AccessAudit {
  const access = buildProductAccessState(role, toEntitlementSnapshot(draft))
  const activePaidPlans = access.activePlanIds.filter((planId) => planId !== 'free')
  const sources: string[] = []
  const warnings: string[] = []

  if (role === 'admin') {
    sources.push('Admin role grants every workspace.')
  } else if (role === 'captain') {
    sources.push('Captain role grants Player and Captain.')
  }

  if (draft.player_plus_subscription_active) {
    sources.push(`Player flag is ${draft.player_plus_subscription_status}.`)
  }

  if (draft.captain_subscription_active) {
    sources.push(`Captain flag is ${draft.captain_subscription_status}.`)
  }

  if (draft.tiq_team_league_entry_enabled && draft.tiq_individual_league_creator_enabled) {
    sources.push('Coordinator flags are enabled.')
  } else if (draft.tiq_team_league_entry_enabled) {
    sources.push('Team coordinator flag is enabled.')
  } else if (draft.tiq_individual_league_creator_enabled) {
    sources.push('Individual coordinator flag is enabled.')
  }

  if (lastConvertedRequest) {
    sources.push(`Last converted checkout was ${formatPlanLabel(lastConvertedRequest.planId)}.`)
  }

  if (lastConvertedRequest?.planId === 'player_plus' && access.canUseCaptainWorkflow) {
    warnings.push('Review: Player checkout currently has Captain access.')
  }

  if (lastConvertedRequest?.planId === 'player_plus' && access.canUseLeagueTools) {
    warnings.push('Review: Player checkout currently has Coordinator access.')
  }

  if (lastConvertedRequest?.planId === 'captain' && access.canUseLeagueTools) {
    warnings.push('Review: Captain checkout currently has Coordinator access.')
  }

  if (lastConvertedRequest?.planId === 'league' && access.canUseAdvancedPlayerInsights && role !== 'admin') {
    warnings.push('Review: Coordinator checkout currently has Player access.')
  }

  return {
    currentPlan: formatPlanLabel(access.currentPlanId),
    activePlans: activePaidPlans.length
      ? activePaidPlans.map(formatPlanLabel).join(', ')
      : 'Free only',
    sources: sources.length ? sources : ['No paid entitlement flags are active.'],
    warnings,
    lastConvertedRequest,
  }
}

function formatPlanLabel(planId: PricingPlanId) {
  if (planId === 'player_plus') return 'Player'
  if (planId === 'captain') return 'Captain'
  if (planId === 'league') return 'Coordinator'
  return 'Free'
}

function Field({
  label,
  htmlFor,
  children,
}: {
  label: string
  htmlFor?: string
  children: ReactNode
}) {
  return (
    <div>
      <label htmlFor={htmlFor} className="label">
        {label}
      </label>
      {children}
    </div>
  )
}

function MetricCard({ label, value }: { label: string; value: number }) {
  return (
    <div className="metric-card">
      <div className="metric-label">{label}</div>
      <div className="metric-value">{value}</div>
    </div>
  )
}

const handoffPanelStyle = {
  display: 'flex',
  justifyContent: 'space-between',
  gap: 14,
  flexWrap: 'wrap',
  marginTop: 18,
  padding: 16,
  borderRadius: 18,
  border: '1px solid color-mix(in srgb, var(--brand-green) 24%, var(--shell-panel-border) 76%)',
  background: 'color-mix(in srgb, var(--brand-green) 8%, var(--shell-chip-bg) 92%)',
} as const

const handoffTitleStyle = {
  margin: '5px 0 0',
  color: 'var(--foreground-strong)',
  fontSize: 20,
  lineHeight: 1.12,
  fontWeight: 950,
} as const

const handoffTextStyle = {
  margin: '7px 0 0',
  maxWidth: 680,
  color: 'var(--shell-copy-muted)',
  fontSize: 13,
  lineHeight: 1.5,
  fontWeight: 750,
} as const

const handoffActionStyle = {
  display: 'flex',
  alignItems: 'center',
  gap: 8,
  flexWrap: 'wrap',
} as const

const accessResultWrapStyle = {
  display: 'grid',
  gap: 8,
  minWidth: 180,
} as const

const auditReasonWrapStyle = {
  display: 'grid',
  gap: 6,
  minWidth: 260,
} as const

const auditReasonStyle = {
  color: 'var(--foreground)',
  fontSize: 12,
  lineHeight: 1.35,
  fontWeight: 750,
} as const

const auditWarningStyle = {
  ...auditReasonStyle,
  color: '#fde68a',
} as const

const toggleWrap = {
  display: 'inline-flex',
  gap: 8,
  alignItems: 'center',
  color: '#e2e8f0',
  fontWeight: 700,
} as const

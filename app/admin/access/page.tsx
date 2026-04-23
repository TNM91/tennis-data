'use client'

import { useDeferredValue, useEffect, useMemo, useState, type ReactNode } from 'react'
import AdminGate from '@/app/components/admin-gate'
import SiteShell from '@/app/components/site-shell'
import {
  CAPTAIN_SUBSCRIPTION_PRICE_LABEL,
  TIQ_SEASON_FEE_PRICE_LABEL,
  type CaptainSubscriptionStatus,
} from '@/lib/access-model'
import { supabase } from '@/lib/supabase'

type ProfileAccessRow = {
  id: string
  role: string | null
  captain_subscription_active: boolean | null
  captain_subscription_status: CaptainSubscriptionStatus | null
  tiq_team_league_entry_enabled: boolean | null
  tiq_individual_league_creator_enabled: boolean | null
}

type EditableProfileAccess = {
  captain_subscription_active: boolean
  captain_subscription_status: CaptainSubscriptionStatus
  tiq_team_league_entry_enabled: boolean
  tiq_individual_league_creator_enabled: boolean
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

export default function AdminAccessPage() {
  const [profiles, setProfiles] = useState<ProfileAccessRow[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [savingId, setSavingId] = useState<string | null>(null)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const [search, setSearch] = useState('')
  const [roleFilter, setRoleFilter] = useState<'all' | 'admin' | 'captain' | 'member' | 'public'>(
    'all',
  )
  const [editedProfiles, setEditedProfiles] = useState<Record<string, EditableProfileAccess>>({})

  const deferredSearch = useDeferredValue(search)

  useEffect(() => {
    void loadProfiles()
  }, [])

  async function loadProfiles(showRefreshing = false) {
    if (showRefreshing) {
      setRefreshing(true)
    } else {
      setLoading(true)
    }

    setError('')

    try {
      const { data, error: loadError } = await supabase
        .from('profiles')
        .select(
          'id, role, captain_subscription_active, captain_subscription_status, tiq_team_league_entry_enabled, tiq_individual_league_creator_enabled',
        )
        .limit(500)

      if (loadError) throw new Error(loadError.message)

      const rows = ((data || []) as ProfileAccessRow[]).sort((a, b) =>
        compactUserId(a.id).localeCompare(compactUserId(b.id)),
      )

      setProfiles(rows)
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
  }

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

  async function saveProfile(profile: ProfileAccessRow) {
    const draft = editedProfiles[profile.id]
    if (!draft) return

    setSavingId(profile.id)
    setMessage('')
    setError('')

    try {
      const payload = {
        captain_subscription_active: draft.captain_subscription_active,
        captain_subscription_status: draft.captain_subscription_status,
        tiq_team_league_entry_enabled: draft.tiq_team_league_entry_enabled,
        tiq_individual_league_creator_enabled: draft.tiq_individual_league_creator_enabled,
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
  const teamEntryCount = profiles.filter((profile) =>
    Boolean(profile.tiq_team_league_entry_enabled),
  ).length
  const individualCreatorCount = profiles.filter((profile) =>
    Boolean(profile.tiq_individual_league_creator_enabled),
  ).length

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
              <h1 className="page-title">Captain and TIQ league entitlements</h1>
              <p className="page-subtitle" style={{ maxWidth: 860 }}>
                Control who has the {CAPTAIN_SUBSCRIPTION_PRICE_LABEL} captain workflow, who can
                enter TIQ team leagues at {TIQ_SEASON_FEE_PRICE_LABEL}, and who can create TIQ
                individual leagues without forcing every player into a paid seat.
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
                <span className="badge badge-blue">TIQ team entry seam</span>
                <span className="badge badge-slate">Individual creator access</span>
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
              <MetricCard label="Captain Active" value={activeCaptainCount} />
              <MetricCard label="Team Entry Enabled" value={teamEntryCount} />
              <MetricCard label="Individual Creator Enabled" value={individualCreatorCount} />
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
              This page is the monetization control seam for TenAceIQ. Captain workflow access and
              TIQ league permissions now live in profile-level fields instead of being implied only
              by role names.
            </p>

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
                <table className="data-table" style={{ minWidth: 1240 }}>
                  <thead>
                    <tr>
                      <th>User</th>
                      <th>Role</th>
                      <th>Captain Active</th>
                      <th>Captain Status</th>
                      <th>TIQ Team Entry</th>
                      <th>Individual Creator</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredProfiles.map((profile) => {
                      const draft = editedProfiles[profile.id] || normalizeEditable(profile)
                      const dirty = isDirty(profile)

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

const toggleWrap = {
  display: 'inline-flex',
  gap: 8,
  alignItems: 'center',
  color: '#e2e8f0',
  fontWeight: 700,
} as const

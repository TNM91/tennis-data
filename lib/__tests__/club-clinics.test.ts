import { describe, expect, it } from 'vitest'
import {
  buildClinicSessionRows,
  canManageClinic,
  normalizeClinicAttendanceStatus,
  normalizeClinicCapacity,
  normalizeClinicDuration,
  normalizeClinicExternalUrl,
  normalizeClinicRosterStatus,
} from '../club-clinics'

describe('club clinic hub', () => {
  it('builds a bounded weekly clinic schedule', () => {
    const rows = buildClinicSessionRows({
      startsAt: '2026-09-01T18:00:00-05:00',
      durationMinutes: 90,
      weeks: 3,
      title: 'Tuesday adult clinic',
      locationLabel: 'Vetta Sunset',
      courtLabel: 'Courts 3-5',
    })

    expect(rows).toHaveLength(3)
    expect(new Date(rows[1].starts_at).getTime() - new Date(rows[0].starts_at).getTime()).toBe(7 * 24 * 60 * 60 * 1000)
    expect(new Date(rows[0].ends_at).getTime() - new Date(rows[0].starts_at).getTime()).toBe(90 * 60 * 1000)
    expect(rows[0]).toMatchObject({ title: 'Tuesday adult clinic', location_label: 'Vetta Sunset', court_label: 'Courts 3-5' })
  })

  it('keeps clinic capacity, duration, roster, and attendance values safe', () => {
    expect(normalizeClinicCapacity(900)).toBe(500)
    expect(normalizeClinicCapacity(-10)).toBe(0)
    expect(normalizeClinicDuration(5)).toBe(15)
    expect(normalizeClinicDuration('bad')).toBe(90)
    expect(normalizeClinicRosterStatus('waitlist')).toBe('waitlist')
    expect(normalizeClinicRosterStatus('unknown')).toBe('active')
    expect(normalizeClinicAttendanceStatus('late')).toBe('late')
    expect(normalizeClinicAttendanceStatus('unknown')).toBe('expected')
    expect(normalizeClinicExternalUrl('https://club.example/register')).toBe('https://club.example/register')
    expect(normalizeClinicExternalUrl('javascript:alert(1)')).toBe('')
  })

  it('lets club managers and the assigned coach manage a clinic', () => {
    expect(canManageClinic(['director'], 'coach-1', 'director-1')).toBe(true)
    expect(canManageClinic(['coach'], 'coach-1', 'coach-1')).toBe(true)
    expect(canManageClinic(['coach'], 'coach-1', 'coach-2')).toBe(false)
    expect(canManageClinic(['player'], 'coach-1', 'player-1')).toBe(false)
  })
})

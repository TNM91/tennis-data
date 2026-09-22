'use client'

import { supabase } from './supabase'
import type { ClubAffiliation, ClubMemberRole, ClubMembershipStatus } from './club-membership'

export type ClubProfile = {
  id: string
  name: string
  slug: string
  logoUrl: string
  primaryColor: string
  secondaryColor: string
  websiteUrl: string
  status: 'active' | 'paused' | 'archived'
}

export type ClubLocation = {
  id: string
  clubId: string
  name: string
  city: string
  stateRegion: string
  isPrimary: boolean
}

export type ClubMembership = {
  id: string
  clubId: string
  userId: string
  role: ClubMemberRole
  status: ClubMembershipStatus
  locationId: string
  linkedPlayerId: string
  acceptedAt: string
}

export type ClubExperience = {
  club: ClubProfile
  locations: ClubLocation[]
  memberships: ClubMembership[]
}

type ClubRow = {
  id: string
  owner_user_id: string
  name: string | null
  slug: string | null
  description: string | null
  logo_url: string | null
  hero_image_url: string | null
  primary_color: string | null
  location_label: string | null
  contact_email: string | null
  time_zone: string | null
  is_public: boolean | null
}

type ClubMembershipRow = {
  id: string
  club_id: string
  user_id: string | null
  roles: string[] | null
  status: string
  joined_at: string | null
}

function cleanText(value: string | null | undefined) {
  return (value || '').trim()
}

function normalizeRole(value: string): ClubMemberRole {
  if (value === 'owner' || value === 'admin' || value === 'director' || value === 'coach' || value === 'captain' || value === 'coordinator' || value === 'guardian') return value
  return 'player'
}

function normalizeStatus(value: string): ClubMembershipStatus {
  if (value === 'inactive' || value === 'removed') return value
  return 'active'
}

function primaryRole(roles: string[] | null | undefined) {
  const priority = ['owner', 'admin', 'director', 'coach', 'captain', 'coordinator', 'player', 'guardian']
  return normalizeRole(priority.find((role) => roles?.includes(role)) || 'player')
}

function mapClub(row: ClubRow): ClubProfile {
  return {
    id: row.id,
    name: cleanText(row.name),
    slug: cleanText(row.slug),
    logoUrl: cleanText(row.logo_url),
    primaryColor: cleanText(row.primary_color) || '#e31837',
    secondaryColor: '#071426',
    websiteUrl: '',
    status: row.is_public === false ? 'paused' : 'active',
  }
}

export async function getClubExperienceBySlug(slug: string): Promise<ClubExperience | null> {
  const normalizedSlug = cleanText(slug).toLowerCase()
  if (!normalizedSlug) return null

  const { data: clubData, error: clubError } = await supabase
    .from('clubs')
    .select('id,owner_user_id,name,slug,description,logo_url,hero_image_url,primary_color,location_label,contact_email,time_zone,is_public')
    .eq('slug', normalizedSlug)
    .maybeSingle()

  if (clubError || !clubData) return null
  const club = mapClub(clubData as ClubRow)

  const membershipsResult = await supabase
      .from('club_memberships')
      .select('id,club_id,user_id,roles,status,joined_at')
      .eq('club_id', club.id)

  const locationLabel = cleanText((clubData as ClubRow).location_label)
  const locations: ClubLocation[] = locationLabel ? [{
    id: club.id,
    clubId: club.id,
    name: locationLabel,
    city: '',
    stateRegion: '',
    isPrimary: true,
  }] : []

  const memberships = ((membershipsResult.data || []) as ClubMembershipRow[]).map((row) => ({
    id: row.id,
    clubId: row.club_id,
    userId: cleanText(row.user_id),
    role: primaryRole(row.roles),
    status: normalizeStatus(row.status),
    locationId: club.id,
    linkedPlayerId: '',
    acceptedAt: cleanText(row.joined_at),
  }))

  return { club, locations, memberships }
}

export async function createSubscriberClub(input: {
  name: string
  slug: string
  logoUrl?: string
  primaryColor?: string
  secondaryColor?: string
  websiteUrl?: string
}) {
  const { data: authData } = await supabase.auth.getUser()
  if (!authData.user) throw new Error('Sign in to create a Club workspace.')
  const { data, error } = await supabase.from('clubs').insert({
    owner_user_id: authData.user.id,
    name: cleanText(input.name),
    slug: cleanText(input.slug),
    logo_url: cleanText(input.logoUrl),
    primary_color: cleanText(input.primaryColor) || '#9dea16',
    is_public: true,
  }).select('id,owner_user_id,name,slug,description,logo_url,hero_image_url,primary_color,location_label,contact_email,time_zone,is_public').single()
  if (error) throw new Error(error.message)
  return data as ClubRow
}

export async function acceptClubInvitation(inviteToken: string) {
  const { data, error } = await supabase.rpc('accept_club_invite', {
    target_invite_token: inviteToken,
  })
  if (error) throw new Error(error.message)
  return data
}

export function toClubAffiliation(
  experience: ClubExperience,
  membership: ClubMembership,
): ClubAffiliation {
  const location = experience.locations.find((item) => item.id === membership.locationId)
  return {
    clubId: experience.club.id,
    clubName: experience.club.name,
    clubSlug: experience.club.slug,
    role: membership.role,
    status: membership.status,
    locationId: membership.locationId,
    locationName: location?.name || '',
    linkedPlayerId: membership.linkedPlayerId,
  }
}

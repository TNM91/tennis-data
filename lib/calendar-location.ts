// Exact, source-verified venue aliases only. Never fuzzy-match an unfamiliar
// club or replace a location that already includes an address/court instructions.
// Keep source URLs and verification dates alongside additions for rechecking.
export const calendarVenues = [
  {
    aliases: ['Vetta West', 'Vetta West Racquet Sports'],
    address: '1330 Harvestowne Industrial Dr, St. Peters, MO 63304',
    source: 'https://vettasports.com/locations/',
    verifiedOn: '2026-09-07',
  },
  {
    aliases: ['Vetta Sports Club - Concord', 'Vetta Concord', 'Vetta Concord Racquet Sports'],
    address: '12320 Old Tesson Rd, St. Louis, MO 63128',
    source: 'https://vettasports.com/location/concord-racquet-sports/',
    verifiedOn: '2026-09-07',
  },
  {
    aliases: ['Sunset Tennis Center', 'Vetta Sunset'],
    address: '10911 Gravois Industrial Ct, St. Louis, MO 63128',
    source: 'https://vettasports.com/location/sunset-hills-tennis/',
    verifiedOn: '2026-09-07',
  },
  {
    aliases: ['Woodsmill Tennis Club'],
    address: '910 Old Woods Mill Rd, Chesterfield, MO 63017',
    source: 'https://woodsmilltc.com/',
    verifiedOn: '2026-09-07',
  },
  {
    aliases: ['St. Clair Tennis Club', 'St Clair Tennis'],
    address: "733 Hartman Ln, O'Fallon, IL 62269",
    source: 'https://stclairtennis.com/',
    verifiedOn: '2026-09-07',
  },
  {
    aliases: ['Forest Lake Tennis Club'],
    // The club's contact page prints an inconsistent ZIP. Omit it rather than
    // propagate it; the street, city and state identify the playing location.
    address: '1012 N. Woods Mill Rd, Chesterfield, MO',
    source: 'https://forestlaketennisclub.com/contact/',
    verifiedOn: '2026-09-07',
  },
  {
    aliases: ['Missouri Athletic Club - West', 'Missouri Athletic Club West'],
    address: '1777 Des Peres Rd, Town & Country, MO 63131',
    source: 'https://www.mac-stl.org/about/contact-us',
    verifiedOn: '2026-09-07',
  },
] as const

function aliasKey(value: string) {
  return value.trim().replace(/\s+/g, ' ').replace(/[–—]/g, '-').toLowerCase()
}

export function resolveCalendarLocation(value: string | null | undefined): string {
  const location = (value || '').trim()
  const key = aliasKey(location)
  if (!key) return ''
  const venue = calendarVenues.find((entry) => entry.aliases.some((alias) => aliasKey(alias) === key))
  return venue ? `${location} — ${venue.address}` : location
}

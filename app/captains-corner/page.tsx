'use client'

import Link from 'next/link'

export const dynamic = 'force-dynamic'

export default function CaptainsCornerPage() {
  return (
    <main style={mainStyle}>
      <div style={navRowStyle}>
        <Link href="/" style={navLinkStyle}>Home</Link>
        <Link href="/rankings" style={navLinkStyle}>Rankings</Link>
        <Link href="/matchup" style={navLinkStyle}>Matchup</Link>
        <Link href="/leagues" style={navLinkStyle}>Leagues</Link>
        <Link href="/captains-corner" style={navLinkStyle}>Captain&apos;s Corner</Link>
        <Link href="/admin" style={navLinkStyle}>Admin</Link>
      </div>

      <div style={heroCardStyle}>
        <h1 style={{ margin: 0, fontSize: '36px' }}>Captain&apos;s Corner</h1>
        <p style={{ margin: '12px 0 0 0', color: '#dbeafe', fontSize: '17px', maxWidth: '760px' }}>
          Tools for captains to manage player availability, explore projected lineups,
          and make stronger team decisions.
        </p>
      </div>

      <div style={cardGridStyle}>
        <Link href="/admin/lineup-availability" style={toolCardStyle}>
          <div style={toolTitleStyle}>Lineup Availability</div>
          <div style={toolTextStyle}>
            Set who is available, unavailable, singles-only, doubles-only, or limited for a given match date.
          </div>
        </Link>

        <Link href="/lineup-projection" style={toolCardStyle}>
          <div style={toolTitleStyle}>Lineup Projection</div>
          <div style={toolTextStyle}>
            Generate suggested singles and doubles lineups using roster usage and dynamic ratings.
          </div>
        </Link>
      </div>
    </main>
  )
}

const mainStyle = {
  padding: '24px',
  fontFamily: 'Arial, sans-serif',
  maxWidth: '1250px',
  margin: '0 auto',
  background: '#f8fafc',
  minHeight: '100vh',
}

const navRowStyle = {
  display: 'flex',
  gap: '12px',
  marginBottom: '24px',
  flexWrap: 'wrap' as const,
}

const navLinkStyle = {
  padding: '10px 14px',
  border: '1px solid #dbeafe',
  borderRadius: '999px',
  textDecoration: 'none',
  color: '#1e3a8a',
  background: '#eff6ff',
  fontWeight: 600,
}

const heroCardStyle = {
  background: 'linear-gradient(135deg, #1d4ed8, #2563eb)',
  color: 'white',
  borderRadius: '20px',
  padding: '28px',
  boxShadow: '0 14px 30px rgba(37, 99, 235, 0.20)',
  marginBottom: '22px',
}

const cardGridStyle = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
  gap: '16px',
}

const toolCardStyle = {
  display: 'block',
  background: '#ffffff',
  border: '1px solid #e2e8f0',
  borderRadius: '20px',
  padding: '22px',
  boxShadow: '0 10px 24px rgba(15, 23, 42, 0.08)',
  textDecoration: 'none',
}

const toolTitleStyle = {
  color: '#0f172a',
  fontSize: '24px',
  fontWeight: 800,
  marginBottom: '10px',
}

const toolTextStyle = {
  color: '#475569',
  fontSize: '15px',
  lineHeight: 1.6,
}
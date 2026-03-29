'use client'

import Link from 'next/link'

export default function HomePage() {
  return (
    <main style={pageStyle}>
      <header style={headerStyle}>
        <div style={headerInner}>
          <div style={brandWrap}>
            <img src="/logo-icon.png" style={brandIcon} alt="TenAceIQ icon" />
            <div style={brandTextWrap}>
              <span style={brandTextWhite}>TenAce</span>
              <span style={brandTextIQ}>IQ</span>
            </div>
          </div>

          <nav style={navStyle}>
            <Link href="/rankings" style={navLink}>Players</Link>
            <Link href="/matchup" style={navLink}>Matchups</Link>
            <Link href="/teams" style={navLink}>Teams</Link>
            <Link href="/captain" style={navLink}>Captain</Link>
            <Link href="/admin" style={navLink}>Admin</Link>
          </nav>
        </div>
      </header>

      <section style={heroSection}>
        <div style={heroContent}>
          <div style={heroLeft}>
            <div style={heroLeftInner}>
              <div style={badge}>TenAceIQ Platform</div>

              <h1 style={heroTitle}>
                Play Smarter.
                <br />
                Win More.
              </h1>

              <p style={heroText}>
                Ratings, matchups, and league tools designed to give players a competitive edge.
              </p>

              <div style={heroButtons}>
                <Link href="/rankings" style={btnPrimary}>Explore Players</Link>
                <Link href="/matchup" style={btnAccent}>Compare Matchups</Link>
              </div>
            </div>
          </div>

          <div style={heroRight}>
            <div style={logoCard}>
              <img src="/logo-dark.png" style={heroLogo} alt="TenAceIQ logo" />
            </div>
          </div>
        </div>
      </section>

      <section style={gridSection}>
        <Link href="/rankings" style={card}>
          <div style={cardTitle}>Players</div>
          <div style={cardText}>Search and view player ratings</div>
        </Link>

        <Link href="/matchup" style={card}>
          <div style={cardTitle}>Matchups</div>
          <div style={cardText}>Head-to-head comparisons</div>
        </Link>

        <Link href="/teams" style={card}>
          <div style={cardTitle}>Teams & Leagues</div>
          <div style={cardText}>Standings and insights</div>
        </Link>

        <Link href="/captain" style={card}>
          <div style={cardTitle}>Captain’s Corner</div>
          <div style={cardText}>Lineups and strategy tools</div>
        </Link>
      </section>

      <section style={adSection}>
        <div style={adBox}>Ad Space</div>
      </section>

      <footer style={footerStyle}>
        <div style={footerInner}>
          <div style={footerBrandRow}>
            <img src="/logo-icon.png" style={footerBrandIcon} alt="TenAceIQ icon" />
            <div style={footerBrandTextWrap}>
              <span style={footerBrandTextWhite}>TenAce</span>
              <span style={footerBrandTextIQ}>IQ</span>
            </div>
          </div>

          <div style={footerTagline}>
            Play Smarter. Win More.
          </div>

          <div style={footerLinks}>
            <Link href="/rankings" style={footerLink}>Players</Link>
            <Link href="/matchup" style={footerLink}>Matchups</Link>
            <Link href="/teams" style={footerLink}>Teams</Link>
            <Link href="/captain" style={footerLink}>Captain</Link>
          </div>

          <div style={footerBottom}>
            © {new Date().getFullYear()} TenAceIQ
          </div>
        </div>
      </footer>
    </main>
  )
}

/* ================= STYLES ================= */

const pageStyle: React.CSSProperties = {
  minHeight: '100vh',
  background: '#F7F9FC',
  fontFamily: 'Arial, sans-serif',
}

/* HEADER */
const headerStyle: React.CSSProperties = {
  background: 'linear-gradient(90deg, #071B4D, #0E63C7)',
  boxShadow: '0 4px 20px rgba(0,0,0,0.15)',
}

const headerInner: React.CSSProperties = {
  maxWidth: '1200px',
  margin: '0 auto',
  padding: '18px 20px',
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  gap: '20px',
  flexWrap: 'wrap',
}

const brandWrap: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: '10px',
}

const brandIcon: React.CSSProperties = {
  height: '38px',
  width: '38px',
  borderRadius: '10px',
}

const brandTextWrap: React.CSSProperties = {
  display: 'flex',
  alignItems: 'baseline',
  fontSize: '32px',
  fontWeight: 900,
  lineHeight: 1,
}

const brandTextWhite: React.CSSProperties = {
  color: '#FFFFFF',
}

const brandTextIQ: React.CSSProperties = {
  background: 'linear-gradient(90deg, #4CC7C7, #9BE11D)',
  WebkitBackgroundClip: 'text',
  WebkitTextFillColor: 'transparent',
}

const navStyle: React.CSSProperties = {
  display: 'flex',
  gap: '22px',
  flexWrap: 'wrap',
}

const navLink: React.CSSProperties = {
  color: '#E0F2FE',
  textDecoration: 'none',
  fontWeight: 700,
}

/* HERO */
const heroSection: React.CSSProperties = {
  maxWidth: '1200px',
  margin: '0 auto',
  padding: '40px 20px',
}

const heroContent: React.CSSProperties = {
  display: 'grid',
  gridTemplateColumns: '1fr 1fr',
  gap: '30px',
  alignItems: 'center',
}

const heroLeft: React.CSSProperties = {
  background: 'linear-gradient(135deg, #071B4D, #0E63C7)',
  borderRadius: '24px',
  padding: '28px',
  color: 'white',
  display: 'flex',
  boxShadow: '0 18px 50px rgba(7, 27, 77, 0.16)',
}

const heroLeftInner: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  justifyContent: 'center',
  gap: '10px',
}

const heroRight: React.CSSProperties = {
  display: 'flex',
  justifyContent: 'center',
  alignItems: 'center',
}

const logoCard: React.CSSProperties = {
  background: '#ffffff',
  borderRadius: '24px',
  padding: '18px',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  width: '80%',
  maxWidth: '360px',
  boxShadow: '0 10px 25px rgba(0,0,0,0.08)',
  border: '1px solid #E2E8F0',
}

const heroLogo: React.CSSProperties = {
  maxWidth: '280px',
  width: '100%',
  borderRadius: '16px',
}

/* TEXT */
const badge: React.CSSProperties = {
  background: 'rgba(255,255,255,0.15)',
  padding: '6px 12px',
  borderRadius: '999px',
  marginBottom: '12px',
  display: 'inline-block',
  alignSelf: 'flex-start',
  fontWeight: 700,
  fontSize: '13px',
}

const heroTitle: React.CSSProperties = {
  fontSize: '42px',
  fontWeight: 900,
  lineHeight: 1.05,
  margin: 0,
}

const heroText: React.CSSProperties = {
  marginTop: '12px',
  color: '#dbeafe',
  fontSize: '16px',
  lineHeight: 1.6,
  maxWidth: '540px',
}

const heroButtons: React.CSSProperties = {
  marginTop: '24px',
  display: 'flex',
  gap: '12px',
  flexWrap: 'wrap',
}

const btnPrimary: React.CSSProperties = {
  background: '#ffffff',
  color: '#0E63C7',
  padding: '12px 18px',
  borderRadius: '12px',
  fontWeight: 800,
  textDecoration: 'none',
}

const btnAccent: React.CSSProperties = {
  background: '#9BE11D',
  color: '#071B4D',
  padding: '12px 18px',
  borderRadius: '12px',
  fontWeight: 800,
  textDecoration: 'none',
}

/* GRID */
const gridSection: React.CSSProperties = {
  maxWidth: '1200px',
  margin: '0 auto',
  padding: '20px',
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
  gap: '20px',
}

const card: React.CSSProperties = {
  background: '#ffffff',
  border: '1px solid #E2E8F0',
  padding: '24px',
  borderRadius: '20px',
  textDecoration: 'none',
  color: '#071B4D',
  boxShadow: '0 8px 24px rgba(15, 23, 42, 0.05)',
}

const cardTitle: React.CSSProperties = {
  fontSize: '20px',
  fontWeight: 800,
}

const cardText: React.CSSProperties = {
  color: '#4CC7C7',
  marginTop: '6px',
}

/* ADS */
const adSection: React.CSSProperties = {
  maxWidth: '900px',
  margin: '40px auto',
  padding: '0 20px',
}

const adBox: React.CSSProperties = {
  background: '#ffffff',
  border: '1px dashed #CBD5E1',
  padding: '40px',
  textAlign: 'center',
  borderRadius: '12px',
  color: '#64748B',
}

/* FOOTER */
const footerStyle: React.CSSProperties = {
  marginTop: '60px',
  background: '#071B4D',
}

const footerInner: React.CSSProperties = {
  maxWidth: '1200px',
  margin: '0 auto',
  padding: '40px 20px',
  textAlign: 'center',
}

const footerBrandRow: React.CSSProperties = {
  display: 'flex',
  justifyContent: 'center',
  alignItems: 'center',
  gap: '10px',
}

const footerBrandIcon: React.CSSProperties = {
  height: '34px',
  width: '34px',
  borderRadius: '8px',
}

const footerBrandTextWrap: React.CSSProperties = {
  display: 'flex',
  alignItems: 'baseline',
  fontSize: '28px',
  fontWeight: 900,
  lineHeight: 1,
}

const footerBrandTextWhite: React.CSSProperties = {
  color: '#FFFFFF',
}

const footerBrandTextIQ: React.CSSProperties = {
  background: 'linear-gradient(90deg, #4CC7C7, #9BE11D)',
  WebkitBackgroundClip: 'text',
  WebkitTextFillColor: 'transparent',
}

const footerTagline: React.CSSProperties = {
  color: '#4CC7C7',
  marginTop: '10px',
}

const footerLinks: React.CSSProperties = {
  display: 'flex',
  justifyContent: 'center',
  gap: '18px',
  marginTop: '20px',
  flexWrap: 'wrap',
}

const footerLink: React.CSSProperties = {
  color: '#CBD5F5',
  textDecoration: 'none',
}

const footerBottom: React.CSSProperties = {
  marginTop: '20px',
  color: '#64748B',
}
'use client'

import Link from 'next/link'

export default function CaptainsCornerPage() {
  const tools = [
    {
      title: 'Availability Tracker',
      description:
        'Track who is available for upcoming matches so lineup decisions start with the right player pool.',
      href: '/captains-corner/lineup-availability',
      cta: 'Open Availability',
    },
    {
      title: 'Lineup Builder',
      description:
        'Build and test lineup combinations, enter opponent assumptions, and prepare your best match-day options.',
      href: '/captains-corner/lineup-builder',
      cta: 'Open Lineup Builder',
    },
    {
      title: 'Scenario Comparison',
      description:
        'Compare saved lineup scenarios side by side to quickly spot lineup changes, opponent changes, and note differences.',
      href: '/captains-corner/scenario-comparison',
      cta: 'Open Scenario Comparison',
    },
  ]

  return (
    <main style={mainStyle}>
      <div style={navRowStyle}>
        <Link href="/" style={navLinkStyle}>
          Home
        </Link>
        <Link href="/rankings" style={navLinkStyle}>
          Rankings
        </Link>
        <Link href="/leagues" style={navLinkStyle}>
          Leagues
        </Link>
        <Link href="/captains-corner" style={navLinkStyle}>
          Captain&apos;s Corner
        </Link>
        <Link href="/admin" style={navLinkStyle}>
          Admin
        </Link>
      </div>

      <section style={heroCardStyle}>
        <div style={heroBadgeStyle}>TenAceIQ Captain Tools</div>

        <h1 style={titleStyle}>Captain&apos;s Corner</h1>

        <p style={subtitleStyle}>
          A lineup command center built for captains. Track player availability,
          build smarter match-day lineups, compare saved scenarios, and prepare
          with more confidence.
        </p>

        <div style={heroActionsStyle}>
          <Link href="/captains-corner/lineup-builder" style={primaryButtonStyle}>
            Go to Lineup Builder
          </Link>
          <Link
            href="/captains-corner/scenario-comparison"
            style={secondaryButtonStyle}
          >
            Compare Scenarios
          </Link>
        </div>
      </section>

      <section style={sectionStyle}>
        <div style={sectionHeaderRowStyle}>
          <div>
            <h2 style={sectionTitleStyle}>Captain Toolkit</h2>
            <p style={sectionSubtitleStyle}>
              Start with availability, build your lineup, then compare saved
              versions before match day.
            </p>
          </div>
        </div>

        <div style={toolsGridStyle}>
          {tools.map((tool) => (
            <div key={tool.href} style={toolCardStyle}>
              <div style={cardAccentStyle} />
              <h3 style={cardTitleStyle}>{tool.title}</h3>
              <p style={cardDescriptionStyle}>{tool.description}</p>
              <Link href={tool.href} style={cardButtonStyle}>
                {tool.cta}
              </Link>
            </div>
          ))}
        </div>
      </section>

      <section style={sectionStyle}>
        <div style={infoGridStyle}>
          <div style={infoCardStyle}>
            <h3 style={infoTitleStyle}>Recommended Workflow</h3>
            <div style={stepsWrapStyle}>
              <div style={stepItemStyle}>
                <div style={stepNumberStyle}>1</div>
                <div>
                  <div style={stepTitleStyle}>Collect Availability</div>
                  <div style={stepTextStyle}>
                    See who is in, out, or uncertain before building anything.
                  </div>
                </div>
              </div>

              <div style={stepItemStyle}>
                <div style={stepNumberStyle}>2</div>
                <div>
                  <div style={stepTitleStyle}>Build Scenarios</div>
                  <div style={stepTextStyle}>
                    Create strongest, safest, or contingency lineup options.
                  </div>
                </div>
              </div>

              <div style={stepItemStyle}>
                <div style={stepNumberStyle}>3</div>
                <div>
                  <div style={stepTitleStyle}>Compare Side by Side</div>
                  <div style={stepTextStyle}>
                    Review changes across your lineup and the expected opponent
                    lineup before finalizing.
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div style={infoCardStyle}>
            <h3 style={infoTitleStyle}>What&apos;s Next</h3>
            <ul style={featureListStyle}>
              <li style={featureListItemStyle}>Saved lineup version history</li>
              <li style={featureListItemStyle}>
                Availability-aware lineup filtering
              </li>
              <li style={featureListItemStyle}>
                Opponent lineup comparison improvements
              </li>
              <li style={featureListItemStyle}>
                Smarter captain suggestions and guidance
              </li>
              <li style={featureListItemStyle}>
                Future projected win probability workflows
              </li>
            </ul>
          </div>
        </div>
      </section>
    </main>
  )
}

const mainStyle: React.CSSProperties = {
  minHeight: '100vh',
  background:
    'linear-gradient(180deg, #0f1632 0%, #162044 34%, #f6f8fc 34%, #f6f8fc 100%)',
  padding: '24px',
}

const navRowStyle: React.CSSProperties = {
  display: 'flex',
  gap: '12px',
  flexWrap: 'wrap',
  marginBottom: '20px',
}

const navLinkStyle: React.CSSProperties = {
  color: '#ffffff',
  textDecoration: 'none',
  fontWeight: 600,
  padding: '10px 14px',
  borderRadius: '10px',
  background: 'rgba(255,255,255,0.10)',
  border: '1px solid rgba(255,255,255,0.14)',
}

const heroCardStyle: React.CSSProperties = {
  background: '#ffffff',
  borderRadius: '22px',
  padding: '28px',
  boxShadow: '0 12px 30px rgba(15, 22, 50, 0.10)',
  marginBottom: '20px',
}

const heroBadgeStyle: React.CSSProperties = {
  display: 'inline-block',
  padding: '6px 12px',
  borderRadius: '999px',
  background: '#eef4ff',
  color: '#255BE3',
  fontWeight: 700,
  fontSize: '0.8rem',
  marginBottom: '14px',
}

const titleStyle: React.CSSProperties = {
  margin: 0,
  fontSize: '2.2rem',
  lineHeight: 1.05,
  color: '#0f1632',
}

const subtitleStyle: React.CSSProperties = {
  marginTop: '12px',
  marginBottom: 0,
  maxWidth: '820px',
  color: '#5c6784',
  fontSize: '1rem',
  lineHeight: 1.6,
}

const heroActionsStyle: React.CSSProperties = {
  display: 'flex',
  gap: '12px',
  flexWrap: 'wrap',
  marginTop: '22px',
}

const primaryButtonStyle: React.CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  padding: '12px 16px',
  borderRadius: '12px',
  background: '#255BE3',
  color: '#ffffff',
  textDecoration: 'none',
  fontWeight: 700,
}

const secondaryButtonStyle: React.CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  padding: '12px 16px',
  borderRadius: '12px',
  background: '#f7f9ff',
  color: '#0f1632',
  textDecoration: 'none',
  fontWeight: 700,
  border: '1px solid #d7def0',
}

const sectionStyle: React.CSSProperties = {
  marginBottom: '20px',
}

const sectionHeaderRowStyle: React.CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'flex-end',
  gap: '16px',
  marginBottom: '14px',
  flexWrap: 'wrap',
}

const sectionTitleStyle: React.CSSProperties = {
  margin: 0,
  color: '#0f1632',
  fontSize: '1.35rem',
}

const sectionSubtitleStyle: React.CSSProperties = {
  margin: '8px 0 0 0',
  color: '#5c6784',
  lineHeight: 1.5,
}

const toolsGridStyle: React.CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))',
  gap: '18px',
}

const toolCardStyle: React.CSSProperties = {
  position: 'relative',
  background: '#ffffff',
  borderRadius: '20px',
  padding: '22px',
  boxShadow: '0 10px 26px rgba(15, 22, 50, 0.08)',
  border: '1px solid #ebeff8',
  overflow: 'hidden',
}

const cardAccentStyle: React.CSSProperties = {
  position: 'absolute',
  top: 0,
  left: 0,
  width: '100%',
  height: '5px',
  background: 'linear-gradient(90deg, #255BE3 0%, #FF3C28 100%)',
}

const cardTitleStyle: React.CSSProperties = {
  margin: '8px 0 10px 0',
  color: '#0f1632',
  fontSize: '1.1rem',
}

const cardDescriptionStyle: React.CSSProperties = {
  margin: 0,
  color: '#5c6784',
  lineHeight: 1.6,
  minHeight: '76px',
}

const cardButtonStyle: React.CSSProperties = {
  display: 'inline-flex',
  marginTop: '18px',
  padding: '10px 14px',
  borderRadius: '12px',
  textDecoration: 'none',
  color: '#0f1632',
  background: '#f7f9ff',
  border: '1px solid #d7def0',
  fontWeight: 700,
}

const infoGridStyle: React.CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
  gap: '18px',
}

const infoCardStyle: React.CSSProperties = {
  background: '#ffffff',
  borderRadius: '20px',
  padding: '22px',
  boxShadow: '0 10px 26px rgba(15, 22, 50, 0.08)',
  border: '1px solid #ebeff8',
}

const infoTitleStyle: React.CSSProperties = {
  margin: '0 0 14px 0',
  color: '#0f1632',
  fontSize: '1.08rem',
}

const stepsWrapStyle: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: '14px',
}

const stepItemStyle: React.CSSProperties = {
  display: 'flex',
  gap: '12px',
  alignItems: 'flex-start',
}

const stepNumberStyle: React.CSSProperties = {
  width: '30px',
  height: '30px',
  borderRadius: '999px',
  background: '#255BE3',
  color: '#ffffff',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  fontWeight: 800,
  fontSize: '0.9rem',
  flexShrink: 0,
}

const stepTitleStyle: React.CSSProperties = {
  color: '#0f1632',
  fontWeight: 700,
  marginBottom: '4px',
}

const stepTextStyle: React.CSSProperties = {
  color: '#5c6784',
  lineHeight: 1.5,
}

const featureListStyle: React.CSSProperties = {
  margin: 0,
  paddingLeft: '20px',
  color: '#5c6784',
}

const featureListItemStyle: React.CSSProperties = {
  marginBottom: '10px',
  lineHeight: 1.5,
}
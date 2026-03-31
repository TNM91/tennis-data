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
      badge: 'Availability',
    },
    {
      title: 'Lineup Builder',
      description:
        'Build and test lineup combinations, enter opponent assumptions, and prepare your best match-day options.',
      href: '/captains-corner/lineup-builder',
      cta: 'Open Lineup Builder',
      badge: 'Strategy',
    },
    {
      title: 'Scenario Comparison',
      description:
        'Compare saved lineup scenarios side by side to quickly spot lineup changes, opponent changes, and note differences.',
      href: '/captains-corner/scenario-comparison',
      cta: 'Open Scenario Comparison',
      badge: 'Comparison',
    },
  ]

  const workflow = [
    {
      step: '1',
      title: 'Collect Availability',
      text: 'See who is in, out, or uncertain before building anything.',
    },
    {
      step: '2',
      title: 'Build Scenarios',
      text: 'Create strongest, safest, or contingency lineup options.',
    },
    {
      step: '3',
      title: 'Compare Side by Side',
      text: 'Review lineup and opponent changes before finalizing your match-day decision.',
    },
  ]

  const futureFeatures = [
    'Saved lineup version history',
    'Availability-aware lineup filtering',
    'Opponent lineup comparison improvements',
    'Smarter captain suggestions and guidance',
    'Future projected win probability workflows',
  ]

  return (
    <main className="page-shell">
      <section className="hero-panel">
        <div className="hero-inner">
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'minmax(0, 1.55fr) minmax(280px, 0.95fr)',
              gap: '24px',
              alignItems: 'stretch',
            }}
          >
            <div>
              <div className="badge badge-blue" style={{ marginBottom: 14 }}>
                TenAceIQ Captain Tools
              </div>

              <p className="section-kicker" style={{ marginBottom: 10 }}>
                Premium captain workflow
              </p>

              <h1
                style={{
                  margin: 0,
                  fontSize: 'clamp(2.2rem, 4vw, 3.4rem)',
                  lineHeight: 1.02,
                  letterSpacing: '-0.03em',
                }}
              >
                Captain&apos;s Corner
              </h1>

              <p
                style={{
                  marginTop: 16,
                  marginBottom: 0,
                  maxWidth: 820,
                  color: 'rgba(255,255,255,0.78)',
                  fontSize: '1.02rem',
                  lineHeight: 1.7,
                }}
              >
                A strategic lineup command center for captains. Track player
                availability, build stronger match-day combinations, compare
                saved scenarios, and make final decisions with more clarity and
                confidence.
              </p>

              <div
                style={{
                  display: 'flex',
                  flexWrap: 'wrap',
                  gap: 12,
                  marginTop: 22,
                }}
              >
                <Link
                  href="/captains-corner/lineup-builder"
                  className="button-primary"
                >
                  Go to Lineup Builder
                </Link>

                <Link
                  href="/captains-corner/scenario-comparison"
                  className="button-secondary"
                >
                  Compare Scenarios
                </Link>
              </div>

              <div
                className="metric-grid"
                style={{ marginTop: 22, gridTemplateColumns: 'repeat(3, 1fr)' }}
              >
                <div className="metric-card">
                  <div className="section-kicker">Workflow</div>
                  <div
                    style={{
                      marginTop: 6,
                      fontSize: '1.1rem',
                      fontWeight: 800,
                    }}
                  >
                    Availability → Build → Compare
                  </div>
                </div>

                <div className="metric-card">
                  <div className="section-kicker">Focus</div>
                  <div
                    style={{
                      marginTop: 6,
                      fontSize: '1.1rem',
                      fontWeight: 800,
                    }}
                  >
                    Match-day decision support
                  </div>
                </div>

                <div className="metric-card">
                  <div className="section-kicker">Use Case</div>
                  <div
                    style={{
                      marginTop: 6,
                      fontSize: '1.1rem',
                      fontWeight: 800,
                    }}
                  >
                    Smarter captain prep
                  </div>
                </div>
              </div>
            </div>

            <div className="glass-card panel-pad">
              <div className="section-kicker">Captain quick start</div>
              <h2
                style={{
                  marginTop: 10,
                  marginBottom: 14,
                  fontSize: '1.35rem',
                  lineHeight: 1.15,
                }}
              >
                Build better lineups with a repeatable process
              </h2>

              <div
                style={{
                  display: 'grid',
                  gap: 12,
                }}
              >
                {workflow.map((item) => (
                  <div
                    key={item.step}
                    style={{
                      display: 'flex',
                      gap: 12,
                      alignItems: 'flex-start',
                      padding: '12px 0',
                      borderTop:
                        item.step === '1'
                          ? 'none'
                          : '1px solid rgba(255,255,255,0.1)',
                    }}
                  >
                    <div
                      style={{
                        width: 32,
                        height: 32,
                        borderRadius: 999,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontWeight: 800,
                        fontSize: '.92rem',
                        color: '#0f1632',
                        background:
                          'linear-gradient(135deg, #c7ff5e 0%, #7dffb3 100%)',
                        flexShrink: 0,
                      }}
                    >
                      {item.step}
                    </div>

                    <div>
                      <div
                        style={{
                          fontWeight: 700,
                          color: '#ffffff',
                          marginBottom: 4,
                        }}
                      >
                        {item.title}
                      </div>
                      <div
                        style={{
                          color: 'rgba(255,255,255,0.72)',
                          lineHeight: 1.55,
                          fontSize: '.96rem',
                        }}
                      >
                        {item.text}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="section">
        <div
          className="surface-card-strong panel-pad"
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'end',
            gap: 16,
            flexWrap: 'wrap',
            marginBottom: 18,
          }}
        >
          <div>
            <p className="section-kicker" style={{ marginBottom: 8 }}>
              Captain toolkit
            </p>
            <h2 className="section-title" style={{ marginBottom: 8 }}>
              Strategic tools built for lineup decisions
            </h2>
            <p
              style={{
                margin: 0,
                color: 'var(--muted-foreground, #667085)',
                maxWidth: 820,
                lineHeight: 1.65,
              }}
            >
              Start with availability, move into lineup construction, then
              compare saved options before match day. Each tool is designed to
              make preparation cleaner, faster, and more confident.
            </p>
          </div>
        </div>

        <div className="card-grid">
          {tools.map((tool) => (
            <article
              key={tool.href}
              className="surface-card"
              style={{
                position: 'relative',
                overflow: 'hidden',
              }}
            >
              <div
                style={{
                  height: 4,
                  width: '100%',
                  background:
                    'linear-gradient(90deg, #255BE3 0%, #61a8ff 55%, #c7ff5e 100%)',
                }}
              />

              <div className="panel-pad">
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: 12,
                    marginBottom: 14,
                  }}
                >
                  <span className="badge badge-slate">{tool.badge}</span>
                </div>

                <h3
                  style={{
                    margin: 0,
                    fontSize: '1.2rem',
                    lineHeight: 1.2,
                  }}
                >
                  {tool.title}
                </h3>

                <p
                  style={{
                    marginTop: 12,
                    marginBottom: 0,
                    color: 'var(--muted-foreground, #667085)',
                    lineHeight: 1.7,
                    minHeight: 82,
                  }}
                >
                  {tool.description}
                </p>

                <div
                  style={{
                    display: 'flex',
                    gap: 10,
                    flexWrap: 'wrap',
                    marginTop: 18,
                  }}
                >
                  <Link href={tool.href} className="button-secondary">
                    {tool.cta}
                  </Link>
                </div>
              </div>
            </article>
          ))}
        </div>
      </section>

      <section className="section">
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'minmax(0, 1.2fr) minmax(0, 0.9fr)',
            gap: 18,
          }}
        >
          <div className="surface-card panel-pad">
            <p className="section-kicker" style={{ marginBottom: 8 }}>
              Recommended workflow
            </p>
            <h2 className="section-title" style={{ marginBottom: 16 }}>
              How captains should use this area
            </h2>

            <div
              style={{
                display: 'grid',
                gap: 14,
              }}
            >
              {workflow.map((item) => (
                <div
                  key={item.step}
                  style={{
                    display: 'flex',
                    gap: 14,
                    alignItems: 'flex-start',
                    padding: '14px 0',
                    borderTop:
                      item.step === '1'
                        ? 'none'
                        : '1px solid rgba(15,22,50,0.08)',
                  }}
                >
                  <div
                    style={{
                      width: 34,
                      height: 34,
                      borderRadius: 999,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontWeight: 800,
                      fontSize: '.95rem',
                      color: '#ffffff',
                      background:
                        'linear-gradient(135deg, #255BE3 0%, #3d7cff 100%)',
                      flexShrink: 0,
                      boxShadow: '0 10px 24px rgba(37,91,227,0.22)',
                    }}
                  >
                    {item.step}
                  </div>

                  <div>
                    <div
                      style={{
                        fontWeight: 750,
                        color: '#0f1632',
                        marginBottom: 4,
                      }}
                    >
                      {item.title}
                    </div>
                    <div
                      style={{
                        color: 'var(--muted-foreground, #667085)',
                        lineHeight: 1.65,
                      }}
                    >
                      {item.text}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="surface-card panel-pad">
            <p className="section-kicker" style={{ marginBottom: 8 }}>
              What&apos;s next
            </p>
            <h2 className="section-title" style={{ marginBottom: 16 }}>
              Planned premium workflow upgrades
            </h2>

            <div
              style={{
                display: 'grid',
                gap: 10,
              }}
            >
              {futureFeatures.map((item) => (
                <div
                  key={item}
                  style={{
                    display: 'flex',
                    alignItems: 'flex-start',
                    gap: 10,
                    padding: '10px 12px',
                    borderRadius: 14,
                    background: 'rgba(37,91,227,0.04)',
                    border: '1px solid rgba(37,91,227,0.08)',
                  }}
                >
                  <span className="badge badge-green">Planned</span>
                  <span
                    style={{
                      color: '#0f1632',
                      lineHeight: 1.55,
                      fontWeight: 500,
                    }}
                  >
                    {item}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>
    </main>
  )
}
'use client'

import Link from 'next/link'
import { useParams } from 'next/navigation'
import { useEffect, useState, type CSSProperties } from 'react'
import SiteShell from '@/app/components/site-shell'
import { buildTiqAwardCertificateText, loadTiqAwardById, type TiqAwardRecord } from '@/lib/tiq-awards-registry'

export default function AwardCertificatePage() {
  return (
    <SiteShell active="/league-coordinator">
      <AwardCertificateInner />
    </SiteShell>
  )
}

function AwardCertificateInner() {
  const params = useParams<{ id: string }>()
  const awardId = decodeURIComponent(params?.id || '')
  const [award, setAward] = useState<TiqAwardRecord | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [copyNotice, setCopyNotice] = useState('')

  useEffect(() => {
    let active = true

    async function loadAward() {
      setLoading(true)
      setError('')
      const result = await loadTiqAwardById(awardId)
      if (!active) return
      setAward(result.data)
      setError(result.error?.message || (!result.data ? 'Award certificate is not available.' : ''))
      setLoading(false)
    }

    void loadAward()

    return () => {
      active = false
    }
  }, [awardId])

  const trophyHref = award?.recipientPlayerId
    ? `/players/${encodeURIComponent(award.recipientPlayerId)}#profile-trophy-case`
    : ''
  const emailHref = award ? buildAwardEmailHref(award) : ''
  const awardProofItems = award ? [
    {
      label: 'Issued',
      value: formatIssuedAt(award.issuedAt),
      ready: true,
    },
    {
      label: 'Certificate',
      value: 'Printable',
      ready: true,
    },
    {
      label: 'Trophy case',
      value: award.recipientPlayerId ? 'Linked' : 'Needs profile',
      ready: Boolean(award.recipientPlayerId),
    },
  ] : []

  async function copyCertificateLink() {
    setCopyNotice('')
    const href = typeof window !== 'undefined' ? window.location.href : `/awards/${encodeURIComponent(awardId)}`

    try {
      if (navigator.share && award) {
        await navigator.share({
          title: `${award.recipientName} - ${award.badgeLabel}`,
          text: buildTiqAwardCertificateText(award),
          url: href,
        })
        setCopyNotice('Share sheet opened.')
        return
      }

      await navigator.clipboard.writeText(href)
      setCopyNotice('Certificate link copied.')
    } catch {
      setCopyNotice('Use your browser address bar to copy this certificate link.')
    }
  }

  return (
    <main className="tiq-award-print-page" style={pageStyle}>
      <style>{awardPrintStyles}</style>
      <section className="tiq-award-screen-only" style={heroStyle}>
        <div>
          <div style={eyebrowStyle}>TenAceIQ Award</div>
          <h1 style={titleStyle}>More Tennis. Less Chaos.</h1>
        </div>
        <div style={actionRowStyle}>
          <button type="button" onClick={() => window.print()} style={buttonStyle}>
            Print
          </button>
          {emailHref ? (
            <a href={emailHref} style={buttonStyle}>
              Email
            </a>
          ) : null}
          {award ? (
            <button type="button" onClick={() => void copyCertificateLink()} style={buttonStyle}>
              Share
            </button>
          ) : null}
          {trophyHref ? (
            <Link href={trophyHref} style={buttonStyle}>
              Trophy case
            </Link>
          ) : null}
        </div>
      </section>

      {loading ? (
        <section className="tiq-award-screen-only" style={panelStyle}>Loading certificate...</section>
      ) : award ? (
        <>
          <section
            className="tiq-award-certificate"
            style={certificateStyle}
            aria-label={`Award certificate for ${award.recipientName}`}
          >
            <div aria-hidden="true" style={certificateWatermarkStyle} />
            <div style={certificateBrandStyle}>TenAceIQ Award Studio</div>
            <div style={badgeStyle}>{award.badgeCode}</div>
            <div style={awardLabelStyle}>{award.badgeLabel}</div>
            <h2 style={recipientStyle}>{award.recipientName}</h2>
            <p style={awardTitleStyle}>{award.title}</p>
            <p style={sourceStyle}>{award.sourceName}</p>
            <p style={subtitleStyle}>{award.subtitle || 'More Tennis. Less Chaos.'}</p>
            <div style={mottoStyle}>More Tennis. Less Chaos.</div>
          </section>

          <section className="tiq-award-screen-only" style={panelStyle}>
            <div>
              <div style={eyebrowStyle}>Certificate copy</div>
              <p style={copyStyle}>{buildTiqAwardCertificateText(award)}</p>
            </div>
            <div style={proofGridStyle} aria-label="Award proof">
              {awardProofItems.map((item) => (
                <div key={item.label} style={proofItemStyle}>
                  <span style={item.ready ? readinessDotReadyStyle : readinessDotWaitingStyle} />
                  <strong>{item.label}</strong>
                  <em>{item.value}</em>
                </div>
              ))}
            </div>
            <div style={metaGridStyle}>
              {copyNotice ? <span>{copyNotice}</span> : null}
            </div>
          </section>
        </>
      ) : (
        <section className="tiq-award-screen-only" style={panelStyle}>
          <div style={eyebrowStyle}>Award unavailable</div>
          <h2 style={emptyTitleStyle}>{error}</h2>
          <Link href="/league-coordinator/tournaments" style={buttonStyle}>
            Open tournament workspace
          </Link>
        </section>
      )}
    </main>
  )
}

const awardPrintStyles = `
  @page {
    size: letter landscape;
    margin: 0.25in;
  }

  @media print {
    body {
      background: #ffffff !important;
      color: #0b1628 !important;
    }

    body * {
      visibility: hidden !important;
    }

    .tiq-award-certificate,
    .tiq-award-certificate * {
      visibility: visible !important;
    }

    .tiq-award-print-page {
      display: block !important;
      width: 100% !important;
      max-width: none !important;
      margin: 0 !important;
      padding: 0 !important;
    }

    .tiq-award-screen-only {
      display: none !important;
    }

    .tiq-award-certificate {
      position: fixed !important;
      inset: 0 !important;
      width: auto !important;
      min-height: auto !important;
      height: auto !important;
      border-radius: 0.18in !important;
      box-shadow: none !important;
      break-inside: avoid !important;
      page-break-inside: avoid !important;
      -webkit-print-color-adjust: exact !important;
      print-color-adjust: exact !important;
    }
  }
`

function formatIssuedAt(value: string) {
  if (!value) return 'Issued by TenAceIQ'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return 'Issued by TenAceIQ'
  return `Issued ${date.toLocaleDateString(undefined, { month: 'long', day: 'numeric', year: 'numeric' })}`
}

function buildAwardEmailHref(award: TiqAwardRecord) {
  const href = typeof window !== 'undefined' ? window.location.href : `/awards/${encodeURIComponent(award.id)}`
  const subject = `TenAceIQ ${award.badgeLabel}: ${award.recipientName}`
  const body = [
    `${award.recipientName} earned ${award.title} in ${award.sourceName}.`,
    award.subtitle || 'More Tennis. Less Chaos.',
    '',
    `Certificate: ${href}`,
  ].join('\n')

  return `mailto:?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`
}

const pageStyle: CSSProperties = {
  display: 'grid',
  gap: 16,
  width: 'min(1120px, 100%)',
  margin: '0 auto',
  padding: '18px 16px 46px',
  minWidth: 0,
}

const heroStyle: CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  gap: 12,
  minWidth: 0,
  flexWrap: 'wrap',
}

const eyebrowStyle: CSSProperties = {
  color: 'var(--brand-blue-2)',
  fontSize: 12,
  fontWeight: 950,
  letterSpacing: 0,
  textTransform: 'uppercase',
}

const titleStyle: CSSProperties = {
  margin: '3px 0 0',
  color: 'var(--foreground-strong)',
  fontSize: 'clamp(2rem, 7vw, 4.5rem)',
  lineHeight: 0.95,
  letterSpacing: 0,
}

const actionRowStyle: CSSProperties = {
  display: 'flex',
  flexWrap: 'wrap',
  gap: 8,
  minWidth: 0,
}

const buttonStyle: CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  minHeight: 40,
  maxWidth: '100%',
  padding: '0 14px',
  borderRadius: 999,
  border: '1px solid rgba(116,190,255,0.24)',
  background: 'rgba(255,255,255,0.06)',
  color: 'var(--foreground-strong)',
  fontSize: 13,
  fontWeight: 900,
  textDecoration: 'none',
  cursor: 'pointer',
}

const certificateStyle: CSSProperties = {
  position: 'relative',
  display: 'grid',
  justifyItems: 'center',
  gap: 10,
  minHeight: 560,
  minWidth: 0,
  padding: '48px 24px',
  borderRadius: 24,
  border: '1px solid rgba(116,190,255,0.30)',
  background: 'radial-gradient(circle at 76% 18%, rgba(155,225,29,0.18), transparent 28%), linear-gradient(180deg, rgba(12,26,50,0.96) 0%, rgba(8,20,40,0.98) 100%)',
  color: 'var(--foreground-strong)',
  textAlign: 'center',
  overflow: 'hidden',
}

const certificateWatermarkStyle: CSSProperties = {
  position: 'absolute',
  right: '-7%',
  bottom: '-18%',
  width: 'min(46vw, 430px)',
  aspectRatio: '1 / 1',
  borderRadius: '50%',
  border: 'clamp(22px, 5vw, 44px) solid rgba(155,225,29,0.075)',
  boxShadow: 'inset 0 0 0 2px rgba(116,190,255,0.045)',
  pointerEvents: 'none',
}

const certificateBrandStyle: CSSProperties = {
  color: 'var(--brand-blue-2)',
  fontSize: 13,
  fontWeight: 950,
  textTransform: 'uppercase',
}

const badgeStyle: CSSProperties = {
  display: 'inline-grid',
  placeItems: 'center',
  width: 86,
  height: 86,
  borderRadius: '50%',
  border: '1px solid rgba(155,225,29,0.48)',
  background: 'rgba(155,225,29,0.14)',
  color: 'var(--brand-lime)',
  fontSize: 22,
  fontWeight: 950,
}

const awardLabelStyle: CSSProperties = {
  color: 'var(--shell-copy-muted)',
  fontSize: 13,
  fontWeight: 900,
  textTransform: 'uppercase',
}

const recipientStyle: CSSProperties = {
  margin: 0,
  maxWidth: 820,
  color: 'var(--foreground-strong)',
  fontSize: 'clamp(2.4rem, 10vw, 6rem)',
  lineHeight: 0.96,
  letterSpacing: 0,
  overflowWrap: 'anywhere',
}

const awardTitleStyle: CSSProperties = {
  margin: 0,
  color: 'var(--foreground-strong)',
  fontSize: 'clamp(1.25rem, 4vw, 2rem)',
  fontWeight: 950,
}

const sourceStyle: CSSProperties = {
  margin: 0,
  color: 'var(--brand-lime)',
  fontSize: 16,
  fontWeight: 900,
}

const subtitleStyle: CSSProperties = {
  margin: 0,
  maxWidth: 680,
  color: 'var(--shell-copy-muted)',
  fontSize: 14,
  fontWeight: 800,
}

const mottoStyle: CSSProperties = {
  marginTop: 16,
  color: 'var(--foreground-strong)',
  fontSize: 13,
  fontWeight: 950,
}

const panelStyle: CSSProperties = {
  display: 'grid',
  gap: 12,
  minWidth: 0,
  padding: 18,
  borderRadius: 18,
  border: '1px solid rgba(116,190,255,0.16)',
  background: 'rgba(7,15,31,0.72)',
  color: 'var(--shell-copy-muted)',
}

const copyStyle: CSSProperties = {
  margin: '6px 0 0',
  color: 'var(--foreground-strong)',
  fontSize: 14,
  lineHeight: 1.55,
  fontWeight: 800,
  overflowWrap: 'anywhere',
}

const proofGridStyle: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 160px), 1fr))',
  gap: 8,
  minWidth: 0,
}

const proofItemStyle: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'auto minmax(0, 1fr) auto',
  gap: 8,
  alignItems: 'center',
  minWidth: 0,
  padding: 10,
  borderRadius: 14,
  border: '1px solid rgba(116,190,255,0.14)',
  background: 'rgba(15,23,42,0.46)',
  color: 'var(--foreground-strong)',
  fontSize: 12,
  fontWeight: 900,
  overflowWrap: 'anywhere',
}

const readinessDotReadyStyle: CSSProperties = {
  width: 9,
  height: 9,
  borderRadius: '50%',
  background: 'var(--brand-lime)',
  boxShadow: '0 0 0 4px rgba(155,225,29,0.10)',
}

const readinessDotWaitingStyle: CSSProperties = {
  ...readinessDotReadyStyle,
  background: 'rgba(116,190,255,0.46)',
  boxShadow: '0 0 0 4px rgba(116,190,255,0.08)',
}

const metaGridStyle: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 180px), 1fr))',
  gap: 8,
  minWidth: 0,
  color: 'var(--shell-copy-muted)',
  fontSize: 12,
  fontWeight: 850,
}

const emptyTitleStyle: CSSProperties = {
  margin: 0,
  color: 'var(--foreground-strong)',
  fontSize: 24,
  lineHeight: 1.1,
}

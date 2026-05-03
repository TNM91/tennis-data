import { CSSProperties } from 'react'

export const colors = {
  bgTop: 'var(--background)',
  bgMid: 'var(--background)',
  bgMidAlt: 'var(--background)',
  bgBottom: 'var(--background)',
  navyPanel: 'var(--surface-soft)',
  navyPanelStrong: 'var(--surface-soft-strong)',
  surface: 'var(--surface)',
  surfaceStrong: 'var(--surface-strong)',
  surfaceSoft: 'var(--surface-soft)',
  border: 'var(--card-border-soft)',
  borderStrong: 'var(--card-border-strong)',
  borderSoft: 'var(--card-border)',
  text: 'var(--foreground)',
  textStrong: 'var(--foreground-strong)',
  muted: 'var(--muted)',
  mutedStrong: 'var(--muted-strong)',
  brandBlue: 'var(--brand-blue)',
  brandBlueLight: 'var(--brand-blue-2)',
  brandGreen: 'var(--brand-green)',
  brandGreenLight: 'var(--brand-green-2)',
} as const

export const radii = {
  sm: 12,
  md: 18,
  lg: 24,
  xl: 32,
} as const

export const shadows = {
  soft: 'var(--shadow-soft)',
  card: 'var(--shadow-card)',
  header: 'var(--shadow-soft)',
  glowBlue: 'var(--shadow-glow-blue)',
  glowGreen: 'var(--shadow-glow-green)',
} as const

export const pageBackground: CSSProperties = {
  position: 'relative',
  minHeight: '100vh',
  overflow: 'hidden',
  background: 'var(--page-background)',
}

export const orbOne: CSSProperties = {
  position: 'absolute',
  top: '-120px',
  left: '-140px',
  width: '420px',
  height: '420px',
  borderRadius: '999px',
  background: 'var(--theme-orb-one)',
  filter: 'blur(8px)',
  pointerEvents: 'none',
}

export const orbTwo: CSSProperties = {
  position: 'absolute',
  right: '-140px',
  top: '140px',
  width: '420px',
  height: '420px',
  borderRadius: '999px',
  background: 'var(--theme-orb-two)',
  filter: 'blur(8px)',
  pointerEvents: 'none',
}

export const topBlueWash: CSSProperties = {
  position: 'absolute',
  top: 0,
  left: 0,
  right: 0,
  height: '420px',
  background: 'var(--theme-top-blue-wash)',
  pointerEvents: 'none',
}

export const gridGlow: CSSProperties = {
  position: 'absolute',
  inset: 0,
  backgroundImage: 'var(--theme-grid-glow)',
  backgroundRepeat: 'repeat, repeat',
  backgroundSize: '34px 34px, 34px 34px',
  maskImage: 'linear-gradient(180deg, rgba(0,0,0,0.55), transparent 88%)',
  pointerEvents: 'none',
}

export const pageShell: CSSProperties = {
  position: 'relative',
  zIndex: 1,
  width: 'min(1280px, calc(100% - 32px))',
  marginInline: 'auto',
  padding: '32px 0 72px',
}

export const pageShellTight: CSSProperties = {
  position: 'relative',
  zIndex: 1,
  width: 'min(1120px, calc(100% - 32px))',
  marginInline: 'auto',
  padding: '24px 0 56px',
}

export const sectionStack: CSSProperties = {
  display: 'grid',
  gap: 24,
}

export const sectionBlock: CSSProperties = {
  marginTop: 28,
}

export const heroPanel: CSSProperties = {
  position: 'relative',
  overflow: 'hidden',
  borderRadius: radii.xl,
  border: `1px solid ${colors.borderStrong}`,
  background: 'var(--surface-strong)',
  color: 'var(--foreground-strong)',
  boxShadow: shadows.card,
}

export const heroInner: CSSProperties = {
  position: 'relative',
  zIndex: 1,
  padding: 32,
}

export const glassCard: CSSProperties = {
  borderRadius: radii.lg,
  border: `1px solid ${colors.borderSoft}`,
  background: colors.surfaceSoft,
  backdropFilter: 'blur(14px)',
  WebkitBackdropFilter: 'blur(14px)',
  boxShadow: shadows.soft,
}

export const surfaceCard: CSSProperties = {
  borderRadius: radii.lg,
  border: `1px solid ${colors.border}`,
  background: colors.surface,
  color: colors.text,
  boxShadow: shadows.soft,
}

export const surfaceCardStrong: CSSProperties = {
  borderRadius: radii.lg,
  border: `1px solid ${colors.borderStrong}`,
  background: colors.surfaceStrong,
  color: colors.text,
  boxShadow: shadows.card,
}

export const metricCard: CSSProperties = {
  borderRadius: 20,
  border: `1px solid ${colors.border}`,
  background: colors.surface,
  color: colors.text,
  padding: 18,
  boxShadow: shadows.soft,
}

export const panelPad: CSSProperties = {
  padding: 20,
}

export const sectionTitle: CSSProperties = {
  margin: 0,
  fontSize: 'clamp(1.4rem, 1.8vw, 2rem)',
  lineHeight: 1.1,
  fontWeight: 800,
  letterSpacing: '-0.03em',
  color: colors.textStrong,
}

export const sectionKicker: CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: 8,
  marginBottom: 12,
  padding: '8px 12px',
  borderRadius: 999,
  border: '1px solid var(--home-eyebrow-border)',
  background: 'var(--home-eyebrow-bg)',
  color: 'var(--home-eyebrow-color)',
  fontSize: '0.82rem',
  fontWeight: 700,
  letterSpacing: '0.04em',
  textTransform: 'uppercase',
}

export const heroTitle: CSSProperties = {
  margin: 0,
  fontSize: 'clamp(2.2rem, 4vw, 4.3rem)',
  lineHeight: 0.95,
  fontWeight: 900,
  letterSpacing: '-0.06em',
}

export const heroSubtitle: CSSProperties = {
  marginTop: 16,
  maxWidth: 720,
  color: 'var(--muted-strong)',
  fontSize: 'clamp(1rem, 1.35vw, 1.12rem)',
  lineHeight: 1.7,
}

export const pageTitle: CSSProperties = {
  margin: 0,
  color: colors.textStrong,
  fontSize: 'clamp(2rem, 3vw, 3rem)',
  lineHeight: 1,
  fontWeight: 850,
  letterSpacing: '-0.04em',
}

export const pageSubtitle: CSSProperties = {
  marginTop: 14,
  maxWidth: 760,
  color: 'var(--muted-strong)',
  fontSize: '1.02rem',
  lineHeight: 1.7,
}

export const metricGrid: CSSProperties = {
  display: 'grid',
  gap: 16,
}

export const cardGrid: CSSProperties = {
  display: 'grid',
  gap: 16,
}

export const buttonBase: CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  gap: 10,
  minHeight: 46,
  padding: '0 18px',
  borderRadius: 999,
  fontWeight: 700,
  transition:
    'transform 0.18s ease, box-shadow 0.18s ease, border-color 0.18s ease, background 0.18s ease',
  cursor: 'pointer',
  textDecoration: 'none',
}

export const buttonPrimary: CSSProperties = {
  ...buttonBase,
  border: '1px solid rgba(155, 225, 29, 0.34)',
  background: 'linear-gradient(135deg, var(--brand-green), var(--brand-green-3))',
  color: 'var(--text-dark)',
  boxShadow: shadows.glowGreen,
}

export const buttonSecondary: CSSProperties = {
  ...buttonBase,
  border: '1px solid rgba(74, 163, 255, 0.22)',
  background: 'linear-gradient(135deg, var(--brand-blue), var(--brand-blue-2))',
  color: 'var(--foreground-strong)',
  boxShadow: shadows.glowBlue,
}

export const buttonGhost: CSSProperties = {
  ...buttonBase,
  border: '1px solid var(--card-border)',
  background: 'var(--surface-soft)',
  color: 'var(--foreground-strong)',
}

export const inputBase: CSSProperties = {
  width: '100%',
  borderRadius: 16,
  border: '1px solid var(--card-border-soft)',
  background: 'var(--surface)',
  color: colors.text,
  padding: '14px 16px',
  outline: 'none',
  boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.04)',
}

export const badgeBase: CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: 8,
  padding: '8px 12px',
  borderRadius: 999,
  fontSize: 12,
  fontWeight: 800,
  letterSpacing: '0.03em',
}

export const badgeBlue: CSSProperties = {
  ...badgeBase,
  color: 'var(--foreground)',
  border: '1px solid rgba(96,165,250,0.18)',
  background: 'var(--surface-soft)',
}

export const badgeGreen: CSSProperties = {
  ...badgeBase,
  color: 'var(--foreground)',
  border: '1px solid rgba(74,222,128,0.20)',
  background: 'var(--surface-soft)',
}

export const badgeSlate: CSSProperties = {
  ...badgeBase,
  color: 'var(--foreground)',
  border: '1px solid rgba(148,163,184,0.18)',
  background: 'var(--surface-soft)',
}

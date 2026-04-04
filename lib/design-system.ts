import { CSSProperties } from 'react'

export const colors = {
  bgTop: '#0b1830',
  bgMid: '#102347',
  bgMidAlt: '#0f2243',
  bgBottom: '#0c1a33',
  navyPanel: 'rgba(8,26,49,0.72)',
  navyPanelStrong: 'rgba(8,26,49,0.92)',
  surface: 'linear-gradient(180deg, rgba(10,24,47,0.92) 0%, rgba(8,19,38,0.96) 100%)',
  surfaceStrong: 'linear-gradient(180deg, rgba(10,28,54,0.96) 0%, rgba(8,20,39,0.99) 100%)',
  surfaceSoft: 'rgba(255,255,255,0.06)',
  border: 'rgba(116,190,255,0.16)',
  borderStrong: 'rgba(116,190,255,0.22)',
  borderSoft: 'rgba(255,255,255,0.10)',
  text: '#e5eefb',
  textStrong: '#ffffff',
  muted: '#9fb0c7',
  mutedStrong: '#c5d5ea',
  brandBlue: '#255be3',
  brandBlueLight: '#4aa3ff',
  brandGreen: '#9be11d',
  brandGreenLight: '#4ade80',
} as const

export const radii = {
  sm: 12,
  md: 18,
  lg: 24,
  xl: 32,
} as const

export const shadows = {
  soft: '0 10px 30px rgba(2, 10, 24, 0.18)',
  card: '0 18px 60px rgba(2, 10, 24, 0.2)',
  header: '0 14px 40px rgba(2, 10, 24, 0.18)',
  glowBlue:
    '0 0 0 1px rgba(74,163,255,0.18), 0 10px 40px rgba(37,91,227,0.22)',
  glowGreen:
    '0 0 0 1px rgba(155,225,29,0.2), 0 10px 40px rgba(74,222,128,0.14)',
} as const

export const pageBackground: CSSProperties = {
  position: 'relative',
  minHeight: '100vh',
  overflow: 'hidden',
  background: `
    radial-gradient(circle at 14% 2%, rgba(120, 190, 255, 0.22) 0%, rgba(120, 190, 255, 0) 24%),
    radial-gradient(circle at 82% 10%, rgba(88, 170, 255, 0.18) 0%, rgba(88, 170, 255, 0) 26%),
    radial-gradient(circle at 50% -8%, rgba(150, 210, 255, 0.14) 0%, rgba(150, 210, 255, 0) 28%),
    linear-gradient(180deg, #0b1830 0%, #102347 34%, #0f2243 68%, #0c1a33 100%)
  `,
}

export const orbOne: CSSProperties = {
  position: 'absolute',
  top: '-120px',
  left: '-140px',
  width: '420px',
  height: '420px',
  borderRadius: '999px',
  background:
    'radial-gradient(circle, rgba(116,190,255,0.28) 0%, rgba(116,190,255,0.12) 40%, rgba(116,190,255,0) 74%)',
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
  background:
    'radial-gradient(circle, rgba(155,225,29,0.13) 0%, rgba(155,225,29,0.05) 36%, rgba(155,225,29,0) 72%)',
  filter: 'blur(8px)',
  pointerEvents: 'none',
}

export const topBlueWash: CSSProperties = {
  position: 'absolute',
  top: 0,
  left: 0,
  right: 0,
  height: '420px',
  background:
    'linear-gradient(180deg, rgba(114,186,255,0.10) 0%, rgba(114,186,255,0.05) 38%, rgba(114,186,255,0) 100%)',
  pointerEvents: 'none',
}

export const gridGlow: CSSProperties = {
  position: 'absolute',
  inset: 0,
  backgroundImage:
    'linear-gradient(rgba(255,255,255,0.024) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.024) 1px, transparent 1px)',
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
  background:
    'linear-gradient(135deg, rgba(8, 26, 49, 0.96), rgba(15, 39, 71, 0.92))',
  color: '#ffffff',
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
  border: '1px solid rgba(155, 225, 29, 0.24)',
  background: 'rgba(155, 225, 29, 0.10)',
  color: '#d8f7a4',
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
  color: 'rgba(229, 238, 251, 0.84)',
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
  color: 'rgba(229, 238, 251, 0.8)',
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
  background: 'linear-gradient(135deg, #9be11d, #c7f36b)',
  color: '#08111d',
  boxShadow: shadows.glowGreen,
}

export const buttonSecondary: CSSProperties = {
  ...buttonBase,
  border: '1px solid rgba(74, 163, 255, 0.22)',
  background: 'linear-gradient(135deg, #255be3, #4aa3ff)',
  color: '#ffffff',
  boxShadow: shadows.glowBlue,
}

export const buttonGhost: CSSProperties = {
  ...buttonBase,
  border: '1px solid rgba(255, 255, 255, 0.16)',
  background: 'rgba(255, 255, 255, 0.06)',
  color: '#ffffff',
}

export const inputBase: CSSProperties = {
  width: '100%',
  borderRadius: 16,
  border: '1px solid rgba(116,190,255,0.16)',
  background: 'linear-gradient(180deg, rgba(10,24,47,0.94) 0%, rgba(8,19,38,0.98) 100%)',
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
  color: '#dbeafe',
  border: '1px solid rgba(96,165,250,0.18)',
  background: 'rgba(10, 28, 52, 0.92)',
}

export const badgeGreen: CSSProperties = {
  ...badgeBase,
  color: '#dcfce7',
  border: '1px solid rgba(74,222,128,0.20)',
  background: 'rgba(17, 39, 27, 0.92)',
}

export const badgeSlate: CSSProperties = {
  ...badgeBase,
  color: '#e2e8f0',
  border: '1px solid rgba(148,163,184,0.18)',
  background: 'rgba(15, 23, 42, 0.88)',
}

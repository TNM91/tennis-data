export const pageBackground = {
  position: 'relative',
  minHeight: '100vh',
  overflow: 'hidden',
} as const

export const orbOne = {
  position: 'absolute',
  top: '-90px',
  left: '-110px',
  width: '340px',
  height: '340px',
  borderRadius: '999px',
  background: 'radial-gradient(circle, rgba(74,163,255,0.16) 0%, transparent 70%)',
}

export const orbTwo = {
  position: 'absolute',
  right: '-120px',
  top: '180px',
  width: '340px',
  height: '340px',
  borderRadius: '999px',
  background: 'radial-gradient(circle, rgba(155,225,29,0.08) 0%, transparent 68%)',
}

export const topBlueWash = {
  position: 'absolute',
  inset: 0,
  background: 'radial-gradient(circle at top, rgba(37,91,227,0.18), transparent 55%)',
}

export const gridGlow = {
  position: 'absolute',
  inset: 0,
  backgroundImage:
    'linear-gradient(rgba(255,255,255,0.024) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.024) 1px, transparent 1px)',
  backgroundSize: '34px 34px',
}
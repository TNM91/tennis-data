export default function NavLockIcon({ size = 12 }: { size?: number }) {
  return (
    <svg viewBox="0 0 16 16" width={size} height={size} fill="none" aria-hidden="true">
      <path
        d="M4.75 7V5.6a3.25 3.25 0 0 1 6.5 0V7"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
      />
      <path
        d="M3.9 7h8.2c.55 0 1 .45 1 1v4.2c0 .55-.45 1-1 1H3.9c-.55 0-1-.45-1-1V8c0-.55.45-1 1-1Z"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinejoin="round"
      />
    </svg>
  )
}


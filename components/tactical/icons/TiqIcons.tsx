import Image from 'next/image'
import { ArrowCounterClockwiseIcon } from '@phosphor-icons/react/dist/csr/ArrowCounterClockwise'
import { BookmarkSimpleIcon } from '@phosphor-icons/react/dist/csr/BookmarkSimple'
import { CheckIcon } from '@phosphor-icons/react/dist/csr/Check'
import { ClipboardTextIcon } from '@phosphor-icons/react/dist/csr/ClipboardText'
import { CopySimpleIcon } from '@phosphor-icons/react/dist/csr/CopySimple'
import { CubeIcon } from '@phosphor-icons/react/dist/csr/Cube'
import { CursorIcon } from '@phosphor-icons/react/dist/csr/Cursor'
import { EyeIcon } from '@phosphor-icons/react/dist/csr/Eye'
import { EyeSlashIcon } from '@phosphor-icons/react/dist/csr/EyeSlash'
import { GridFourIcon } from '@phosphor-icons/react/dist/csr/GridFour'
import { PauseIcon } from '@phosphor-icons/react/dist/csr/Pause'
import { PencilSimpleIcon } from '@phosphor-icons/react/dist/csr/PencilSimple'
import { PlayIcon } from '@phosphor-icons/react/dist/csr/Play'
import { PlusIcon } from '@phosphor-icons/react/dist/csr/Plus'
import { SlidersHorizontalIcon } from '@phosphor-icons/react/dist/csr/SlidersHorizontal'
import { StopIcon } from '@phosphor-icons/react/dist/csr/Stop'
import { TargetIcon } from '@phosphor-icons/react/dist/csr/Target'
import { ToolboxIcon } from '@phosphor-icons/react/dist/csr/Toolbox'
import { TrashIcon } from '@phosphor-icons/react/dist/csr/Trash'

const tacticsControls = {
  add: PlusIcon,
  brief: ClipboardTextIcon,
  court: TargetIcon,
  details: SlidersHorizontalIcon,
  done: CheckIcon,
  draw: PencilSimpleIcon,
  duplicate: CopySimpleIcon,
  edit: CursorIcon,
  labels: EyeIcon,
  labelsOff: EyeSlashIcon,
  overhead: GridFourIcon,
  pause: PauseIcon,
  perspective: CubeIcon,
  play: PlayIcon,
  remove: TrashIcon,
  saved: BookmarkSimpleIcon,
  stop: StopIcon,
  tools: ToolboxIcon,
  undo: ArrowCounterClockwiseIcon,
}

export function TacticsControlIcon({ name }: { name: keyof typeof tacticsControls }) {
  const Icon = tacticsControls[name]
  return <Icon data-tiq-tactics-glyph={name} aria-hidden="true" focusable="false" weight="regular" size={18} />
}

type IconProps = {
  className?: string
}

type PlayerIconProps = IconProps & {
  handedness?: 'righty' | 'lefty'
}

type MarkerIconProps = IconProps & {
  type: 'ball' | 'cone' | 'x' | 'o'
}

export function PlayerIcon({ className, handedness = 'righty' }: PlayerIconProps) {
  return (
    <svg aria-hidden="true" className={className} viewBox="-16 -18 32 40">
      <defs>
        <filter id={`tiq-player-glow-${handedness}`} x="-40%" y="-40%" width="180%" height="180%">
          <feDropShadow dx="0" dy="0" stdDeviation="1.4" floodColor="#9BE11D" floodOpacity=".55" />
        </filter>
      </defs>
      <g
        fill="none"
        filter={`url(#tiq-player-glow-${handedness})`}
        stroke="#9BE11D"
        strokeLinecap="round"
        strokeLinejoin="round"
        transform={handedness === 'lefty' ? 'scale(-1 1)' : undefined}
      >
        <ellipse cx="0" cy="12" fill="#9BE11D" opacity=".22" rx="8.5" ry="2" stroke="none" />
        <circle cx="0" cy="-9" fill="#07101E" r="5.7" strokeWidth="1.55" />
        <path d="M-5.1-8.8C-2.6-12.8.1-12.2 2.5-8.7 3.9-6.7 5-6.9 5.8-8.4" strokeWidth="1.35" />
        <path d="M0-3.1V7.5M0-.9l-6.3 4.1M0-.9l6.3 4.1M0 7.5l-5.5 7.4M0 7.5l5.5 7.4" strokeWidth="1.8" />
      </g>
    </svg>
  )
}

export function MarkerIcon({ className, type }: MarkerIconProps) {
  if (type === 'ball') {
    return <Image alt="" aria-hidden="true" className={className} height={38} src="/tiq/tokens/tennis-ball-reference.png" width={38} />
  }

  if (type === 'x' || type === 'o') {
    return (
      <svg aria-hidden="true" className={className} viewBox="-10 -10 20 20">
        {type === 'x' ? (
          <g fill="none" stroke="#9BE11D" strokeLinecap="round" strokeWidth="3">
            <path d="M-5.8-5.8 5.8 5.8" />
            <path d="M5.8-5.8-5.8 5.8" />
          </g>
        ) : (
          <circle cx="0" cy="0" fill="none" r="6.2" stroke="#9BE11D" strokeWidth="2.8" />
        )}
      </svg>
    )
  }

  if (type === 'cone') {
    return (
      <svg aria-hidden="true" className={className} viewBox="-8 -8 16 16">
        <path d="M0-6.2 5.5 5.2h-11z" fill="#FFC257" stroke="#07101E" strokeLinejoin="round" strokeWidth="1.1" />
        <path d="M-6.5 5.2h13" fill="none" stroke="#9BE11D" strokeLinecap="round" strokeWidth="1.2" />
        <path d="M-2.2.8h4.4" stroke="#07101E" strokeLinecap="round" strokeWidth=".9" />
      </svg>
    )
  }
}

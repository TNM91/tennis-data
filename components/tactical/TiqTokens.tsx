import {StudioImage as Image} from './TiqStudioPlatform'
import { MarkerIcon } from './icons/TiqIcons'
import type { TacticalToken } from '@/lib/tactical/types'
import styles from './TiqTacticalStudio.module.css'

export function PlayerGlyph(){return <svg viewBox="0 0 32 32" width="30" height="30" color="#e1f5ff" aria-hidden="true" fill="none"><circle cx="16" cy="10" r="5" fill="currentColor"/><path d="M6 28v-4a10 10 0 0 1 20 0v4" fill="currentColor"/></svg>}

export default function TiqTokenIcon({ token }: { token: TacticalToken }) {
  if (token.type === 'player') {
    return (
      <span className={styles.playerTokenHead}>
        <PlayerGlyph/>
      </span>
    )
  }

  if (token.type === 'ball') {
    return (
      <span className={styles.ballTokenImage}>
        <Image alt="" draggable={false} fill sizes="42px" src="/tiq/tokens/tennis-ball-reference.png" />
      </span>
    )
  }

  return <MarkerIcon type={token.type} />
}

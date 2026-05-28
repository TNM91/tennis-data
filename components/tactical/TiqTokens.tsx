import { MarkerIcon, PlayerIcon } from './icons/TiqIcons'
import type { TacticalToken } from '@/lib/tactical/types'

export default function TiqTokenIcon({ token }: { token: TacticalToken }) {
  if (token.type === 'player') {
    return <PlayerIcon handedness={token.handedness ?? 'righty'} />
  }

  return <MarkerIcon type={token.type} />
}

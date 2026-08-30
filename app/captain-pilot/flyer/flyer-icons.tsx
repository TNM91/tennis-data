'use client'

import { BinocularsIcon } from '@phosphor-icons/react/dist/csr/Binoculars'
import { CalendarBlankIcon } from '@phosphor-icons/react/dist/csr/CalendarBlank'
import { ChartLineUpIcon } from '@phosphor-icons/react/dist/csr/ChartLineUp'
import { ChatCircleDotsIcon } from '@phosphor-icons/react/dist/csr/ChatCircleDots'
import { ClipboardTextIcon } from '@phosphor-icons/react/dist/csr/ClipboardText'
import { ShieldCheckIcon } from '@phosphor-icons/react/dist/csr/ShieldCheck'

const benefitIcons = {
  access: ShieldCheckIcon,
  availability: CalendarBlankIcon,
  lineups: ChartLineUpIcon,
  scouting: BinocularsIcon,
  teamPlan: ClipboardTextIcon,
}

type FlyerBenefitIconName = keyof typeof benefitIcons

export function FlyerBenefitIcon({ name, className }: { name: FlyerBenefitIconName; className?: string }) {
  const Icon = benefitIcons[name]
  return <Icon aria-hidden="true" className={className} weight="duotone" />
}

export function FlyerFeedbackIcon({ className }: { className?: string }) {
  return <ChatCircleDotsIcon aria-hidden="true" className={className} weight="duotone" />
}

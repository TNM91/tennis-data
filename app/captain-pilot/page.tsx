import CaptainPilotClient from './captain-pilot-client'
import { buildCaptainPilotTrialEnd } from '@/lib/captain-pilot'

export const dynamic = 'force-dynamic'

export default function CaptainPilotPage() {
  const renewalDateLabel = new Intl.DateTimeFormat('en-US', {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(new Date(buildCaptainPilotTrialEnd() * 1000))

  return <CaptainPilotClient renewalDateLabel={renewalDateLabel} />
}

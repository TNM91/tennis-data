export type TiqTournamentMessagingProviderState = {
  mode: 'sandbox' | 'ready'
  provider: 'disabled' | 'twilio'
  enabled: boolean
  label: string
  blocker: string
  previewNote: string
}

export function getTiqTournamentMessagingProviderState(): TiqTournamentMessagingProviderState {
  const provider = process.env.NEXT_PUBLIC_TIQ_TOURNAMENT_SMS_PROVIDER?.trim().toLowerCase()
  const enabled = provider === 'twilio' && process.env.NEXT_PUBLIC_TIQ_TOURNAMENT_SMS_ENABLED === 'true'

  if (enabled) {
    return {
      mode: 'ready',
      provider: 'twilio',
      enabled: true,
      label: 'Provider ready',
      blocker: '',
      previewNote: 'No SMS was sent. This validates recipients and payload before live provider delivery.',
    }
  }

  return {
    mode: 'sandbox',
    provider: 'disabled',
    enabled: false,
    label: 'Sandbox',
    blocker: 'Live SMS stays locked until sender registration, consent capture, opt-out handling, and provider delivery checks are enabled.',
    previewNote: 'No SMS was sent. This validates recipients and payload before provider delivery is enabled.',
  }
}

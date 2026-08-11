import {
  isPinnedPortalShortcutList,
  normalizePinnedPortalShortcuts,
  type PortalShortcutPreferenceId,
} from '@/lib/portal-lane-preferences'

export type PortalShortcutCloudState = {
  shortcuts: PortalShortcutPreferenceId[] | null
  cueDismissed: boolean
  cloudAvailable: boolean
  updatedAt: string | null
}

export async function loadPortalShortcutCloudState(accessToken: string, signal?: AbortSignal): Promise<PortalShortcutCloudState> {
  if (!accessToken) return emptyCloudState(false)

  try {
    const response = await fetch('/api/portal/shortcuts', {
      headers: { Authorization: `Bearer ${accessToken}` },
      cache: 'no-store',
      signal,
    })
    const body = await response.json().catch(() => null) as Record<string, unknown> | null
    if (!response.ok || !body?.ok) return emptyCloudState(false)

    return {
      shortcuts: isPinnedPortalShortcutList(body.shortcuts)
        ? normalizePinnedPortalShortcuts(body.shortcuts)
        : null,
      cueDismissed: body.cueDismissed === true,
      cloudAvailable: body.cloudAvailable !== false,
      updatedAt: typeof body.updatedAt === 'string' ? body.updatedAt : null,
    }
  } catch {
    return emptyCloudState(false)
  }
}

export async function savePortalShortcutCloudState(input: {
  accessToken: string
  shortcuts: readonly PortalShortcutPreferenceId[]
  cueDismissed: boolean
}): Promise<PortalShortcutCloudState> {
  if (!input.accessToken) return emptyCloudState(false)

  try {
    const response = await fetch('/api/portal/shortcuts', {
      method: 'PUT',
      headers: {
        Authorization: `Bearer ${input.accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        shortcuts: normalizePinnedPortalShortcuts(input.shortcuts),
        cueDismissed: input.cueDismissed,
      }),
    })
    const body = await response.json().catch(() => null) as Record<string, unknown> | null
    if (!response.ok || !body?.ok) return emptyCloudState(false)

    return {
      shortcuts: isPinnedPortalShortcutList(body.shortcuts)
        ? normalizePinnedPortalShortcuts(body.shortcuts)
        : normalizePinnedPortalShortcuts(input.shortcuts),
      cueDismissed: body.cueDismissed === true,
      cloudAvailable: body.cloudAvailable !== false,
      updatedAt: typeof body.updatedAt === 'string' ? body.updatedAt : null,
    }
  } catch {
    return emptyCloudState(false)
  }
}

function emptyCloudState(cloudAvailable: boolean): PortalShortcutCloudState {
  return {
    shortcuts: null,
    cueDismissed: false,
    cloudAvailable,
    updatedAt: null,
  }
}

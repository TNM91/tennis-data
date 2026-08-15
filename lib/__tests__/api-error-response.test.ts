import { afterEach, describe, expect, it, vi } from 'vitest'
import { apiServerError } from '../api-error-response'

describe('API server error responses', () => {
  afterEach(() => vi.restoreAllMocks())

  it('logs the internal error without returning its details to the client', async () => {
    const error = new Error('database host and table detail')
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => undefined)

    const response = apiServerError('Could not load records', error, 'Records are temporarily unavailable.')

    expect(response.status).toBe(500)
    await expect(response.json()).resolves.toEqual({
      ok: false,
      message: 'Records are temporarily unavailable.',
    })
    expect(consoleError).toHaveBeenCalledWith('Could not load records', error)
  })
})

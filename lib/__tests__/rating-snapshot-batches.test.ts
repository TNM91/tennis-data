import { expect, it, vi } from 'vitest'
import { saveRatingSnapshotBatches } from '../rating-snapshot-batches'

function deferred() {
  let resolve!: () => void
  let reject!: (reason: unknown) => void
  const promise = new Promise<void>((yes, no) => { resolve = yes; reject = no })
  return { promise, resolve, reject }
}

it('runs only two disjoint batches per wave and waits before starting another', async () => {
  const first = deferred(), second = deferred()
  const save = vi.fn((batch: number) => batch === 0 ? first.promise : batch === 1 ? second.promise : Promise.resolve())
  const job = saveRatingSnapshotBatches([0, 1, 2, 3, 4], save, 2)
  expect(save.mock.calls.flat()).toEqual([0, 1])
  first.resolve()
  await Promise.resolve()
  expect(save.mock.calls.flat()).toEqual([0, 1])
  second.resolve()
  await job
  expect(save.mock.calls.flat()).toEqual([0, 1, 2, 3, 4])
})

it('drains a sibling write before rejecting and never starts the next wave', async () => {
  const sibling = deferred(), failure = new Error('write failed')
  const save = vi.fn((batch: number) => batch === 0 ? Promise.reject(failure) : sibling.promise)
  let released = false
  const job = saveRatingSnapshotBatches([0, 1, 2], save, 2).catch(error => { released = true; throw error })
  const assertion = expect(job).rejects.toBe(failure)
  await Promise.resolve()
  await Promise.resolve()
  expect(released).toBe(false)
  expect(save.mock.calls.flat()).toEqual([0, 1])
  sibling.resolve()
  await assertion
  expect(released).toBe(true)
  expect(save.mock.calls.flat()).toEqual([0, 1])
})

it('observes both failures, including a synchronous failure, without starting more work', async () => {
  const failure = new Error('sync'), sibling = deferred()
  const save = vi.fn((batch: number) => { if (batch === 0) throw failure; return sibling.promise })
  const job = saveRatingSnapshotBatches([0, 1, 2], save, 2)
  const assertion = expect(job).rejects.toBe(failure)
  sibling.reject(new Error('async'))
  await assertion
  expect(save).toHaveBeenCalledTimes(2)
})

it('keeps the default sequential and accepts an empty inventory', async () => {
  const first = deferred()
  const save = vi.fn(() => first.promise)
  const job = saveRatingSnapshotBatches([0, 1], save)
  expect(save).toHaveBeenCalledTimes(1)
  first.resolve()
  await job
  expect(save).toHaveBeenCalledTimes(2)
  save.mockClear()
  await saveRatingSnapshotBatches([], save, 2)
  expect(save).not.toHaveBeenCalled()
})

it('clamps unsupported runtime values to the sequential default', async () => {
  const first = deferred(), save = vi.fn(() => first.promise)
  const job = saveRatingSnapshotBatches([0, 1], save, 100 as 2)
  expect(save).toHaveBeenCalledTimes(1)
  first.resolve()
  await job
})

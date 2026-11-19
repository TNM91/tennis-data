import type {SupportedStorage} from '@supabase/auth-js'
import {getNativeAuthStorage} from '../../lib/native-auth-storage'

export const openingScreenChoices = [
  ['lab', 'My Lab'], ['teams', 'Chats'], ['explore', 'Explore'], ['compete', 'Compete'], ['last', 'Last-used tab'],
] as const
export type OpeningChoice = typeof openingScreenChoices[number][0]
export type OpeningTab = Exclude<OpeningChoice, 'last'> | 'more'
const tabs: readonly string[] = ['lab', 'teams', 'explore', 'compete', 'more']
const queues = new Map<string, Promise<unknown>>()
const lastQueued = new Map<string, OpeningTab>()
let deviceStorage: SupportedStorage | undefined
const storage = () => deviceStorage ??= getNativeAuthStorage() ?? localStorage
const validOwner = (owner: string) => {
  if (!/^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(owner)) throw Error('Invalid account')
}
const isChoice = (value: unknown): value is OpeningChoice => openingScreenChoices.some(([id]) => id === value)
function enqueue(owner: string, operation: () => Promise<void>) {
  const task = (queues.get(owner) ?? Promise.resolve()).catch(() => {}).then(operation)
  queues.set(owner, task)
  void task.then(() => {if (queues.get(owner) === task) queues.delete(owner)}, () => {if (queues.get(owner) === task) queues.delete(owner)})
  return task
}
export function openingPreferences(owner: string, supplied?: SupportedStorage) {
  validOwner(owner)
  const choiceKey = 'opening-screen:v1:' + owner, tabKey = 'opening-tab:v1:' + owner
  const backing = () => supplied ?? storage()
  return {
    async read(): Promise<OpeningChoice> {
      const value = await backing().getItem(choiceKey)
      return isChoice(value) ? value : 'lab'
    },
    async last(): Promise<OpeningTab> {
      const value = await backing().getItem(tabKey)
      return value && tabs.includes(value) ? value as OpeningTab : 'lab'
    },
    save(choice: OpeningChoice) {
      if (!isChoice(choice)) return Promise.reject(Error('Invalid opening screen'))
      return enqueue(owner, async () => {
        await backing().setItem(choiceKey, choice)
        if (await backing().getItem(choiceKey) !== choice) throw Error('Preference save unconfirmed')
      })
    },
    remember(tab: OpeningTab) {
      if (!tabs.includes(tab)) return Promise.reject(Error('Invalid tab'))
      if (lastQueued.get(owner) === tab && !supplied) return Promise.resolve()
      if (!supplied) lastQueued.set(owner, tab)
      return enqueue(owner, async () => {
        if (!supplied && lastQueued.get(owner) !== tab) return
        try {await backing().setItem(tabKey, tab)}
        catch (error) {if (!supplied && lastQueued.get(owner) === tab) lastQueued.delete(owner); throw error}
      })
    },
    clear() {
      lastQueued.delete(owner)
      return enqueue(owner, async () => {await backing().removeItem(choiceKey); await backing().removeItem(tabKey)})
    },
  }
}
export async function resolveOpeningScreen(owner: string, current: () => boolean, supplied?: SupportedStorage): Promise<OpeningTab> {
  if (!current()) throw Error('Account changed')
  let tab: OpeningTab = 'lab'
  try {
    const preferences = openingPreferences(owner, supplied), choice = await preferences.read()
    tab = choice === 'last' ? await preferences.last() : choice
  } catch { /* A device-storage outage keeps the normal My Lab entry usable. */ }
  if (!current()) throw Error('Account changed')
  return tab
}

'use client'

import Link from 'next/link'
import { useSyncExternalStore } from 'react'
import styles from '@/app/player-development/_components/player-development.module.css'
import {
  PLAYER_FOCUS_STORAGE_KEY,
  PLAYER_STYLE_COOKIE,
  PLAYER_STYLE_STORAGE_KEY,
  writePlayerStyleCookie,
} from '@/lib/player-identity-selection'
import type { PlayerDevelopmentIdentityKind } from '@/lib/player-development'

type IdentityChoice = {
  slug: string
  title: string
  summary: string
  cue: string
}

type SavedIdentityChoice = {
  slug: string
  savedAt: string
}

type PlayerIdentitySelectorProps = {
  activeIdentity: IdentityChoice
  activeKind: PlayerDevelopmentIdentityKind
  playingStyles: IdentityChoice[]
  developmentFocuses: IdentityChoice[]
  initialSavedStyleSlug?: string | null
}

const PLAYER_IDENTITY_CHANGE_EVENT = 'tenaceiq:player-identity-changed'

function readSavedChoice(key: string) {
  try {
    const value = window.localStorage.getItem(key)
    if (!value) return null
    const parsed = JSON.parse(value) as Partial<SavedIdentityChoice>
    return typeof parsed.slug === 'string' ? parsed.slug : null
  } catch {
    return null
  }
}

function readCookie(name: string) {
  const prefix = `${name}=`
  const value = document.cookie.split('; ').find((item) => item.startsWith(prefix))?.slice(prefix.length)
  if (!value) return null

  try {
    return decodeURIComponent(value)
  } catch {
    return null
  }
}

function subscribeToIdentityChoices(onStoreChange: () => void) {
  window.addEventListener('storage', onStoreChange)
  window.addEventListener(PLAYER_IDENTITY_CHANGE_EVENT, onStoreChange)
  return () => {
    window.removeEventListener('storage', onStoreChange)
    window.removeEventListener(PLAYER_IDENTITY_CHANGE_EVENT, onStoreChange)
  }
}

function getSavedStyleSnapshot() {
  return readSavedChoice(PLAYER_STYLE_STORAGE_KEY) ?? readCookie(PLAYER_STYLE_COOKIE)
}

function getSavedFocusSnapshot() {
  return readSavedChoice(PLAYER_FOCUS_STORAGE_KEY)
}

function getEmptySavedFocusSnapshot() {
  return null
}

export default function PlayerIdentitySelector({
  activeIdentity,
  activeKind,
  playingStyles,
  developmentFocuses,
  initialSavedStyleSlug = null,
}: PlayerIdentitySelectorProps) {
  const savedStyleSlug = useSyncExternalStore(
    subscribeToIdentityChoices,
    getSavedStyleSnapshot,
    () => initialSavedStyleSlug,
  )
  const savedFocusSlug = useSyncExternalStore(
    subscribeToIdentityChoices,
    getSavedFocusSnapshot,
    getEmptySavedFocusSnapshot,
  )

  const activeSavedSlug = activeKind === 'playing-style' ? savedStyleSlug : savedFocusSlug
  const isActiveSaved = activeSavedSlug === activeIdentity.slug
  const activeLabel = activeKind === 'playing-style' ? 'Playing style' : 'Development focus'
  const saveLabel = activeKind === 'playing-style' ? 'Use this style' : 'Use this focus'

  function rememberChoice(choice: IdentityChoice, kind: PlayerDevelopmentIdentityKind) {
    const storageKey = kind === 'playing-style' ? PLAYER_STYLE_STORAGE_KEY : PLAYER_FOCUS_STORAGE_KEY
    const payload: SavedIdentityChoice = { slug: choice.slug, savedAt: new Date().toISOString() }

    try {
      window.localStorage.setItem(storageKey, JSON.stringify(payload))
    } catch {
      // Navigation still works when storage is unavailable.
    }

    if (kind === 'playing-style') {
      writePlayerStyleCookie(choice.slug)
    }
    window.dispatchEvent(new Event(PLAYER_IDENTITY_CHANGE_EVENT))
  }

  function renderChoice(choice: IdentityChoice, kind: PlayerDevelopmentIdentityKind) {
    const isActive = choice.slug === activeIdentity.slug
    const isSaved = (kind === 'playing-style' ? savedStyleSlug : savedFocusSlug) === choice.slug

    return (
      <Link
        key={choice.slug}
        href={`/level-up/${choice.slug}`}
        prefetch={false}
        data-active={isActive ? 'true' : 'false'}
        data-saved={isSaved ? 'true' : 'false'}
        onClick={() => rememberChoice(choice, kind)}
      >
        <span>{choice.title}</span>
        <strong>{choice.summary}</strong>
        <small>{choice.cue}</small>
        {isSaved ? <em>Saved</em> : null}
      </Link>
    )
  }

  return (
    <section id="playing-style" className={styles.levelUpIdentityChooser} aria-label="Playing style and development focus">
      <div className={styles.levelUpIdentityCurrent}>
        <div className={styles.levelUpIdentityCurrentCopy}>
          <span>{activeLabel}</span>
          <strong>{activeIdentity.title}</strong>
          <p>{activeIdentity.summary}</p>
          <small>
            {isActiveSaved
              ? activeKind === 'playing-style'
                ? 'Chosen by you. New match and practice proof can sharpen it over time.'
                : 'Saved as your current training emphasis. Change it whenever your tennis needs change.'
              : activeKind === 'playing-style'
                ? 'Starter style. Compare the options before making it yours.'
                : 'Training emphasis. This can change without changing your playing style.'}
          </small>
        </div>
        <div className={styles.levelUpIdentityCurrentActions}>
          <button type="button" disabled={isActiveSaved} onClick={() => rememberChoice(activeIdentity, activeKind)}>
            {isActiveSaved ? 'Saved' : saveLabel}
          </button>
        </div>
      </div>

      <details className={styles.levelUpIdentityCompare}>
        <summary>
          <span>Compare or update</span>
          <strong>Style stays steady. Focus can change.</strong>
          <em>
            <span>Open</span>
            <span>Close</span>
          </em>
        </summary>
        <div className={styles.levelUpIdentityCompareBody}>
          <p className={styles.levelUpIdentityCompareNote}>
            Pick the style that best describes how you naturally build and finish points. Use a development focus for the part of your tennis you are improving now.
          </p>
          <section aria-labelledby="core-playing-styles-title">
            <header>
              <span>Core identity</span>
              <strong id="core-playing-styles-title">Playing styles</strong>
              <p>Your durable match identity.</p>
            </header>
            <div className={styles.levelUpIdentityChoiceGrid}>
              {playingStyles.map((choice) => renderChoice(choice, 'playing-style'))}
            </div>
          </section>
          <section aria-labelledby="development-focuses-title">
            <header>
              <span>Train now</span>
              <strong id="development-focuses-title">Development focuses</strong>
              <p>One priority that can change as your game changes.</p>
            </header>
            <div className={styles.levelUpIdentityChoiceGrid}>
              {developmentFocuses.map((choice) => renderChoice(choice, 'development-focus'))}
            </div>
          </section>
        </div>
      </details>
    </section>
  )
}

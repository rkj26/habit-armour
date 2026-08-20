import { useCallback, useEffect, useRef, useState } from 'react'
import { logicalToday } from './logicalDay'

/**
 * A localStorage-backed form draft that expires when the logical day rolls over.
 *
 * The old behaviour kept one key per form forever, so yesterday's half-written
 * journal reappeared this morning and you had to notice and clear it. Drafts are
 * now stamped with the logical day they were written on and dropped on read if
 * that day has passed; stale keys from other days are purged at the same time.
 *
 * Editing a past entry deliberately does not touch the draft -- you are working
 * on a specific date, not on today's scratch pad.
 */
export function useDraft(key, initialValue, { enabled = true } = {}) {
  const storageKey = `habitarmour_draft_${key}`

  const [value, setValue] = useState(() => {
    try {
      const raw = localStorage.getItem(storageKey)
      if (!raw) return initialValue
      const parsed = JSON.parse(raw)
      // Legacy drafts have no envelope; treat them as stale rather than guessing.
      if (!parsed || parsed.day !== logicalToday()) {
        localStorage.removeItem(storageKey)
        return initialValue
      }
      return { ...initialValue, ...parsed.value }
    } catch {
      return initialValue
    }
  })

  const enabledRef = useRef(enabled)
  enabledRef.current = enabled

  useEffect(() => {
    if (!enabledRef.current) return
    try {
      localStorage.setItem(storageKey, JSON.stringify({ day: logicalToday(), value }))
    } catch {
      // Private browsing or a full quota -- losing a draft is not worth throwing.
    }
  }, [storageKey, value])

  /**
   * Wipes the stored draft and resets state. Pass `resetTo` when the empty
   * shape depends on config the hook never saw (e.g. the supplements list).
   */
  const clear = useCallback(
    (resetTo) => {
      try {
        localStorage.removeItem(storageKey)
      } catch {
        /* nothing useful to do */
      }
      setValue(resetTo === undefined ? initialValue : resetTo)
      // eslint-disable-next-line react-hooks/exhaustive-deps
    },
    [storageKey]
  )

  return [value, setValue, clear]
}

/** Word count used by the journal limits. */
export function countWords(text) {
  const trimmed = (text || '').trim()
  return trimmed ? trimmed.split(/\s+/).length : 0
}

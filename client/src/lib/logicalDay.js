/**
 * The client's copy of the 4 AM rollover rule that app/config.py owns on the
 * backend. Keep the two in sync -- a mismatch means the UI thinks it is a
 * different day than the lock does.
 */
const LOGICAL_DAY_START_HOUR = 4

export function logicalToday(now = new Date()) {
  const shifted = new Date(now.getTime() - LOGICAL_DAY_START_HOUR * 60 * 60 * 1000)
  const y = shifted.getFullYear()
  const m = String(shifted.getMonth() + 1).padStart(2, '0')
  const d = String(shifted.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

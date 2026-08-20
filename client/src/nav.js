import {
  CalendarCheck,
  ChartLine,
  Dumbbell,
  GraduationCap,
  History,
  Settings,
  Sun,
} from 'lucide-react'

/**
 * Sidebar destinations. Anything finer-grained than these is an in-page tab --
 * twelve flat entries made the sidebar the hardest thing on screen to scan.
 *
 * Sub-tab ids are the values `activeTab`'s companion state takes, and they still
 * match the `window` strings the submit API expects.
 */
export const NAV_SECTIONS = [
  {
    title: 'Log',
    items: [
      { id: 'today', label: 'Today', icon: Sun },
      { id: 'weekly', label: 'Weekly check-in', icon: CalendarCheck },
    ],
  },
  {
    title: 'Progress',
    items: [
      { id: 'training', label: 'Training', icon: Dumbbell },
      { id: 'learning', label: 'Learning', icon: GraduationCap },
    ],
  },
  {
    title: 'System',
    items: [
      { id: 'dashboard', label: 'Analytics', icon: ChartLine },
      { id: 'history', label: 'History', icon: History },
      { id: 'settings', label: 'Settings', icon: Settings },
    ],
  },
]

export const NAV_ITEMS = NAV_SECTIONS.flatMap((s) => s.items)

/** Which sidebar destination owns a given daily-log window. */
export const WINDOW_TO_TAB = {
  morning: 'today',
  morningJournal: 'today',
  night: 'today',
  nightJournal: 'today',
  weekly: 'weekly',
}

export const TODAY_TABS = [
  { id: 'morning', label: 'Morning log' },
  { id: 'morningJournal', label: 'Morning journal' },
  { id: 'night', label: 'Night log' },
  { id: 'nightJournal', label: 'Night journal' },
]

export function navTitle(id) {
  return NAV_ITEMS.find((i) => i.id === id)?.label ?? 'Habit Armour'
}

export function navSectionTitle(id) {
  return NAV_SECTIONS.find((s) => s.items.some((i) => i.id === id))?.title ?? ''
}

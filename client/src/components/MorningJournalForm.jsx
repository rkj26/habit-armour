import React from 'react'

import EditingBanner from './EditingBanner'
import TodoListEditor from './TodoListEditor'
import WordCountField from './WordCountField'
import { Button } from '@/components/shadcn/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/shadcn/card'
import { countWords } from '@/lib/useDraft'

/** Words required before a journal clears the lock. */
export const FEELING_MIN_WORDS = 50

/**
 * Morning journal: what you intend to do, and how you're arriving.
 *
 * Replaces the old single 100-word-minimum freeform box. The to-do list is the
 * part the night journal reads back to tick off, so its shape is a contract
 * between the two screens.
 */
export function morningJournalBlocker(data) {
  const todos = (data.todos || []).filter((t) => t.text.trim())
  if (todos.length === 0) return 'Add at least one to-do before submitting.'
  const words = countWords(data.feeling)
  if (words < FEELING_MIN_WORDS) {
    return `${FEELING_MIN_WORDS - words} more words on how you're feeling.`
  }
  return null
}

export default function MorningJournalForm({
  morningData,
  setMorningData,
  editingDate,
  cancelEditing,
  onSubmit,
}) {
  const todos = morningData.todos || []
  const feeling = morningData.feeling || ''
  const blocker = morningJournalBlocker(morningData)

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-6">
      <EditingBanner editingDate={editingDate} cancelEditing={cancelEditing} />

      <Card>
        <CardHeader>
          <CardTitle>Today&apos;s to-dos</CardTitle>
          <CardDescription>
            As many as you need. Tonight you&apos;ll tick these off.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <TodoListEditor items={todos} onChange={(next) => setMorningData({ ...morningData, todos: next })} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>How are you feeling?</CardTitle>
          <CardDescription>At least {FEELING_MIN_WORDS} words — enough to actually think it through.</CardDescription>
        </CardHeader>
        <CardContent>
          <WordCountField
            id="morning-feeling"
            label="This morning"
            hint="Nice one."
            value={feeling}
            onChange={(v) => setMorningData({ ...morningData, feeling: v })}
            min={FEELING_MIN_WORDS}
          />
        </CardContent>
      </Card>

      <div className="flex items-center justify-between gap-4">
        <span className="text-sm text-muted-foreground">{blocker || 'Ready to submit.'}</span>
        <Button type="submit" size="lg" disabled={Boolean(blocker)}>
          Submit morning journal
        </Button>
      </div>
    </form>
  )
}

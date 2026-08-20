import React from 'react'
import { ArrowRight } from 'lucide-react'
import EditingBanner from './EditingBanner'
import WordCountField from './WordCountField'
import MorningReferenceCard from './MorningReferenceCard'
import { Button } from '@/components/shadcn/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/shadcn/card'
import { Checkbox } from '@/components/shadcn/checkbox'
import { Label } from '@/components/shadcn/label'
import { countWords } from '@/lib/useDraft'
import { FEELING_MIN_WORDS } from './MorningJournalForm'

/**
 * Night journal: close the loop on the morning's to-dos, then reflect.
 *
 * `morningTodos` comes from today's saved morning entry, not from local state --
 * the point is to be held to what you actually committed to this morning.
 */
export function nightJournalBlocker(data) {
  const feeling = countWords(data.feeling)
  if (feeling < FEELING_MIN_WORDS) {
    return `${FEELING_MIN_WORDS - feeling} more words on how the day went.`
  }
  const tomorrow = countWords(data.tomorrow)
  if (tomorrow < FEELING_MIN_WORDS) {
    return `${FEELING_MIN_WORDS - tomorrow} more words on tomorrow.`
  }
  // Not ticking anything is a valid, honest answer to a bad day, so completion
  // of the to-dos is deliberately not a gate.
  return null
}

export default function NightJournalForm({
  nightData,
  setNightData,
  status,
  morningTodos = [],
  editingDate,
  cancelEditing,
  onSubmit,
}) {
  const done = nightData.todosCompleted || []
  const blocker = nightJournalBlocker(nightData, morningTodos)

  const toggle = (id, checked) => {
    const next = checked ? [...new Set([...done, id])] : done.filter((x) => x !== id)
    setNightData({ ...nightData, todosCompleted: next })
  }

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-6">
      <EditingBanner editingDate={editingDate} cancelEditing={cancelEditing} />

      <MorningReferenceCard status={status} />

      <Card>
        <CardHeader>
          <CardTitle>This morning&apos;s to-dos</CardTitle>
          <CardDescription>
            {morningTodos.length > 0
              ? `${done.length} of ${morningTodos.length} done. Ticking everything is not the point; being accurate is.`
              : 'No to-dos were logged this morning.'}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {morningTodos.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Nothing to review. Add to-dos in the morning journal and they&apos;ll appear here tonight.
            </p>
          ) : (
            <div className="flex flex-col gap-3">
              {morningTodos.map((todo) => {
                const checked = done.includes(todo.id)
                return (
                  <div key={todo.id} className="flex items-start gap-3">
                    <Checkbox
                      id={`todo-${todo.id}`}
                      checked={checked}
                      onCheckedChange={(v) => toggle(todo.id, v === true)}
                    />
                    <Label
                      htmlFor={`todo-${todo.id}`}
                      className={
                        checked
                          ? 'font-normal leading-snug text-muted-foreground line-through'
                          : 'font-normal leading-snug'
                      }
                    >
                      {todo.text}
                    </Label>
                  </div>
                )
              })}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>How was the day?</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-6">
          <WordCountField
            id="night-feeling"
            label="How you're feeling about today"
            hint="Nice one."
            value={nightData.feeling || ''}
            onChange={(v) => setNightData({ ...nightData, feeling: v })}
            min={FEELING_MIN_WORDS}
          />
          <WordCountField
            id="night-tomorrow"
            label="What you want to do tomorrow"
            hint="Nice one."
            value={nightData.tomorrow || ''}
            onChange={(v) => setNightData({ ...nightData, tomorrow: v })}
            min={FEELING_MIN_WORDS}
          />
        </CardContent>
      </Card>

      <div className="flex items-center justify-between gap-4">
        <span className="text-sm text-muted-foreground">{blocker || 'Ready to submit.'}</span>
        <Button type="submit" size="lg" disabled={Boolean(blocker)}>
          Submit night journal
          <ArrowRight className="size-4" />
        </Button>
      </div>
    </form>
  )
}

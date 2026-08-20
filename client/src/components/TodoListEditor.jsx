import React, { useState } from 'react'
import { Plus, X, GripVertical } from 'lucide-react'
import { Button } from '@/components/shadcn/button'
import { Input } from '@/components/shadcn/input'

/**
 * The morning to-do list. Free-form length -- add as many as the day needs.
 * Items are `{ id, text }`; the night journal ticks them off by id, so ids must
 * survive a round trip through the daily entry JSON.
 */
export default function TodoListEditor({ items, onChange }) {
  const [draft, setDraft] = useState('')

  const add = () => {
    const text = draft.trim()
    if (!text) return
    onChange([...items, { id: `todo_${Date.now()}_${items.length}`, text }])
    setDraft('')
  }

  const remove = (id) => onChange(items.filter((i) => i.id !== id))

  const edit = (id, text) => onChange(items.map((i) => (i.id === id ? { ...i, text } : i)))

  return (
    <div className="flex flex-col gap-2">
      {items.length === 0 && (
        <p className="text-sm text-muted-foreground">
          Nothing planned yet. Add the things you intend to get done today.
        </p>
      )}

      {items.map((item, idx) => (
        <div key={item.id} className="flex items-center gap-2">
          <GripVertical className="size-4 shrink-0 text-muted-foreground/50" aria-hidden />
          <span className="w-5 shrink-0 text-right text-sm tabular-nums text-muted-foreground">
            {idx + 1}.
          </span>
          <Input
            value={item.text}
            onChange={(e) => edit(item.id, e.target.value)}
            aria-label={`To-do ${idx + 1}`}
          />
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={() => remove(item.id)}
            aria-label={`Remove to-do ${idx + 1}`}
          >
            <X className="size-4" />
          </Button>
        </div>
      ))}

      <div className="flex items-center gap-2 pt-1">
        <Input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              // Enter adds an item rather than submitting the whole journal.
              e.preventDefault()
              add()
            }
          }}
          placeholder="Add a to-do and press Enter…"
        />
        <Button type="button" variant="secondary" onClick={add} disabled={!draft.trim()}>
          <Plus className="size-4" />
          Add
        </Button>
      </div>
    </div>
  )
}

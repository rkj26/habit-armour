import React from 'react'
import { Label } from '@/components/shadcn/label'
import { Textarea } from '@/components/shadcn/textarea'
import { cn } from '@/lib/utils'
import { countWords } from '@/lib/useDraft'

/**
 * A reflection box with a word floor and no ceiling.
 *
 * The count is live and the remaining-words hint updates as you type, rather
 * than the old behaviour of only telling you in an alert() after you'd already
 * hit submit.
 */
export default function WordCountField({ id, label, hint, value, onChange, min = 50, rows = 6 }) {
  const words = countWords(value)
  const met = words >= min

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-baseline justify-between gap-4">
        <Label htmlFor={id}>{label}</Label>
        <span
          className={cn(
            'font-mono text-xs tabular-nums',
            met ? 'font-semibold text-emerald-600' : 'text-muted-foreground'
          )}
        >
          {met ? `${words} words ✓` : `${words}/${min}`}
        </span>
      </div>

      <Textarea
        id={id}
        rows={rows}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        aria-describedby={`${id}-hint`}
      />

      <p id={`${id}-hint`} className="text-sm text-muted-foreground">
        {met ? hint : `${min - words} more word${min - words === 1 ? '' : 's'} to go.`}
      </p>
    </div>
  )
}

import React from 'react'
import { Sunrise, ListChecks } from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/shadcn/card'

/** Read-only recap of this morning's log, shown while filling in the night forms. */
export default function MorningReferenceCard({ status }) {
  const entry = status?.entry
  if (!entry) return null

  const { morningCompleted, morningJournalCompleted, morningData, morningJournalData } = entry

  if (!morningCompleted && !morningJournalCompleted) {
    return (
      <Card className="border-dashed">
        <CardContent className="py-4">
          <p className="flex items-center gap-2 text-sm text-muted-foreground">
            <Sunrise className="size-4 shrink-0" />
            No morning log yet today. Once you fill it in, it appears here for reference.
          </p>
        </CardContent>
      </Card>
    )
  }

  const metrics = [
    ['Weight', morningData?.wakingWeight && `${morningData.wakingWeight} kg`],
    ['Sleep', morningData?.sleepHours && `${morningData.sleepHours} h`],
    ['Energy', morningData?.energyLevels && `${morningData.energyLevels}/10`],
    ['Mood', morningData?.mood && `${morningData.mood}/10`],
    ['Resting HR', morningData?.restingHR && `${morningData.restingHR} bpm`],
  ].filter(([, v]) => v)

  const todos = morningJournalData?.todos || []

  return (
    <Card className="bg-muted/30">
      <CardHeader>
        <CardTitle>This morning</CardTitle>
        <CardDescription>What you logged and committed to earlier today.</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        {metrics.length > 0 && (
          <dl className="grid grid-cols-2 gap-3 sm:grid-cols-5">
            {metrics.map(([label, value]) => (
              <div key={label}>
                <dt className="text-xs text-muted-foreground">{label}</dt>
                <dd className="font-mono text-sm font-medium tabular-nums">{value}</dd>
              </div>
            ))}
          </dl>
        )}

        {morningJournalData?.feeling && (
          <div>
            <p className="text-xs text-muted-foreground">How you felt this morning</p>
            <p className="mt-0.5 text-sm leading-snug">{morningJournalData.feeling}</p>
          </div>
        )}

        {todos.length > 0 && (
          <div>
            <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <ListChecks className="size-3.5" />
              Today&apos;s to-dos
            </p>
            <ul className="mt-1 list-inside list-disc text-sm leading-relaxed">
              {todos.map((t) => (
                <li key={t.id}>{t.text}</li>
              ))}
            </ul>
          </div>
        )}
      </CardContent>
    </Card>
  )
}

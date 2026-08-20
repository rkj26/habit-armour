import React, { useState } from 'react'
import { ChevronRight, Pencil } from 'lucide-react'
import { Badge } from '@/components/shadcn/badge'
import { Button } from '@/components/shadcn/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/shadcn/card'
import { Input } from '@/components/shadcn/input'
import { Label } from '@/components/shadcn/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/shadcn/select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/shadcn/table'
import { logicalToday } from '@/lib/logicalDay'
import { cn } from '@/lib/utils'

const WINDOWS = [
  { value: 'morning', label: 'Morning metrics' },
  { value: 'morningJournal', label: 'Morning journal' },
  { value: 'night', label: 'Night metrics' },
  { value: 'nightJournal', label: 'Night journal' },
  { value: 'weekly', label: 'Weekly specs' },
]

function StatusCell({ entryDate, type, isCompleted, config }) {
  if (isCompleted) return <Badge className="bg-emerald-600 hover:bg-emerald-600">Done</Badge>

  const today = logicalToday()
  if (entryDate > today) return <Badge variant="outline">Pending</Badge>
  if (entryDate < today) return <Badge variant="destructive">Missed</Badge>

  const hour = new Date().getHours()
  const isMorning = type.startsWith('morning')
  const start = isMorning ? (config.morningStart ?? 5) : (config.nightStart ?? 20)
  const end = isMorning ? (config.morningEnd ?? 12) : (config.nightEnd ?? 24)

  if (hour < start) return <Badge variant="outline">Pending</Badge>
  if (hour < end) return <Badge variant="secondary">Due now</Badge>
  return <Badge variant="destructive">Missed</Badge>
}

function ExpandedEntry({ entry, photoUrl, startEditingLog }) {
  const mj = entry.morningJournalData
  const nj = entry.nightJournalData
  const photos = Object.entries(entry.weeklyData?.photos || {}).filter(([, v]) => v)
  const doneIds = nj?.todosCompleted || []

  return (
    <div className="flex flex-col gap-5">
      <div className="grid gap-5 md:grid-cols-2">
        <div>
          <h4 className="mb-1.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Morning journal
          </h4>
          {mj?.feeling || mj?.todos?.length ? (
            <div className="flex flex-col gap-2 text-sm">
              {mj.feeling && <p className="leading-snug">{mj.feeling}</p>}
              {mj.todos?.length > 0 && (
                <ul className="flex flex-col gap-1">
                  {mj.todos.map((t) => (
                    <li key={t.id} className="flex items-start gap-2">
                      <span className={doneIds.includes(t.id) ? 'text-emerald-600' : 'text-muted-foreground'}>
                        {doneIds.includes(t.id) ? '✓' : '○'}
                      </span>
                      <span className={doneIds.includes(t.id) ? 'text-muted-foreground line-through' : ''}>
                        {t.text}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">Not logged.</p>
          )}
        </div>

        <div>
          <h4 className="mb-1.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Night journal
          </h4>
          {nj?.feeling || nj?.tomorrow ? (
            <div className="flex flex-col gap-2 text-sm leading-snug">
              {nj.feeling && <p>{nj.feeling}</p>}
              {nj.tomorrow && (
                <p>
                  <span className="text-muted-foreground">Tomorrow: </span>
                  {nj.tomorrow}
                </p>
              )}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">Not logged.</p>
          )}
        </div>
      </div>

      {photos.length > 0 && (
        <div>
          <h4 className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Progress photos
          </h4>
          <div className="flex flex-wrap gap-2">
            {photos.map(([pose, url]) => (
              <img key={pose} src={photoUrl(url)} alt={pose} className="h-28 rounded-md border object-cover" />
            ))}
          </div>
        </div>
      )}

      <div className="flex flex-wrap gap-2">
        {WINDOWS.map((w) => (
          <Button key={w.value} variant="outline" size="sm" onClick={() => startEditingLog(entry.date, w.value)}>
            Edit {w.label.toLowerCase()}
          </Button>
        ))}
      </div>
    </div>
  )
}

export default function HistoryView({ history, config, API_URL = '', startEditingLog }) {
  const [expanded, setExpanded] = useState({})
  const [pastDate, setPastDate] = useState('')
  const [pastWindow, setPastWindow] = useState('morning')

  const photoUrl = (url) => (!url ? '' : url.startsWith('http') ? url : `${API_URL}${url}`)
  const toggle = (date) => setExpanded((p) => ({ ...p, [date]: !p[date] }))

  return (
    <div className="flex flex-col gap-6">
      <Card>
        <CardHeader>
          <CardTitle>Log a past day</CardTitle>
          <CardDescription>Backfill a missed entry.</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap items-end gap-3">
          <div className="grid gap-2">
            <Label htmlFor="past-date">Date</Label>
            <Input
              id="past-date"
              type="date"
              max={logicalToday()}
              value={pastDate}
              onChange={(e) => setPastDate(e.target.value)}
              className="w-44"
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="past-window">Log type</Label>
            <Select value={pastWindow} onValueChange={setPastWindow}>
              <SelectTrigger id="past-window" className="w-52">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {WINDOWS.map((w) => (
                  <SelectItem key={w.value} value={w.value}>
                    {w.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <Button disabled={!pastDate} onClick={() => startEditingLog(pastDate, pastWindow)}>
            <Pencil className="size-4" />
            Start log
          </Button>
        </CardContent>
      </Card>

      {history.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-sm text-muted-foreground">
            No logs recorded yet.
          </CardContent>
        </Card>
      ) : (
        <div className="overflow-x-auto rounded-xl border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-36">Date</TableHead>
                <TableHead>Morning</TableHead>
                <TableHead>M. journal</TableHead>
                <TableHead>Night</TableHead>
                <TableHead>N. journal</TableHead>
                <TableHead className="text-right">Weight</TableHead>
                <TableHead className="text-right">Sleep</TableHead>
                <TableHead className="text-right">Calories</TableHead>
                <TableHead className="text-right">Steps</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {history.map((entry) => (
                <React.Fragment key={entry.date}>
                  <TableRow className="cursor-pointer" onClick={() => toggle(entry.date)}>
                    <TableCell className="font-medium">
                      <span className="flex items-center gap-1.5">
                        <ChevronRight
                          className={cn(
                            'size-3.5 text-muted-foreground transition-transform',
                            expanded[entry.date] && 'rotate-90'
                          )}
                        />
                        {entry.date}
                      </span>
                    </TableCell>
                    <TableCell>
                      <StatusCell entryDate={entry.date} type="morning" isCompleted={entry.morningCompleted} config={config} />
                    </TableCell>
                    <TableCell>
                      <StatusCell entryDate={entry.date} type="morningJournal" isCompleted={entry.morningJournalCompleted} config={config} />
                    </TableCell>
                    <TableCell>
                      <StatusCell entryDate={entry.date} type="night" isCompleted={entry.nightCompleted} config={config} />
                    </TableCell>
                    <TableCell>
                      <StatusCell entryDate={entry.date} type="nightJournal" isCompleted={entry.nightJournalCompleted} config={config} />
                    </TableCell>
                    <TableCell className="text-right font-mono tabular-nums">
                      {entry.morningData?.wakingWeight ? `${entry.morningData.wakingWeight} kg` : '—'}
                    </TableCell>
                    <TableCell className="text-right font-mono tabular-nums">
                      {entry.morningData?.sleepHours ? `${entry.morningData.sleepHours} h` : '—'}
                    </TableCell>
                    <TableCell className="text-right font-mono tabular-nums">
                      {entry.nightData?.calories || '—'}
                    </TableCell>
                    <TableCell className="text-right font-mono tabular-nums">
                      {entry.nightData?.steps ? Number(entry.nightData.steps).toLocaleString() : '—'}
                    </TableCell>
                  </TableRow>

                  {expanded[entry.date] && (
                    <TableRow className="hover:bg-transparent">
                      <TableCell colSpan={9} className="bg-muted/40 p-5">
                        <ExpandedEntry entry={entry} photoUrl={photoUrl} startEditingLog={startEditingLog} />
                      </TableCell>
                    </TableRow>
                  )}
                </React.Fragment>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  )
}

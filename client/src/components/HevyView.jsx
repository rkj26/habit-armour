import React, { useEffect, useState } from 'react'
import { CalendarDays, Check, Clock, Plus, TriangleAlert, Upload, X } from 'lucide-react'

import { api } from '@/api/client'
import { Alert, AlertDescription, AlertTitle } from '@/components/shadcn/alert'
import { Badge } from '@/components/shadcn/badge'
import { Button } from '@/components/shadcn/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/shadcn/card'
import { Input } from '@/components/shadcn/input'
import { Label } from '@/components/shadcn/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/shadcn/select'
import { Separator } from '@/components/shadcn/separator'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/shadcn/tabs'
import { ToggleGroup, ToggleGroupItem } from '@/components/shadcn/toggle-group'

const CARDIO_PRESETS = {
  walking: { title: 'Outdoor walk', templateId: '33EDD7DB', name: 'Walking' },
  running: { title: 'Running session', templateId: '33EDD7DB', name: 'Running' },
  elliptical: { title: 'Elliptical cardio', templateId: '3303376C', name: 'Elliptical' },
  cycling: { title: 'Cycling workout', templateId: 'D8F7F851', name: 'Cycling' },
}

function Field({ id, label, children }) {
  return (
    <div className="grid gap-2">
      <Label htmlFor={id}>{label}</Label>
      {children}
    </div>
  )
}

export default function HevyView({
  hevyStatus,
  hevyWorkouts,
  workoutsLoading,
  workoutsError,
  fetchHevyWorkouts,
}) {
  const [showCreator, setShowCreator] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [uploadError, setUploadError] = useState(null)
  const [uploadSuccess, setUploadSuccess] = useState(null)

  const [quickActivity, setQuickActivity] = useState('walking')
  const [quickDuration, setQuickDuration] = useState(30)
  const [quickTitle, setQuickTitle] = useState(CARDIO_PRESETS.walking.title)
  const [quickNotes, setQuickNotes] = useState('Logged via Habit Armour')

  const [customTitle, setCustomTitle] = useState('Gym workout session')
  const [customNotes, setCustomNotes] = useState('Pushed from Habit Armour')
  const [exercisesList, setExercisesList] = useState([
    {
      templateId: '7EB3F7C3',
      title: 'Chest Press (Machine)',
      sets: [
        { type: 'normal', weight_kg: 40, reps: 10 },
        { type: 'normal', weight_kg: 45, reps: 8 },
      ],
    },
  ])

  const [templates, setTemplates] = useState([])

  useEffect(() => {
    if (!hevyStatus?.hevyApiKeyConfigured) return
    const fetchTemplates = async () => {
      try {
        const data = await api.hevy.templates()
        setTemplates(data.exercise_templates || data || [])
      } catch (err) {
        setUploadError(err.message)
      }
    }
    fetchTemplates()
  }, [hevyStatus])

  const selectPreset = (key) => {
    if (!key) return
    setQuickActivity(key)
    setQuickTitle(CARDIO_PRESETS[key].title)
  }

  const pushWorkout = async (payload) => {
    setUploading(true)
    setUploadError(null)
    setUploadSuccess(null)
    try {
      await api.hevy.uploadWorkout(payload)
      setUploadSuccess(`Uploaded “${payload.title}” to Hevy.`)
      fetchHevyWorkouts?.()
      setTimeout(() => setUploadSuccess(null), 4000)
    } catch (err) {
      setUploadError(err.message)
    } finally {
      setUploading(false)
    }
  }

  const handleUploadQuickCardio = (e) => {
    e.preventDefault()
    const preset = CARDIO_PRESETS[quickActivity]
    const durationSec = Number(quickDuration) * 60
    const now = new Date()
    pushWorkout({
      title: quickTitle || preset.title,
      description: quickNotes,
      start_time: new Date(now.getTime() - durationSec * 1000).toISOString(),
      end_time: now.toISOString(),
      exercises: [
        {
          exercise_template_id: preset.templateId,
          notes: '',
          sets: [{ type: 'normal', duration_seconds: durationSec }],
        },
      ],
    })
  }

  const handleUploadCustomWorkout = (e) => {
    e.preventDefault()
    const now = new Date()
    pushWorkout({
      title: customTitle || 'Custom gym session',
      description: customNotes,
      start_time: new Date(now.getTime() - 45 * 60000).toISOString(),
      end_time: now.toISOString(),
      exercises: exercisesList.map((ex) => ({
        exercise_template_id: ex.templateId,
        notes: '',
        sets: ex.sets.map((s) => ({
          type: s.type || 'normal',
          weight_kg: Number(s.weight_kg) || 0,
          reps: Number(s.reps) || 0,
        })),
      })),
    })
  }

  const addExercise = () =>
    setExercisesList((prev) => [
      ...prev,
      {
        templateId: templates[0]?.id || '7EB3F7C3',
        title: templates[0]?.title || 'Chest Press (Machine)',
        sets: [{ type: 'normal', weight_kg: 30, reps: 10 }],
      },
    ])

  const removeExercise = (idx) => setExercisesList((prev) => prev.filter((_, i) => i !== idx))

  const patchExercise = (exIdx, patch) =>
    setExercisesList((prev) => prev.map((ex, i) => (i === exIdx ? { ...ex, ...patch } : ex)))

  const addSet = (exIdx) =>
    setExercisesList((prev) =>
      prev.map((ex, i) =>
        i === exIdx
          ? { ...ex, sets: [...ex.sets, { ...(ex.sets.at(-1) || { type: 'normal', weight_kg: 20, reps: 10 }) }] }
          : ex
      )
    )

  const removeSet = (exIdx, setIdx) =>
    setExercisesList((prev) =>
      prev.map((ex, i) => (i === exIdx ? { ...ex, sets: ex.sets.filter((_, j) => j !== setIdx) } : ex))
    )

  const patchSet = (exIdx, setIdx, field, val) =>
    setExercisesList((prev) =>
      prev.map((ex, i) =>
        i === exIdx
          ? { ...ex, sets: ex.sets.map((s, j) => (j === setIdx ? { ...s, [field]: val } : s)) }
          : ex
      )
    )

  if (!hevyStatus.hevyApiKeyConfigured) {
    return (
      <div className="flex flex-col gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Hevy API key not configured</CardTitle>
            <CardDescription>
              Add the key to the <code className="font-mono">.env</code> file at the project root.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            <pre className="bg-muted rounded-md border p-3 font-mono text-sm">
              HEVY_API_KEY=your_hevy_api_key
            </pre>
            <p className="text-muted-foreground text-sm">
              Generate one at <em>hevy.com/settings?developer</em> — requires Hevy Pro.
            </p>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap justify-end gap-2">
        <Button
          variant={showCreator ? 'outline' : 'default'}
          onClick={() => setShowCreator(!showCreator)}
        >
          {showCreator ? <X className="size-4" /> : <Upload className="size-4" />}
          {showCreator ? 'Close creator' : 'Upload workout'}
        </Button>
      </div>

      {uploadSuccess && (
        <Alert>
          <Check />
          <AlertTitle>{uploadSuccess}</AlertTitle>
        </Alert>
      )}
      {uploadError && (
        <Alert variant="destructive">
          <TriangleAlert />
          <AlertTitle>Upload failed</AlertTitle>
          <AlertDescription>{uploadError}</AlertDescription>
        </Alert>
      )}

      {showCreator && (
        <Card>
          <CardHeader>
            <CardTitle>Create a workout</CardTitle>
            <CardDescription>Posted to Hevy through the developer API.</CardDescription>
          </CardHeader>
          <CardContent>
            <Tabs defaultValue="quick" className="gap-6">
              <TabsList>
                <TabsTrigger value="quick">Quick cardio</TabsTrigger>
                <TabsTrigger value="custom">Custom builder</TabsTrigger>
              </TabsList>

              <TabsContent value="quick">
                <form onSubmit={handleUploadQuickCardio} className="flex flex-col gap-5">
                  <div className="grid gap-2">
                    <Label>Activity</Label>
                    <ToggleGroup
                      type="single"
                      variant="outline"
                      value={quickActivity}
                      onValueChange={selectPreset}
                      className="justify-start"
                    >
                      {Object.entries(CARDIO_PRESETS).map(([key, preset]) => (
                        <ToggleGroupItem key={key} value={key} className="px-4">
                          {preset.name}
                        </ToggleGroupItem>
                      ))}
                    </ToggleGroup>
                  </div>

                  <div className="grid gap-4 sm:grid-cols-2">
                    <Field id="quick-title" label="Workout title">
                      <Input
                        id="quick-title"
                        value={quickTitle}
                        onChange={(e) => setQuickTitle(e.target.value)}
                        required
                      />
                    </Field>
                    <Field id="quick-duration" label="Duration (minutes)">
                      <Input
                        id="quick-duration"
                        type="number"
                        min="1"
                        max="300"
                        value={quickDuration}
                        onChange={(e) => setQuickDuration(e.target.value)}
                        required
                      />
                    </Field>
                  </div>

                  <Field id="quick-notes" label="Notes">
                    <Input
                      id="quick-notes"
                      value={quickNotes}
                      onChange={(e) => setQuickNotes(e.target.value)}
                      placeholder="e.g. Incline 5%, zone 2"
                    />
                  </Field>

                  <Button type="submit" disabled={uploading} className="self-start">
                    {uploading ? 'Uploading…' : 'Push session to Hevy'}
                  </Button>
                </form>
              </TabsContent>

              <TabsContent value="custom">
                <form onSubmit={handleUploadCustomWorkout} className="flex flex-col gap-5">
                  <div className="grid gap-4 sm:grid-cols-2">
                    <Field id="custom-title" label="Workout title">
                      <Input
                        id="custom-title"
                        value={customTitle}
                        onChange={(e) => setCustomTitle(e.target.value)}
                        required
                      />
                    </Field>
                    <Field id="custom-notes" label="Notes">
                      <Input
                        id="custom-notes"
                        value={customNotes}
                        onChange={(e) => setCustomNotes(e.target.value)}
                      />
                    </Field>
                  </div>

                  <div className="flex items-center justify-between">
                    <Label>Exercises ({exercisesList.length})</Label>
                    <Button type="button" variant="outline" size="sm" onClick={addExercise}>
                      <Plus className="size-4" />
                      Add exercise
                    </Button>
                  </div>

                  {exercisesList.map((ex, exIdx) => (
                    <div key={exIdx} className="flex flex-col gap-3 rounded-lg border p-4">
                      <div className="flex items-center justify-between gap-3">
                        <Select
                          value={ex.templateId}
                          onValueChange={(id) =>
                            patchExercise(exIdx, {
                              templateId: id,
                              title: templates.find((t) => t.id === id)?.title || id,
                            })
                          }
                        >
                          <SelectTrigger className="max-w-xs">
                            <SelectValue placeholder={ex.title} />
                          </SelectTrigger>
                          <SelectContent>
                            {templates.length > 0 ? (
                              templates.map((t) => (
                                <SelectItem key={t.id} value={t.id}>
                                  {t.title}
                                </SelectItem>
                              ))
                            ) : (
                              <SelectItem value={ex.templateId}>{ex.title}</SelectItem>
                            )}
                          </SelectContent>
                        </Select>
                        {exercisesList.length > 1 && (
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            onClick={() => removeExercise(exIdx)}
                            aria-label="Remove exercise"
                          >
                            <X className="size-4" />
                          </Button>
                        )}
                      </div>

                      <Separator />

                      <div className="flex flex-col gap-2">
                        {ex.sets.map((s, setIdx) => (
                          <div key={setIdx} className="flex items-center gap-2">
                            <span className="text-muted-foreground w-12 text-sm">
                              Set {setIdx + 1}
                            </span>
                            <Input
                              type="number"
                              className="w-24"
                              min="0"
                              step="0.5"
                              placeholder="kg"
                              value={s.weight_kg}
                              onChange={(e) => patchSet(exIdx, setIdx, 'weight_kg', e.target.value)}
                            />
                            <span className="text-muted-foreground text-sm">kg ×</span>
                            <Input
                              type="number"
                              className="w-20"
                              min="0"
                              step="1"
                              placeholder="reps"
                              value={s.reps}
                              onChange={(e) => patchSet(exIdx, setIdx, 'reps', e.target.value)}
                            />
                            <span className="text-muted-foreground text-sm">reps</span>
                            {ex.sets.length > 1 && (
                              <Button
                                type="button"
                                variant="ghost"
                                size="icon"
                                className="ml-auto"
                                onClick={() => removeSet(exIdx, setIdx)}
                                aria-label="Remove set"
                              >
                                <X className="size-4" />
                              </Button>
                            )}
                          </div>
                        ))}
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="self-start"
                          onClick={() => addSet(exIdx)}
                        >
                          <Plus className="size-3" />
                          Add set
                        </Button>
                      </div>
                    </div>
                  ))}

                  <Button type="submit" disabled={uploading} className="self-start">
                    {uploading ? 'Uploading…' : 'Push workout to Hevy'}
                  </Button>
                </form>
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>
      )}

      <div className="flex flex-col gap-4">
        <h3 className="text-lg font-semibold">Recent workouts</h3>

        {workoutsLoading && (
          <p className="text-muted-foreground py-10 text-center text-sm">Syncing with Hevy…</p>
        )}

        {workoutsError && (
          <Alert variant="destructive">
            <TriangleAlert />
            <AlertTitle>Couldn&apos;t fetch workouts</AlertTitle>
            <AlertDescription>{workoutsError}</AlertDescription>
          </Alert>
        )}

        {!workoutsLoading && !workoutsError && hevyWorkouts.length === 0 && (
          <p className="text-muted-foreground py-10 text-center text-sm">
            No workouts yet. Log one in Hevy or use the creator above.
          </p>
        )}

        {!workoutsLoading && !workoutsError && hevyWorkouts.length > 0 && (
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {hevyWorkouts.map((w) => {
              const dateStr = w.start_time
                ? new Date(w.start_time).toLocaleDateString([], {
                    weekday: 'short',
                    month: 'short',
                    day: 'numeric',
                  })
                : 'Unknown date'
              const durationMins =
                w.start_time && w.end_time
                  ? Math.round((new Date(w.end_time) - new Date(w.start_time)) / 60000)
                  : null

              return (
                <Card key={w.id}>
                  <CardHeader>
                    <CardTitle>{w.title || 'Workout'}</CardTitle>
                    <CardDescription className="flex flex-wrap items-center gap-3">
                      <span className="inline-flex items-center gap-1">
                        <CalendarDays className="size-3.5" />
                        {dateStr}
                      </span>
                      {durationMins !== null && (
                        <span className="inline-flex items-center gap-1">
                          <Clock className="size-3.5" />
                          {durationMins} min
                        </span>
                      )}
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="flex flex-col gap-4">
                    {w.notes && <p className="text-muted-foreground text-sm italic">“{w.notes}”</p>}
                    {w.exercises?.map((e, eIdx) => (
                      <div key={eIdx} className="flex flex-col gap-1.5">
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-sm font-medium">{e.title}</span>
                          <Badge variant="outline" className="shrink-0">
                            {e.sets?.length || 0} sets
                          </Badge>
                        </div>
                        {e.sets?.map((s, sIdx) => {
                          const weight =
                            s.weight_kg !== null && s.weight_kg !== undefined
                              ? `${s.weight_kg} kg`
                              : s.duration_seconds
                                ? `${Math.round(s.duration_seconds / 60)} min`
                                : 'Bodyweight'
                          const reps = s.reps || (s.duration_seconds ? '' : 0)
                          return (
                            <div
                              key={sIdx}
                              className="text-muted-foreground flex justify-between text-xs tabular-nums"
                            >
                              <span>
                                Set {sIdx + 1}: {reps ? `${reps} reps` : 'Cardio'}
                              </span>
                              <span className="text-foreground font-medium">
                                {weight}
                                {s.rpe ? ` · RPE ${s.rpe}` : ''}
                              </span>
                            </div>
                          )
                        })}
                      </div>
                    ))}
                  </CardContent>
                </Card>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}

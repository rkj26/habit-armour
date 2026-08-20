import React from 'react'

import EditingBanner from './EditingBanner'
import { Button } from '@/components/shadcn/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/shadcn/card'
import { Input } from '@/components/shadcn/input'
import { Label } from '@/components/shadcn/label'
import { Slider } from '@/components/shadcn/slider'

/** Nine near-identical 1-10 sliders used to be nine copies of the same markup. */
function ScaleField({ id, label, value, onChange, min = 1, max = 10 }) {
  return (
    <div className="grid gap-2">
      <div className="flex items-baseline justify-between gap-2">
        <Label htmlFor={id}>{label}</Label>
        <span className="font-mono text-xs tabular-nums text-muted-foreground">
          {value}/{max}
        </span>
      </div>
      <Slider id={id} min={min} max={max} step={1} value={[value]} onValueChange={([v]) => onChange(v)} />
    </div>
  )
}

function TextField({ id, label, ...props }) {
  return (
    <div className="grid gap-2">
      <Label htmlFor={id}>{label}</Label>
      <Input id={id} {...props} />
    </div>
  )
}

export default function MorningForm({
  morningData,
  setMorningData,
  editingDate,
  cancelEditing,
  onSubmit,
}) {
  const set = (patch) => setMorningData({ ...morningData, ...patch })

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-6">
      <EditingBanner editingDate={editingDate} cancelEditing={cancelEditing} />

      <Card>
        <CardHeader>
          <CardTitle>Weight &amp; sleep</CardTitle>
          <CardDescription>
            Body mass, sleep duration, device score and energy. Submitting clears the morning
            lock.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-6">
          <div className="grid gap-4 sm:grid-cols-2">
            <TextField
              id="waking-weight"
              label="Waking weight (kg)"
              type="number"
              step="0.01"
              min="20"
              max="400"
              required
              placeholder="78.45"
              value={morningData.wakingWeight}
              onChange={(e) => set({ wakingWeight: e.target.value })}
            />
            <TextField
              id="sleep-hours"
              label="Sleep duration (hours)"
              type="number"
              step="0.1"
              min="0"
              max="24"
              required
              placeholder="7.5"
              value={morningData.sleepHours}
              onChange={(e) => set({ sleepHours: e.target.value })}
            />
          </div>
          <div className="grid gap-4 sm:grid-cols-3">
            <ScaleField
              id="sleep-self"
              label="Sleep quality (self)"
              value={morningData.sleepQualitySelf}
              onChange={(v) => set({ sleepQualitySelf: v })}
            />
            <TextField
              id="sleep-device"
              label="Sleep score (device)"
              type="number"
              min="0"
              max="100"
              placeholder="82"
              value={morningData.sleepQualityDevice}
              onChange={(e) => set({ sleepQualityDevice: e.target.value })}
            />
            <ScaleField
              id="energy"
              label="Energy level"
              value={morningData.energyLevels}
              onChange={(v) => set({ energyLevels: v })}
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Mood &amp; recovery</CardTitle>
          <CardDescription>Mood, stress, illness signs and muscle soreness.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          <ScaleField id="mood" label="Mood" value={morningData.mood} onChange={(v) => set({ mood: v })} />
          <ScaleField
            id="stress"
            label="Stress level"
            value={morningData.stress}
            onChange={(v) => set({ stress: v })}
          />
          <ScaleField
            id="illness"
            label="Signs of illness"
            value={morningData.illnessSigns}
            onChange={(v) => set({ illnessSigns: v })}
          />
          <ScaleField
            id="doms"
            label="Muscle soreness"
            value={morningData.muscleSoreness}
            onChange={(v) => set({ muscleSoreness: v })}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Vitals</CardTitle>
          <CardDescription>Resting heart rate and blood pressure.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <TextField
            id="resting-hr"
            label="Resting heart rate (bpm)"
            type="number"
            min="20"
            max="250"
            required
            placeholder="58"
            value={morningData.restingHR}
            onChange={(e) => set({ restingHR: e.target.value })}
          />
          <TextField
            id="blood-pressure"
            label="Blood pressure (systolic/diastolic)"
            inputMode="numeric"
            pattern="\\d{2,3}\\s*/\\s*\\d{2,3}"
            title="Two numbers separated by a slash, e.g. 118/74"
            placeholder="118/74"
            value={morningData.bloodPressure}
            onChange={(e) => set({ bloodPressure: e.target.value })}
          />
        </CardContent>
      </Card>

      <div className="flex justify-end">
        <Button type="submit" size="lg">
          Submit morning log
        </Button>
      </div>
    </form>
  )
}

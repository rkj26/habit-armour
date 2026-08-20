import React, { useState } from 'react'
import { Camera, Check, X, TriangleAlert } from 'lucide-react'
import EditingBanner from './EditingBanner'
import { compressImage } from '../utils/imageCompressor'
import { api } from '@/api/client'
import { Alert, AlertDescription, AlertTitle } from '@/components/shadcn/alert'
import { Button } from '@/components/shadcn/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/shadcn/card'
import { Checkbox } from '@/components/shadcn/checkbox'
import { Input } from '@/components/shadcn/input'
import { Label } from '@/components/shadcn/label'
import { Slider } from '@/components/shadcn/slider'
import { ToggleGroup, ToggleGroupItem } from '@/components/shadcn/toggle-group'
import { logicalToday } from '@/lib/logicalDay'
import { cn } from '@/lib/utils'

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

/** Every number in the night log is a quantity, so none of them go below zero. */
function NumField({ id, label, unit, min = '0', ...props }) {
  return (
    <div className="grid gap-2">
      <Label htmlFor={id}>
        {label}
        {unit && <span className="ml-1 font-normal text-muted-foreground">({unit})</span>}
      </Label>
      <Input id={id} type="number" min={min} {...props} />
    </div>
  )
}

/** Yes/No is a two-option choice, not a dropdown or a pair of radios. */
function YesNo({ label, value, onChange }) {
  return (
    <div className="grid gap-2">
      <Label>{label}</Label>
      <ToggleGroup
        type="single"
        value={value}
        onValueChange={(v) => v && onChange(v)}
        variant="outline"
        className="justify-start"
      >
        <ToggleGroupItem value="Yes" className="px-5">
          Yes
        </ToggleGroupItem>
        <ToggleGroupItem value="No" className="px-5">
          No
        </ToggleGroupItem>
      </ToggleGroup>
    </div>
  )
}

export default function NightForm({
  nightData,
  setNightData,
  supplementsList = ['Vitamin D3', 'Vitamin K2', 'Omega-3', 'Creatine'],
  enforceBlocker = true,
  enforceProteinShakeBlocker = true,
  editingDate,
  cancelEditing,
  onSubmit,
}) {
  const [uploading, setUploading] = useState(false)
  const [uploadError, setUploadError] = useState(null)

  const set = (patch) => setNightData({ ...nightData, ...patch })
  const shake = nightData.proteinShake || { taken: false, photoUrl: '' }
  const supplements = nightData.supplements || {}
  const missingSupps = supplementsList.filter((s) => !supplements[s])

  const toggleSupp = (name, checked) => set({ supplements: { ...supplements, [name]: checked } })

  const uploadShakePhoto = async (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    setUploadError(null)
    if (!file.type.startsWith('image/')) {
      setUploadError('Select a valid image file.')
      return
    }
    setUploading(true)
    try {
      const dataUrl = await compressImage(file, 1600, 0.8)
      const data = await api.uploadPhoto({
        date: editingDate || logicalToday(),
        pose: 'protein-shake',
        dataUrl,
      })
      set({ proteinShake: { ...shake, photoUrl: data.url } })
    } catch (err) {
      setUploadError(err.message)
    } finally {
      setUploading(false)
    }
  }

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-6">
      <EditingBanner editingDate={editingDate} cancelEditing={cancelEditing} />

      {uploadError && (
        <Alert variant="destructive">
          <TriangleAlert />
          <AlertTitle>Photo upload failed</AlertTitle>
          <AlertDescription>{uploadError}</AlertDescription>
        </Alert>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Nutrition</CardTitle>
          <CardDescription>
            Macros, water and how the food actually felt. Submitting clears the night lock.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-6">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <NumField
              id="calories"
              min="0"
              label="Calories"
              unit="kcal"
              required
              placeholder="2500"
              value={nightData.calories}
              onChange={(e) => set({ calories: e.target.value })}
            />
            <NumField
              id="protein"
              min="0"
              label="Protein"
              unit="g"
              required
              placeholder="150"
              value={nightData.protein}
              onChange={(e) => set({ protein: e.target.value })}
            />
            <NumField
              id="carbs"
              min="0"
              label="Carbs"
              unit="g"
              placeholder="250"
              value={nightData.carbs}
              onChange={(e) => set({ carbs: e.target.value })}
            />
            <NumField
              id="fats"
              min="0"
              label="Fats"
              unit="g"
              placeholder="70"
              value={nightData.fats}
              onChange={(e) => set({ fats: e.target.value })}
            />
          </div>
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            <NumField
              id="water"
              label="Water"
              unit="L"
              step="0.1"
              placeholder="3.0"
              value={nightData.waterConsumed}
              onChange={(e) => set({ waterConsumed: e.target.value })}
            />
            <ScaleField
              id="food-quality"
              label="Food quality"
              value={nightData.foodQuality}
              onChange={(v) => set({ foodQuality: v })}
            />
            <ScaleField
              id="hunger"
              label="Hunger"
              value={nightData.hunger}
              onChange={(v) => set({ hunger: v })}
            />
            <ScaleField
              id="digestive"
              label="Digestive stress"
              value={nightData.digestiveStress}
              onChange={(v) => set({ digestiveStress: v })}
            />
          </div>
          <YesNo
            label="Alcohol consumed"
            value={nightData.alcoholConsumed}
            onChange={(v) => set({ alcoholConsumed: v })}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Supplements &amp; shake</CardTitle>
          <CardDescription>
            {enforceBlocker && missingSupps.length > 0
              ? `${missingSupps.length} still to tick before this log will submit.`
              : 'All required supplements accounted for.'}
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-5">
          <div className="grid gap-3 sm:grid-cols-2">
            {supplementsList.map((name) => (
              <label
                key={name}
                className={cn(
                  'flex cursor-pointer items-center gap-3 rounded-lg border px-3 py-2.5 text-sm transition-colors',
                  supplements[name] ? 'border-emerald-600/40 bg-emerald-600/5' : 'hover:bg-accent'
                )}
              >
                <Checkbox
                  checked={Boolean(supplements[name])}
                  onCheckedChange={(v) => toggleSupp(name, v === true)}
                />
                <span className={supplements[name] ? 'text-foreground' : 'text-muted-foreground'}>
                  {name}
                </span>
              </label>
            ))}
          </div>

          <div className="rounded-lg border p-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <label className="flex cursor-pointer items-center gap-3 text-sm font-medium">
                <Checkbox
                  checked={shake.taken}
                  onCheckedChange={(v) => set({ proteinShake: { ...shake, taken: v === true } })}
                />
                Protein shake taken
              </label>

              <div className="flex items-center gap-2">
                {shake.photoUrl ? (
                  <>
                    <span className="inline-flex items-center gap-1.5 text-xs font-medium text-emerald-700">
                      <Check className="size-3.5" />
                      Proof attached
                    </span>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      onClick={() => set({ proteinShake: { ...shake, photoUrl: '' } })}
                      aria-label="Remove proof photo"
                    >
                      <X className="size-4" />
                    </Button>
                  </>
                ) : (
                  <Button type="button" variant="outline" size="sm" asChild disabled={uploading}>
                    <label className="cursor-pointer">
                      <Camera className="size-4" />
                      {uploading ? 'Uploading…' : 'Attach proof'}
                      <input type="file" accept="image/*" className="sr-only" onChange={uploadShakePhoto} />
                    </label>
                  </Button>
                )}
              </div>
            </div>

            {shake.photoUrl && (
              <img
                src={shake.photoUrl}
                alt="Protein shake proof"
                className="mt-3 max-h-40 rounded-md border object-cover"
              />
            )}

            {enforceProteinShakeBlocker && (!shake.taken || !shake.photoUrl) && (
              <p className="mt-3 text-xs text-muted-foreground">
                Both the tick and a proof photo are required to clear the night lock.
              </p>
            )}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Activity</CardTitle>
          <CardDescription>Training, cardio and steps feed the weekly activity goal.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          <YesNo
            label="Training day"
            value={nightData.trainingDay}
            onChange={(v) => set({ trainingDay: v })}
          />
          <YesNo
            label="Cardio performed"
            value={nightData.cardioPerformed}
            onChange={(v) => set({ cardioPerformed: v })}
          />
          <NumField
            id="steps"
            label="Steps"
            placeholder="13000"
            value={nightData.steps}
            onChange={(e) => set({ steps: e.target.value })}
          />
          <ScaleField
            id="strength"
            label="Strength performance"
            value={nightData.strengthPerformance}
            onChange={(v) => set({ strengthPerformance: v })}
          />
        </CardContent>
      </Card>

      <div className="flex justify-end">
        <Button type="submit" size="lg">
          Submit night log
        </Button>
      </div>
    </form>
  )
}

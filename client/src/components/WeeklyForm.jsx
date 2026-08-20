import React, { useState } from 'react'
import { Camera, TriangleAlert, X } from 'lucide-react'

import EditingBanner from './EditingBanner'
import { compressImage } from '../utils/imageCompressor'
import { api, API_URL } from '@/api/client'
import { logicalToday } from '@/lib/logicalDay'
import { Alert, AlertDescription, AlertTitle } from '@/components/shadcn/alert'
import { Badge } from '@/components/shadcn/badge'
import { Button } from '@/components/shadcn/button'
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/shadcn/card'
import { Input } from '@/components/shadcn/input'
import { Label } from '@/components/shadcn/label'
import { cn } from '@/lib/utils'

const POSES = [
  { key: 'front', label: 'Front', subtitle: 'Facing forward, arms relaxed' },
  { key: 'back', label: 'Back', subtitle: 'Facing away, arms relaxed' },
  { key: 'sideLeft', label: 'Left side', subtitle: 'Left profile' },
  { key: 'sideRight', label: 'Right side', subtitle: 'Right profile' },
]

const MEASUREMENTS = [
  { key: 'umbilical', label: 'Umbilical (waist)', placeholder: '84.5' },
  { key: 'chest', label: 'Chest', placeholder: '102.4' },
  { key: 'bicepL', label: 'Bicep (left)', placeholder: '36.2' },
  { key: 'bicepR', label: 'Bicep (right)', placeholder: '36.5' },
  { key: 'quadL', label: 'Quad (left)', placeholder: '58.1' },
  { key: 'quadR', label: 'Quad (right)', placeholder: '58.3' },
  { key: 'glutes', label: 'Glutes', placeholder: '98.2' },
]

function Field({ id, label, children }) {
  return (
    <div className="grid gap-2">
      <Label htmlFor={id}>{label}</Label>
      {children}
    </div>
  )
}

export default function WeeklyForm({
  weeklyData,
  setWeeklyData,
  photosRequired = true,
  editingDate,
  cancelEditing,
  onSubmit,
}) {
  const [uploadingPose, setUploadingPose] = useState(null)
  const [uploadError, setUploadError] = useState(null)

  const photos = weeklyData.photos || { front: '', back: '', sideLeft: '', sideRight: '' }
  const set = (patch) => setWeeklyData({ ...weeklyData, ...patch })

  const handlePhotoSelect = async (pose, e) => {
    const file = e.target.files?.[0]
    if (!file) return

    setUploadError(null)
    if (!file.type.startsWith('image/')) {
      setUploadError('Select a valid image file (JPEG, PNG or WebP).')
      return
    }

    setUploadingPose(pose)
    try {
      const dataUrl = await compressImage(file, 1600, 0.8)
      const targetDate =
        weeklyData.weekCommencing || editingDate || new Date().toISOString().split('T')[0]
      const data = await api.uploadPhoto({ date: targetDate, pose, dataUrl })
      setWeeklyData((prev) => ({ ...prev, photos: { ...(prev.photos || {}), [pose]: data.url } }))
    } catch (err) {
      setUploadError(err.message)
    } finally {
      setUploadingPose(null)
    }
  }

  const removePhoto = (pose) =>
    setWeeklyData((prev) => ({ ...prev, photos: { ...(prev.photos || {}), [pose]: '' } }))

  const uploadedCount = POSES.filter((p) => Boolean(photos[p.key])).length
  const allUploaded = uploadedCount === POSES.length

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
          <CardTitle>Baseline &amp; response</CardTitle>
          <CardDescription>
            Week commencing, starting weight, and what you changed. Due weekly to keep device
            clearance.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-3">
          <Field id="week-commencing" label="Week commencing">
            <Input
              id="week-commencing"
              type="date"
              max={logicalToday()}
              required
              value={weeklyData.weekCommencing}
              onChange={(e) => set({ weekCommencing: e.target.value })}
            />
          </Field>
          <Field id="start-weight" label="Start weight (kg)">
            <Input
              id="start-weight"
              type="number"
              step="0.01"
              min="20"
              max="400"
              required
              placeholder="79.2"
              value={weeklyData.startWeight}
              onChange={(e) => set({ startWeight: e.target.value })}
            />
          </Field>
          <Field id="response-action" label="Response action">
            <Input
              id="response-action"
              placeholder="Macro / cardio adjustments"
              value={weeklyData.responseAction}
              onChange={(e) => set({ responseAction: e.target.value })}
            />
          </Field>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Measurements (cm)</CardTitle>
          <CardDescription>Landmarks that track hypertrophy and composition shifts.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {MEASUREMENTS.map(({ key, label, placeholder }) => (
            <Field key={key} id={key} label={label}>
              <Input
                id={key}
                type="number"
                step="0.1"
                min="0"
                max="300"
                required
                placeholder={placeholder}
                value={weeklyData[key]}
                onChange={(e) => set({ [key]: e.target.value })}
              />
            </Field>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Progress photos</CardTitle>
          <CardDescription>Front, back and both sides.</CardDescription>
          {photosRequired && (
            <CardAction>
              <Badge variant={allUploaded ? 'default' : 'destructive'}>
                {allUploaded ? 'Complete' : `${uploadedCount}/4 required`}
              </Badge>
            </CardAction>
          )}
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {POSES.map((pose) => {
            const photoUrl = photos[pose.key]
            const fullUrl = photoUrl
              ? photoUrl.startsWith('http')
                ? photoUrl
                : `${API_URL}${photoUrl}`
              : ''

            return (
              <div
                key={pose.key}
                className={cn(
                  'flex min-h-45 flex-col items-center justify-center gap-3 rounded-lg border border-dashed p-4 text-center',
                  photoUrl && 'border-solid'
                )}
              >
                {photoUrl ? (
                  <>
                    <img
                      src={fullUrl}
                      alt={pose.label}
                      className="h-35 w-full rounded-md border object-cover"
                    />
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium">{pose.label}</span>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => removePhoto(pose.key)}
                      >
                        <X className="size-3" />
                        Remove
                      </Button>
                    </div>
                  </>
                ) : (
                  <>
                    <Camera className="text-muted-foreground size-7" />
                    <div>
                      <p className="text-sm font-medium">{pose.label}</p>
                      <p className="text-muted-foreground text-xs">{pose.subtitle}</p>
                    </div>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      asChild
                      disabled={uploadingPose === pose.key}
                    >
                      <label htmlFor={`photo-upload-${pose.key}`} className="cursor-pointer">
                        {uploadingPose === pose.key ? 'Uploading…' : 'Choose photo'}
                        <input
                          id={`photo-upload-${pose.key}`}
                          type="file"
                          accept="image/*"
                          className="sr-only"
                          onChange={(e) => handlePhotoSelect(pose.key, e)}
                        />
                      </label>
                    </Button>
                  </>
                )}
              </div>
            )
          })}
        </CardContent>
      </Card>

      <div className="flex justify-end">
        <Button type="submit" size="lg">
          Submit weekly specs
        </Button>
      </div>
    </form>
  )
}

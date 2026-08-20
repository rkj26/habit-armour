import React from 'react'
import { TriangleAlert } from 'lucide-react'
import { Alert, AlertDescription, AlertTitle } from '@/components/shadcn/alert'

export default function WarningBanner({ status }) {
  if (!status.isWarning) return null

  return (
    <Alert variant="destructive" className="mb-4">
      <TriangleAlert />
      <AlertTitle>Habit lock warning</AlertTitle>
      <AlertDescription>
        {status.secondsRemaining} seconds to complete your {status.window} log before the device locks.
      </AlertDescription>
    </Alert>
  )
}

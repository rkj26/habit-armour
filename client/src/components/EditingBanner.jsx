import React from 'react'
import { Pencil } from 'lucide-react'
import { Alert, AlertDescription, AlertTitle } from '@/components/shadcn/alert'
import { Button } from '@/components/shadcn/button'

/**
 * Shown when a form is editing a past day rather than logging today.
 * Every form used to repeat this as ~15 lines of inline styles, each with
 * slightly different padding and a hardcoded amber.
 */
export default function EditingBanner({ editingDate, cancelEditing }) {
  if (!editingDate) return null

  return (
    <Alert>
      <Pencil />
      <AlertTitle>Editing an existing log</AlertTitle>
      <AlertDescription>
        <span>
          Submitting will overwrite the entry for <strong>{editingDate}</strong>.
        </span>
        <Button type="button" variant="outline" size="sm" onClick={cancelEditing}>
          Cancel edit
        </Button>
      </AlertDescription>
    </Alert>
  )
}

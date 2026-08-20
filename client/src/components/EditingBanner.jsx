import React from 'react';
import { Alert, Button } from './ui';

/**
 * Shown when a form is editing a past day rather than logging today.
 * Every form repeated this banner as ~15 lines of inline styles, each with
 * slightly different padding and a hardcoded amber that no longer matched the
 * token palette.
 */
export default function EditingBanner({ editingDate, cancelEditing }) {
  if (!editingDate) return null;

  return (
    <Alert
      variant="warning"
      title="Editing an existing log"
      icon="✏️"
      onDismiss={cancelEditing}
    >
      Submitting will overwrite the entry for <strong>{editingDate}</strong>.{' '}
      <Button variant="ghost" size="sm" onClick={cancelEditing}>
        Cancel edit
      </Button>
    </Alert>
  );
}

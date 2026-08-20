import React from 'react';
import MorningReferenceCard from './MorningReferenceCard';
import EditingBanner from './EditingBanner';
import { Alert, Button, Card, Counter, Field, Stack, Textarea } from './ui';

const MIN_WORDS = 100;

export default function NightJournalForm({
  nightData,
  setNightData,
  status,
  editingDate,
  cancelEditing,
  onSubmit
}) {
  const text = nightData.journalEntry || '';
  const wordCount = text.trim() ? text.trim().split(/\s+/).length : 0;
  const isWordCountMet = wordCount >= MIN_WORDS;

  return (
    <Stack as="form" gap={5} onSubmit={onSubmit}>
      <div className="section-title">
        <h2>🌙 Evening Reflections & Retrospective</h2>
        <p style={{ margin: 'var(--space-1) 0 0 0', color: 'var(--text-secondary)' }}>
          Evening reflections and daily retrospective. Requires {MIN_WORDS} words to submit and clear the lock.
        </p>
      </div>

      <EditingBanner editingDate={editingDate} cancelEditing={cancelEditing} />

      <MorningReferenceCard status={status} />

      <Alert variant="info" icon="💡" title="Guiding retrospective prompts">
        <ol style={{ margin: 'var(--space-1) 0 0 0', paddingLeft: 'var(--space-5)' }}>
          <li>What went well today and why?</li>
          <li>What could have been executed better or differently?</li>
          <li>What is your main priority or focus for tomorrow?</li>
        </ol>
      </Alert>

      <Card>
        <Field
          label="Evening retrospective entry"
          hint={
            isWordCountMet
              ? undefined
              : `${MIN_WORDS - wordCount} more words needed before this can be submitted.`
          }
        >
          {(props) => (
            <Stack gap={2}>
              <Textarea
                required
                rows={10}
                placeholder="Write your evening reflections, achievements, lessons, and plan for tomorrow…"
                value={text}
                onChange={(e) => setNightData({ ...nightData, journalEntry: e.target.value })}
                style={{ minHeight: 220 }}
                {...props}
              />
              <Counter value={wordCount} min={MIN_WORDS} />
            </Stack>
          )}
        </Field>
      </Card>

      <Stack direction="row" justify="between" align="center">
        <span style={{ color: 'var(--text-muted)', fontSize: 'var(--text-sm)' }}>
          {isWordCountMet ? 'Ready to submit.' : 'The submit button unlocks at 100 words.'}
        </span>
        <Button type="submit" variant="primary" size="lg" disabled={!isWordCountMet}>
          🚀 Submit night journal
        </Button>
      </Stack>
    </Stack>
  );
}

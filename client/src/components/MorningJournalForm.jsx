import React from 'react';
import EditingBanner from './EditingBanner';
import { Alert, Button, Card, Counter, Field, Stack, Textarea } from './ui';

const MIN_WORDS = 100;

export default function MorningJournalForm({
  morningData,
  setMorningData,
  editingDate,
  cancelEditing,
  onSubmit
}) {
  const text = morningData.journalEntry || '';
  const wordCount = text.trim() ? text.trim().split(/\s+/).length : 0;
  const isWordCountMet = wordCount >= MIN_WORDS;

  return (
    <Stack as="form" gap={5} onSubmit={onSubmit}>
      <div className="section-title">
        <h2>📝 Morning Intentions & Journal</h2>
        <p style={{ margin: 'var(--space-1) 0 0 0', color: 'var(--text-secondary)' }}>
          Daily goals, intentions, and reflection. Requires {MIN_WORDS} words to submit and clear the lock.
        </p>
      </div>

      <EditingBanner editingDate={editingDate} cancelEditing={cancelEditing} />

      <Alert variant="info" icon="💡" title="Guiding prompts">
        <ol style={{ margin: 'var(--space-1) 0 0 0', paddingLeft: 'var(--space-5)' }}>
          <li>What are your top 3 priority goals for today?</li>
          <li>How do you want to show up energetically/emotionally today?</li>
          <li>What potential obstacles do you foresee, and how will you handle them?</li>
        </ol>
      </Alert>

      <Card>
        <Field
          label="Journal reflection entry"
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
                placeholder="Write your morning reflection, goals, and intentions here…"
                value={text}
                onChange={(e) => setMorningData({ ...morningData, journalEntry: e.target.value })}
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
          🚀 Submit morning journal
        </Button>
      </Stack>
    </Stack>
  );
}

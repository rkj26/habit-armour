import React, { useState } from 'react';

import {
  Alert,
  Badge,
  Button,
  Card,
  CardHeader,
  Counter,
  EmptyState,
  Field,
  Input,
  Select,
  Slider,
  Spinner,
  Stack,
  Textarea,
} from './index';

/**
 * Dev-only reference for every UI primitive and variant.
 *
 * This exists so the next person (or agent) adding a screen can see what
 * already exists instead of inventing an eleventh button style. If you add a
 * primitive, add it here in the same commit.
 *
 * Reachable from the sidebar as "UI Gallery" when running `npm run dev`; it is
 * not rendered in a production build.
 */
export default function Gallery() {
  const [slider, setSlider] = useState(6);
  const [words, setWords] = useState('');
  const [dismissed, setDismissed] = useState(false);

  const wordCount = words.trim().split(/\s+/).filter(Boolean).length;

  return (
    <Stack gap={6}>
      <div>
        <h2>UI Gallery</h2>
        <p style={{ color: 'var(--text-secondary)', marginTop: 'var(--space-1)' }}>
          Every primitive in <code>components/ui</code>. Dev builds only. Toggle your OS between light and
          dark appearance to check both themes.
        </p>
      </div>

      <Card>
        <CardHeader title="Button" description="variant × size, plus loading and block." />
        <Stack gap={4}>
          <Stack direction="row" gap={2} align="center">
            <Button variant="primary">Primary</Button>
            <Button variant="secondary">Secondary</Button>
            <Button variant="danger">Danger</Button>
            <Button variant="success">Success</Button>
            <Button variant="ghost">Ghost</Button>
          </Stack>
          <Stack direction="row" gap={2} align="center">
            <Button size="sm">Small</Button>
            <Button size="md">Medium</Button>
            <Button size="lg">Large</Button>
            <Button variant="primary" loading>
              Saving
            </Button>
            <Button disabled>Disabled</Button>
          </Stack>
          <Button variant="primary" block icon={<span aria-hidden="true">✓</span>}>
            Block with icon
          </Button>
        </Stack>
      </Card>

      <Card>
        <CardHeader
          title="Field"
          description="Label, hint, error and required marker. Errors set aria-invalid and aria-describedby on the control."
        />
        <Stack gap={5}>
          <Field label="Waking weight (kg)" hint="Measured before breakfast." required>
            {(props) => <Input type="number" step="0.01" placeholder="78.45" {...props} />}
          </Field>
          <Field label="Morning start hour" error="morningStart must be a valid integer">
            {(props) => <Input defaultValue="not-an-int" {...props} />}
          </Field>
          <Field label="Journal storage">
            {(props) => (
              <Select defaultValue="obsidian" {...props}>
                <option value="none">None</option>
                <option value="obsidian">Obsidian</option>
              </Select>
            )}
          </Field>
          <Field label="Sleep quality (self rated)">
            <Slider value={slider} min={1} max={10} onChange={(e) => setSlider(Number(e.target.value))} />
          </Field>
          <Field
            label="Night journal"
            hint="A minimum of 100 words is required to clear the night lock."
          >
            {(props) => (
              <>
                <Textarea
                  rows={4}
                  value={words}
                  onChange={(e) => setWords(e.target.value)}
                  placeholder="Write here to watch the counter…"
                  {...props}
                />
                <Counter value={wordCount} min={100} />
              </>
            )}
          </Field>
        </Stack>
      </Card>

      <Card>
        <CardHeader title="Alert" description="Four roles. Danger uses role=alert so it is announced." />
        <Stack gap={3}>
          <Alert variant="info" title="Heads up">
            The lock daemon polls every 1.5 seconds while a lock is active.
          </Alert>
          <Alert variant="success" title="Saved">
            Night log submitted for 2026-08-20.
          </Alert>
          <Alert variant="warning" title="Can't reach Habit Armour">
            Showing the last known state. Check that the server is running on port 3000.
          </Alert>
          {!dismissed && (
            <Alert variant="danger" title="Rejected invalid config" onDismiss={() => setDismissed(true)}>
              morningStart must be a valid integer.
            </Alert>
          )}
        </Stack>
      </Card>

      <Card>
        <CardHeader title="Badge, Spinner" />
        <Stack gap={4}>
          <Stack direction="row" gap={2} align="center">
            <Badge variant="primary">Primary</Badge>
            <Badge variant="success" dot>
              Done
            </Badge>
            <Badge variant="danger">Missed</Badge>
            <Badge variant="warning">Due now</Badge>
            <Badge variant="info">Cached</Badge>
          </Stack>
          <Stack direction="row" gap={4} align="center">
            <Spinner size="sm" />
            <Spinner size="md" />
            <Spinner size="lg" />
          </Stack>
        </Stack>
      </Card>

      <Card padding="flush">
        <EmptyState
          icon="📭"
          title="No logs recorded yet"
          description="Submit a morning or night log and it will show up here."
          action={<Button variant="primary">Log this morning</Button>}
        />
      </Card>

      <Card>
        <CardHeader title="Stack" description="gap uses the 8pt scale: 1=4px … 6=32px." />
        <Stack gap={2}>
          {[1, 2, 3, 4, 5, 6].map((g) => (
            <Stack key={g} direction="row" gap={g} align="center">
              <span style={{ width: 48, color: 'var(--text-muted)', fontSize: 'var(--text-xs)' }}>
                gap={g}
              </span>
              {[0, 1, 2].map((i) => (
                <span
                  key={i}
                  style={{
                    width: 28,
                    height: 20,
                    borderRadius: 'var(--radius-xs)',
                    background: 'var(--primary-subtle)',
                    border: '1px solid var(--border-color)',
                  }}
                />
              ))}
            </Stack>
          ))}
        </Stack>
      </Card>
    </Stack>
  );
}

import React, { useState } from 'react'
import { Plus, Save, X } from 'lucide-react'

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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/shadcn/select'
import { Switch } from '@/components/shadcn/switch'
import { ToggleGroup, ToggleGroupItem } from '@/components/shadcn/toggle-group'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/shadcn/tabs'

const DEFAULT_SUPPLEMENTS = ['Vitamin D3', 'Vitamin K2', 'Omega-3', 'Creatine']
const DEFAULT_SITES = ['myfitnesspal.com', 'gemini.google.com', 'claude.ai', 'chatgpt.com', 'arxiv.org']
const SITE_PRESETS = [...DEFAULT_SITES, 'wandb.ai']
const WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']

function Field({ id, label, hint, invalid, children }) {
  return (
    <div className="grid gap-2">
      <Label htmlFor={id}>{label}</Label>
      {children}
      {hint && (
        <p className={cn('text-xs', invalid ? 'text-destructive' : 'text-muted-foreground')}>{hint}</p>
      )}
    </div>
  )
}

/**
 * Hours were nine bare 0-23 number boxes. You think about these in clock time,
 * so they render as clock time; the stored value is still the integer hour.
 */
function HourField({ name, label, hint, value, fallback, onChange, includeMidnightEnd = false }) {
  const hours = Array.from({ length: includeMidnightEnd ? 25 : 24 }, (_, h) => h)
  return (
    <Field id={name} label={label} hint={hint}>
      <Select
        value={String(value !== undefined ? value : fallback)}
        onValueChange={(v) => onChange({ target: { name, type: 'number', value: v } })}
      >
        <SelectTrigger id={name} className="w-full">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {hours.map((h) => (
            <SelectItem key={h} value={String(h)}>
              {h === 24 ? '24:00 (midnight)' : `${String(h).padStart(2, '0')}:00`}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </Field>
  )
}

function NumField({ name, label, hint, value, fallback, onChange, ...props }) {
  return (
    <Field id={name} label={label} hint={hint}>
      <Input
        id={name}
        name={name}
        type="number"
        value={value !== undefined ? value : fallback}
        onChange={onChange}
        {...props}
      />
    </Field>
  )
}

function TextField({ name, label, hint, value, onChange, ...props }) {
  return (
    <Field id={name} label={label} hint={hint} invalid={props['aria-invalid']}>
      <Input id={name} name={name} value={value} onChange={onChange} {...props} />
    </Field>
  )
}

/** Switch reports a boolean, so it is adapted to the change-event shape config state expects. */
function SwitchRow({ name, label, description, checked, onChange }) {
  return (
    <div className="flex items-start justify-between gap-4 rounded-lg border p-4">
      <div className="grid gap-1">
        <Label htmlFor={name} className="cursor-pointer">
          {label}
        </Label>
        {description && <p className="text-muted-foreground text-xs">{description}</p>}
      </div>
      <Switch
        id={name}
        checked={checked}
        onCheckedChange={(v) => onChange({ target: { name, type: 'checkbox', checked: v } })}
      />
    </div>
  )
}

function ChipList({ items, onRemove, empty }) {
  if (items.length === 0) {
    return <p className="text-muted-foreground text-sm italic">{empty}</p>
  }
  return (
    <div className="flex flex-wrap gap-2">
      {items.map((item) => (
        <Badge key={item} variant="secondary" className="gap-1 pr-1 pl-2.5 font-normal">
          {item}
          <button
            type="button"
            onClick={() => onRemove(item)}
            title={`Remove ${item}`}
            className="hover:bg-background/80 rounded-full p-0.5"
          >
            <X className="size-3" />
          </button>
        </Badge>
      ))}
    </div>
  )
}

function AddForm({ onSubmit, value, setValue, placeholder, cta }) {
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault()
        onSubmit(value)
        setValue('')
      }}
      className="flex max-w-md gap-2"
    >
      <Input placeholder={placeholder} value={value} onChange={(e) => setValue(e.target.value)} />
      <Button type="submit" variant="secondary" className="shrink-0">
        <Plus className="size-4" />
        {cta}
      </Button>
    </form>
  )
}

export default function SettingsView({ config, handleConfigChange, saveConfig }) {
  const [newSupp, setNewSupp] = useState('')
  const [newDeck, setNewDeck] = useState('')
  const [newSite, setNewSite] = useState('')

  const suppList = config.supplementsList || DEFAULT_SUPPLEMENTS
  const ignoredDecks = Array.isArray(config.ankiIgnoredDecks) ? config.ankiIgnoredDecks : []
  const allowedSites = Array.isArray(config.allowedWebsites) ? config.allowedWebsites : DEFAULT_SITES

  const setList = (name, value) => handleConfigChange({ target: { name, value } })

  const addTo = (name, list, raw, normalise = (s) => s.trim()) => {
    const item = normalise(raw || '')
    if (!item || list.includes(item)) return
    setList(name, [...list, item])
  }
  const removeFrom = (name, list, item) => setList(name, list.filter((x) => x !== item))

  const syncsToObsidian = config.journalStorage === 'obsidian' || config.journalStorage === 'both'
  const vaultPathMissing = syncsToObsidian && !(config.obsidianVaultPath || '').trim()

  const normaliseDomain = (s) =>
    s.trim().toLowerCase().replace(/^https?:\/\//, '').replace(/\/.*$/, '')

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap justify-end gap-2">
        <Button onClick={saveConfig}>
          <Save className="size-4" />
          Save configuration
        </Button>
      </div>

      <Tabs defaultValue="locks" className="gap-6">
        <TabsList>
          <TabsTrigger value="locks">Locks</TabsTrigger>
          <TabsTrigger value="learning">Learning</TabsTrigger>
          <TabsTrigger value="nutrition">Nutrition</TabsTrigger>
          <TabsTrigger value="integrations">Integrations</TabsTrigger>
          <TabsTrigger value="targets">Targets</TabsTrigger>
        </TabsList>

        <TabsContent value="locks" className="flex flex-col gap-6">
          <Card>
            <CardHeader>
              <CardTitle>Lock windows</CardTitle>
              <CardDescription>
                Hours the logs are due. Inside a window an unfinished log starts a grace countdown,
                then locks the Mac.
              </CardDescription>
            </CardHeader>
            <CardContent className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
              <div className="grid grid-cols-2 gap-3">
                <HourField
                    name="morningStart"
                    label="Morning start"
                    value={config.morningStart}
                    fallback={5}
                    onChange={handleConfigChange}
                  />
                <HourField
                    name="morningEnd"
                    label="Morning end"
                    value={config.morningEnd}
                    fallback={12}
                    onChange={handleConfigChange}
                  />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <HourField
                    name="nightStart"
                    label="Night start"
                    value={config.nightStart}
                    fallback={20}
                    onChange={handleConfigChange}
                  />
                <HourField
                    name="nightEnd"
                    label="Night end"
                    value={config.nightEnd}
                    fallback={24}
                    onChange={handleConfigChange}
                    includeMidnightEnd
                  />
              </div>
              <NumField
                name="gracePeriodSec"
                label="Grace period (seconds)"
                hint="Warning countdown before the device locks."
                value={config.gracePeriodSec}
                fallback={120}
                onChange={handleConfigChange}
                min="10"
                max="600"
              />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Weekly check-in lock</CardTitle>
              <CardDescription>When the weekly review and progress photos fall due.</CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-4">
              <SwitchRow
                name="weeklyLockEnabled"
                label="Enforce the weekly spec lock"
                checked={config.weeklyLockEnabled !== false}
                onChange={handleConfigChange}
              />
              <SwitchRow
                name="weeklyPhotosRequired"
                label="Require progress photos"
                description="Front, back and both sides must be attached to clear the lock."
                checked={config.weeklyPhotosRequired !== false}
                onChange={handleConfigChange}
              />
              {config.weeklyLockEnabled !== false && (
                <div className="grid gap-4 sm:grid-cols-3">
                  <Field id="weeklyLockDay" label="Lock day" hint="Day the specs are due.">
                    <Select
                      value={String(config.weeklyLockDay ?? 0)}
                      onValueChange={(v) => setList('weeklyLockDay', parseInt(v, 10))}
                    >
                      <SelectTrigger id="weeklyLockDay" className="w-full">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {WEEKDAYS.map((day, i) => (
                          <SelectItem key={day} value={String(i)}>
                            {day}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </Field>
                  <HourField
                    name="weeklyLockStartHour"
                    label="Start hour"
                    value={config.weeklyLockStartHour}
                    fallback={0}
                    onChange={handleConfigChange}
                  />
                  <HourField
                    name="weeklyLockEndHour"
                    label="End hour"
                    value={config.weeklyLockEndHour}
                    fallback={24}
                    onChange={handleConfigChange}
                    includeMidnightEnd
                  />
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Gym lock</CardTitle>
              <CardDescription>Verified against Hevy workouts and step count.</CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-4">
              <SwitchRow
                name="gymLockEnabled"
                label="Enforce the gym lock"
                checked={Boolean(config.gymLockEnabled)}
                onChange={handleConfigChange}
              />
              {config.gymLockEnabled && (
                <>
                  <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                    <HourField
                    name="gymLockStartHour"
                    label="Lock start hour"
                    hint="Locks at this hour if the day is still inactive."
                    value={config.gymLockStartHour}
                    fallback={21}
                    onChange={handleConfigChange}
                  />
                    <NumField
                      name="gymMinDurationMinutes"
                      label="Min workout minutes"
                      hint="Shorter workouts fail verification."
                      value={config.gymMinDurationMinutes}
                      fallback={30}
                      onChange={handleConfigChange}
                      min="1"
                    />
                    <Field
                      id="gymWeeklyGoal"
                      label="Weekly active days"
                      hint="Once hit, the rest of the week is unlocked."
                    >
                      <ToggleGroup
                        type="single"
                        variant="outline"
                        value={String(config.gymWeeklyGoal ?? 5)}
                        onValueChange={(v) => v && setList('gymWeeklyGoal', Number(v))}
                        className="justify-start"
                      >
                        {[1, 2, 3, 4, 5, 6, 7].map((d) => (
                          <ToggleGroupItem key={d} value={String(d)} className="px-3">
                            {d}
                          </ToggleGroupItem>
                        ))}
                      </ToggleGroup>
                    </Field>
                    <NumField
                      name="gymMinSteps"
                      label="Min steps for an active day"
                      hint="Counts when no gym or cardio was logged."
                      value={config.gymMinSteps}
                      fallback={13000}
                      onChange={handleConfigChange}
                      min="1000"
                      step="500"
                    />
                  </div>
                  <SwitchRow
                    name="gymRequireNoConsecutiveRestDays"
                    label="Block two rest days in a row"
                    description="A rest day after a rest day locks the device regardless of the weekly goal."
                    checked={config.gymRequireNoConsecutiveRestDays !== false}
                    onChange={handleConfigChange}
                  />
                </>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="learning" className="flex flex-col gap-6">
          <Card>
            <CardHeader>
              <CardTitle>Anki flashcards</CardTitle>
              <CardDescription>
                Checked over AnkiConnect. Any active deck with cards due at the cutoff locks the Mac.
              </CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-4">
              <SwitchRow
                name="ankiLockEnabled"
                label="Enforce daily deck clearance"
                checked={config.ankiLockEnabled !== false}
                onChange={handleConfigChange}
              />
              {config.ankiLockEnabled !== false && (
                <>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <HourField
                    name="ankiLockStartHour"
                    label="Cutoff hour"
                    value={config.ankiLockStartHour}
                    fallback={21}
                    onChange={handleConfigChange}
                  />
                    <TextField
                      name="ankiConnectUrl"
                      type="url"
                      label="AnkiConnect endpoint"
                      hint="Local JSON-RPC endpoint of the Anki desktop app."
                      value={config.ankiConnectUrl || 'http://localhost:8765'}
                      onChange={handleConfigChange}
                      placeholder="http://localhost:8765"
                    />
                  </div>
                  <div className="grid gap-3">
                    <Label>Ignored decks ({ignoredDecks.length})</Label>
                    <ChipList
                      items={ignoredDecks}
                      onRemove={(d) => removeFrom('ankiIgnoredDecks', ignoredDecks, d)}
                      empty="No decks ignored — every deck must be clear."
                    />
                    <AddForm
                      value={newDeck}
                      setValue={setNewDeck}
                      placeholder="Deck name to ignore (e.g. Archive)"
                      cta="Ignore deck"
                      onSubmit={(v) => addTo('ankiIgnoredDecks', ignoredDecks, v)}
                    />
                  </div>
                </>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Consistent practice</CardTitle>
              <CardDescription>
                Daily active recall on derivations, proofs and papers, scheduled by FSRS.
              </CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-4">
              <SwitchRow
                name="practiceLockEnabled"
                label="Enforce the practice lock"
                checked={config.practiceLockEnabled !== false}
                onChange={handleConfigChange}
              />
              {config.practiceLockEnabled !== false && (
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                  <HourField
                    name="practiceLockStartHour"
                    label="Cutoff hour"
                    value={config.practiceLockStartHour}
                    fallback={21}
                    onChange={handleConfigChange}
                  />
                  <NumField
                    name="practiceMinDueToUnlock"
                    label="Min proofs to unlock"
                    hint="0 clears the whole due queue; 1 needs a single session."
                    value={config.practiceMinDueToUnlock}
                    fallback={1}
                    onChange={handleConfigChange}
                    min="0"
                    max="10"
                  />
                  <NumField
                    name="practiceNewCardsPerDay"
                    label="New topics per day"
                    hint="Brand-new ladders introduced daily."
                    value={config.practiceNewCardsPerDay}
                    fallback={1}
                    onChange={handleConfigChange}
                    min="0"
                    max="10"
                  />
                  <NumField
                    name="practiceReviewTopicsPerDay"
                    label="Review topics per day"
                    hint="Started topics resurfaced, most overdue first."
                    value={config.practiceReviewTopicsPerDay}
                    fallback={1}
                    onChange={handleConfigChange}
                    min="0"
                    max="10"
                  />
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="nutrition" className="flex flex-col gap-6">
          <Card>
            <CardHeader>
              <CardTitle>Supplement stack</CardTitle>
              <CardDescription>
                With enforcement on, every item here must be ticked before the night log submits.
              </CardDescription>
              <CardAction>
                <Badge variant="outline">{suppList.length} configured</Badge>
              </CardAction>
            </CardHeader>
            <CardContent className="flex flex-col gap-4">
              <SwitchRow
                name="enforceSupplementsBlocker"
                label="Supplements block the night log"
                description="All items must be checked to clear the evening lock."
                checked={config.enforceSupplementsBlocker !== false}
                onChange={handleConfigChange}
              />
              <SwitchRow
                name="enforceProteinShakeBlocker"
                label="Protein shake needs a proof photo"
                description="The tick alone will not clear the lock."
                checked={config.enforceProteinShakeBlocker !== false}
                onChange={handleConfigChange}
              />
              <ChipList
                items={suppList}
                onRemove={(s) => removeFrom('supplementsList', suppList, s)}
                empty="No supplements configured."
              />
              <AddForm
                value={newSupp}
                setValue={setNewSupp}
                placeholder="Add a supplement (e.g. Magnesium)"
                cta="Add"
                onSubmit={(v) => addTo('supplementsList', suppList, v)}
              />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="integrations" className="flex flex-col gap-6">
          <Card>
            <CardHeader>
              <CardTitle>Allowed websites</CardTitle>
              <CardDescription>
                Sites that stay reachable while the lock is active — calorie logging, AI assistants,
                papers.
              </CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-4">
              <ChipList
                items={allowedSites}
                onRemove={(s) => removeFrom('allowedWebsites', allowedSites, s)}
                empty="Nothing allowed — a lock blocks every site."
              />
              <AddForm
                value={newSite}
                setValue={setNewSite}
                placeholder="Add a domain (e.g. myfitnesspal.com)"
                cta="Add domain"
                onSubmit={(v) => addTo('allowedWebsites', allowedSites, v, normaliseDomain)}
              />
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-muted-foreground text-xs">Presets</span>
                {SITE_PRESETS.map((preset) => (
                  <Button
                    key={preset}
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={allowedSites.includes(preset)}
                    onClick={() => addTo('allowedWebsites', allowedSites, preset, normaliseDomain)}
                  >
                    <Plus className="size-3" />
                    {preset}
                  </Button>
                ))}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Journal sync</CardTitle>
              <CardDescription>Mirror journal entries into Obsidian, a Google Doc, or both.</CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-4">
              <Field id="journalStorage" label="Storage target">
                <Select
                  value={config.journalStorage || 'none'}
                  onValueChange={(v) => setList('journalStorage', v)}
                >
                  <SelectTrigger id="journalStorage" className="w-full max-w-sm">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Disabled</SelectItem>
                    <SelectItem value="obsidian">Local Obsidian vault</SelectItem>
                    <SelectItem value="gdoc">Google Doc</SelectItem>
                    <SelectItem value="both">Both</SelectItem>
                  </SelectContent>
                </Select>
              </Field>

              {(config.journalStorage === 'obsidian' || config.journalStorage === 'both') && (
                <div className="grid gap-4 sm:grid-cols-2">
                  <TextField
                    name="obsidianVaultPath"
                    label="Vault path"
                    hint={
                      vaultPathMissing
                        ? 'Required while Obsidian sync is on — journals have nowhere to go.'
                        : 'Absolute path to the vault root.'
                    }
                    value={config.obsidianVaultPath || ''}
                    onChange={handleConfigChange}
                    placeholder="/Users/you/Documents/Obsidian"
                    aria-invalid={vaultPathMissing}
                  />
                  <TextField
                    name="obsidianJournalFolder"
                    label="Journal subfolder"
                    hint="Leave empty to write to the vault root."
                    value={config.obsidianJournalFolder || ''}
                    onChange={handleConfigChange}
                    placeholder="Journal"
                  />
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="targets">
          <Card>
            <CardHeader>
              <CardTitle>Personal targets</CardTitle>
              <CardDescription>Drawn as goal lines on the analytics charts.</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <NumField
                name="targetWeight"
                label="Target weight (kg)"
                value={config.targetWeight}
                fallback={75}
                onChange={handleConfigChange}
                step="0.1"
              />
              <NumField
                name="targetProtein"
                label="Target protein (g)"
                value={config.targetProtein}
                fallback={150}
                onChange={handleConfigChange}
              />
              <NumField
                name="targetSteps"
                label="Target steps"
                value={config.targetSteps}
                fallback={10000}
                onChange={handleConfigChange}
              />
              <NumField
                name="targetCalories"
                label="Target calories (kcal)"
                value={config.targetCalories}
                fallback={2500}
                onChange={handleConfigChange}
              />
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <div className="flex justify-end">
        <Button size="lg" onClick={saveConfig}>
          <Save className="size-4" />
          Save configuration
        </Button>
      </div>
    </div>
  )
}

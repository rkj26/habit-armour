import React from 'react'
import { Lightbulb, Target } from 'lucide-react'

import { Badge } from '@/components/shadcn/badge'
import { Button } from '@/components/shadcn/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/shadcn/dialog'
import { Input } from '@/components/shadcn/input'
import { Label } from '@/components/shadcn/label'
import { RadioGroup, RadioGroupItem } from '@/components/shadcn/radio-group'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/shadcn/select'
import { Separator } from '@/components/shadcn/separator'
import { Textarea } from '@/components/shadcn/textarea'
import { Prompt } from './bits'

function Field({ id, label, children }) {
  return (
    <div className="grid gap-2">
      <Label htmlFor={id}>{label}</Label>
      {children}
    </div>
  )
}

export function ItemModal({
  show,
  onClose,
  onSubmit,
  isEditing,
  itemFormType,
  setItemFormType,
  itemFormTitle,
  setItemFormTitle,
  itemFormTags,
  setItemFormTags,
  itemFormNotes,
  setItemFormNotes,
  paperArxivId,
  setPaperArxivId,
  paperAuthors,
  setPaperAuthors,
  paperYear,
  setPaperYear,
  savingItem,
}) {
  return (
    <Dialog open={show} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-lg">
        <form onSubmit={onSubmit} className="flex flex-col gap-4">
          <DialogHeader>
            <DialogTitle>{isEditing ? 'Edit item' : 'Add topic or paper'}</DialogTitle>
            <DialogDescription>
              Questions attach to an item. FSRS schedules each question on its own.
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-2">
            <Label>Type</Label>
            <RadioGroup
              value={itemFormType}
              onValueChange={setItemFormType}
              className="flex flex-wrap gap-4"
            >
              <Label className="font-normal">
                <RadioGroupItem value="topic" />
                Theory topic
              </Label>
              <Label className="font-normal">
                <RadioGroupItem value="paper" />
                Landmark paper
              </Label>
            </RadioGroup>
          </div>

          <Field id="item-title" label="Title">
            <Input
              id="item-title"
              required
              placeholder="e.g. Proximal Policy Optimization"
              value={itemFormTitle}
              onChange={(e) => setItemFormTitle(e.target.value)}
            />
          </Field>

          <Field id="item-tags" label="Tags (comma separated)">
            <Input
              id="item-tags"
              placeholder="RL, Policy Gradients, Actor-Critic"
              value={itemFormTags}
              onChange={(e) => setItemFormTags(e.target.value)}
            />
          </Field>

          <Field id="item-notes" label="Core focus">
            <Textarea
              id="item-notes"
              rows={3}
              placeholder="Key mechanisms, equations or theorems to master…"
              value={itemFormNotes}
              onChange={(e) => setItemFormNotes(e.target.value)}
            />
          </Field>

          {itemFormType === 'paper' && (
            <>
              <Separator />
              <Field id="paper-arxiv" label="arXiv ID">
                <Input
                  id="paper-arxiv"
                  placeholder="1707.06347"
                  value={paperArxivId}
                  onChange={(e) => setPaperArxivId(e.target.value)}
                />
              </Field>
              <div className="grid grid-cols-[1fr_100px] gap-3">
                <Field id="paper-authors" label="Authors">
                  <Input
                    id="paper-authors"
                    placeholder="Schulman et al."
                    value={paperAuthors}
                    onChange={(e) => setPaperAuthors(e.target.value)}
                  />
                </Field>
                <Field id="paper-year" label="Year">
                  <Input
                    id="paper-year"
                    type="number"
                    min="1900"
                    max="2100"
                    value={paperYear}
                    onChange={(e) => setPaperYear(e.target.value)}
                  />
                </Field>
              </div>
            </>
          )}

          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={savingItem}>
              {savingItem ? 'Saving…' : 'Save item'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

export function QuestionModal({
  show,
  onClose,
  onSubmit,
  items,
  questionItemId,
  setQuestionItemId,
  questionPrompt,
  setQuestionPrompt,
  questionTemplate,
  setQuestionTemplate,
  questionDifficulty,
  setQuestionDifficulty,
  savingQuestion,
}) {
  return (
    <Dialog open={show} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-lg">
        <form onSubmit={onSubmit} className="flex flex-col gap-4">
          <DialogHeader>
            <DialogTitle>Add recall question</DialogTitle>
            <DialogDescription>
              A single prompt you can answer in one to two minutes.
            </DialogDescription>
          </DialogHeader>

          <Field id="question-item" label="Topic or paper">
            <Select value={questionItemId} onValueChange={setQuestionItemId}>
              <SelectTrigger id="question-item" className="w-full">
                <SelectValue placeholder="Choose an item" />
              </SelectTrigger>
              <SelectContent>
                {items.map((item) => (
                  <SelectItem key={item.id} value={item.id}>
                    {item.title}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>

          <Field id="question-prompt" label="Prompt">
            <Textarea
              id="question-prompt"
              rows={4}
              required
              placeholder="State the single derivation, tensor trace or mechanism to recall…"
              value={questionPrompt}
              onChange={(e) => setQuestionPrompt(e.target.value)}
            />
          </Field>

          <div className="grid gap-4 sm:grid-cols-2">
            <Field id="question-template" label="Answer template">
              <Select value={questionTemplate} onValueChange={setQuestionTemplate}>
                <SelectTrigger id="question-template" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="topic">Proof + intuition + ELI5</SelectItem>
                  <SelectItem value="paper">Claims + method + results + limits</SelectItem>
                </SelectContent>
              </Select>
            </Field>
            <Field id="question-difficulty" label="Difficulty">
              <Select value={questionDifficulty} onValueChange={setQuestionDifficulty}>
                <SelectTrigger id="question-difficulty" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Easy">Easy</SelectItem>
                  <SelectItem value="Medium">Medium</SelectItem>
                  <SelectItem value="Hard">Hard</SelectItem>
                </SelectContent>
              </Select>
            </Field>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={savingQuestion}>
              {savingQuestion ? 'Creating…' : 'Create question'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

export function ManualOverrideModal({
  show,
  onClose,
  onSubmit,
  overrideReason,
  setOverrideReason,
  submittingOverride,
}) {
  return (
    <Dialog open={show} onOpenChange={(open) => !open && onClose()}>
      <DialogContent>
        <form onSubmit={onSubmit} className="flex flex-col gap-4">
          <DialogHeader>
            <DialogTitle>Manual practice override</DialogTitle>
            <DialogDescription>
              Clears today&apos;s practice requirement without an in-app proof.
            </DialogDescription>
          </DialogHeader>

          <Field id="practice-override-reason" label="Reason">
            <Input
              id="practice-override-reason"
              required
              value={overrideReason}
              onChange={(e) => setOverrideReason(e.target.value)}
            />
          </Field>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={submittingOverride}>
              {submittingOverride ? 'Submitting…' : 'Confirm override'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

const GRADE_LABELS = { 4: 'Easy', 3: 'Good', 2: 'Hard', 1: 'Again' }

export function AttemptHistoryModal({ historyItem, onClose, loadingHistory, historyAttempts }) {
  return (
    <Dialog open={Boolean(historyItem)} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle>Attempt history</DialogTitle>
          <DialogDescription>{historyItem?.title}</DialogDescription>
        </DialogHeader>

        {loadingHistory ? (
          <p className="text-muted-foreground py-8 text-center text-sm">Loading evaluations…</p>
        ) : historyAttempts.length === 0 ? (
          <p className="text-muted-foreground py-8 text-center text-sm">
            No attempts recorded for this item yet.
          </p>
        ) : (
          <div className="flex flex-col gap-4">
            {historyAttempts.map((att) => (
              <div key={att.id} className="flex flex-col gap-3 rounded-lg border p-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="text-muted-foreground text-xs">
                    {new Date(att.submittedAt).toLocaleString()}
                  </span>
                  <div className="flex items-center gap-2">
                    {att.evaluation?.grade && (
                      <Badge variant="outline">
                        Grade {att.evaluation.grade} · {GRADE_LABELS[att.evaluation.grade]}
                      </Badge>
                    )}
                    <Badge variant={att.evaluation?.score >= 7 ? 'default' : 'secondary'}>
                      {att.evaluation?.score ?? 'N/A'} / 10
                    </Badge>
                  </div>
                </div>

                {att.evaluation?.keyImprovements?.length > 0 && (
                  <div className="bg-muted/50 flex flex-col gap-1.5 rounded-md p-3">
                    <span className="flex items-center gap-1.5 text-xs font-semibold">
                      <Lightbulb className="size-3.5" />
                      Key improvements
                    </span>
                    <ul className="list-disc space-y-0.5 pl-5 text-sm">
                      {att.evaluation.keyImprovements.map((imp, idx) => (
                        <li key={idx}>{imp}</li>
                      ))}
                    </ul>
                  </div>
                )}

                {att.evaluation?.idealAnswer && (
                  <div className="bg-muted/50 flex flex-col gap-1.5 rounded-md p-3">
                    <span className="flex items-center gap-1.5 text-xs font-semibold">
                      <Target className="size-3.5" />
                      Model answer
                    </span>
                    <Prompt>{att.evaluation.idealAnswer}</Prompt>
                  </div>
                )}

                <Separator />

                <div className="flex flex-col gap-1.5">
                  <span className="text-muted-foreground text-xs font-semibold uppercase">
                    Reviewer critique
                  </span>
                  <Prompt>{att.evaluation?.critique}</Prompt>
                </div>
              </div>
            ))}
          </div>
        )}

        <DialogFooter>
          <Button onClick={onClose}>Close</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

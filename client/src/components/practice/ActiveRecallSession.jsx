import React from 'react'
import { Camera, Clock, Key, TriangleAlert } from 'lucide-react'

import { Badge } from '@/components/shadcn/badge'
import { Button } from '@/components/shadcn/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/shadcn/dialog'
import { Label } from '@/components/shadcn/label'
import { Separator } from '@/components/shadcn/separator'
import { Textarea } from '@/components/shadcn/textarea'
import { DifficultyBadge, Prompt, TypeBadge } from './bits'

const GRADES = {
  4: 'Mastered',
  3: 'Good',
  2: 'Hard',
  1: 'Lapse',
}

function SectionLabel({ children, tone }) {
  return (
    <span
      className={
        tone === 'danger'
          ? 'text-destructive text-xs font-semibold tracking-wide uppercase'
          : 'text-muted-foreground text-xs font-semibold tracking-wide uppercase'
      }
    >
      {children}
    </span>
  )
}

export default function ActiveRecallSession({
  activeQuestion,
  onClose,
  answerMarkdown,
  setAnswerMarkdown,
  isSubmittingAttempt,
  evaluationResult,
  imageUploading,
  fileInputRef,
  handleImageUpload,
  handleSubmitAttempt,
  fetchModelSolution,
  activeModelSolution,
  loadingModelSolution,
  practiceTimer,
}) {
  if (!activeQuestion) return null

  const evaluation = evaluationResult?.evaluation

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-5xl">
        <DialogHeader>
          <div className="flex flex-wrap items-center gap-2">
            <TypeBadge type={activeQuestion.itemType} />
            <DifficultyBadge difficulty={activeQuestion.difficulty} />
            <Badge variant="outline" className="gap-1 tabular-nums">
              <Clock className="size-3" />
              {practiceTimer}s
            </Badge>
            {activeQuestion.hasModelSolution && (
              <Badge variant="outline" className="font-normal">
                Key saved
              </Badge>
            )}
          </div>
          <DialogTitle>{activeQuestion.itemTitle}</DialogTitle>
          <DialogDescription>Active recall — answer from memory before checking.</DialogDescription>
        </DialogHeader>

        <div className="bg-muted/40 rounded-lg border p-4">
          <SectionLabel>Prompt</SectionLabel>
          <Prompt className="mt-2">{activeQuestion.prompt}</Prompt>
        </div>

        {evaluation && (
          <div className="flex flex-col gap-4 rounded-lg border p-5">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <SectionLabel>Evaluation</SectionLabel>
                <div className="mt-1 flex items-baseline gap-2">
                  <span className="text-3xl font-bold tabular-nums">{evaluation.score}</span>
                  <span className="text-muted-foreground text-sm">/ 10</span>
                  <Badge variant={evaluation.grade >= 3 ? 'default' : 'secondary'}>
                    {GRADES[evaluation.grade] || 'Graded'}
                  </Badge>
                </div>
              </div>

              {evaluationResult.fsrs && (
                <div className="rounded-md border px-3 py-2 text-right">
                  <SectionLabel>Next review</SectionLabel>
                  <p className="text-sm font-medium">
                    {evaluationResult.fsrs.dueDate} · {evaluationResult.fsrs.intervalDays}d
                  </p>
                  <p className="text-muted-foreground text-xs">
                    Stability {evaluationResult.fsrs.stability}d · D{' '}
                    {evaluationResult.fsrs.fsrsDifficulty}
                  </p>
                </div>
              )}
            </div>

            {evaluation.rubric && Object.keys(evaluation.rubric).length > 0 && (
              <>
                <Separator />
                <div className="flex flex-col gap-2">
                  <SectionLabel>Rubric</SectionLabel>
                  <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                    {Object.entries(evaluation.rubric).map(([category, item]) => (
                      <div key={category} className="flex flex-col gap-1 rounded-md border p-3">
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-sm font-medium capitalize">{category}</span>
                          <Badge variant="outline" className="tabular-nums">
                            {item.score}/10
                          </Badge>
                        </div>
                        <p className="text-muted-foreground text-xs">{item.feedback}</p>
                      </div>
                    ))}
                  </div>
                </div>
              </>
            )}

            {evaluation.critique && (
              <div className="flex flex-col gap-2">
                <SectionLabel>Critique</SectionLabel>
                <Prompt>{evaluation.critique}</Prompt>
              </div>
            )}

            {evaluation.flaggedIssues?.length > 0 && (
              <div className="flex flex-col gap-2">
                <SectionLabel tone="danger">Flagged issues</SectionLabel>
                {evaluation.flaggedIssues.map((flag, idx) => (
                  <div key={idx} className="border-destructive/30 rounded-md border p-3 text-sm">
                    <p className="text-destructive flex items-center gap-1.5 font-medium">
                      <TriangleAlert className="size-3.5" />
                      [{flag.type}] “{flag.quote}”
                    </p>
                    <p className="text-muted-foreground mt-1">{flag.note}</p>
                  </div>
                ))}
              </div>
            )}

            {evaluation.idealAnswer && (
              <div className="bg-muted/40 flex flex-col gap-2 rounded-md p-4">
                <SectionLabel>Model solution</SectionLabel>
                <Prompt>{evaluation.idealAnswer}</Prompt>
              </div>
            )}
          </div>
        )}

        {!evaluation && (
          <form onSubmit={handleSubmitAttempt} className="flex flex-col gap-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <Label htmlFor="answer-markdown">Your derivation</Label>
              <div className="flex gap-2">
                <input
                  type="file"
                  accept="image/*"
                  ref={fileInputRef}
                  className="sr-only"
                  onChange={handleImageUpload}
                />
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={imageUploading}
                >
                  <Camera className="size-4" />
                  {imageUploading ? 'Uploading…' : 'Attach diagram'}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={fetchModelSolution}
                  disabled={loadingModelSolution}
                >
                  <Key className="size-4" />
                  {loadingModelSolution ? 'Loading…' : 'Answer key'}
                </Button>
              </div>
            </div>

            <div className="grid gap-4 lg:grid-cols-2">
              <Textarea
                id="answer-markdown"
                rows={14}
                className="resize-y font-mono text-sm"
                placeholder={
                  'Write your derivation, proof or conceptual mechanics here.\n\n' +
                  'LaTeX works: $V^\\pi(s)$ or $$Q(s,a) = R + \\gamma \\mathbb{E}[V(s\')]$$'
                }
                value={answerMarkdown}
                onChange={(e) => setAnswerMarkdown(e.target.value)}
              />

              <div className="bg-muted/40 max-h-100 overflow-y-auto rounded-md border p-4">
                <SectionLabel>Live preview</SectionLabel>
                <div className="mt-2">
                  {answerMarkdown.trim() ? (
                    <Prompt>{answerMarkdown}</Prompt>
                  ) : (
                    <p className="text-muted-foreground text-sm italic">
                      Rendered maths and markdown appear here.
                    </p>
                  )}
                </div>
              </div>
            </div>

            {activeModelSolution && (
              <div className="bg-muted/40 flex flex-col gap-2 rounded-md border p-4">
                <div className="flex items-center justify-between gap-2">
                  <SectionLabel>Reference solution</SectionLabel>
                  <Badge variant="outline" className="font-normal">
                    {activeModelSolution.cached ? 'Cached' : 'Generated'}
                  </Badge>
                </div>
                <Prompt>{activeModelSolution.idealAnswer}</Prompt>
              </div>
            )}

            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={onClose}>
                Cancel
              </Button>
              <Button type="submit" disabled={isSubmittingAttempt || !answerMarkdown.trim()}>
                {isSubmittingAttempt ? 'Evaluating…' : 'Submit for grading'}
              </Button>
            </div>
          </form>
        )}
      </DialogContent>
    </Dialog>
  )
}

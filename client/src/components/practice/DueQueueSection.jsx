import React from 'react'
import { Check, ChevronDown, ChevronRight, PartyPopper, Zap } from 'lucide-react'

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
import { Progress } from '@/components/shadcn/progress'
import { Separator } from '@/components/shadcn/separator'
import { DifficultyBadge, EmptyState, LoadingState, Prompt, TypeBadge } from './bits'
import { cn } from '@/lib/utils'

export default function DueQueueSection({
  dueGroups,
  dueData,
  loading,
  expandedDueGroups,
  toggleDueGroupExpand,
  onStartPractice,
}) {
  const shown = dueData?.topicsShownToday ?? 0
  const done = dueData?.topicsCompletedToday ?? 0
  const percent = shown ? Math.min(100, Math.round((done / shown) * 100)) : 100

  return (
    <div className="flex flex-col gap-6">
      <Card>
        <CardHeader>
          <CardTitle>Today&apos;s queue</CardTitle>
          <CardDescription>
            {dueData?.targetMet
              ? "Today's topic areas are cleared. Extra reps below are optional."
              : `${dueData?.reviewTopicsPerDay ?? 1} review + ${dueData?.newTopicsPerDay ?? 1} new topic, ${dueData?.completedToday || 0} questions done so far.`}
          </CardDescription>
          <CardAction>
            {dueData?.targetMet ? (
              <Badge className="gap-1">
                <Check className="size-3" />
                Target met
              </Badge>
            ) : (
              <Badge variant="outline" className="tabular-nums">
                {done} / {shown} topics
              </Badge>
            )}
          </CardAction>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <Progress value={percent} />

          {dueData &&
            (dueData.totalDueBacklog > dueData.dueCount ||
              dueData.queuedNewTopicsCount > 0 ||
              dueData.queuedReviewTopicsCount > 0) && (
              <div className="text-muted-foreground flex flex-wrap items-center justify-between gap-2 rounded-lg border px-3 py-2 text-xs">
                <span>
                  <strong className="text-foreground">Pacing:</strong> {dueData.topicsShownToday} topic
                  area{dueData.topicsShownToday === 1 ? '' : 's'} today, {dueData.dueCount} question
                  {dueData.dueCount === 1 ? '' : 's'}.
                  {(dueData.queuedReviewTopicsCount > 0 || dueData.queuedNewTopicsCount > 0) &&
                    ` ${[
                      dueData.queuedReviewTopicsCount > 0
                        ? `${dueData.queuedReviewTopicsCount} review`
                        : null,
                      dueData.queuedNewTopicsCount > 0 ? `${dueData.queuedNewTopicsCount} new` : null,
                    ]
                      .filter(Boolean)
                      .join(' + ')} queued for later days.`}
                </span>
                <span className="text-foreground font-medium">
                  Bank total: {dueData.totalBankCount} cards
                </span>
              </div>
            )}
        </CardContent>
      </Card>

      {loading ? (
        <LoadingState>Loading your spaced repetition queue…</LoadingState>
      ) : !dueGroups || dueGroups.length === 0 ? (
        <EmptyState icon={PartyPopper} title="Queue clear">
          Nothing is due today. Browse the study bank or practise free recall.
        </EmptyState>
      ) : (
        dueGroups.map((group) => {
          const isExpanded = expandedDueGroups[group.itemId] !== false
          const groupCompleted = group.completedTodayCount === group.dueCount

          return (
            <Card key={group.itemId} className="gap-0 overflow-hidden py-0">
              <button
                type="button"
                onClick={() => toggleDueGroupExpand(group.itemId)}
                className="hover:bg-accent/40 flex w-full items-center justify-between gap-3 px-5 py-4 text-left transition-colors"
              >
                <div className="flex flex-wrap items-center gap-2">
                  {isExpanded ? (
                    <ChevronDown className="text-muted-foreground size-4" />
                  ) : (
                    <ChevronRight className="text-muted-foreground size-4" />
                  )}
                  <TypeBadge type={group.itemType} />
                  <Badge variant="secondary" className="font-normal">
                    {group.isReview ? 'Review' : 'New ladder'}
                  </Badge>
                  <span className="font-semibold">{group.itemTitle}</span>
                </div>
                <span
                  className={cn(
                    'shrink-0 text-sm tabular-nums',
                    groupCompleted ? 'font-medium text-emerald-600' : 'text-muted-foreground'
                  )}
                >
                  {group.completedTodayCount} / {group.dueCount}
                </span>
              </button>

              {isExpanded && (
                <>
                  <Separator />
                  <div className="flex flex-col gap-4 p-5">
                    {group.questions.map((q, idx) => (
                      <div
                        key={q.id}
                        className={cn(
                          'flex flex-col gap-3 rounded-lg border p-4',
                          q.completedToday && 'bg-muted/40'
                        )}
                      >
                        <div className="flex flex-wrap items-center gap-2">
                          <Badge variant="outline" className="tabular-nums">
                            #{idx + 1}
                          </Badge>
                          <DifficultyBadge difficulty={q.difficulty} />
                          {q.fsrs?.repetitions > 0 && (
                            <Badge variant="outline" className="font-normal">
                              R {Math.round(q.fsrs.retrievability * 100)}% · stability{' '}
                              {q.fsrs.stability}d
                            </Badge>
                          )}
                          {q.completedToday && (
                            <Badge className="gap-1">
                              <Check className="size-3" />
                              Done today
                            </Badge>
                          )}
                        </div>

                        <Prompt>{q.prompt}</Prompt>

                        <Button size="sm" className="self-start" onClick={() => onStartPractice(q)}>
                          <Zap className="size-4" />
                          Start active recall
                        </Button>
                      </div>
                    ))}
                  </div>
                </>
              )}
            </Card>
          )
        })
      )}
    </div>
  )
}

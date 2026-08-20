import React from 'react'
import { ChartNoAxesColumn, Zap } from 'lucide-react'

import { Badge } from '@/components/shadcn/badge'
import { Button } from '@/components/shadcn/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/shadcn/card'
import { Progress } from '@/components/shadcn/progress'
import { DifficultyBadge, EmptyState, LoadingState, Prompt, TypeBadge } from './bits'

function StatCard({ label, value, unit }) {
  return (
    <Card className="gap-1 py-4">
      <CardHeader className="px-4">
        <CardDescription>{label}</CardDescription>
        <CardTitle className="text-3xl font-semibold tabular-nums">
          {value}
          {unit && <span className="text-muted-foreground ml-1 text-sm font-normal">{unit}</span>}
        </CardTitle>
      </CardHeader>
    </Card>
  )
}

export default function PerformanceSection({
  performanceData,
  loading,
  allQuestions,
  onStartPractice,
}) {
  if (loading && !performanceData) {
    return <LoadingState>Loading FSRS analytics…</LoadingState>
  }

  if (!performanceData) {
    return (
      <EmptyState icon={ChartNoAxesColumn} title="No performance data yet">
        Complete a recall session to start building a mastery trajectory.
      </EmptyState>
    )
  }

  const { summary, topics, questions } = performanceData

  return (
    <div className="flex flex-col gap-6">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Active cards" value={summary.totalQuestions} />
        <StatCard label="Mean score" value={summary.overallAverageScore} unit="/ 10" />
        <StatCard label="Avg stability" value={summary.averageStabilityDays} unit="days" />
        <StatCard label="Attempts logged" value={summary.totalAttempts} />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Topic mastery</CardTitle>
          <CardDescription>Share of each topic&apos;s questions at mastered level.</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          {topics.map((t) => (
            <div key={t.itemId} className="flex flex-col gap-2">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <TypeBadge type={t.type} />
                  <span className="text-sm font-medium">{t.title}</span>
                </div>
                <div className="text-muted-foreground flex items-center gap-3 text-xs tabular-nums">
                  <span>
                    Avg <strong className="text-foreground">{t.averageScore}/10</strong>
                  </span>
                  <span>
                    Mastered{' '}
                    <strong className="text-foreground">
                      {t.masteredCount}/{t.questionCount}
                    </strong>
                  </span>
                  <span className="text-foreground font-semibold">{t.masteryRate}%</span>
                </div>
              </div>
              <Progress value={t.masteryRate} className="h-1.5" />
            </div>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Stability &amp; retention</CardTitle>
          <CardDescription>Per-question FSRS state.</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          {questions.map((q) => {
            const fullQ = allQuestions.find((orig) => orig.id === q.questionId) || q
            return (
              <div key={q.questionId} className="flex flex-col gap-2 rounded-lg border p-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <DifficultyBadge difficulty={q.difficulty} />
                    <TypeBadge type={q.itemType}>{q.itemTitle}</TypeBadge>
                    <Badge variant={q.statusTier === 'Mastered' ? 'default' : 'outline'}>
                      {q.statusTier}
                    </Badge>
                  </div>
                  <div className="text-muted-foreground flex flex-wrap items-center gap-3 text-xs tabular-nums">
                    <span>
                      Attempts <strong className="text-foreground">{q.totalAttempts}</strong>
                    </span>
                    <span>
                      Avg <strong className="text-foreground">{q.averageScore}/10</strong>
                    </span>
                    <span>
                      Stability <strong className="text-foreground">{q.fsrs.stability}d</strong>
                    </span>
                    <span>
                      Due <strong className="text-foreground">{q.fsrs.dueDate || 'today'}</strong>
                    </span>
                  </div>
                </div>

                <Prompt className="text-xs">{q.prompt}</Prompt>

                <Button
                  size="sm"
                  variant="secondary"
                  className="self-end"
                  onClick={() => onStartPractice(fullQ)}
                >
                  <Zap className="size-3" />
                  Practise
                </Button>
              </div>
            )
          })}
        </CardContent>
      </Card>
    </div>
  )
}

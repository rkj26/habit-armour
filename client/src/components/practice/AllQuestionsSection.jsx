import React from 'react'
import { SearchX, Zap } from 'lucide-react'

import { Badge } from '@/components/shadcn/badge'
import { Button } from '@/components/shadcn/button'
import { Card, CardContent, CardHeader } from '@/components/shadcn/card'
import { Input } from '@/components/shadcn/input'
import { ToggleGroup, ToggleGroupItem } from '@/components/shadcn/toggle-group'
import { DifficultyBadge, EmptyState, LoadingState, Prompt, TypeBadge } from './bits'

const LEVELS = ['easy', 'medium', 'hard']

export default function AllQuestionsSection({
  allQuestions,
  loading,
  questionFilter,
  setQuestionFilter,
  searchQuery,
  setSearchQuery,
  onStartPractice,
}) {
  const countAt = (level) =>
    allQuestions.filter((q) => q.difficulty.toLowerCase() === level).length

  const filteredQuestions = allQuestions.filter((q) => {
    if (questionFilter !== 'all' && q.difficulty.toLowerCase() !== questionFilter) return false
    if (searchQuery.trim()) {
      const text = searchQuery.toLowerCase()
      return (
        (q.prompt || '').toLowerCase().includes(text) ||
        (q.itemTitle || '').toLowerCase().includes(text)
      )
    }
    return true
  })

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <ToggleGroup
          type="single"
          variant="outline"
          value={questionFilter}
          onValueChange={(v) => v && setQuestionFilter(v)}
        >
          <ToggleGroupItem value="all" className="px-4">
            All ({allQuestions.length})
          </ToggleGroupItem>
          {LEVELS.map((level) => (
            <ToggleGroupItem key={level} value={level} className="px-4 capitalize">
              {level} ({countAt(level)})
            </ToggleGroupItem>
          ))}
        </ToggleGroup>

        <Input
          className="max-w-xs"
          type="search"
          placeholder="Search questions or equations…"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
        />
      </div>

      {loading ? (
        <LoadingState>Loading question bank…</LoadingState>
      ) : filteredQuestions.length === 0 ? (
        <EmptyState icon={SearchX} title="No questions found">
          Nothing matches the current filter or search.
        </EmptyState>
      ) : (
        <div className="grid gap-4 xl:grid-cols-2">
          {filteredQuestions.map((q) => (
            <Card key={q.id}>
              <CardHeader>
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <DifficultyBadge difficulty={q.difficulty} />
                    <TypeBadge type={q.itemType}>{q.itemTitle}</TypeBadge>
                    {q.hasModelSolution && (
                      <Badge variant="outline" className="font-normal">
                        Key saved
                      </Badge>
                    )}
                  </div>
                  <span className="text-muted-foreground text-xs">
                    Due {q.fsrs?.dueDate || q.sm2?.dueDate || 'today'}
                  </span>
                </div>
              </CardHeader>
              <CardContent className="flex flex-col gap-4">
                <Prompt>{q.prompt}</Prompt>
                <Button size="sm" className="self-start" onClick={() => onStartPractice(q)}>
                  <Zap className="size-4" />
                  Practise now
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}

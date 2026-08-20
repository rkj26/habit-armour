import React from 'react'
import {
  ChevronDown,
  ChevronRight,
  ExternalLink,
  FolderOpen,
  History,
  Pencil,
  Plus,
  Trash2,
  Zap,
} from 'lucide-react'

import { Badge } from '@/components/shadcn/badge'
import { Button } from '@/components/shadcn/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/shadcn/card'
import { Input } from '@/components/shadcn/input'
import { Separator } from '@/components/shadcn/separator'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/shadcn/tooltip'
import { ToggleGroup, ToggleGroupItem } from '@/components/shadcn/toggle-group'
import { DifficultyBadge, EmptyState, LoadingState, Prompt, TypeBadge } from './bits'

function IconAction({ label, icon: Icon, onClick }) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button variant="ghost" size="icon" onClick={onClick} aria-label={label}>
          <Icon className="size-4" />
        </Button>
      </TooltipTrigger>
      <TooltipContent>{label}</TooltipContent>
    </Tooltip>
  )
}

export default function TopicBankSection({
  items,
  allQuestions,
  loading,
  bankFilter,
  setBankFilter,
  searchQuery,
  setSearchQuery,
  expandedItems,
  toggleItemExpand,
  onAddQuestion,
  onViewHistory,
  onEditItem,
  onDeleteItem,
  onStartPractice,
}) {
  const filteredItems = items.filter((item) => {
    if (bankFilter !== 'all' && item.type !== bankFilter) return false
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase()
      return (
        item.title.toLowerCase().includes(q) ||
        (item.notes || '').toLowerCase().includes(q) ||
        (item.tags || []).some((t) => t.toLowerCase().includes(q)) ||
        Boolean(item.paper?.arxivId?.toLowerCase().includes(q))
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
          value={bankFilter}
          onValueChange={(v) => v && setBankFilter(v)}
        >
          <ToggleGroupItem value="all" className="px-4">
            All ({items.length})
          </ToggleGroupItem>
          <ToggleGroupItem value="topic" className="px-4">
            Topics ({items.filter((i) => i.type === 'topic').length})
          </ToggleGroupItem>
          <ToggleGroupItem value="paper" className="px-4">
            Papers ({items.filter((i) => i.type === 'paper').length})
          </ToggleGroupItem>
        </ToggleGroup>

        <Input
          className="max-w-xs"
          type="search"
          placeholder="Search topics, tags, algorithms…"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
        />
      </div>

      {loading ? (
        <LoadingState>Loading study bank…</LoadingState>
      ) : filteredItems.length === 0 ? (
        <EmptyState icon={FolderOpen} title="No topics found">
          Nothing matches the current filter or search.
        </EmptyState>
      ) : (
        <div className="grid gap-4 xl:grid-cols-2">
          {filteredItems.map((item) => {
            const itemQuestions = allQuestions
              .filter((q) => q.itemId === item.id)
              .sort((a, b) => (a.order || 0) - (b.order || 0))
            const isExpanded = Boolean(expandedItems[item.id])

            return (
              <Card key={item.id}>
                <CardHeader>
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex flex-col gap-2">
                      <TypeBadge type={item.type} />
                      <CardTitle>{item.title}</CardTitle>
                    </div>
                    <div className="flex shrink-0">
                      <IconAction label="Add question" icon={Plus} onClick={() => onAddQuestion(item)} />
                      <IconAction
                        label="Attempt history"
                        icon={History}
                        onClick={() => onViewHistory(item)}
                      />
                      <IconAction label="Edit" icon={Pencil} onClick={() => onEditItem(item)} />
                      <IconAction label="Delete" icon={Trash2} onClick={() => onDeleteItem(item.id)} />
                    </div>
                  </div>
                </CardHeader>

                <CardContent className="flex flex-col gap-3">
                  {item.notes && <p className="text-muted-foreground text-sm">{item.notes}</p>}

                  {item.paper && (
                    <div className="text-muted-foreground flex flex-col gap-1 rounded-lg border p-3 text-xs">
                      {item.paper.arxivId && (
                        <span>
                          arXiv <strong className="text-foreground">{item.paper.arxivId}</strong>
                        </span>
                      )}
                      {item.paper.authors?.length > 0 && (
                        <span>
                          {item.paper.authors.join(', ')} ({item.paper.year})
                        </span>
                      )}
                      {item.paper.url && (
                        <a
                          href={item.paper.url}
                          target="_blank"
                          rel="noreferrer"
                          className="text-foreground inline-flex items-center gap-1 underline underline-offset-2"
                        >
                          <ExternalLink className="size-3" />
                          Open paper
                        </a>
                      )}
                    </div>
                  )}

                  {item.tags?.length > 0 && (
                    <div className="flex flex-wrap gap-1.5">
                      {item.tags.map((t) => (
                        <Badge key={t} variant="secondary" className="font-normal">
                          {t}
                        </Badge>
                      ))}
                    </div>
                  )}

                  <Separator />

                  <Button
                    variant="ghost"
                    size="sm"
                    className="justify-start px-0 hover:bg-transparent"
                    onClick={() => toggleItemExpand(item.id)}
                  >
                    {isExpanded ? (
                      <ChevronDown className="size-4" />
                    ) : (
                      <ChevronRight className="size-4" />
                    )}
                    Questions ({itemQuestions.length})
                  </Button>

                  {isExpanded && (
                    <div className="flex flex-col gap-2">
                      {itemQuestions.length === 0 ? (
                        <p className="text-muted-foreground text-xs italic">
                          No questions yet — use the + button above.
                        </p>
                      ) : (
                        itemQuestions.map((q, qIdx) => (
                          <div key={q.id} className="flex flex-col gap-2 rounded-lg border p-3">
                            <div className="flex flex-wrap items-center justify-between gap-2">
                              <div className="flex flex-wrap items-center gap-1.5">
                                <Badge variant="outline" className="tabular-nums">
                                  #{qIdx + 1}
                                </Badge>
                                <DifficultyBadge difficulty={q.difficulty} />
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

                            <Prompt className="text-xs">{q.prompt}</Prompt>

                            <Button
                              size="sm"
                              variant="secondary"
                              className="self-end"
                              onClick={() => onStartPractice(q)}
                            >
                              <Zap className="size-3" />
                              Practise
                            </Button>
                          </div>
                        ))
                      )}
                    </div>
                  )}
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}
    </div>
  )
}

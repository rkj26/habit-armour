import React from 'react'
import { Brain, FileText } from 'lucide-react'

import { Badge } from '@/components/shadcn/badge'
import { Card, CardContent } from '@/components/shadcn/card'
import { Progress } from '@/components/shadcn/progress'
import { renderMarkdown } from '../../utils/renderMarkdown'
import { cn } from '@/lib/utils'

/** Shared across the four practice sections so a topic looks the same everywhere. */
export function TypeBadge({ type, children }) {
  const Icon = type === 'paper' ? FileText : Brain
  return (
    <Badge variant="outline" className="gap-1">
      <Icon className="size-3" />
      {children ?? (type === 'paper' ? 'Paper' : 'Topic')}
    </Badge>
  )
}

export function DifficultyBadge({ difficulty }) {
  return (
    <Badge variant="secondary" className="font-normal">
      {difficulty}
    </Badge>
  )
}

export function EmptyState({ icon: Icon, title, children }) {
  return (
    <Card>
      <CardContent className="flex flex-col items-center gap-2 py-14 text-center">
        {Icon && <Icon className="text-muted-foreground size-8" />}
        <p className="font-medium">{title}</p>
        {children && <p className="text-muted-foreground max-w-md text-sm">{children}</p>}
      </CardContent>
    </Card>
  )
}

export function LoadingState({ children }) {
  return <p className="text-muted-foreground py-14 text-center text-sm">{children}</p>
}

/** KaTeX-rendered markdown. `markdown-rendered` is what renderMarkdown's CSS hooks onto. */
export function Prompt({ children, className }) {
  return <div className={cn('markdown-rendered text-sm leading-relaxed', className)}>{renderMarkdown(children)}</div>
}

export function MasteryBar({ value }) {
  return <Progress value={value} className="h-1.5" />
}

import React, { useEffect, useState } from 'react'
import { Shield, ShieldAlert } from 'lucide-react'

import { Badge } from '@/components/shadcn/badge'
import { Separator } from '@/components/shadcn/separator'
import { SidebarTrigger } from '@/components/shadcn/sidebar'
import ModeToggle from './ModeToggle'
import { navTitle } from '@/nav'

export default function SiteHeader({ activeTab, status }) {
  const [timeStr, setTimeStr] = useState('')

  useEffect(() => {
    const tick = () =>
      setTimeStr(new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }))
    tick()
    const id = setInterval(tick, 1000)
    return () => clearInterval(id)
  }, [])

  const lockCount = status.lockCount || (status.locked ? 1 : 0)

  return (
    <header className="bg-background/95 supports-[backdrop-filter]:bg-background/60 sticky top-0 z-10 flex h-16 shrink-0 items-center gap-2 border-b backdrop-blur">
      <div className="flex w-full items-center gap-1 px-4 lg:gap-2 lg:px-6">
        <SidebarTrigger className="-ml-1 md:hidden" />
        <Separator
          orientation="vertical"
          className="mx-2 data-[orientation=vertical]:h-4 md:hidden"
        />
        <h1 className="truncate text-base font-medium">{navTitle(activeTab)}</h1>

        <div className="ml-auto flex items-center gap-2">
          <span className="text-muted-foreground hidden font-mono text-sm tabular-nums sm:inline">
            {timeStr}
          </span>
          {status.locked ? (
            <Badge variant="destructive" className="gap-1.5">
              <ShieldAlert className="size-3" />
              {lockCount > 1 ? `${lockCount} breaches` : 'Locked'}
            </Badge>
          ) : (
            <Badge variant="outline" className="gap-1.5">
              <Shield className="size-3" />
              Protected
            </Badge>
          )}
          <ModeToggle />
        </div>
      </div>
    </header>
  )
}
